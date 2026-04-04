import { NextResponse } from "next/server";
import { fetchRegulations } from "@/lib/external-sources";
import { ingestSingleBill } from "@/lib/ingestion";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body?.limit ?? 5);

    const regulations = await fetchRegulations(limit);

    const ingestedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const reg of regulations) {
      try {
        await ingestSingleBill(reg);
        ingestedIds.push(reg.id);
      } catch (err: any) {
        errors.push({ id: reg.id, error: err?.message ?? "Unknown error" });
      }
    }

    return NextResponse.json({ ok: true, fetched: regulations.length, ingestedIds, errors });
  } catch (error: any) {
    console.error("ingest-regulation route failed", error);
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
