"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upsertGooseProfile } from "@/lib/supabase/profile-store";
import { replaceProfileAudiences } from "@/lib/supabase/profile-audiences-store";
import { deriveProfileAudiences } from "@/lib/audience-matching";

const interestOptions = [
  "Education",
  "Civil Rights",
  "Language Access",
  "Healthcare",
  "Higher Education",
  "Taxes",
  "Economy",
];

const contextOptions = [
  "Asian American",
  "Immigrant Family",
  "First-Generation Student",
  "Middle Class",
];

const ageOptions = ["Under 18", "18-24", "25-34", "35-49", "50-64", "65+"];

const genderOptions = ["Woman", "Man", "Nonbinary", "Prefer not to say"];

export default function PreferencesPage() {
  const [email, setEmail] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
  const [selectedAge, setSelectedAge] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();

  function toggleInterest(option: string) {
    setSelectedInterests((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  }

  function toggleContext(option: string) {
    setSelectedContexts((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  }

  async function handleContinue() {
    if (!email.trim()) {
      setStatus("Harnold needs an email before he can honk responsibly.");
      return;
    }

    setSaving(true);
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();

    localStorage.setItem("userEmail", cleanEmail);
    localStorage.setItem("userInterests", JSON.stringify(selectedInterests));
    localStorage.setItem("userContexts", JSON.stringify(selectedContexts));
    localStorage.setItem("userAge", selectedAge);
    localStorage.setItem("userGender", selectedGender);

    try {
      await upsertGooseProfile({
        email: cleanEmail,
        interests: selectedInterests,
        contexts: selectedContexts,
        age: selectedAge,
        gender: selectedGender,
        digest_enabled: true,
        digest_frequency: "Weekly",
      });
        const derivedAudiences = deriveProfileAudiences({
        email: cleanEmail,
        interests: selectedInterests,
        contexts: selectedContexts,
        age: selectedAge,
        gender: selectedGender,
    });

await replaceProfileAudiences(cleanEmail, derivedAudiences);
      router.push(`/dashboard?email=${encodeURIComponent(cleanEmail)}`);
    } catch (error) {
      console.error("Failed to save goose profile", error);

      setStatus(
        "Supabase had a small pond incident, so Harnold saved your settings locally and kept marching."
      );

      router.push(`/dashboard?email=${encodeURIComponent(cleanEmail)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="hand-drawn-card bg-white p-8 md:p-10">
          <div className="mb-2 text-sm font-medium text-orange-700">
            Harnold’s onboarding clipboard
          </div>
          <h1 className="text-4xl font-bold md:text-5xl">
            Tell Harnold what to watch
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-slate-600">
            Pick your interests and life context so Harnold can honk at the
            right bills instead of every bill. Even geese respect inbox
            boundaries.
          </p>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600"
            />
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-bold">Policy interests</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {interestOptions.map((option) => {
                const active = selectedInterests.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleInterest(option)}
                    className={`rounded-[14px_26px_14px_26px] border-2 p-4 text-left transition ${
                      active
                        ? "border-slate-900 bg-teal-600 text-white shadow-[4px_4px_0_rgba(0,0,0,0.18)]"
                        : "border-slate-900/20 bg-white hover:bg-orange-50"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-2xl font-bold">Life context</h2>
            <p className="mt-2 text-slate-600">
              Optional, but helpful for personalization.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {contextOptions.map((option) => {
                const active = selectedContexts.includes(option);

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleContext(option)}
                    className={`rounded-[14px_26px_14px_26px] border-2 p-4 text-left transition ${
                      active
                        ? "border-slate-900 bg-orange-400 text-slate-900 shadow-[4px_4px_0_rgba(0,0,0,0.18)]"
                        : "border-slate-900/20 bg-white hover:bg-teal-50"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Age group
              </label>
              <select
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600"
              >
                <option value="">Select an age group</option>
                {ageOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Gender
              </label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600"
              >
                <option value="">Select a gender</option>
                {genderOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={saving}
            className="hand-drawn-button mt-10 bg-slate-900 px-6 py-3 text-lg font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Harnold is filing paperwork..." : "Let Harnold loose"}
          </button>

          {status ? (
            <div className="mt-4 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4 text-slate-700">
              {status}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}