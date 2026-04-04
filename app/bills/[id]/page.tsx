"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { generateWhyItMatters, UserProfile } from "@/lib/ai";
import {
  getAllBills,
  getBillById,
  getRelatedBillsFromList,
  Bill,
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
  profileAudienceLabels,
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

  const [profileAudiences, setProfileAudiences] = useState<ProfileAudience[]>(
    []
  );
  const [bill, setBill] = useState<Bill | null>(null);
  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [billAnalysis, setBillAnalysis] = useState<BillAnalysis | null>(null);
  const [billAudiences, setBillAudiences] = useState<BillAudience[]>([]);
  const [semanticMatches, setSemanticMatches] = useState<BillAudience[]>([]);

  const [loadingBill, setLoadingBill] = useState(true);
  const [billError, setBillError] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState<
    "idle" | "loading" | "missing" | "error"
  >("idle");
  const [audienceStatus, setAudienceStatus] = useState<
    "idle" | "loading" | "missing" | "error"
  >("idle");

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "";
    const interests = JSON.parse(localStorage.getItem("userInterests") || "[]");
    const contexts = JSON.parse(localStorage.getItem("userContexts") || "[]");
    const age = localStorage.getItem("userAge") || "";
    const gender = localStorage.getItem("userGender") || "";

    setProfile({
      email,
      interests,
      contexts,
      age,
      gender,
    });
  }, []);

  useEffect(() => {
    async function loadBillData() {
      try {
        setAnalysisStatus("loading");
        setAudienceStatus("loading");
        setSemanticMatches([]);

        const email = localStorage.getItem("userEmail") || "";
        const interests = JSON.parse(
          localStorage.getItem("userInterests") || "[]"
        );
        const contexts = JSON.parse(
          localStorage.getItem("userContexts") || "[]"
        );
        const age = localStorage.getItem("userAge") || "";
        const gender = localStorage.getItem("userGender") || "";

        const [
          billRow,
          allBillRows,
          analysisRow,
          audienceRows,
          storedProfileAudiences,
        ] = await Promise.all([
          getBillById(params.id),
          getAllBills(),
          getBillAnalysisByBillId(params.id),
          getBillAudiencesByBillId(params.id),
          email ? getProfileAudiencesByEmail(email) : Promise.resolve([]),
        ]);

        if (!billRow) {
          setBillError("Harnold could not find that bill in the pond records.");
          setBill(null);
        } else {
          setBill(billRow);
          setBillError("");
        }

        setAllBills(allBillRows);
        setBillAnalysis(analysisRow);
        setBillAudiences(audienceRows);

        if (storedProfileAudiences.length > 0) {
          setProfileAudiences(storedProfileAudiences);
        } else {
          const fallbackDerived = deriveProfileAudiences({
            email,
            interests,
            contexts,
            age,
            gender,
          }).map((item, index) => ({
            id: -1 - index,
            profileEmail: email,
            audienceLabel: item.audienceLabel,
            normalizedAudienceKey: item.normalizedAudienceKey ?? null,
            source: item.source ?? "derived",
            confidence: item.confidence ?? 1,
          }));

          setProfileAudiences(fallbackDerived);
        }

        if (email) {
          try {
            const semantic = await getSemanticMatchesForBillAndProfile(
              params.id,
              email,
              3
            );
            setSemanticMatches(semantic);
          } catch (error) {
            console.error(
              "Semantic audience matching failed, using fallback matching",
              error
            );
          }
        }

        setAnalysisStatus(analysisRow ? "idle" : "missing");
        setAudienceStatus(audienceRows.length ? "idle" : "missing");
      } catch (error) {
        console.error("Failed to load bill page data from Supabase", error);
        setBillError("Harnold hit a database splash while loading this bill.");
        setAnalysisStatus("error");
        setAudienceStatus("error");
      } finally {
        setLoadingBill(false);
      }
    }

    if (params?.id) {
      void loadBillData();
    }
  }, [params?.id]);

  const relatedBills = useMemo(() => {
    if (!bill) return [];
    return getRelatedBillsFromList(bill, allBills);
  }, [bill, allBills]);

  const fallbackWhyItMatters = useMemo(() => {
    if (!bill) return "";
    return generateWhyItMatters(
      bill.title,
      bill.topics,
      bill.affectedGroups,
      profile
    );
  }, [bill, profile]);

  const matchedAudiences = useMemo(() => {
    if (semanticMatches.length > 0) {
      return semanticMatches;
    }

    return getTopMatchingAudiencesForProfile(
      billAudiences,
      profileAudiences,
      3
    );
  }, [semanticMatches, billAudiences, profileAudiences]);

  const userSignals = useMemo(() => {
    return profileAudienceLabels(profileAudiences);
  }, [profileAudiences]);

  if (loadingBill) {
    return (
      <main className="page-shell px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <div className="hand-drawn-card bg-white p-8">
            Harnold is flipping through the legislative reeds...
          </div>
        </div>
      </main>
    );
  }

  if (!bill) {
    return (
      <main className="page-shell px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/dashboard"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            ← Back to Harnold’s dashboard
          </Link>

          <div className="hand-drawn-card mt-4 bg-[#fff8ef] p-8 text-slate-700">
            {billError || "That bill is not currently in Harnold’s flock."}
          </div>
        </div>
      </main>
    );
  }

  const whyItMattersText =
    billAnalysis?.whyItMattersGeneral || fallbackWhyItMatters;

  const broaderPatternText = billAnalysis?.broaderPattern || bill.pattern;

  const hotTakeText =
    billAnalysis?.hotTake ||
    "Harnold’s temporary hot take: this bill has enough ripple effects that he is pacing the shoreline and muttering about policy again.";

  return (
    <main className="page-shell px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard"
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          ← Back to Harnold’s dashboard
        </Link>

        <div className="hand-drawn-card mt-4 bg-white p-8">
          <div className="text-sm font-medium text-orange-700">
            Harnold’s bill brief
          </div>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">{bill.title}</h1>

          <div className="mt-4 flex flex-wrap gap-2">
            {bill.topics.map((topic) => (
              <span key={topic} className="badge-pill text-sm text-slate-700">
                {topic}
              </span>
            ))}
          </div>

          <a
            href={bill.officialSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="hand-drawn-button mt-6 inline-block bg-white px-4 py-2 text-sm font-semibold"
          >
            View official source
          </a>
        </div>

        <section className="hand-drawn-card mt-6 bg-white p-6">
          <h2 className="text-2xl font-bold">Summary</h2>
          <p className="mt-3 text-lg text-slate-600">{bill.summary}</p>
        </section>

        <section className="hand-drawn-card mt-6 bg-teal-50 p-6">
          <h2 className="text-2xl font-bold">Why this may matter</h2>
          <p className="mt-3 text-lg text-slate-700">{whyItMattersText}</p>

          {analysisStatus === "missing" ? (
            <p className="mt-3 text-sm text-slate-500">
              No cached bill-level analysis yet. Harnold is still working from
              backup instincts.
            </p>
          ) : null}
        </section>

        <section className="hand-drawn-card mt-6 bg-orange-100 p-6">
          <h2 className="text-2xl font-bold">Broader legislative pattern</h2>
          <p className="mt-3 text-lg text-slate-700">{broaderPatternText}</p>
          <p className="mt-3 text-sm text-slate-500">
            Confidence: same pond, same splash.
          </p>
        </section>

        <section className="hand-drawn-card mt-6 bg-[#fff8ef] p-6">
          <h2 className="text-2xl font-bold">Harnold’s hot take</h2>
          <p className="mt-3 text-lg text-slate-700">{hotTakeText}</p>
        </section>

        <section className="hand-drawn-card mt-6 bg-white p-6">
          <h2 className="text-2xl font-bold">
            Why Harnold flagged this for you
          </h2>

          {userSignals.length > 0 ? (
            <p className="mt-3 text-slate-600">
              Based on your profile, Harnold looked for overlap with:{" "}
              <span className="font-medium">
                {userSignals.slice(0, 5).join(", ")}
              </span>
              .
            </p>
          ) : (
            <p className="mt-3 text-slate-600">
              Harnold does not have many profile clues yet, so he is using
              general audience matching.
            </p>
          )}

          {semanticMatches.length > 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Harnold used semantic pond radar for these matches.
            </p>
          ) : null}

          {audienceStatus === "missing" ? (
            <p className="mt-4 text-sm text-slate-500">
              No cached audience explainers yet. The flock has not finished this
              bill’s audience pass.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4">
            {matchedAudiences.map((audience) => (
              <div
                key={audience.id}
                className="rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fffaf4] p-4"
              >
                <div className="text-sm font-medium text-orange-700">
                  Audience match
                </div>
                <h3 className="mt-1 text-xl font-bold">
                  {audience.audienceLabelRaw}
                </h3>
                <p className="mt-2 text-slate-700">{audience.whyItMatters}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Why this audience: {audience.audienceRationale}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="hand-drawn-card mt-6 bg-white p-6">
          <h2 className="text-2xl font-bold">Who it may affect</h2>
          <ul className="mt-3 list-disc pl-6 text-lg text-slate-600">
            {bill.affectedGroups.map((group) => (
              <li key={group}>{group}</li>
            ))}
          </ul>
        </section>

        <section className="hand-drawn-card mt-6 bg-white p-6">
          <h2 className="text-2xl font-bold">Related bills in the flock</h2>

          <div className="mt-4 grid gap-4">
            {relatedBills.map((relatedBill) => (
              <Link
                key={relatedBill.id}
                href={`/bills/${relatedBill.id}`}
                className="rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fffaf4] p-4 transition hover:bg-white"
              >
                <div className="font-bold">{relatedBill.title}</div>
                <div className="mt-1 text-slate-600">{relatedBill.summary}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}