import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllBills } from "@/lib/supabase/bills-store";
import {
  deleteBillAudiencesByBillId,
  upsertBillAudiences,
} from "@/lib/supabase/bill-audiences-store";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type AudienceOutput = {
  audienceLabelRaw: string;
  audienceRationale: string;
  whyItMatters: string;
  confidence: number;
  normalizedAudienceKey?: string | null;
};

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const force = Boolean(body?.force);

    const bills = await getAllBills();

    if (!bills.length) {
      return NextResponse.json({
        ok: true,
        message: "No bills found to analyze for audiences.",
        processed: 0,
      });
    }

    let created = 0;
    const errors: Array<{ billId: string; error: string }> = [];

    for (const bill of bills) {
      try {
        if (force) {
          await deleteBillAudiencesByBillId(bill.id);
        }

        const prompt = `
You are generating reusable audience-specific bill explainers for a civic-tech app called PoliticAlert.

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
${JSON.stringify(bill, null, 2)}
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
          throw new Error("Model did not return structured audience output.");
        }

        const cleaned: AudienceOutput[] = toolBlock.input.audiences
          .filter((item: any) => item && typeof item === "object")
          .map((item: any) => ({
            audienceLabelRaw: String(item.audienceLabelRaw ?? "").trim(),
            audienceRationale: String(item.audienceRationale ?? "").trim(),
            whyItMatters: String(item.whyItMatters ?? "").trim(),
            confidence: Number(item.confidence ?? 0),
            normalizedAudienceKey: String(item.normalizedAudienceKey ?? "").trim() || null,
          }))
          .filter(
            (item: { audienceLabelRaw: string; audienceRationale: string; whyItMatters: string; confidence: number; normalizedAudienceKey: string | null }) =>
              item.audienceLabelRaw &&
              item.audienceRationale &&
              item.whyItMatters
          )
          .slice(0, 6);

        if (!cleaned.length) {
          throw new Error("No usable audiences were returned.");
        }

        await upsertBillAudiences(bill.id, cleaned);
        created += cleaned.length;
      } catch (error: any) {
        console.error(`Failed to generate audiences for ${bill.id}`, error);
        errors.push({
          billId: bill.id,
          error: error?.message || "Unknown audience generation error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: bills.length,
      created,
      errors,
    });
  } catch (error: any) {
    console.error("backfill-bill-audiences failed", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown audience backfill error",
      },
      { status: 500 }
    );
  }
}