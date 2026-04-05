"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import ProfileSummary from "@/components/ProfileSummary";
import SendDigestCard from "@/components/SendDigestCard";
import DigestSettingsCard from "@/components/DigestSettingsCard";
import HarnoldGoose from "@/components/HarnoldGoose";
import { WavyDivider, PondRipple } from "@/components/HandDrawnAssets";
import { UserProfile } from "@/lib/ai";
import { getAllBills, Bill } from "@/lib/supabase/bills-store";
import {
  getProfileAudiencesByEmail,
  ProfileAudience,
} from "@/lib/supabase/profile-audiences-store";
import {
  getBillAudiencesByBillId,
  BillAudience,
} from "@/lib/supabase/bill-audiences-store";
import {
  rankBillsForDashboard,
  buildRankingBadgeText,
  RankedBill,
} from "@/lib/dashboard-ranking";

const INITIAL_SHOW = 5;

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    interests: [],
    contexts: [],
    age: "",
    gender: "",
  });

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [profileAudiences, setProfileAudiences] = useState<ProfileAudience[]>([]);
  const [billAudiencesByBillId, setBillAudiencesByBillId] = useState<
    Record<string, BillAudience[]>
  >({});
  const [loadingBills, setLoadingBills] = useState(true);
  const [billsError, setBillsError] = useState("");
  const [showAll, setShowAll] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    for (const key of [
      "userEmail", "userInterests", "userContexts", "userAge", "userGender",
      "userIncome", "userEducation", "userRace", "userLocation", "userEmployment", "userFamily",
    ]) {
      localStorage.removeItem(key);
    }
    router.push("/");
  }

  useEffect(() => {
    const email = localStorage.getItem("userEmail") || "";
    const interests = JSON.parse(localStorage.getItem("userInterests") || "[]");
    const contexts = JSON.parse(localStorage.getItem("userContexts") || "[]");
    const age = localStorage.getItem("userAge") || "";
    const gender = localStorage.getItem("userGender") || "";
    const income = localStorage.getItem("userIncome") || "";
    const education = localStorage.getItem("userEducation") || "";
    const race = JSON.parse(localStorage.getItem("userRace") || "[]");
    const location = localStorage.getItem("userLocation") || "";
    const employment = localStorage.getItem("userEmployment") || "";
    const family = localStorage.getItem("userFamily") || "";

    setProfile({ email, interests, contexts, age, gender, income, education, race, location, employment, family });
  }, []);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const bills = await getAllBills();
        setAllBills(bills);

        const email = localStorage.getItem("userEmail") || "";
        if (email) {
          try {
            const stored = await getProfileAudiencesByEmail(email);
            setProfileAudiences(stored);
          } catch (error) {
            console.error("Failed to load profile audiences", error);
          }
        }

        const audienceEntries = await Promise.all(
          bills.map(async (bill) => {
            try {
              const audiences = await getBillAudiencesByBillId(bill.id);
              return [bill.id, audiences] as const;
            } catch {
              return [bill.id, []] as const;
            }
          })
        );
        setBillAudiencesByBillId(Object.fromEntries(audienceEntries));
      } catch (error) {
        console.error("Failed to load dashboard data", error);
        setBillsError("Harnold had trouble reaching the cloud pond.");
      } finally {
        setLoadingBills(false);
      }
    }
    void loadDashboardData();
  }, []);

  const rankedBills: RankedBill[] = useMemo(() => {
    return rankBillsForDashboard({
      bills: allBills,
      billAudiencesByBillId,
      profileAudiences,
      interests: profile.interests,
      contexts: profile.contexts,
      demographics: {
        income: profile.income,
        employment: profile.employment,
        family: profile.family,
        education: profile.education,
        age: profile.age,
      },
    });
  }, [allBills, billAudiencesByBillId, profileAudiences, profile]);

  // Smart filter: prefer scored bills, but always include non-bill content types
  // (regulations, executive orders, court decisions) regardless of score.
  const filteredBills = useMemo(() => {
    const hasProfile =
      profile.interests.length > 0 ||
      profile.contexts.length > 0 ||
      profileAudiences.length > 0;

    if (!hasProfile) return rankedBills;

    const scoredBills = rankedBills.filter(
      (b) => b.bill.contentType === "bill" && b.score > 0
    );
    const nonBill = rankedBills.filter((b) => b.bill.contentType !== "bill");
    const unscoredBills = rankedBills.filter(
      (b) => b.bill.contentType === "bill" && b.score === 0
    );

    const relevantNonBill = nonBill.filter((b) => b.score > 0);

    if (scoredBills.length > 0) {
      // Scored bills + any non-bill content that actually matched something
      return [...scoredBills, ...relevantNonBill].sort((a, b) => b.score - a.score);
    }

    // No profile matches at all: show all bills + relevant non-bill only
    return [...unscoredBills, ...relevantNonBill];
  }, [rankedBills, profile, profileAudiences]);

  const visibleBills = showAll ? filteredBills : filteredBills.slice(0, INITIAL_SHOW);
  const hiddenCount = filteredBills.length - INITIAL_SHOW;

  // Content-type helpers
  const ctBorderClass: Record<string, string> = {
    bill: "ct-bill",
    regulation: "ct-regulation",
    executive_order: "ct-executive-order",
    court_decision: "ct-court-decision",
  };

  const ctLabelClass: Record<string, string> = {
    regulation: "ct-label-regulation",
    executive_order: "ct-label-executive_order",
    court_decision: "ct-label-court_decision",
  };

  const contentTypeLabel: Record<string, string> = {
    regulation: "Regulation",
    executive_order: "Executive Order",
    court_decision: "Court Decision",
  };

  return (
    <main className="page-shell px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="hand-drawn-card bg-white p-6 md:p-8 relative">
          <PondRipple className="absolute bottom-2 right-3 w-24 opacity-40 pointer-events-none" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <HarnoldGoose className="h-14 w-14 shrink-0 anim-bob" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold">Politic<span className="text-teal-600">Alert</span></span>
                  <span className="badge-pill text-xs text-slate-500">legislative radar</span>
                </div>
                <h1 className="mt-0.5 text-2xl font-bold md:text-3xl">Your feed</h1>
                <p className="mt-0.5 text-slate-500 text-sm">
                  {loadingBills
                    ? "Harnold is sorting the pond..."
                    : profile.interests.length > 0
                    ? `${filteredBills.length} item${filteredBills.length !== 1 ? "s" : ""} ranked for you · ${profile.interests.slice(0, 3).join(", ")}`
                    : `${filteredBills.length} item${filteredBills.length !== 1 ? "s" : ""} in the feed`}
                </p>
              </div>
            </div>
            {profile.email ? (
              <button
                onClick={handleLogout}
                className="hand-drawn-button bg-white px-4 py-2 text-sm text-slate-700 shrink-0"
              >
                Log out
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">

          {/* Sidebar */}
          <div className="grid gap-4 self-start">
            <ProfileSummary
              email={profile.email}
              interests={profile.interests}
              contexts={profile.contexts}
              age={profile.age}
              gender={profile.gender}
              income={profile.income}
              education={profile.education}
              race={profile.race}
              location={profile.location}
              employment={profile.employment}
              family={profile.family}
            />
            <DigestSettingsCard />
            <SendDigestCard
              profile={profile}
              matchedBills={visibleBills.slice(0, 3).map((item) => item.bill)}
            />
          </div>

          {/* Bill feed */}
          <div className="grid gap-4 content-start">
            {billsError ? (
              <div className="hand-drawn-card bg-[#fff8ef] p-5 text-slate-700">{billsError}</div>
            ) : null}

            {!loadingBills && filteredBills.length === 0 && !billsError ? (
              <div className="hand-drawn-card bg-white p-5 text-slate-600">
                Harnold checked the pond and found no bills yet.
              </div>
            ) : null}

            {visibleBills.map((item) => {
              const { bill, matchedAudienceLabels, score } = item;
              const badge = buildRankingBadgeText(item);
              const typeLabel = contentTypeLabel[bill.contentType];
              const borderClass = ctBorderClass[bill.contentType] ?? "ct-bill";
              const labelClass = ctLabelClass[bill.contentType];
              const isHonk = score >= 14;

              return (
                <article key={bill.id} className={`hand-drawn-card bg-white p-5 relative anim-fade-up ${borderClass}`}>
                  {/* Title row */}
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {typeLabel ? (
                        <span className={`badge-pill text-xs font-semibold mb-2 inline-block ${labelClass}`}>
                          {typeLabel}
                        </span>
                      ) : null}
                      <h2 className="text-lg font-bold leading-snug">{bill.title}</h2>
                      {bill.agency ? (
                        <div className="mt-0.5 text-xs text-slate-400 font-medium">{bill.agency}</div>
                      ) : null}
                      <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{bill.summary}</p>
                    </div>
                    <span className="badge-pill shrink-0 bg-orange-100 text-orange-800 text-xs">
                      {bill.status}
                    </span>
                  </div>

                  {/* Pills row */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bill.topics.slice(0, 3).map((topic: string) => (
                      <span key={topic} className="badge-pill text-xs text-slate-600">
                        {topic}
                      </span>
                    ))}
                    {matchedAudienceLabels.slice(0, 2).map((label: string) => (
                      <span key={label} className="badge-pill text-xs bg-teal-50 text-teal-700">
                        {label}
                      </span>
                    ))}
                  </div>

                  {/* Footer row */}
                  <div className="mt-4 flex items-center justify-between">
                    {isHonk ? (
                      <span className="badge-honk">{badge}</span>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          score >= 8 ? "text-slate-600" : "text-slate-400"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                    <Link
                      href={`/bills/${bill.id}`}
                      className="hand-drawn-button bg-teal-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      View →
                    </Link>
                  </div>
                </article>
              );
            })}

            {!showAll && hiddenCount > 0 ? (
              <div>
                <WavyDivider className="w-full mb-3 opacity-50" />
                <button
                  onClick={() => setShowAll(true)}
                  className="hand-drawn-button w-full bg-white py-3 text-sm text-slate-600"
                >
                  Show {hiddenCount} more item{hiddenCount !== 1 ? "s" : ""}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
