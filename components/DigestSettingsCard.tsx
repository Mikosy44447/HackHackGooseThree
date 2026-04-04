"use client";

import { useEffect, useMemo, useState } from "react";
import { updateGooseDigestSettings } from "@/lib/supabase/profile-store";

type DigestSettingsCardProps = {
  email?: string;
  initialEnabled?: boolean;
  initialFrequency?: string;
};

function getNextSendText(enabled: boolean, frequency: string) {
  if (!enabled) {
    return "Digest is currently paused.";
  }

  const now = new Date();
  const next = new Date(now);

  if (frequency === "Daily") {
    next.setDate(now.getDate() + 1);
  } else if (frequency === "Twice a week") {
    next.setDate(now.getDate() + 3);
  } else if (frequency === "Weekly") {
    next.setDate(now.getDate() + 7);
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
  const [status, setStatus] = useState("");

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  useEffect(() => {
    setFrequency(initialFrequency);
  }, [initialFrequency]);

  useEffect(() => {
    localStorage.setItem("digestEnabled", String(enabled));
    localStorage.setItem("digestFrequency", frequency);
  }, [enabled, frequency]);

  useEffect(() => {
    async function syncDigestSettings() {
      if (!email) return;

      try {
        await updateGooseDigestSettings(email, enabled, frequency);
        setStatus("Saved to Supabase. Harnold has updated the pond schedule.");
      } catch (error) {
        console.error("Failed to sync digest settings", error);
        setStatus(
          "Saved locally for now. Harnold dropped the clipboard in the pond, but the backup copy survived."
        );
      }
    }

    void syncDigestSettings();
  }, [email, enabled, frequency]);

  const nextSendText = useMemo(() => {
    return getNextSendText(enabled, frequency);
  }, [enabled, frequency]);

  return (
    <section className="hand-drawn-card bg-white p-6">
      <div className="text-sm font-medium text-orange-700">
        Harnold’s schedule board
      </div>
      <h2 className="mt-2 text-2xl font-bold">Digest settings</h2>
      <p className="mt-3 text-slate-600">
        Control how often Harnold sends updates. For the hackathon demo, the
        10-second send still works as your “scheduled” preview.
      </p>

      <div className="mt-5 flex items-center justify-between rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4">
        <div>
          <div className="font-semibold text-slate-900">Weekly digest</div>
          <div className="text-sm text-slate-600">
            Turn recurring updates on or off
          </div>
        </div>

        <button
          type="button"
          onClick={() => setEnabled((prev) => !prev)}
          className={`hand-drawn-button px-4 py-2 font-semibold ${
            enabled
              ? "bg-teal-600 text-white"
              : "bg-slate-200 text-slate-800"
          }`}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Frequency
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          disabled={!enabled}
          className="w-full rounded-2xl border-2 border-slate-900/20 bg-[#fffaf0] px-4 py-3 outline-none focus:border-teal-600 disabled:opacity-60"
        >
          <option>Daily</option>
          <option>Twice a week</option>
          <option>Weekly</option>
          <option>Monthly</option>
        </select>
      </div>

      <div className="mt-5 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-teal-50 p-4">
        <p className="text-sm font-medium text-slate-500">Next send</p>
        <p className="mt-1 text-slate-700">
          {enabled ? nextSendText : "No upcoming digest scheduled."}
        </p>
      </div>

      <div className="mt-4 text-sm text-slate-600">
        Harnold is now trying to keep this synchronized beyond one browser. A
        major emotional step for the goose.
      </div>

      {status ? (
        <div className="mt-4 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4 text-sm text-slate-700">
          {status}
        </div>
      ) : null}
    </section>
  );
}