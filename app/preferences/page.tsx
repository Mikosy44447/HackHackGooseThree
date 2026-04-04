"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getGooseProfileByEmail } from "@/lib/supabase/profile-store";
import HarnoldGoose from "@/components/HarnoldGoose";
import { HonkBubble, FeatherDoodle, SketchStar, PondRipple } from "@/components/HandDrawnAssets";

type Step = "email-check" | "login" | "setup";

export default function PreferencesPage() {
  const [step, setStep] = useState<Step>("email-check");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const router = useRouter();

  function goBackToEmailCheck() {
    setStep("email-check");
    setStatus("");
    setPassword("");
  }

  async function handleEmailCheck() {
    if (!email.trim()) {
      setStatus("Harnold needs an email before he can honk responsibly.");
      return;
    }

    setChecking(true);
    setStatus("");

    const cleanEmail = email.trim().toLowerCase();

    try {
      const existing = await getGooseProfileByEmail(cleanEmail);
      setEmail(cleanEmail);
      setPassword("");
      setStep(existing ? "login" : "setup");
    } catch {
      setEmail(email.trim().toLowerCase());
      setPassword("");
      setStep("setup");
    } finally {
      setChecking(false);
    }
  }

  async function handleLogin() {
    if (!password) {
      setStatus("Harnold needs your password to let you through the gate.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          setStatus("Check your inbox — you need to confirm your email before logging in.");
        } else {
          setStatus(error.message);
        }
        return;
      }

      const profile = await getGooseProfileByEmail(email);
      if (profile) {
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userInterests", JSON.stringify(profile.interests ?? []));
        localStorage.setItem("userContexts", JSON.stringify(profile.contexts ?? []));
        localStorage.setItem("userAge", profile.age ?? "");
        localStorage.setItem("userGender", profile.gender ?? "");
        localStorage.setItem("userIncome", profile.income ?? "");
        localStorage.setItem("userEducation", profile.education ?? "");
        localStorage.setItem("userRace", JSON.stringify(profile.race ?? []));
        localStorage.setItem("userLocation", profile.location ?? "");
        localStorage.setItem("userEmployment", profile.employment ?? "");
        localStorage.setItem("userFamily", profile.family ?? "");
      }

      router.push(`/dashboard?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error("Login failed", error);
      setStatus("Something went wrong. Harnold is investigating.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegister() {
    if (!password) {
      setStatus("Pick a password so Harnold can guard your account.");
      return;
    }
    if (password.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const { error } = await supabase.auth.signUp({ email, password });

      if (error) {
        setStatus(error.message);
        return;
      }

      localStorage.setItem("userEmail", email);
      router.push(`/onboarding?email=${encodeURIComponent(email)}`);
    } catch (error) {
      console.error("Registration failed", error);
      setStatus("Something went wrong during registration.");
    } finally {
      setSaving(false);
    }
  }

  const emailDisplay = (
    <div className="mt-8">
      <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
      <div className="flex items-center gap-3">
        <span className="flex-1 rounded-2xl border-2 border-slate-900/20 bg-slate-50 px-4 py-3 text-slate-700">
          {email}
        </span>
        <button type="button" onClick={goBackToEmailCheck} className="text-sm text-slate-500 underline hover:text-slate-700">
          Change
        </button>
      </div>
    </div>
  );
  // Note: emailDisplay is safe as a const because it contains no inputs —
  // only a <span> and a button, so remounting on re-render has no visible effect.


  const statusMessage = status ? (
    <div className="mt-4 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4 text-slate-700">
      {status}
    </div>
  ) : null;

  // ── Step: email-check ────────────────────────────────────────────────────────

  if (step === "email-check") {
    return (
      <main className="page-shell px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-lg">
          {/* Doodle row above card */}
          <div className="relative mb-6 flex items-end justify-center gap-4 h-28">
            <FeatherDoodle className="h-20 opacity-60 anim-bob" style={{animationDelay: "0.4s"}} />
            <div className="relative">
              <HarnoldGoose className="h-24 w-24 anim-bob" />
              <HonkBubble className="absolute -top-10 -left-8 w-24 anim-honk-pop" />
            </div>
            <FeatherDoodle className="h-16 opacity-40 anim-bob scale-x-[-1]" style={{animationDelay: "0.9s"}} />
          </div>

          <div className="hand-drawn-card bg-white p-8 md:p-10 relative">
            <SketchStar className="absolute top-3 right-3 w-8 h-8 opacity-25 anim-wiggle" />
            <div className="mb-4">
              <div className="text-lg font-bold leading-tight">
                Politic<span className="text-teal-600">Alert</span>
              </div>
              <div className="text-xs text-slate-500">Harnold&rsquo;s front door</div>
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">Welcome</h1>
            <p className="mt-2 text-slate-600">
              Enter your email to log in or create an account.
            </p>

            <div className="mt-8">
              <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailCheck()}
                className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600"
              />
            </div>

            <button
              onClick={handleEmailCheck}
              disabled={checking}
              className="hand-drawn-button mt-6 bg-slate-900 px-6 py-3 text-lg font-semibold text-white disabled:opacity-60"
            >
              {checking ? "Harnold is checking the flock list..." : "Continue →"}
            </button>

            {statusMessage}
          </div>
        </div>
      </main>
    );
  }

  // ── Step: login ──────────────────────────────────────────────────────────────

  if (step === "login") {
    return (
      <main className="page-shell px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-lg">
          <div className="hand-drawn-card bg-white p-8 md:p-10 relative">
            <PondRipple className="absolute bottom-3 right-3 w-20 opacity-30 pointer-events-none" />
            <div className="mb-4 flex items-center gap-3">
              <HarnoldGoose className="h-10 w-10 anim-bob" />
              <div className="text-sm font-medium text-orange-700">Welcome back, flock member</div>
            </div>
            <h1 className="text-4xl font-bold md:text-5xl">Log in</h1>
            <p className="mt-3 text-lg text-slate-600">
              Harnold found your account. Enter your password to continue.
            </p>

            {emailDisplay}

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={saving}
              className="hand-drawn-button mt-8 bg-slate-900 px-6 py-3 text-lg font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Harnold is checking credentials..." : "Log in →"}
            </button>

            {statusMessage}
          </div>
        </div>
      </main>
    );
  }

  // ── Step: setup (new account — email + password only) ────────────────────────

  return (
    <main className="page-shell px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-lg">
        <div className="hand-drawn-card bg-white p-8 md:p-10 relative">
          <SketchStar className="absolute top-3 right-3 w-9 h-9 opacity-25 anim-wiggle" style={{animationDelay: "0.3s"}} />
          <SketchStar className="absolute bottom-6 left-4 w-6 h-6 opacity-15 anim-wiggle" style={{animationDelay: "1.1s"}} />
          <div className="mb-2 text-sm font-medium text-orange-700">New account</div>
          <h1 className="text-4xl font-bold md:text-5xl">Create your account</h1>
          <p className="mt-3 text-lg text-slate-600">
            After this, Harnold will ask you a few questions to personalize your
            legislative feed.
          </p>

          {emailDisplay}

          <div className="mt-6">
            <label className="mb-2 block text-sm font-medium text-slate-700">Create a password (min 6 characters)</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRegister()}
              className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600"
            />
          </div>

          <button
            onClick={handleRegister}
            disabled={saving}
            className="hand-drawn-button mt-8 bg-slate-900 px-6 py-3 text-lg font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Harnold is filing paperwork..." : "Create account →"}
          </button>

          {statusMessage}
        </div>
      </div>
    </main>
  );
}
