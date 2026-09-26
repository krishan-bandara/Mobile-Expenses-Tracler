import { z } from "zod";

/**
 * Server-only. Sends a receipt photo straight to the Gemini API and gets
 * strict, schema-validated JSON back. Never import this from a client
 * component — GEMINI_API_KEY must stay server-side.
 */

const extractionSchema = z.object({
  merchant: z.string().default("Unknown"),
  txn_date: z.string().default(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }),
  total: z.number().nonnegative(),
  tax: z.number().nonnegative().nullable().default(null),
  currency: z.string().default("LKR"),
  line_items: z
    .array(z.object({ name: z.string(), amount: z.number() }))
    .default([]),
  suggested_category: z.string().default("Other"),
  confidence: z.number().min(0).max(1).default(0.5)
});

export type BillExtraction = z.infer<typeof extractionSchema>;

const PROMPT = `You read receipt and bill photos. Extract the merchant, the date
(YYYY-MM-DD, your best reading; use today if illegible), the final total paid,
any VAT/tax line if present, the currency as printed, each line item with its
amount, and the single best-fit category from the list you're given. Set
"confidence" between 0 and 1 for how sure you are of the "total" field
specifically — lower it if the photo was blurry or the total was hard to read.`;

// Gemini's structured-output schema format (a constrained subset of
// OpenAPI 3.0 Schema — note the upper-case type names, that's required).
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    merchant: { type: "STRING" },
    txn_date: { type: "STRING" },
    total: { type: "NUMBER" },
    tax: { type: "NUMBER", nullable: true },
    currency: { type: "STRING" },
    line_items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          amount: { type: "NUMBER" }
        },
        required: ["name", "amount"]
      }
    },
    suggested_category: { type: "STRING" },
    confidence: { type: "NUMBER" }
  },
  required: ["merchant", "txn_date", "total", "currency", "suggested_category", "confidence"]
};

export async function extractBillFromImage(params: {
  imageBase64: string; // data URL or raw base64
  mimeType: string;
  categoryNames: string[];
}): Promise<BillExtraction> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const base64Data = params.imageBase64.includes(",")
    ? params.imageBase64.split(",")[1]
    : params.imageBase64;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Header auth rather than ?key= in the URL, so the secret never
        // ends up in a proxy or access log line.
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `${PROMPT}\n\nCategories to choose from: ${params.categoryNames.join(", ")}` },
              { inline_data: { mime_type: params.mimeType, data: base64Data } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA
        }
      })
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse Gemini's response as JSON.");
  }

  const result = extractionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model response did not match the expected shape: ${result.error.message}`);
  }

  return result.data;
}
