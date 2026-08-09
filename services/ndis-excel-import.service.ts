/**
 * NDIS Excel import engine, per §9.5 and ndis_excel_import_logic.sql.
 * Processes every worksheet in the workbook, upserts categories/items/
 * attributes/prices keyed on business keys (not row order), and soft-deletes
 * categories/support items that existed for this rate_set but are absent
 * from the current file (idempotent re-import).
 */
import * as XLSX from 'xlsx';
import { db } from '@/db';
import rateSetCategoryRepository from '@/repositories/rate-set-category.repository';
import rateSetSupportItemRepository from '@/repositories/rate-set-support-item.repository';
import rateSetSupportItemAttributeTypeRepository from '@/repositories/rate-set-support-item-attribute-type.repository';
import rateSetSupportItemAttributeRepository from '@/repositories/rate-set-support-item-attribute.repository';
import rateSetSupportItemTypeRepository from '@/repositories/rate-set-support-item-type.repository';
import pricingRegionRepository from '@/repositories/pricing-region.repository';
import rateSetSupportItemPriceRepository from '@/repositories/rate-set-support-item-price.repository';
import { COL, PRICING_REGIONS, ATTRIBUTE_COLUMNS, toCode, parseYesNo } from '@/lib/ndis-import-constants';
import { AppError, ErrorCodes } from '@/lib/errors';

interface ParsedRow {
  itemNumber: string;
  itemName: string;
  categoryNumber: string;
  categoryName: string;
  unit: string | null;
  startDate: Date;
  endDate: Date | null;
  typeCode: string | null;
  typeLabel: string | null;
  attributes: Array<{ code: string; value: boolean }>;
  prices: Array<{ regionCode: string; unitPrice: number }>;
}

/** Parses a YYYYMMDD value (e.g. 20250701 or "20250701") into a Date.
 * The NDIS catalogue files store dates this way — not as Excel serial
 * dates or ISO strings — and inconsistently type them as number or string
 * depending on the file/year. '99991231' is used as a "no end date" sentinel
 * and is intentionally stored as a literal year-9999 date (timestamptz can
 * hold this fine; no special-casing needed).
 */
