import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { embedText, audienceTextForEmbedding } from "@/lib/ollama-embeddings";
import {
  setBillAudienceEmbedding,
  setProfileAudienceEmbedding,
} from "@/lib/supabase/vector-matching-store";

type BillAudienceRow = {
  id: number;
  audience_label_raw: string;
  audience_rationale: string;
  normalized_audience_key?: string | null;
};

type ProfileAudienceRow = {
  id: number;
  audience_label: string;
  normalized_audience_key?: string | null;
  source: string;
};

export async function POST() {
  try {
    const { data: billAudiences, error: billError } = await supabase
      .from("bill_audiences")
      .select("id, audience_label_raw, audience_rationale, normalized_audience_key");

    if (billError) throw billError;

    const { data: profileAudiences, error: profileError } = await supabase
      .from("profile_audiences")
      .select("id, audience_label, normalized_audience_key, source");

    if (profileError) throw profileError;

    let billEmbedded = 0;
    let profileEmbedded = 0;

    for (const row of (billAudiences ?? []) as BillAudienceRow[]) {
      const embedding = await embedText(
        audienceTextForEmbedding({
          label: row.audience_label_raw,
          rationale: row.audience_rationale,
          normalizedKey: row.normalized_audience_key ?? null,
        })
      );

      await setBillAudienceEmbedding(row.id, embedding);
      billEmbedded += 1;
    }

    for (const row of (profileAudiences ?? []) as ProfileAudienceRow[]) {
      const embedding = await embedText(
        audienceTextForEmbedding({
          label: row.audience_label,
          rationale: row.source,
          normalizedKey: row.normalized_audience_key ?? null,
        })
      );

      await setProfileAudienceEmbedding(row.id, embedding);
      profileEmbedded += 1;
    }

    return NextResponse.json({
      ok: true,
      billEmbedded,
      profileEmbedded,
    });
  } catch (error: any) {
    console.error("backfill-audience-embeddings failed", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown embedding backfill error",
      },
      { status: 500 }
    );
  }
}