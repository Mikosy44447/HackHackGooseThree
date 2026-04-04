"use client";

import { useMemo, useState } from "react";
import { Bill } from "@/lib/bills";

type UserProfile = {
  email?: string;
  interests: string[];
  contexts: string[];
  age?: string;
  gender?: string;
};

export default function SendDigestCard({
  profile,
  matchedBills,
}: {
  profile: UserProfile;
  matchedBills: Bill[];
}) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const canSend = useMemo(() => {
    return Boolean(profile.email && matchedBills.length > 0);
  }, [profile.email, matchedBills.length]);

  async function sendNow() {
    if (!canSend) {
      setStatus("Add an email and at least one matching bill first.");
      return;
    }

    setLoading(true);
    setStatus("Harnold is flapping toward your inbox...");

    try {
      const response = await fetch("/api/send-digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: profile.email,
          profile,
          matchedBills,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        let message = "Failed to send digest.";

        if (typeof result?.error === "string") {
          message = result.error;
        } else if (result?.error?.message) {
          message = result.error.message;
        } else if (result?.message) {
          message = result.message;
        }

        throw new Error(message);
      }

      setStatus("Digest sent. Harnold has dispatched your legislative honk.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Send failed: ${error.message}`
          : "Something went wrong sending the digest."
      );
    } finally {
      setLoading(false);
    }
  }

  function sendInTenSeconds() {
    if (!canSend) {
      setStatus("Add an email and at least one matching bill first.");
      return;
    }

    setStatus("Demo timer started. Harnold will send in 10 seconds...");

    window.setTimeout(() => {
      void sendNow();
    }, 10000);
  }

  return (
    <section className="hand-drawn-card bg-white p-5">
      <div className="text-xs font-medium text-orange-700">Send digest</div>
      <h2 className="mt-0.5 text-base font-bold">Email your top bills</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={sendNow}
          disabled={loading || !canSend}
          className="hand-drawn-button bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send now"}
        </button>
        <button
          type="button"
          onClick={sendInTenSeconds}
          disabled={loading || !canSend}
          className="hand-drawn-button bg-slate-100 px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
        >
          Preview in 10s
        </button>
      </div>

      {status ? (
        <p className="mt-3 text-xs text-slate-600 break-words">{status}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-400">
          {profile.email || "No email set"}
        </p>
      )}
    </section>
  );
}