function toDate(raw: unknown): Date | null {
  if (raw instanceof Date) return raw;

  const str = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  if (/^\d{8}$/.test(str)) {
    const year = Number(str.slice(0, 4));
    const month = Number(str.slice(4, 6));
    const day = Number(str.slice(6, 8));
    if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  // Fallback for any unexpected format (shouldn't normally hit this given the files inspected).
  if (str) {
    const parsed = new Date(str);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = Number(raw.replace(/[$,]/g, ''));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Finds the header row within a sheet by locating the row whose column A
 * looks like "Support Item Number" — NDIS pricing files have a few title
 * rows above the real header. Returns the index of the first DATA row.
 */
function findDataStartRow(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const cellA = String(rows[i]?.[COL.ITEM_NUMBER] ?? '').trim().toLowerCase();
    if (cellA.includes('support item number') || cellA.includes('item number')) {
      return i + 1;
    }
  }
  // Fallback: assume no title rows, data starts at row 0.
  return 0;
}

function parseSheet(rows: unknown[][]): ParsedRow[] {
  const startRow = findDataStartRow(rows);
  const parsed: ParsedRow[] = [];

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const itemNumber = String(row[COL.ITEM_NUMBER] ?? '').trim();
    if (!itemNumber) continue; // skip blank/footer rows

    const categoryNumber = String(row[COL.CATEGORY_NUMBER] ?? '').trim();
    const startDate = toDate(row[COL.START_DATE]);
    if (!categoryNumber || !startDate) continue; // required per spec — skip malformed rows

    const typeRaw = String(row[COL.TYPE] ?? '').trim();

    const prices: ParsedRow['prices'] = [];
    for (const region of PRICING_REGIONS) {
      const price = toNumber(row[region.col]);
      if (price !== null) {
        prices.push({ regionCode: region.code, unitPrice: price });
      }
    }

    parsed.push({
      itemNumber,
      itemName: String(row[COL.ITEM_NAME] ?? '').trim(),
      categoryNumber,
      categoryName: String(row[COL.CATEGORY_NAME] ?? '').trim(),
      unit: String(row[COL.UNIT] ?? '').trim() || null,
      startDate,
      endDate: toDate(row[COL.END_DATE]),
      typeCode: typeRaw ? toCode(typeRaw) : null,
      typeLabel: typeRaw || null,
      attributes: ATTRIBUTE_COLUMNS.map((a) => ({
        code: a.code,
        value: parseYesNo(row[a.col]),
      })),
      prices,
    });
  }

  return parsed;
}

const ndisExcelImportService = {
  /**
   * Imports an uploaded NDIS pricing Excel file into the given rate set.
   * Idempotent: re-importing the same file produces no net changes.
   */
  async importForRateSet(rateSetId: number, fileBuffer: Buffer) {
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

    // Process every worksheet, per §9.5 note #3.
    const allRows: ParsedRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
      allRows.push(...parseSheet(rows));
    }

    if (allRows.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'No valid data rows found in the uploaded file.', 400);
    }

    return db.transaction().execute(async (trx) => {
      // ---- 1. Seed the 10 fixed pricing regions (idempotent upsert) ----
      for (const region of PRICING_REGIONS) {
        await pricingRegionRepository.upsert(region.code, region.label, region.fullLabel);
      }

      // ---- 2. Categories: dedupe, sort numerically, assign sorting ----
      const categoryMap = new Map<string, string>(); // number -> name
      for (const row of allRows) {
        if (!categoryMap.has(row.categoryNumber)) {
          categoryMap.set(row.categoryNumber, row.categoryName);
        }
      }
      const sortedCategoryNumbers = [...categoryMap.keys()].sort(
        (a, b) => Number(a) - Number(b),
      );

      const categoryIdByNumber = new Map<string, number>();
      for (let i = 0; i < sortedCategoryNumbers.length; i++) {
        const number = sortedCategoryNumbers[i];
        const category = await rateSetCategoryRepository.upsert({
          rate_set_id: rateSetId,
          category_number: number,
          category_name: categoryMap.get(number)!,
          sorting: i + 1,
        });
        categoryIdByNumber.set(number, category.id);
      }
      await rateSetCategoryRepository.softDeleteMissing(rateSetId, sortedCategoryNumbers);

      // ---- 3. Support items: dedupe by item_number, sorted by appearance ----
      const itemMap = new Map<string, ParsedRow>();
      for (const row of allRows) {
        if (!itemMap.has(row.itemNumber)) {
          itemMap.set(row.itemNumber, row);
        }
      }
      const itemNumbers = [...itemMap.keys()];

      const itemIdByNumber = new Map<string, number>();
      for (let i = 0; i < itemNumbers.length; i++) {
        const row = itemMap.get(itemNumbers[i])!;
        const categoryId = categoryIdByNumber.get(row.categoryNumber);
        if (!categoryId) continue; // shouldn't happen — category always processed first

        const item = await rateSetSupportItemRepository.upsert({
          rate_set_id: rateSetId,
          category_id: categoryId,
          item_number: row.itemNumber,
          item_name: row.itemName,
          unit: row.unit,
          sorting: i + 1,
        });
        itemIdByNumber.set(row.itemNumber, item.id);
      }
      await rateSetSupportItemRepository.softDeleteMissing(rateSetId, itemNumbers);

      // ---- 4. Attribute types (static 6) + per-item attribute values ----
      const attributeTypeLabels: Record<string, string> = {
        IS_QUOTE_REQUIRED: 'Quote',
        IS_NF2F_SUPPORT_PROVISION: 'Non-Face-to-Face Support Provision',
        IS_PROVIDER_TRAVEL: 'Provider Travel',
        IS_SHORT_NOTICE_CANCEL: 'Short Notice Cancellations.',
        IS_NDIA_REQUESTED_REPORTS: 'NDIA Requested Reports',
        IS_IRREGULAR_SIL_SUPPORTS: 'Irregular SIL Supports',
      };
      for (const [code, label] of Object.entries(attributeTypeLabels)) {
        await rateSetSupportItemAttributeTypeRepository.upsert(code, label);
      }

      for (const row of itemMap.values()) {
        const itemId = itemIdByNumber.get(row.itemNumber);
        if (!itemId) continue;
        for (const attr of row.attributes) {
          await rateSetSupportItemAttributeRepository.upsert(itemId, attr.code, attr.value);
        }
      }

      // ---- 5. Support item types (from column AB values seen) ----
      const typeIdByCode = new Map<string, number>();
      const seenTypes = new Map<string, string>();
      for (const row of allRows) {
        if (row.typeCode && row.typeLabel && !seenTypes.has(row.typeCode)) {
          seenTypes.set(row.typeCode, row.typeLabel);
        }
      }
      for (const [code, label] of seenTypes.entries()) {
        const type = await rateSetSupportItemTypeRepository.upsert(code, label);
        typeIdByCode.set(code, type.id);
      }

      // ---- 6. Prices: one row per (item, region) combination present ----
      let priceCount = 0;
      for (const row of allRows) {
        const itemId = itemIdByNumber.get(row.itemNumber);
        if (!itemId) continue;
        const typeId = row.typeCode ? typeIdByCode.get(row.typeCode) ?? null : null;

        for (const price of row.prices) {
          await rateSetSupportItemPriceRepository.upsert({
            rate_set_id: rateSetId,
            support_item_id: itemId,
            type_id: typeId,
            pricing_region_code: price.regionCode,
            unit_price: String(price.unitPrice),
            start_date: row.startDate,
            end_date: row.endDate,
          });
          priceCount++;
        }
      }

      return {
        categoriesProcessed: sortedCategoryNumbers.length,
        itemsProcessed: itemNumbers.length,
        pricesProcessed: priceCount,
      };
    });
  },
};

export default ndisExcelImportService;