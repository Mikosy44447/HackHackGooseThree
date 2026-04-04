import { supabase } from "./client";

export type SupabaseBill = {
  id: string;
  title: string;
  summary: string;
  status: string;
  topics: string[];
  affected_groups: string[];
  pattern: string;
  related_bill_ids: string[];
  official_source_label: string;
  official_source_url: string;
};

export type Bill = {
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

function mapBill(row: SupabaseBill): Bill {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    status: row.status,
    topics: row.topics ?? [],
    affectedGroups: row.affected_groups ?? [],
    pattern: row.pattern,
    relatedBillIds: row.related_bill_ids ?? [],
    officialSourceLabel: row.official_source_label,
    officialSourceUrl: row.official_source_url,
  };
}

export async function getAllBills(): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapBill);
}

export async function getBillById(id: string): Promise<Bill | null> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapBill(data) : null;
}

export function getRelatedBillsFromList(bill: Bill, allBills: Bill[]): Bill[] {
  return allBills
    .filter((candidate) => candidate.id !== bill.id)
    .map((candidate) => {
      const sharedTopics = candidate.topics.filter((topic) =>
        bill.topics.includes(topic)
      ).length;

      const sharedGroups = candidate.affectedGroups.filter((group) =>
        bill.affectedGroups.includes(group)
      ).length;

      const manualBoost = bill.relatedBillIds.includes(candidate.id) ? 2 : 0;

      const score = sharedTopics * 2 + sharedGroups + manualBoost;

      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.candidate)
    .slice(0, 3);
}