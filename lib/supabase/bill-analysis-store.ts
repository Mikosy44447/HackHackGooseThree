import { supabase } from "./client";

export type BillAnalysisRow = {
  bill_id: string;
  why_it_matters_general: string;
  broader_pattern: string;
  hot_take: string;
  analysis_version: string;
  model?: string | null;
};

export type BillAnalysis = {
  billId: string;
  whyItMattersGeneral: string;
  broaderPattern: string;
  hotTake: string;
  analysisVersion: string;
  model?: string | null;
};

function mapBillAnalysis(row: BillAnalysisRow): BillAnalysis {
  return {
    billId: row.bill_id,
    whyItMattersGeneral: row.why_it_matters_general,
    broaderPattern: row.broader_pattern,
    hotTake: row.hot_take,
    analysisVersion: row.analysis_version,
    model: row.model ?? null,
  };
}

export async function getBillAnalysisByBillId(
  billId: string
): Promise<BillAnalysis | null> {
  const { data, error } = await supabase
    .from("bill_analysis")
    .select("*")
    .eq("bill_id", billId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapBillAnalysis(data) : null;
}

export async function upsertBillAnalysis(input: {
  billId: string;
  whyItMattersGeneral: string;
  broaderPattern: string;
  hotTake: string;
  analysisVersion?: string;
  model?: string;
}) {
  const { data, error } = await supabase
    .from("bill_analysis")
    .upsert(
      {
        bill_id: input.billId,
        why_it_matters_general: input.whyItMattersGeneral,
        broader_pattern: input.broaderPattern,
        hot_take: input.hotTake,
        analysis_version: input.analysisVersion ?? "v1",
        model: input.model ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "bill_id" }
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return mapBillAnalysis(data);
}