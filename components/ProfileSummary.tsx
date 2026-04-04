type ProfileSummaryProps = {
  email?: string;
  interests: string[];
  contexts: string[];
  age?: string;
  gender?: string;
  summary: string;
};

export default function ProfileSummary({
  email,
  interests,
  contexts,
  age,
  gender,
  summary,
}: ProfileSummaryProps) {
  return (
    <section className="hand-drawn-card bg-white p-6">
      <div className="text-sm font-medium text-orange-700">
        Harnold’s notes
      </div>
      <h2 className="mt-2 text-2xl font-bold">Your profile</h2>

      <div className="mt-4 space-y-2 text-slate-700">
        {email ? (
          <p>
            <span className="font-semibold">Email:</span> {email}
          </p>
        ) : null}

        <p>
          <span className="font-semibold">Interests:</span>{" "}
          {interests.length > 0 ? interests.join(", ") : "None selected"}
        </p>

        <p>
          <span className="font-semibold">Contexts:</span>{" "}
          {contexts.length > 0 ? contexts.join(", ") : "None selected"}
        </p>

        <p>
          <span className="font-semibold">Age group:</span> {age || "Not provided"}
        </p>

        <p>
          <span className="font-semibold">Gender:</span> {gender || "Not provided"}
        </p>
      </div>

      <div className="mt-5 rounded-[12px_20px_12px_20px] border-2 border-slate-900/10 bg-[#fff8ef] p-4">
        <p className="text-sm font-medium text-slate-500">AI summary</p>
        <p className="mt-2 text-slate-700">{summary}</p>
      </div>
    </section>
  );
}