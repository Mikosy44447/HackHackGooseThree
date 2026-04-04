import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildRankedDigestBills, buildDigestHtml } from "@/lib/digest-ranking";

const resend = new Resend(process.env.RESEND_API_KEY);

type UserProfile = {
  email?: string;
  interests: string[];
  contexts: string[];
  age?: string;
  gender?: string;
};

export async function POST(request: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { profile } = body as {
      profile?: UserProfile;
    };

    if (!profile?.email) {
      return NextResponse.json(
        { error: "Profile email is required." },
        { status: 400 }
      );
    }

    const digestBills = await buildRankedDigestBills(profile, 3);

    if (!digestBills.length) {
      return NextResponse.json(
        { error: "No digest bills were available." },
        { status: 400 }
      );
    }

    const html = buildDigestHtml({
      profile,
      digestBills,
    });

    const { data, error } = await resend.emails.send({
      from: "PoliticAlert <onboarding@resend.dev>",
      to: profile.email,
      subject: "Harnold’s latest legislative digest 🪿",
      html,
    });

    if (error) {
      console.error("Resend send failed", error);
      return NextResponse.json(
        { error: error.message || "Failed to send digest." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      emailId: data?.id ?? null,
      sentBillIds: digestBills.map((item) => item.bill.id),
    });
  } catch (error: any) {
    console.error("send-digest route failed", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown digest send error.",
      },
      { status: 500 }
    );
  }
}