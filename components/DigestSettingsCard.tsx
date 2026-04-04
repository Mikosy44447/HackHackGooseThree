"use client";

import { useEffect, useMemo, useState } from "react";
import { updateGooseDigestSettings } from "@/lib/supabase/profile-store";

type DigestSettingsCardProps = {
  email?: string;
  initialEnabled?: boolean;
  initialFrequency?: string;
};

function getNextSendText(frequency: string): string {
  const now = new Date();
  const next = new Date(now);
  if (frequency === "Daily") {
    next.setDate(now.getDate() + 1);
  } else if (frequency === "Twice a week") {
    next.setDate(now.getDate() + 3);
  } else if (frequency === "Monthly") {
    next.setMonth(now.getMonth() + 1);
  } else {
    next.setDate(now.getDate() + 7);
  }
  return next.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DigestSettingsCard({
  email,
  initialEnabled = true,
  initialFrequency = "Weekly",
}: DigestSettingsCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [frequency, setFrequency] = useState(initialFrequency);

  useEffect(() => { setEnabled(initialEnabled); }, [initialEnabled]);
  useEffect(() => { setFrequency(initialFrequency); }, [initialFrequency]);

  useEffect(() => {
    localStorage.setItem("digestEnabled", String(enabled));
    localStorage.setItem("digestFrequency", frequency);
  }, [enabled, frequency]);

  useEffect(() => {
    if (!email) return;
    updateGooseDigestSettings(email, enabled, frequency).catch((err) => {
      console.error("Failed to sync digest settings", err);
    });
  }, [email, enabled, frequency]);

  const nextSendText = useMemo(() => getNextSendText(frequency), [frequency]);

  return (
    <section className="hand-drawn-card bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-medium text-orange-700">Digest</div>
          <h2 className="mt-0.5 text-base font-bold">Email schedule</h2>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((prev) => !prev)}
          className={
            "hand-drawn-button px-3 py-1.5 text-sm font-semibold " +
            (enabled ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-800")
          }
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      <select
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        disabled={!enabled}
        className="mt-3 w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:opacity-60"
      >
        <option>Daily</option>
        <option>Twice a week</option>
        <option>Weekly</option>
        <option>Monthly</option>
      </select>

      <p className="mt-2 text-xs text-slate-400">
        {enabled ? "Next: " + nextSendText : "Paused"}
      </p>
    </section>
  );
}
