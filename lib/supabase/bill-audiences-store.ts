import { supabase } from "./client";

export type BillAudienceRow = {
  id: number;
  bill_id: string;
  audience_label_raw: string;
  audience_rationale: string;
  why_it_matters: string;
  confidence: number;
  normalized_audience_key?: string | null;
};

export type BillAudience = {
  id: number;
  billId: string;
  audienceLabelRaw: string;
  audienceRationale: string;
  whyItMatters: string;
  confidence: number;
  normalizedAudienceKey?: string | null;
};

function mapBillAudience(row: BillAudienceRow): BillAudience {
  return {
    id: row.id,
    billId: row.bill_id,
    audienceLabelRaw: row.audience_label_raw,
    audienceRationale: row.audience_rationale,
    whyItMatters: row.why_it_matters,
    confidence: Number(row.confidence),
    normalizedAudienceKey: row.normalized_audience_key ?? null,
  };
}

export async function getBillAudiencesByBillId(
  billId: string
): Promise<BillAudience[]> {
  const { data, error } = await supabase
    .from("bill_audiences")
    .select("*")
    .eq("bill_id", billId)
    .order("confidence", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBillAudience);
}

export async function upsertBillAudiences(
  billId: string,
  audiences: Array<{
    audienceLabelRaw: string;
    audienceRationale: string;
    whyItMatters: string;
    confidence: number;
    normalizedAudienceKey?: string | null;
  }>
) {
  const payload = audiences.map((audience) => ({
    bill_id: billId,
    audience_label_raw: audience.audienceLabelRaw,
    audience_rationale: audience.audienceRationale,
    why_it_matters: audience.whyItMatters,
    confidence: audience.confidence,
    normalized_audience_key: audience.normalizedAudienceKey ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from("bill_audiences")
    .upsert(payload, {
      onConflict: "bill_id,audience_label_raw",
    })
    .select();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBillAudience);
}

export async function deleteBillAudiencesByBillId(billId: string) {
  const { error } = await supabase
    .from("bill_audiences")
    .delete()
    .eq("bill_id", billId);

  if (error) {
    throw error;
  }
}