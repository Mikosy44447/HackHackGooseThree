import { NextResponse } from "next/server";
import { fetchCourtDecisions } from "@/lib/external-sources";
import { ingestSingleBill } from "@/lib/ingestion";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body?.limit ?? 5);

    const decisions = await fetchCourtDecisions(limit);

    const ingestedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const decision of decisions) {
      try {
        await ingestSingleBill(decision);
        ingestedIds.push(decision.id);
      } catch (err: any) {
        errors.push({ id: decision.id, error: err?.message ?? "Unknown error" });
      }
    }

    return NextResponse.json({ ok: true, fetched: decisions.length, ingestedIds, errors });
  } catch (error: any) {
    console.error("ingest-court-decision route failed", error);
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
