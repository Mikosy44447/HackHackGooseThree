import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase/client";
import { upsertBillAnalysis } from "@/lib/supabase/bill-analysis-store";
import { upsertBillAudiences } from "@/lib/supabase/bill-audiences-store";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type IngestBillInput = {
  id: string;
  title: string;
  summary: string;
  status: string;
  topics: string[];
  affectedGroups: string[];
  pattern: string;
  relatedBillIds: string[];
  officialSourceLabel: string;
  officialSourceUrl: string;
};

type BillAnalysisToolOutput = {
  whyItMattersGeneral: string;
  broaderPattern: string;
  hotTake: string;
};

type BillAudienceToolOutput = {
  audiences: Array<{
    audienceLabelRaw: string;
    audienceRationale: string;
    whyItMatters: string;
    confidence: number;
    normalizedAudienceKey?: string | null;
  }>;
};

function validateBillInput(input: IngestBillInput) {
  if (!input.id?.trim()) throw new Error("Bill id is required");
  if (!input.title?.trim()) throw new Error("Bill title is required");
  if (!input.summary?.trim()) throw new Error("Bill summary is required");
  if (!input.status?.trim()) throw new Error("Bill status is required");
  if (!input.pattern?.trim()) throw new Error("Bill pattern is required");
  if (!input.officialSourceLabel?.trim()) {
    throw new Error("officialSourceLabel is required");
  }
  if (!input.officialSourceUrl?.trim()) {
    throw new Error("officialSourceUrl is required");
  }
  if (!Array.isArray(input.topics)) throw new Error("topics must be an array");
  if (!Array.isArray(input.affectedGroups)) {
    throw new Error("affectedGroups must be an array");
  }
  if (!Array.isArray(input.relatedBillIds)) {
    throw new Error("relatedBillIds must be an array");
  }
}

async function upsertBill(input: IngestBillInput) {
  const { data, error } = await supabase
    .from("bills")
    .upsert(
      {
        id: input.id,
        title: input.title,
        summary: input.summary,
        status: input.status,
        topics: input.topics,
        affected_groups: input.affectedGroups,
        pattern: input.pattern,
        related_bill_ids: input.relatedBillIds,
        official_source_label: input.officialSourceLabel,
        official_source_url: input.officialSourceUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function generateBillAnalysis(input: IngestBillInput) {
  const prompt = `
You are generating reusable bill-level analysis for a civic-tech app called HarnoldAlert.

Return structured output with exactly these fields:
- whyItMattersGeneral
- broaderPattern
- hotTake

Rules:
- whyItMattersGeneral: 2-4 sentences, broad and reusable across users
- broaderPattern: 2-4 sentences about the wider legislative or policy trend
- hotTake: 1-3 sentences, playful but informative, in Harnold's voice
- Do not invent facts beyond the bill data provided
- Keep the output concise and readable
- No markdown

Bill:
${JSON.stringify(input, null, 2)}
  `.trim();

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 700,
    tools: [
      {
        name: "return_bill_analysis",
        description: "Return cached bill-level analysis for the UI.",
        input_schema: {
          type: "object",
          properties: {
            whyItMattersGeneral: { type: "string" },
            broaderPattern: { type: "string" },
            hotTake: { type: "string" },
          },
          required: ["whyItMattersGeneral", "broaderPattern", "hotTake"],
        },
      },
    ],
    tool_choice: {
      type: "tool",
      name: "return_bill_analysis",
    },
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const toolBlock = message.content.find(
    (block: any) =>
      block.type === "tool_use" && block.name === "return_bill_analysis"
  ) as any;

  if (!toolBlock?.input) {
    throw new Error("Model did not return structured bill analysis");
  }

  const inputData = toolBlock.input as BillAnalysisToolOutput;

  if (
    typeof inputData.whyItMattersGeneral !== "string" ||
    typeof inputData.broaderPattern !== "string" ||
    typeof inputData.hotTake !== "string"
  ) {
    throw new Error("Structured bill analysis was incomplete");
  }

  return {
    whyItMattersGeneral: inputData.whyItMattersGeneral.trim(),
    broaderPattern: inputData.broaderPattern.trim(),
    hotTake: inputData.hotTake.trim(),
  };
}

async function generateBillAudiences(input: IngestBillInput) {
  const prompt = `
You are generating reusable audience-specific bill explainers for a civic-tech app called HarnoldAlert.

For this bill, identify 3 to 6 audiences who may be meaningfully affected.

Important:
- Use flexible, natural audience descriptions.
- Do NOT force every audience into a rigid taxonomy.
- If a normalized audience key is obvious, include one.
- If not obvious, leave normalizedAudienceKey empty.
- Keep the rationale concise and factual.
- Keep whyItMatters concise, readable, and useful for that audience.
- Do not invent facts beyond the bill data.

Return a tool payload with:
- audiences: an array of audience objects

Each audience object must include:
- audienceLabelRaw
- audienceRationale
- whyItMatters
- confidence
- normalizedAudienceKey

Confidence should be a number from 0.0 to 1.0.

Bill:
${JSON.stringify(input, null, 2)}
  `.trim();

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1400,
    tools: [
      {
        name: "return_bill_audiences",
        description:
          "Return free-form affected audiences and cached explainers for a bill.",
        input_schema: {
          type: "object",
          properties: {
            audiences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  audienceLabelRaw: { type: "string" },
                  audienceRationale: { type: "string" },
                  whyItMatters: { type: "string" },
                  confidence: { type: "number" },
                  normalizedAudienceKey: { type: "string" },
                },
                required: [
                  "audienceLabelRaw",
                  "audienceRationale",
                  "whyItMatters",
                  "confidence",
                  "normalizedAudienceKey",
                ],
              },
            },
          },
          required: ["audiences"],
        },
      },
    ],
    tool_choice: {
      type: "tool",
      name: "return_bill_audiences",
    },
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const toolBlock = message.content.find(
    (block: any) =>
      block.type === "tool_use" && block.name === "return_bill_audiences"
  ) as any;

  if (!toolBlock?.input?.audiences || !Array.isArray(toolBlock.input.audiences)) {
    throw new Error("Model did not return structured audience output");
  }

  const cleaned = (toolBlock.input as BillAudienceToolOutput).audiences
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      audienceLabelRaw: String(item.audienceLabelRaw ?? "").trim(),
      audienceRationale: String(item.audienceRationale ?? "").trim(),
      whyItMatters: String(item.whyItMatters ?? "").trim(),
      confidence: Number(item.confidence ?? 0),
      normalizedAudienceKey:
        String(item.normalizedAudienceKey ?? "").trim() || null,
    }))
    .filter(
      (item) =>
        item.audienceLabelRaw &&
        item.audienceRationale &&
        item.whyItMatters
    )
    .slice(0, 6);

  if (!cleaned.length) {
    throw new Error("No usable audiences were returned");
  }

  return cleaned;
}

export async function ingestSingleBill(input: IngestBillInput) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in .env.local");
  }

  validateBillInput(input);

  const savedBill = await upsertBill(input);
  const analysis = await generateBillAnalysis(input);
  const audiences = await generateBillAudiences(input);

  const savedAnalysis = await upsertBillAnalysis({
    billId: input.id,
    whyItMattersGeneral: analysis.whyItMattersGeneral,
    broaderPattern: analysis.broaderPattern,
    hotTake: analysis.hotTake,
    analysisVersion: "v1",
    model: "claude-haiku-4-5",
  });

  const savedAudiences = await upsertBillAudiences(input.id, audiences);

  return {
    bill: savedBill,
    analysis: savedAnalysis,
    audiences: savedAudiences,
  };
}