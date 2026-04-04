import Link from "next/link";
import HarnoldGoose from "@/components/HarnoldGoose";

export default function HomePage() {
  return (
    <main className="page-shell text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="mb-8 flex items-center justify-between border-b-2 border-dashed border-black/20 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-2xl shadow-[3px_3px_0_rgba(0,0,0,0.18)]">
              🪿
            </div>
            <div>
              <div className="text-2xl font-bold">
                Harnold<span className="text-teal-600">Alert</span>
              </div>
              <div className="text-sm text-slate-600">
                Civic updates with maximum honk
              </div>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="hand-drawn-button hidden bg-white px-4 py-2 md:inline-block"
          >
            View demo
          </Link>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="mb-5 inline-block rounded-full border-2 border-slate-900/20 bg-orange-100 px-4 py-1 text-sm font-medium text-orange-800">
              Honk! Your democracy companion has arrived
            </div>

            <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">
              Government activity,{" "}
              <span className="sketch-underline text-teal-600">simplified</span>
            </h1>

            <p className="mt-6 max-w-xl text-xl leading-9 text-slate-700">
              Harnold tracks bills and policy changes that affect you, then
              explains them in plain English. Less jargon. More honk.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/preferences"
                className="hand-drawn-button bg-teal-600 px-6 py-3 text-lg font-semibold text-white"
              >
                Start with Harnold →
              </Link>
              <Link
                href="/dashboard"
                className="hand-drawn-button bg-white px-6 py-3 text-lg"
              >
                See the flock in action
              </Link>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <div className="flex -space-x-2">
                {["A", "B", "C", "D"].map((letter) => (
                  <div
                    key={letter}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-sm font-bold"
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <p className="text-slate-600">
                Trusted by <span className="font-bold text-slate-900">2,400+</span>{" "}
                informed geese... and humans
              </p>
            </div>
          </div>

          <div className="relative">
            <div className="hand-drawn-card rotate-2 p-6">
              <div className="rounded-[1rem_2rem_1rem_2rem] border-2 border-slate-900 bg-gradient-to-br from-orange-100 to-teal-100 p-8">
                <div className="flex items-center gap-4">
                  <HarnoldGoose className="h-24 w-24 shrink-0" />
                  <div>
                    <h2 className="text-3xl font-bold">Harnold’s Hot Takes</h2>
                    <p className="mt-3 text-lg text-slate-700">
                      “This bill may affect immigrant families, students, and
                      middle class households. I repeat: this is not a drill.
                      It is a bill.”
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="hand-drawn-card absolute -left-4 top-4 hidden -rotate-6 bg-white px-4 py-3 md:block">
              <div className="text-sm font-medium">🔔 New bill affects you!</div>
            </div>

            <div className="hand-drawn-card absolute -bottom-5 right-2 hidden rotate-6 bg-orange-200 px-4 py-3 md:block">
              <div className="text-sm font-medium">Tax policy update!</div>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              emoji: "🔔",
              title: "Personalized alerts",
              text: "Track legislation by your interests, demographics, and life context.",
            },
            {
              emoji: "📜",
              title: "Plain-language summaries",
              text: "See what a bill does without needing a law degree or emotional support highlighter.",
            },
            {
              emoji: "🧭",
              title: "Pattern detection",
              text: "Connect one bill to broader legislative movements and recurring policy themes.",
            },
          ].map((item) => (
            <div key={item.title} className="hand-drawn-card p-6">
              <div className="mb-4 text-4xl">{item.emoji}</div>
              <h3 className="text-2xl font-bold">{item.title}</h3>
              <p className="mt-3 text-lg text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}