import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { deriveProfileAudiences } from "@/lib/audience-matching";
import { replaceProfileAudiences } from "@/lib/supabase/profile-audiences-store";

type GooseProfileRow = {
  email: string;
  interests: string[];
  contexts: string[];
  age?: string | null;
  gender?: string | null;
};

export async function POST() {
  try {
    const { data, error } = await supabase.from("goose_profiles").select("*");

    if (error) {
      throw error;
    }

    let processed = 0;

    for (const row of (data ?? []) as GooseProfileRow[]) {
      const derived = deriveProfileAudiences({
        email: row.email,
        interests: row.interests ?? [],
        contexts: row.contexts ?? [],
        age: row.age ?? "",
        gender: row.gender ?? "",
      });

      await replaceProfileAudiences(row.email, derived);
      processed += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
    });
  } catch (error: any) {
    console.error("backfill-profile-audiences failed", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown profile audience backfill error",
      },
      { status: 500 }
    );
  }
}