/**
 * Fixed column mapping and reference data for the NDIS Excel import, per
 * ndis_excel_import_logic.sql (the authoritative "complete specification"
 * the brief points to — this takes precedence over the summarized table
 * in the assessment PDF where the two differ, e.g. attribute columns).
 */

// Zero-based column indices (A=0, B=1, ... Z=25, AA=26, AB=27)
export const COL = {
  ITEM_NUMBER: 0,       // A
  ITEM_NAME: 1,         // B
  CATEGORY_NUMBER: 5,   // F
  CATEGORY_NAME: 7,     // H
  UNIT: 8,              // I
  IS_QUOTE_REQUIRED: 9, // J
  START_DATE: 10,       // K
  END_DATE: 11,         // L
  // M–V: pricing region unit prices (fixed 10-region mapping, see PRICING_REGIONS below)
  IS_NF2F_SUPPORT_PROVISION: 22, // W
  IS_PROVIDER_TRAVEL: 23,        // X
  IS_SHORT_NOTICE_CANCEL: 24,    // Y
  IS_NDIA_REQUESTED_REPORTS: 25, // Z
  IS_IRREGULAR_SIL_SUPPORTS: 26, // AA
  TYPE: 27,                      // AB
} as const;

// Fixed region code -> [column index, label, full_label] per §9.5.4.
export const PRICING_REGIONS: Array<{ col: number; code: string; label: string; fullLabel: string }> = [
  { col: 12, code: 'ACT', label: 'ACT', fullLabel: 'Australian Capital Territory' },
  { col: 13, code: 'NSW', label: 'NSW', fullLabel: 'New South Wales' },
  { col: 14, code: 'NT', label: 'NT', fullLabel: 'Northern Territory' },
  { col: 15, code: 'QLD', label: 'QLD', fullLabel: 'Queensland' },
  { col: 16, code: 'SA', label: 'SA', fullLabel: 'South Australia' },
  { col: 17, code: 'TAS', label: 'TAS', fullLabel: 'Tasmania' },
  { col: 18, code: 'VIC', label: 'VIC', fullLabel: 'Victoria' },
  { col: 19, code: 'WA', label: 'WA', fullLabel: 'Western Australia' },
  { col: 20, code: 'REMOTE', label: 'Remote', fullLabel: 'Remote' },
  { col: 21, code: 'VERY_REMOTE', label: 'Very Remote', fullLabel: 'Very Remote' },
];

// Attribute column -> code, per ndis_excel_import_logic.sql (6 attributes total —
// note this file includes IS_IRREGULAR_SIL_SUPPORTS (col AA), which the summarized
// PDF table omits; the .sql file says it's the complete spec, so it wins).
export const ATTRIBUTE_COLUMNS: Array<{ col: number; code: string }> = [
  { col: COL.IS_QUOTE_REQUIRED, code: 'IS_QUOTE_REQUIRED' },
  { col: COL.IS_NF2F_SUPPORT_PROVISION, code: 'IS_NF2F_SUPPORT_PROVISION' },
  { col: COL.IS_PROVIDER_TRAVEL, code: 'IS_PROVIDER_TRAVEL' },
  { col: COL.IS_SHORT_NOTICE_CANCEL, code: 'IS_SHORT_NOTICE_CANCEL' },
  { col: COL.IS_NDIA_REQUESTED_REPORTS, code: 'IS_NDIA_REQUESTED_REPORTS' },
  { col: COL.IS_IRREGULAR_SIL_SUPPORTS, code: 'IS_IRREGULAR_SIL_SUPPORTS' },
];

export function toCode(rawLabel: string): string {
  return rawLabel.trim().toUpperCase().replace(/\s+/g, '_');
}

export function parseYesNo(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  return /^y(es)?$/i.test(raw.trim());
}