/**
 * PDF invoice data extraction via OpenAI/OpenRouter, per §11.3.
 */
import OpenAI from 'openai';

export interface ExtractedInvoice {
  participant_name: string | null;
  participant_ndis_number: string | null;
  provider_name: string | null;
  provider_abn: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  stated_invoice_total: string | null;
  line_items: Array<{
    unit: string | null;
    invoiced_rate: string | null;
    stated_amount: string | null;
    service_end_date: string | null;
    service_start_date: string | null;
    support_item_number: string | null;
  }>;
}

const PROMPT = `Extract key information from the following NDIS invoice text into structured JSON with exactly this shape:
{
  "participant_name": string or null,
  "participant_ndis_number": string or null,
  "provider_name": string or null,
  "provider_abn": string or null,
  "invoice_number": string or null,
  "invoice_date": "YYYY-MM-DD" or null,
  "stated_invoice_total": string or null,
  "line_items": [{
    "unit": string or null,
    "invoiced_rate": string or null,
    "stated_amount": string or null,
    "service_end_date": "YYYY-MM-DD" or null,
    "service_start_date": "YYYY-MM-DD" or null,
    "support_item_number": string or null
  }]
}
Respond with ONLY the JSON object, no markdown formatting, no explanation. Use null for any field that cannot be determined from the document.

Invoice Text:
`;

function getClientAndModel() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (openRouterKey) {
    return {
      client: new OpenAI({ apiKey: openRouterKey, baseURL: 'https://openrouter.ai/api/v1' }),
      model: 'openai/gpt-4o-mini',
    };
  }

  return {
    client: new OpenAI({ apiKey: openAiKey || 'missing-api-key' }),
    model: 'gpt-4o-mini',
  };
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Polyfill DOMMatrix and import pdfjs dynamically to avoid build-time ReferenceErrors in Node.js
  if (typeof global.DOMMatrix === 'undefined') {
    (global as any).DOMMatrix = class DOMMatrix {
      constructor() {}
      multiply() { return this; }
      fromFloat32Array() { return this; }
      fromFloat64Array() { return this; }
      fromMatrix() { return this; }
    };
  }
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.js';

    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({ data });
    const pdfDocument = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdfDocument.numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      text += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text;
  } catch (error) {
    console.error('ERROR: PDF text extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const aiExtractionService = {
  async extractFromPdf(pdfBuffer: Buffer): Promise<{ result: ExtractedInvoice; usage: OpenAI.CompletionUsage | undefined; model: string }> {
    const { client, model } = getClientAndModel();

    const text = await extractTextFromPdf(pdfBuffer);

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: PROMPT + text,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const cleaned = raw.replace(/^```json\s*|```$/g, '').trim();

    let result: ExtractedInvoice;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = {
        participant_name: null,
        participant_ndis_number: null,
        provider_name: null,
        provider_abn: null,
        invoice_number: null,
        invoice_date: null,
        stated_invoice_total: null,
        line_items: [],
      };
    }

    return { result, usage: response.usage, model };
  },
};

export default aiExtractionService;
