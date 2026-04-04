"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import HarnoldGoose from "@/components/HarnoldGoose";
import { HonkBubble, FeatherDoodle, PondRipple, SketchStar } from "@/components/HandDrawnAssets";
import { useEffect, useMemo, useState } from "react";
import { generateWhyItMatters, UserProfile } from "@/lib/ai";
import {
  getAllBills,
  getBillById,
  getRelatedBillsFromList,
  Bill,
  Sponsor,
} from "@/lib/supabase/bills-store";
import {
  getBillAnalysisByBillId,
  BillAnalysis,
} from "@/lib/supabase/bill-analysis-store";
import {
  BillAudience,
  getBillAudiencesByBillId,
} from "@/lib/supabase/bill-audiences-store";
import {
  deriveProfileAudiences,
  getTopMatchingAudiencesForProfile,
} from "@/lib/audience-matching";
import {
  getProfileAudiencesByEmail,
  ProfileAudience,
} from "@/lib/supabase/profile-audiences-store";
import { getSemanticMatchesForBillAndProfile } from "@/lib/supabase/vector-matching-store";

export default function BillDetailPage() {
  const params = useParams<{ id: string }>();

  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    interests: [],
    contexts: [],
    age: "",
    gender: "",
  });

  const [profileAudiences, setProfileAudiences] = useState<ProfileAudience[]>([]);
  const [bill, setBill] = useState<Bill | null>(null);
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [billAnalysis, setBillAnalysis] = useState<BillAnalysis | null>(null);
  const [billAudiences, setBillAudiences] = useState<BillAudience[]>([]);
  const [semanticMatches, setSemanticMatches] = useState<BillAudience[]>([]);
  const [loadingBill, setLoadingBill] = useState(true);
  const [billError, setBillError] = useState("");

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "";
    const interests = JSON.parse(localStorage.getItem("userInterests") || "[]");
    const contexts = JSON.parse(localStorage.getItem("userContexts") || "[]");
    setProfile({
      email,
      interests,
      contexts,
      age: localStorage.getItem("userAge") || "",
      gender: localStorage.getItem("userGender") || "",
      income: localStorage.getItem("userIncome") || "",
      education: localStorage.getItem("userEducation") || "",
      race: JSON.parse(localStorage.getItem("userRace") || "[]"),
      location: localStorage.getItem("userLocation") || "",
      employment: localStorage.getItem("userEmployment") || "",
      family: localStorage.getItem("userFamily") || "",
    });
  }, []);

  useEffect(() => {
    if (!params?.id) return;

    async function loadBillData() {
      const email = localStorage.getItem("userEmail") || "";
      const interests = JSON.parse(localStorage.getItem("userInterests") || "[]");
      const contexts = JSON.parse(localStorage.getItem("userContexts") || "[]");
      const age = localStorage.getItem("userAge") || "";
      const gender = localStorage.getItem("userGender") || "";

      try {
        const [billRow, allBillRows, analysisRow, audienceRows, storedAudiences] =
          await Promise.all([
            getBillById(params.id),
            getAllBills(),
            getBillAnalysisByBillId(params.id),
            getBillAudiencesByBillId(params.id),
            email ? getProfileAudiencesByEmail(email) : Promise.resolve([]),
          ]);

        if (!billRow) {
          setBillError("Harnold could not find that bill.");
        } else {
          setBill(billRow);
        }
        setAllBills(allBillRows);
        setBillAnalysis(analysisRow);
        setBillAudiences(audienceRows);

        if (storedAudiences.length > 0) {
          setProfileAudiences(storedAudiences);
        } else {
          const fallback = deriveProfileAudiences({ email, interests, contexts, age, gender }).map(
            (item, i) => ({
              id: -1 - i,
              profileEmail: email,
              audienceLabel: item.audienceLabel,
              normalizedAudienceKey: item.normalizedAudienceKey ?? null,
              source: item.source ?? "derived",
              confidence: item.confidence ?? 1,
            })
          );
          setProfileAudiences(fallback);
        }

        if (email) {
          try {
            const semantic = await getSemanticMatchesForBillAndProfile(params.id, email, 3);
            setSemanticMatches(semantic);
          } catch {
            // semantic matching optional
          }
        }
      } catch (error) {
        console.error("Failed to load bill page data", error);
        setBillError("Harnold hit a database splash loading this bill.");
      } finally {
        setLoadingBill(false);
      }
    }

    void loadBillData();
  }, [params?.id]);

  const relatedBills = useMemo(() => {
    if (!bill) return [];
    return getRelatedBillsFromList(bill, allBills);
  }, [bill, allBills]);

  const fallbackWhyItMatters = useMemo(() => {
    if (!bill) return "";
    return generateWhyItMatters(bill.title, bill.topics, bill.affectedGroups, profile);
  }, [bill, profile]);

  const matchedAudiences = useMemo(() => {
    if (semanticMatches.length > 0) return semanticMatches;
    return getTopMatchingAudiencesForProfile(billAudiences, profileAudiences, 3);
  }, [semanticMatches, billAudiences, profileAudiences]);

  if (loadingBill) {
    return (
      <main className="page-shell px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <div className="hand-drawn-card bg-white p-8 text-slate-500">
            Loading bill...
          </div>
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="page-shell px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← Dashboard
          </Link>
          <div className="hand-drawn-card mt-4 bg-[#fff8ef] p-6 text-slate-700">
            {billError || "Bill not found."}
          </div>
        </div>
      </main>
    );
  }

  const whyItMattersText = billAnalysis?.whyItMattersGeneral || fallbackWhyItMatters;
  const broaderPatternText = billAnalysis?.broaderPattern || bill.pattern;
  const hotTakeText = billAnalysis?.hotTake;

  const contentTypeMeta: Record<string, { label: string; borderClass: string; labelClass: string; accentColor: string }> = {
    regulation: { label: "Regulation", borderClass: "ct-regulation", labelClass: "ct-label-regulation", accentColor: "text-amber-700" },
    executive_order: { label: "Executive Order", borderClass: "ct-executive-order", labelClass: "ct-label-executive_order", accentColor: "text-red-700" },
    court_decision: { label: "Court Decision", borderClass: "ct-court-decision", labelClass: "ct-label-court_decision", accentColor: "text-violet-700" },
  };
  const ctMeta = contentTypeMeta[bill.contentType];

  return (
    <main className="page-shell px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">

        {/* Back */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-800">
            ← Dashboard
          </Link>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-slate-400">🪿 PoliticAlert</span>
        </div>

        {/* Header */}
        <div className={`hand-drawn-card mt-3 bg-white p-6 ${ctMeta?.borderClass ?? "ct-bill"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {ctMeta ? (
                  <span className={`badge-pill text-xs font-semibold ${ctMeta.labelClass}`}>
                    {ctMeta.label}
                  </span>
                ) : null}
                {bill.agency ? (
                  <span className="text-xs text-slate-400 font-medium">{bill.agency}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {bill.topics.map((topic) => (
                  <span key={topic} className="badge-pill text-xs text-slate-600">
                    {topic}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl font-bold leading-snug md:text-3xl">
                {bill.title}
              </h1>
            </div>
            <span className="badge-pill shrink-0 bg-orange-100 text-orange-800 text-xs">
              {bill.status}
            </span>
          </div>
          <a
            href={bill.officialSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:text-teal-800"
          >
            {bill.officialSourceLabel} →
          </a>
        </div>

        {/* Body: main + sidebar */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">

          {/* Main column */}
          <div className="grid gap-4 content-start">

            {/* Why it matters */}
            <section className="hand-drawn-card bg-teal-50 p-5 relative">
              <PondRipple className="absolute bottom-2 right-2 w-16 opacity-30 pointer-events-none" />
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Why it matters
              </div>
              <p className="mt-2 leading-relaxed text-slate-800">{whyItMattersText}</p>
            </section>

            {/* Hot take */}
            {hotTakeText ? (
              <section className="hand-drawn-card bg-[#fff8ef] p-5 relative">
                <SketchStar className="absolute top-2 right-2 w-8 h-8 opacity-25 anim-wiggle" />
                <div className="flex items-center gap-2 mb-2">
                  <HarnoldGoose className="h-6 w-6 anim-bob" />
                  <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                    Harnold&rsquo;s take
                  </div>
                </div>
                <p className="text-slate-700 italic leading-relaxed">{hotTakeText}</p>
              </section>
            ) : null}

            {/* Summary */}
            <section className="hand-drawn-card bg-white p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Full summary
              </div>
              <p className="text-slate-700 leading-relaxed">{bill.summary}</p>
            </section>

            {/* Broader pattern */}
            {broaderPatternText ? (
              <section className="hand-drawn-card bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Broader pattern
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{broaderPatternText}</p>
              </section>
            ) : null}
          </div>

          {/* Sidebar */}
          <div className="grid gap-4 content-start">

            {/* Decorative feather at top of sidebar */}
            <div className="flex justify-end px-1 -mb-2">
              <FeatherDoodle className="h-14 opacity-40 anim-bob" style={{animationDelay: "0.6s"}} />
            </div>

            {/* Relevant to you */}
            {matchedAudiences.length > 0 ? (
              <section className="hand-drawn-card bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-orange-700 mb-3">
                  Relevant to you
                </div>
                <div className="space-y-4">
                  {matchedAudiences.map((audience) => (
                    <div key={audience.id}>
                      <div className="text-sm font-semibold text-slate-800">
                        {audience.audienceLabelRaw}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {audience.whyItMatters}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Affected groups */}
            {bill.affectedGroups.length > 0 ? (
              <section className="hand-drawn-card bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                  Affected groups
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bill.affectedGroups.map((group) => (
                    <span key={group} className="badge-pill text-xs text-slate-600">
                      {group}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Sponsors */}
            {bill.sponsors.length > 0 ? (
              <section className="hand-drawn-card bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  {bill.sponsors.length === 1 ? "Sponsor" : "Sponsors"}
                </div>
                <div className="space-y-2">
                  {bill.sponsors.map((sponsor: Sponsor, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="text-sm font-medium text-slate-800">{sponsor.fullName}</div>
                      {(sponsor.party || sponsor.state) ? (
                        <div className="text-xs text-slate-400">
                          {[sponsor.party, sponsor.state].filter(Boolean).join(" · ")}
                          {sponsor.district ? ` · Dist. ${sponsor.district}` : ""}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Related bills */}
            {relatedBills.length > 0 ? (
              <section className="hand-drawn-card bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Related bills
                </div>
                <div className="space-y-2">
                  {relatedBills.map((rb) => (
                    <Link
                      key={rb.id}
                      href={`/bills/${rb.id}`}
                      className="block rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:bg-white"
                    >
                      <div className="text-sm font-medium text-slate-800 line-clamp-2">
                        {rb.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {rb.topics.slice(0, 2).map((t) => (
                          <span key={t} className="text-xs text-slate-400">{t}</span>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
