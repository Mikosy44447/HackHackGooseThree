import { NextResponse } from "next/server";
import { fetchExecutiveOrders } from "@/lib/external-sources";
import { ingestSingleBill } from "@/lib/ingestion";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body?.limit ?? 5);

    const orders = await fetchExecutiveOrders(limit);

    const ingestedIds: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const order of orders) {
      try {
        await ingestSingleBill(order);
        ingestedIds.push(order.id);
      } catch (err: any) {
        errors.push({ id: order.id, error: err?.message ?? "Unknown error" });
      }
    }

    return NextResponse.json({ ok: true, fetched: orders.length, ingestedIds, errors });
  } catch (error: any) {
    console.error("ingest-executive-order route failed", error);
    return NextResponse.json({ error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
