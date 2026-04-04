type ProfileSummaryProps = {
  email?: string;
  interests: string[];
  contexts: string[];
  age?: string;
  gender?: string;
  income?: string;
  education?: string;
  race?: string[];
  location?: string;
  employment?: string;
  family?: string;
  summary?: string;
};

export default function ProfileSummary({
  email,
  interests,
  contexts,
  age,
  gender,
  income,
  education,
  race,
  location,
  employment,
  family,
}: ProfileSummaryProps) {
  const demographics = [age, gender, income, education, location, employment, family]
    .filter(Boolean) as string[];
  const raceList = race ?? [];

  const hasAnything =
    interests.length > 0 ||
    contexts.length > 0 ||
    demographics.length > 0 ||
    raceList.length > 0;

  return (
    <section className="hand-drawn-card bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-orange-700">Your profile</div>
        {email ? (
          <span className="text-xs text-slate-400 truncate max-w-[160px]">{email}</span>
        ) : null}
      </div>

      {!hasAnything ? (
        <p className="mt-3 text-sm text-slate-500">
          Complete onboarding to personalize your feed.
        </p>
      ) : null}

      {interests.length > 0 ? (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
            Interests
          </div>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((item) => (
              <span
                key={item}
                className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {contexts.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
            Context
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contexts.map((item) => (
              <span
                key={item}
                className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-800"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {raceList.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 text-xs font-medium text-slate-400 uppercase tracking-wide">
            Background
          </div>
          <div className="flex flex-wrap gap-1.5">
            {raceList.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {demographics.length > 0 ? (
        <div className="mt-3 text-xs text-slate-400">
          {demographics.join(" · ")}
        </div>
      ) : null}
    </section>
  );
}
