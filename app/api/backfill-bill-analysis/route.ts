import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllBills } from "@/lib/supabase/bills-store";
import {
  getBillAnalysisByBillId,
  upsertBillAnalysis,
} from "@/lib/supabase/bill-analysis-store";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
        message: "No bills found to analyze.",
        processed: 0,
      });
    }

    let created = 0;
    let skipped = 0;
    const errors: Array<{ billId: string; error: string }> = [];

    for (const bill of bills) {
      try {
        const existing = await getBillAnalysisByBillId(bill.id);

        if (existing && !force) {
          skipped += 1;
          continue;
        }

        const prompt = `
You are generating reusable bill-level analysis for a civic-tech app called PoliticAlert.

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
${JSON.stringify(bill, null, 2)}
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
                  whyItMattersGeneral: {
                    type: "string",
                    description:
                      "Broad reusable explanation of why the bill matters.",
                  },
                  broaderPattern: {
                    type: "string",
                    description:
                      "Broader legislative or policy pattern connected to the bill.",
                  },
                  hotTake: {
                    type: "string",
                    description:
                      "Playful but informative Harnold-style take on the bill.",
                  },
                },
                required: [
                  "whyItMattersGeneral",
                  "broaderPattern",
                  "hotTake",
                ],
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
            block.type === "tool_use" &&
            block.name === "return_bill_analysis"
        ) as any;

        if (!toolBlock || !toolBlock.input) {
          throw new Error("Model did not return structured bill analysis.");
        }

        const input = toolBlock.input;

        if (
          typeof input.whyItMattersGeneral !== "string" ||
          typeof input.broaderPattern !== "string" ||
          typeof input.hotTake !== "string"
        ) {
          throw new Error("Structured bill analysis was incomplete.");
        }

        await upsertBillAnalysis({
          billId: bill.id,
          whyItMattersGeneral: input.whyItMattersGeneral.trim(),
          broaderPattern: input.broaderPattern.trim(),
          hotTake: input.hotTake.trim(),
          analysisVersion: "v1",
          model: "claude-haiku-4-5",
        });

        created += 1;
      } catch (error: any) {
        console.error(`Failed to analyze bill ${bill.id}`, error);
        errors.push({
          billId: bill.id,
          error: error?.message || "Unknown analysis error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: bills.length,
      created,
      skipped,
      errors,
    });
  } catch (error: any) {
    console.error("backfill-bill-analysis failed", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown backfill error",
      },
      { status: 500 }
    );
  }
}