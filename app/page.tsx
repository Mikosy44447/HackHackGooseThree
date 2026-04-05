import Link from "next/link";
import HarnoldGoose from "@/components/HarnoldGoose";
import { WavyDivider, FeatherDoodle, SketchStar } from "@/components/HandDrawnAssets";

export default function HomePage() {
  return (
    <main className="page-shell text-slate-900">
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">

        {/* Nav */}
        <div className="mb-10 flex items-center justify-between border-b-2 border-dashed border-black/20 pb-5">
          <div className="flex items-center gap-3">
            <HarnoldGoose className="h-10 w-10 shrink-0 anim-bob" />
            <div>
              <div className="text-xl font-bold leading-tight">
                Politic<span className="text-teal-600">Alert</span>
              </div>
              <div className="text-xs text-slate-500">less doomscrolling · more useful honking</div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="hand-drawn-button hidden bg-white px-4 py-2 text-sm md:inline-block"
          >
            View feed
          </Link>
        </div>

        {/* Hero */}
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
              Government activity,{" "}
              <span className="sketch-underline text-teal-600">simplified</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700">
              Harnold tracks bills, regulations, executive orders, and court decisions
              that affect you — then explains them in plain English. Less jargon. More honk.
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
                Browse the feed
              </Link>
            </div>
          </div>

          {/* Harnold hero card */}
          <div className="relative py-6 px-2">
            <div className="hand-drawn-card rotate-1 p-6 bg-gradient-to-br from-orange-50 to-teal-50 anim-float">
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <HarnoldGoose className="h-20 w-20 anim-bob" />
                </div>
                <div>
                  <p className="text-base text-slate-700 leading-relaxed italic">
                    &ldquo;This bill may affect immigrant families, students, and middle-class
                    households. I repeat: this is not a drill. It is a bill.&rdquo;
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="badge-pill text-xs text-slate-500">Healthcare</span>
                    <span className="badge-pill text-xs bg-teal-50 text-teal-700">Affects you</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating stickers — four distinct corners, won't collide */}
            {/* Bottom-left */}
            <div className="hand-drawn-card absolute -left-2 -bottom-2 hidden -rotate-6 bg-white px-4 py-2.5 md:flex items-center gap-2 anim-wiggle">
              <SketchStar className="w-5 h-5" />
              <div className="text-sm font-medium">New regulation!</div>
            </div>
            {/* Bottom-right */}
            <div className="hand-drawn-card absolute -bottom-2 -right-2 hidden rotate-3 bg-red-100 px-4 py-2.5 md:block anim-float" style={{animationDelay: "0.8s"}}>
              <div className="text-sm font-medium">Executive Order →</div>
            </div>
            {/* Top-right — feather only, no text to crowd the HONK bubble */}
            <FeatherDoodle className="absolute -right-4 top-2 hidden h-20 opacity-50 md:block anim-bob" style={{animationDelay: "1.2s"}} />
          </div>
        </div>

        <WavyDivider className="mt-16 w-full opacity-70 wavy-animated" />

        {/* Content types */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { border: "ct-bill", icon: "📋", label: "Bills", text: "Congressional legislation tracked as it moves through chambers." },
            { border: "ct-regulation", icon: "📑", label: "Regulations", text: "Federal agency rules from the Federal Register." },
            { border: "ct-executive-order", icon: "🖊️", label: "Executive Orders", text: "Presidential directives and proclamations." },
            { border: "ct-court-decision", icon: "⚖️", label: "Court Decisions", text: "Significant federal court rulings from CourtListener." },
          ].map((item) => (
            <div key={item.label} className={`hand-drawn-card bg-white p-5 ${item.border}`}>
              <div className="mb-2 text-2xl">{item.icon}</div>
              <div className="font-bold text-slate-900">{item.label}</div>
              <p className="mt-1 text-sm text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>

        <WavyDivider className="mt-8 w-full opacity-70 wavy-animated" />

        {/* Features */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            {
              emoji: "🔔",
              title: "Personalized alerts",
              text: "Ranked by your interests, demographics, and life context using a 5-dimensional relevance engine.",
            },
            {
              emoji: "📜",
              title: "Plain-language summaries",
              text: "See what each item does without needing a law degree or emotional support highlighter.",
            },
            {
              emoji: "🧭",
              title: "Pattern detection",
              text: "Connect one bill to broader legislative movements and recurring policy themes.",
            },
          ].map((item) => (
            <div key={item.title} className="hand-drawn-card p-6 relative anim-fade-up">
              <SketchStar className="absolute top-2 right-2 w-8 h-8 opacity-30 anim-wiggle" />
              <div className="mb-3 text-3xl">{item.emoji}</div>
              <h3 className="text-xl font-bold">{item.title}</h3>
              <p className="mt-2 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>

      </section>
    </main>
  );
}