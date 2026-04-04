import { supabase } from "./client";
import type { BillAudience } from "./bill-audiences-store";

export type SemanticBillAudience = BillAudience & {
  semanticScore: number;
};

function mapSemanticAudience(row: any): SemanticBillAudience {
  return {
    id: row.id,
    billId: row.bill_id,
    audienceLabelRaw: row.audience_label_raw,
    audienceRationale: row.audience_rationale,
    whyItMatters: row.why_it_matters,
    confidence: Number(row.confidence),
    normalizedAudienceKey: row.normalized_audience_key ?? null,
    semanticScore: Number(row.semantic_score ?? 0),
  };
}

export async function setBillAudienceEmbedding(
  id: number,
  embedding: number[]
) {
  const { error } = await supabase
    .from("bill_audiences")
    .update({ embedding })
    .eq("id", id);

  if (error) throw error;
}

export async function setProfileAudienceEmbedding(
  id: number,
  embedding: number[]
) {
  const { error } = await supabase
    .from("profile_audiences")
    .update({ embedding })
    .eq("id", id);

  if (error) throw error;
}

export async function getSemanticMatchesForBillAndProfile(
  billId: string,
  profileEmail: string,
  limit = 3
): Promise<SemanticBillAudience[]> {
  const { data, error } = await supabase.rpc(
    "match_bill_audiences_for_profile",
    {
      p_bill_id: billId,
      p_profile_email: profileEmail,
      p_match_count: limit,
    }
  );

  if (error) throw error;

  return (data ?? []).map(mapSemanticAudience);
}