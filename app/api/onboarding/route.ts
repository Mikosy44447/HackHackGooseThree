import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { upsertGooseProfile } from "@/lib/supabase/profile-store";
import { replaceProfileAudiences } from "@/lib/supabase/profile-audiences-store";
import { deriveProfileAudiences } from "@/lib/audience-matching";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Harnold — a civic-minded goose who takes democracy very seriously. You work for PoliticAlert, an app that tracks US Congressional bills and delivers personalized legislative digests.

Your job right now is to onboard a new user through a friendly conversation. You need to learn:
1. Their policy interests (e.g. education, healthcare, taxes, civil rights, immigration, housing, economy, environment, etc.)
2. Their demographic context — ALL of these are optional and you should say so:
   - Age group: Under 18 / 18-24 / 25-34 / 35-49 / 50-64 / 65+
   - Gender: Woman / Man / Nonbinary / Prefer not to say
   - Household income: Under $25k / $25k–$50k / $50k–$75k / $75k–$100k / $100k–$150k / Over $150k
   - Education: Less than high school / High school or GED / Some college / Bachelor's degree / Graduate degree
   - Race/ethnicity (can be multiple): White / Black or African American / Hispanic or Latino / Asian American / Native American / Pacific Islander / Multiracial / Other / Prefer not to say
   - US state or region (e.g. "California" or "Northeast")
   - Employment: Employed full-time / Part-time / Self-employed / Student / Retired / Unemployed / Other
   - Family/relationship: Single / Married or partnered / Parent / Caregiver / Other
3. Any community or identity contexts that matter to them (e.g. immigrant family, first-generation student, veteran, small business owner, etc.)

Rules:
- Be warm, conversational, and lightly funny in Harnold's goose voice
- Ask 1-2 questions at a time — never overwhelm
- Demographic questions are always optional — say so each time
- After gathering a reasonable picture (at least interests + 3-4 demographics), call save_profile
- If the user says they're done or wants to skip, call save_profile with what you have
- Keep responses concise: 2-4 sentences + a question
- Infer values from context when possible (e.g. "I'm in college" → education: "Some college", employment: "Student")
- Never lecture about privacy — just be breezy about the optional nature of each question`;

const SAVE_PROFILE_TOOL: Anthropic.Tool = {
  name: "save_profile",
  description:
    "Save the user's profile after gathering enough information. Call this when you have at least their interests and a few demographics, or when the user signals they are done.",
  input_schema: {
    type: "object" as const,
    properties: {
      interests: {
        type: "array",
        items: { type: "string" },
        description: "Policy interests, e.g. ['Education', 'Healthcare', 'Taxes']",
      },
      contexts: {
        type: "array",
        items: { type: "string" },
        description:
          "Community/identity contexts, e.g. ['Asian American', 'Immigrant Family', 'First-Generation Student']",
      },
      age: { type: "string", description: "Age group, e.g. '25-34'" },
      gender: { type: "string", description: "Gender, e.g. 'Woman'" },
      income: {
        type: "string",
        description: "Household income range, e.g. '$50k–$75k'",
      },
      education: {
        type: "string",
        description: "Highest education level, e.g. \"Bachelor's degree\"",
      },
      race: {
        type: "array",
        items: { type: "string" },
        description:
          "Race/ethnicity (can be multiple), e.g. ['Asian American', 'Multiracial']",
      },
      location: {
        type: "string",
        description: "US state or region, e.g. 'California'",
      },
      employment: {
        type: "string",
        description: "Employment status, e.g. 'Employed full-time'",
      },
      family: {
        type: "string",
        description: "Family/relationship status, e.g. 'Parent'",
      },
    },
    required: ["interests", "contexts"],
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Missing ANTHROPIC_API_KEY" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { history, email } = body as {
      history: ChatMessage[];
      email: string;
    };

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      tools: [SAVE_PROFILE_TOOL],
      tool_choice: { type: "auto" },
      messages: history,
    });

    // Check if Claude called save_profile
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "save_profile"
    );

    if (toolUse) {
      const extracted = toolUse.input as {
        interests?: string[];
        contexts?: string[];
        age?: string;
        gender?: string;
        income?: string;
        education?: string;
        race?: string[];
        location?: string;
        employment?: string;
        family?: string;
      };

      const profile = {
        email,
        interests: extracted.interests ?? [],
        contexts: extracted.contexts ?? [],
        age: extracted.age,
        gender: extracted.gender,
        income: extracted.income,
        education: extracted.education,
        race: extracted.race,
        location: extracted.location,
        employment: extracted.employment,
        family: extracted.family,
        digest_enabled: true,
        digest_frequency: "Weekly",
      };

      await upsertGooseProfile(profile);

      const audiences = deriveProfileAudiences({
        email,
        interests: profile.interests,
        contexts: profile.contexts,
        age: profile.age,
        gender: profile.gender,
        income: profile.income,
        education: profile.education,
        race: profile.race,
        location: profile.location,
        employment: profile.employment,
        family: profile.family,
      });

      await replaceProfileAudiences(email, audiences);

      // Get the text reply Claude sent before calling the tool (if any)
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text"
      );

      return NextResponse.json({
        done: true,
        reply:
          textBlock?.text ??
          "HONK! Harnold has your profile locked and loaded. Time to see your personalized feed.",
        profile,
      });
    }

    // Normal conversational reply
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    return NextResponse.json({
      done: false,
      reply: textBlock?.text ?? "HONK! (Harnold is momentarily speechless.)",
    });
  } catch (error: unknown) {
    console.error("Onboarding route failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
