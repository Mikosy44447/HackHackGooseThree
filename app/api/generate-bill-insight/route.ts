import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Bill = {
  id: string;
  title: string;
  summary: string;
  status: string;
  topics: string[];
  affectedGroups: string[];
  pattern: string;
  officialSourceLabel: string;
  officialSourceUrl: string;
};

type UserProfile = {
  email?: string;
  interests: string[];
  contexts: string[];
  age?: string;
  gender?: string;
};

type Insight = {
  whyItMatters: string;
  broaderPattern: string;
  hotTake: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { bill, profile } = body as {
      bill?: Bill;
      profile?: UserProfile;
    };

    if (!bill) {
      return NextResponse.json(
        { error: "Bill is required." },
        { status: 400 }
      );
    }

    const userPrompt = `
You are helping write a personalized legislative explainer for a civic-tech app called PoliticAlert.

Generate:
- whyItMatters
- broaderPattern
- hotTake

Rules:
- Keep each field to 2-4 sentences max.
- Be specific to the user profile if available.
- Do not invent facts beyond the bill data provided.
- You may infer relevance, but label it carefully.
- Keep a light playful tone for "hotTake", but not for the other two.
- Do not mention being an AI.

User profile:
${JSON.stringify(profile ?? {}, null, 2)}

Bill:
${JSON.stringify(bill, null, 2)}
    `.trim();

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 700,
      tools: [
        {
          name: "return_bill_insight",
          description: "Return structured bill insight fields for the app UI.",
          input_schema: {
            type: "object",
            properties: {
              whyItMatters: {
                type: "string",
                description:
                  "2-4 sentences explaining why the bill matters to this user.",
              },
              broaderPattern: {
                type: "string",
                description:
                  "2-4 sentences describing the broader legislative or policy pattern.",
              },
              hotTake: {
                type: "string",
                description:
                  "2-4 sentences max, playful but informative summary.",
              },
            },
            required: ["whyItMatters", "broaderPattern", "hotTake"],
          },
        },
      ],
      tool_choice: {
        type: "tool",
        name: "return_bill_insight",
      },
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const toolBlock = message.content.find(
      (block) => block.type === "tool_use" && block.name === "return_bill_insight"
    );

    if (!toolBlock || !("input" in toolBlock)) {
      console.error("Anthropic did not return the expected tool output.");
      console.error(JSON.stringify(message, null, 2));

      return NextResponse.json(
        { error: "Model did not return structured insight output." },
        { status: 502 }
      );
    }

    const input = toolBlock.input as Partial<Insight>;

    if (
      typeof input.whyItMatters !== "string" ||
      typeof input.broaderPattern !== "string" ||
      typeof input.hotTake !== "string"
    ) {
      console.error("Anthropic tool output missing required strings.");
      console.error(JSON.stringify(toolBlock, null, 2));

      return NextResponse.json(
        { error: "Structured output was incomplete." },
        { status: 502 }
      );
    }

    const insight: Insight = {
      whyItMatters: input.whyItMatters.trim(),
      broaderPattern: input.broaderPattern.trim(),
      hotTake: input.hotTake.trim(),
    };

    return NextResponse.json({ ok: true, insight });
  } catch (err: any) {
    console.error("generate-bill-insight failed");
    console.error({
      message: err?.message,
      status: err?.status,
      name: err?.name,
      type: err?.type,
    });

    return NextResponse.json(
      {
        error: err?.message || "Unknown error while generating bill insight.",
        status: err?.status || 500,
        type: err?.type || null,
      },
      { status: err?.status || 500 }
    );
  }
}