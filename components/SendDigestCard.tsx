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
    <section className="hand-drawn-card bg-white p-6">
      <div className="text-sm font-medium text-orange-700">
        Harnold’s dispatch center
      </div>
      <h2 className="mt-2 text-2xl font-bold">Send your digest</h2>
      <p className="mt-3 text-slate-600">
        Send a real personalized email now, or trigger a 10-second demo send that
        feels like a scheduled digest.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={sendNow}
          disabled={loading}
          className="hand-drawn-button bg-teal-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Sending..." : "Send my digest now"}
        </button>

        <button
          type="button"
          onClick={sendInTenSeconds}
          disabled={loading}
          className="hand-drawn-button bg-orange-300 px-5 py-3 font-semibold text-slate-900 disabled:opacity-60"
        >
          Demo weekly send in 10s
        </button>
      </div>

      <p className="mt-4 text-sm text-slate-600">
        Recipient: {profile.email || "No email entered yet"}
      </p>

      {status ? (
        <div className="mt-4 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4 text-slate-700 break-words whitespace-pre-wrap">
          {status}
        </div>
      ) : null}
    </section>
  );
}