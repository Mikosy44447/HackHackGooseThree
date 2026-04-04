"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import HarnoldGoose from "@/components/HarnoldGoose";
import { HonkBubble, FeatherDoodle, PondRipple } from "@/components/HandDrawnAssets";

type Message = { role: "user" | "assistant"; content: string };

const GREETING: Message = {
  role: "assistant",
  content:
    "HONK! Welcome to PoliticAlert — I'm Harnold, your civic-minded goose companion. I take democracy very seriously, mostly because I once tried to read a tax bill and it took me three hours.\n\nI'm going to ask you a few questions so I can personalize your legislative feed. Let's start with the fun stuff: what policy areas matter most to you? Think education, healthcare, taxes, civil rights, immigration, housing, the economy — whatever's on your mind.",
};

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? (typeof window !== "undefined" ? localStorage.getItem("userEmail") : "") ?? "";

  const [history, setHistory] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading || done) return;

    const userMessage: Message = { role: "user", content: text };
    const nextHistory = [...history, userMessage];
    setHistory(nextHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: nextHistory, email }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
      };
      setHistory((prev) => [...prev, assistantMessage]);

      if (data.done) {
        setDone(true);

        // Mirror new profile fields to localStorage
        if (data.profile) {
          const p = data.profile;
          localStorage.setItem("userEmail", email);
          localStorage.setItem("userInterests", JSON.stringify(p.interests ?? []));
          localStorage.setItem("userContexts", JSON.stringify(p.contexts ?? []));
          localStorage.setItem("userAge", p.age ?? "");
          localStorage.setItem("userGender", p.gender ?? "");
          localStorage.setItem("userIncome", p.income ?? "");
          localStorage.setItem("userEducation", p.education ?? "");
          localStorage.setItem("userRace", JSON.stringify(p.race ?? []));
          localStorage.setItem("userLocation", p.location ?? "");
          localStorage.setItem("userEmployment", p.employment ?? "");
          localStorage.setItem("userFamily", p.family ?? "");
        }

        setTimeout(() => {
          router.push(`/dashboard?email=${encodeURIComponent(email)}`);
        }, 2000);
      }
    } catch (err) {
      console.error("Onboarding API error", err);
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "HONK! Harnold hit a turbulence patch. Try sending that again.",
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <main className="page-shell flex flex-col text-slate-900" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="relative flex items-center gap-3 border-b-2 border-dashed border-black/20 px-6 py-4 bg-white overflow-hidden">
        <PondRipple className="absolute -right-2 top-1/2 -translate-y-1/2 w-20 opacity-30 pointer-events-none" />
        <FeatherDoodle className="absolute right-16 top-0 h-10 opacity-20 pointer-events-none" />
        <div className="relative shrink-0">
          <HarnoldGoose className="h-10 w-10 anim-bob" />
        </div>
        <div>
          <div className="font-bold">Harnold</div>
          <div className="text-xs text-slate-500">Setting up your profile</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="mr-2 mt-1 shrink-0">
                  <HarnoldGoose className="h-8 w-8 anim-bob" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-[16px_20px_20px_4px] border-2 px-4 py-3 text-base leading-relaxed ${
                  msg.role === "assistant"
                    ? "border-slate-900/15 bg-white text-slate-800"
                    : "rounded-[20px_4px_16px_20px] border-teal-700/20 bg-teal-600 text-white"
                }`}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start items-center gap-2">
              <HarnoldGoose className="h-8 w-8 shrink-0 anim-bob" />
              <div className="rounded-[16px_20px_20px_4px] border-2 border-slate-900/15 bg-white px-4 py-3 text-slate-400">
                Harnold is thinking...
              </div>
            </div>
          )}

          {done && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <HarnoldGoose className="h-16 w-16 anim-bob" />
                <HonkBubble className="absolute -top-10 -left-6 w-24 anim-honk-pop" />
              </div>
              <div className="text-sm text-slate-500">Redirecting to your dashboard...</div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t-2 border-dashed border-black/20 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || done}
            placeholder={done ? "Profile saved!" : "Type your answer... (Enter to send, Shift+Enter for new line)"}
            rows={2}
            className="flex-1 resize-none rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 text-base outline-none focus:border-teal-600 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || done || !input.trim()}
            className="hand-drawn-button self-end bg-teal-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </main>
  );
}
