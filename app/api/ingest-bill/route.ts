import { NextResponse } from "next/server";
import { ingestSingleBill, IngestBillInput } from "@/lib/ingestion";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<IngestBillInput>;

    const result = await ingestSingleBill({
      id: String(body.id ?? "").trim(),
      title: String(body.title ?? "").trim(),
      summary: String(body.summary ?? "").trim(),
      status: String(body.status ?? "").trim(),
      topics: Array.isArray(body.topics) ? body.topics.map(String) : [],
      affectedGroups: Array.isArray(body.affectedGroups)
        ? body.affectedGroups.map(String)
        : [],
      pattern: String(body.pattern ?? "").trim(),
      relatedBillIds: Array.isArray(body.relatedBillIds)
        ? body.relatedBillIds.map(String)
        : [],
      officialSourceLabel: String(body.officialSourceLabel ?? "").trim(),
      officialSourceUrl: String(body.officialSourceUrl ?? "").trim(),
    });

    return NextResponse.json({
      ok: true,
      billId: result.bill.id,
      audienceCount: result.audiences.length,
      result,
    });
  } catch (error: any) {
    console.error("ingest-bill route failed", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown ingestion error",
      },
      { status: 500 }
    );
  }
}