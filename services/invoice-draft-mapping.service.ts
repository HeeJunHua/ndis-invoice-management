/**
 * Maps AI-extracted invoice data to a draft invoice, per §11.4's exact
 * participant/provider/rate-set/support-item mapping rules.
 * TODO: this is the least-tested piece of the whole project — only
 * validated conceptually against the spec, never run against a real
 * extraction result yet. Test with 01_Invoice_Sample.pdf / 02_Invoice_Sample.pdf
 * before considering this done.
 */
import { db } from '@/db';
import clientRepository from '@/repositories/client.repository';
import providerRepository from '@/repositories/provider.repository';
import rateSetRepository from '@/repositories/rate-set.repository';
import rateSetSupportItemRepository from '@/repositories/rate-set-support-item.repository';
import rateSetSupportItemPriceRepository from '@/repositories/rate-set-support-item-price.repository';
import type { ExtractedInvoice } from './ai-extraction.service';

function tokenize(name: string): string[] {
  return name.toLowerCase().trim().split(/[^a-z0-9]+/).filter(Boolean);
}

function rankByNameParts<T extends { name_parts: string[]; id: number }>(
  candidates: T[],
  tokens: string[],
): T | null {
  if (candidates.length === 0) return null;
  const scored = candidates.map((c) => ({
    c,
    score: tokens.filter((t) => c.name_parts.includes(t)).length,
  }));
  scored.sort((a, b) => b.score - a.score || b.c.id - a.c.id);
  return scored[0].c;
}

const invoiceDraftMappingService = {
  async mapToDraft(extracted: ExtractedInvoice) {
    // ---- Participant mapping ----
    let clientId: number | null = null;
    if (extracted.participant_ndis_number) {
      const matches = await db
        .selectFrom('client')
        .selectAll()
        .where('ndis_number', '=', extracted.participant_ndis_number)
        .where('deleted_at', 'is', null)
        .execute();

      if (matches.length === 1) {
        clientId = matches[0].id;
      } else if (matches.length > 1 && extracted.participant_name) {
        const best = rankByNameParts(matches, tokenize(extracted.participant_name));
        clientId = best?.id ?? null;
      }
    }

    // ---- Provider mapping ----
    let providerId: number | null = null;
    if (extracted.provider_abn) {
      const matches = await db
        .selectFrom('provider')
        .selectAll()
        .where('abn', '=', extracted.provider_abn)
        .where('deleted_at', 'is', null)
        .execute();

      if (matches.length === 1) {
        providerId = matches[0].id;
      } else if (matches.length > 1 && extracted.provider_name) {
        const best = rankByNameParts(matches, tokenize(extracted.provider_name));
        providerId = best?.id ?? null;
      }
    }

    if (!extracted.invoice_number) {
      // Per §11.4: invoice_number is required, cannot create draft when null.
      return null;
    }

    const client = clientId ? await clientRepository.findById(clientId) : null;

    // ---- Per-line-item mapping ----
    const items = [];
    for (const line of extracted.line_items) {
      let rateSetId: number | null = null;
      let categoryId: number | null = null;
      let supportItemId: number | null = null;
      let maxRate: number | null = null;

      if (line.service_start_date && line.service_end_date) {
        const rateSets = await rateSetRepository.findOverlapping(line.service_start_date, line.service_end_date);
        if (rateSets.length === 1) {
          rateSetId = rateSets[0].id;

          if (line.support_item_number) {
            const supportItems = await db
              .selectFrom('rate_set_support_item')
              .selectAll()
              .where('rate_set_id', '=', rateSetId)
              .where('item_number', '=', line.support_item_number)
              .where('deleted_at', 'is', null)
              .execute();

            if (supportItems.length === 1) {
              supportItemId = supportItems[0].id;
              categoryId = supportItems[0].category_id;

              if (client?.pricing_region) {
                const price = await rateSetSupportItemPriceRepository.findBestMatch({
                  rateSetId,
                  supportItemId,
                  pricingRegionCode: client.pricing_region,
                  startDate: line.service_start_date,
                  endDate: line.service_end_date,
                });
                if (price?.unit_price != null) maxRate = Number(price.unit_price);
              }
            }
          }
        }
      }

      const unit = line.unit ? Number(line.unit) : null;
      const inputRate = line.invoiced_rate ? Number(line.invoiced_rate) : null;
      const amount = unit != null && inputRate != null ? Math.round(unit * inputRate * 100) / 100 : null;

      items.push({
        rate_set_id: rateSetId,
        category_id: categoryId,
        support_item_id: supportItemId,
        start_date: line.service_start_date,
        end_date: line.service_end_date,
        max_rate: maxRate,
        unit,
        input_rate: inputRate,
        amount,
      });
    }

    return {
      client_id: clientId,
      provider_id: providerId,
      invoice_number: extracted.invoice_number,
      invoice_date: extracted.invoice_date,
      expected_amount: extracted.stated_invoice_total ? Number(extracted.stated_invoice_total) : null,
      amount: items.length > 0 ? Math.round(items.reduce((s, i) => s + (i.amount ?? 0), 0) * 100) / 100 : null,
      status: 'drafted' as const,
      items,
    };
  },
};
export default invoiceDraftMappingService;