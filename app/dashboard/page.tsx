"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ProfileSummary from "@/components/ProfileSummary";
import SendDigestCard from "@/components/SendDigestCard";
import DigestSettingsCard from "@/components/DigestSettingsCard";
import { generateProfileSummary, UserProfile } from "@/lib/ai";
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
  buildRankingReasonText,
  RankedBill,
} from "@/lib/dashboard-ranking";

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile>({
    email: "",
    interests: [],
    contexts: [],
    age: "",
    gender: "",
  });

  const [allBills, setAllBills] = useState<Bill[]>([]);
  const [profileAudiences, setProfileAudiences] = useState<ProfileAudience[]>(
    []
  );
  const [billAudiencesByBillId, setBillAudiencesByBillId] = useState<
    Record<string, BillAudience[]>
  >({});
  const [loadingBills, setLoadingBills] = useState(true);
  const [billsError, setBillsError] = useState("");

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
    async function loadDashboardData() {
      try {
        const bills = await getAllBills();
        setAllBills(bills);

        const email = localStorage.getItem("userEmail") || "";

        if (email) {
          try {
            const storedProfileAudiences = await getProfileAudiencesByEmail(
              email
            );
            setProfileAudiences(storedProfileAudiences);
          } catch (error) {
            console.error("Failed to load profile audiences", error);
          }
        }

        const audienceEntries = await Promise.all(
          bills.map(async (bill) => {
            try {
              const audiences = await getBillAudiencesByBillId(bill.id);
              return [bill.id, audiences] as const;
            } catch (error) {
              console.error(`Failed to load bill audiences for ${bill.id}`, error);
              return [bill.id, []] as const;
            }
          })
        );

        setBillAudiencesByBillId(Object.fromEntries(audienceEntries));
      } catch (error) {
        console.error("Failed to load dashboard data from Supabase", error);
        setBillsError(
          "Harnold had trouble reaching the cloud pond, so the flock board is temporarily unavailable."
        );
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
    });
  }, [
    allBills,
    billAudiencesByBillId,
    profileAudiences,
    profile.interests,
    profile.contexts,
  ]);

  const profileSummary = generateProfileSummary(profile);

  return (
    <main className="page-shell px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="hand-drawn-card bg-white p-8">
          <div className="text-sm font-medium text-orange-700">
            Harnold’s legislative radar
          </div>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">
            Bills that may matter to you
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            {profile.interests.length > 0
              ? `Tracking: ${profile.interests.join(", ")}`
              : "Showing all demo bills in the flock"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {profile.contexts.length > 0
              ? `Context: ${profile.contexts.join(", ")}`
              : "Context: none selected"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {loadingBills
              ? "Harnold is ranking bills by pond relevance..."
              : `${rankedBills.length} bills currently in the flock.`}
          </p>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="grid gap-6">
            <ProfileSummary
              email={profile.email}
              interests={profile.interests}
              contexts={profile.contexts}
              age={profile.age}
              gender={profile.gender}
              summary={profileSummary}
            />

            <DigestSettingsCard />

            <SendDigestCard
              profile={profile}
              matchedBills={rankedBills.slice(0, 3).map((item) => item.bill)}
            />
          </div>

          <div className="grid gap-6">
            {billsError ? (
              <div className="hand-drawn-card bg-[#fff8ef] p-6 text-slate-700">
                {billsError}
              </div>
            ) : null}

            {!loadingBills && rankedBills.length === 0 && !billsError ? (
              <div className="hand-drawn-card bg-white p-6 text-slate-700">
                Harnold checked the pond and found no matching bills yet.
              </div>
            ) : null}

            {rankedBills.map((item) => {
              const { bill, matchedAudienceLabels } = item;

              return (
                <article key={bill.id} className="hand-drawn-card p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-3 flex flex-wrap gap-2">
                        <span className="badge-pill bg-teal-100 text-teal-800">
                          {buildRankingBadgeText(item)}
                        </span>
                      </div>

                      <h2 className="text-2xl font-bold">{bill.title}</h2>
                      <p className="mt-3 max-w-3xl text-lg text-slate-600">
                        {bill.summary}
                      </p>
                    </div>

                    <span className="badge-pill bg-orange-100 text-orange-800">
                      {bill.status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {bill.topics.map((topic) => (
                      <span
                        key={topic}
                        className="badge-pill text-sm text-slate-700"
                      >
                        {topic}
                      </span>
                    ))}
                  </div>

                  {matchedAudienceLabels.length > 0 ? (
                    <div className="mt-5 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-teal-50 p-4">
                      <p className="text-sm font-medium text-slate-500">
                        Audience overlap
                      </p>
                      <p className="mt-1 text-slate-700">
                        {matchedAudienceLabels.join(", ")}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-5 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4">
                    <p className="text-sm font-medium text-slate-500">
                      Why Harnold surfaced this
                    </p>
                    <p className="mt-1 text-slate-700">
                      {buildRankingReasonText(item)}
                    </p>
                  </div>

                  <div className="mt-5 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-white p-4">
                    <p className="text-sm font-medium text-slate-500">
                      Broader pattern
                    </p>
                    <p className="mt-1 text-slate-700">{bill.pattern}</p>
                  </div>

                  <Link
                    href={`/bills/${bill.id}`}
                    className="hand-drawn-button mt-6 inline-block bg-teal-600 px-5 py-2.5 font-semibold text-white"
                  >
                    View bill
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}