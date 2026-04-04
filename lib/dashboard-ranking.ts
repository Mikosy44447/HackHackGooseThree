import type { Bill } from "@/lib/supabase/bills-store";
import type { BillAudience } from "@/lib/supabase/bill-audiences-store";
import type { ProfileAudience } from "@/lib/supabase/profile-audiences-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function tokenSet(value: string) {
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

function overlapScore(a: string, b: string) {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap;
}

// ─── Interest expansion dictionary ───────────────────────────────────────────
// Maps normalized interest keywords → related terms used in bill/reg text.
// Keep tight: only terms that are clearly about the same topic.

const INTEREST_EXPANSIONS: Record<string, string[]> = {
  education: ["school", "student", "college", "university", "tuition", "teacher", "academic", "curriculum", "campus", "enrollment", "pell", "financial aid", "higher education", "k-12", "classroom"],
  healthcare: ["health", "medical", "hospital", "insurance", "medicare", "medicaid", "prescription", "clinical", "patient", "mental health", "drug", "pharmaceutical", "nursing", "physician", "affordable care", "aca"],
  environment: ["environmental", "climate", "carbon", "emission", "pollution", "clean energy", "renewable", "conservation", "epa", "fossil fuel", "wildfire", "drought", "endangered species", "clean air", "clean water"],
  immigration: ["immigrant", "visa", "asylum", "border", "citizenship", "deportation", "refugee", "undocumented", "daca", "green card", "detention", "removal", "naturalization"],
  housing: ["rent", "mortgage", "affordable housing", "tenant", "landlord", "zoning", "eviction", "homelessness", "homeowner", "hud", "public housing", "fair housing"],
  economy: ["economic", "budget", "inflation", "wage", "gdp", "fiscal", "trade", "tariff", "recession", "deficit", "spending", "appropriation", "financial"],
  taxes: ["tax", "irs", "deduction", "credit", "income tax", "corporate tax", "capital gains", "estate tax", "tax reform"],
  labor: ["worker", "union", "wage", "workplace", "labor rights", "minimum wage", "overtime", "osha", "collective bargaining", "employee"],
  "criminal justice": ["police", "incarceration", "prison", "sentencing", "law enforcement", "justice reform", "probation", "parole", "crime", "prosecution"],
  technology: ["artificial intelligence", "ai", "data privacy", "cybersecurity", "digital", "internet", "software", "algorithm", "surveillance", "tech"],
  "civil rights": ["discrimination", "equality", "civil liberties", "voting rights", "lgbtq", "racial", "gender", "disability rights", "hate crime"],
  "foreign policy": ["foreign", "international", "diplomacy", "sanctions", "treaty", "nato", "defense", "national security", "embassy"],
  "social security": ["social security", "retirement", "pension", "disability benefits", "ssa", "supplemental"],
  agriculture: ["farm", "agriculture", "crop", "rural", "usda", "pesticide", "livestock", "food safety", "subsidy"],
  veterans: ["veteran", "military service", "va benefit", "ptsd", "combat", "deployment", "service member"],
  "small business": ["small business", "entrepreneur", "startup", "sba", "self-employed", "sole proprietor", "gig"],
  infrastructure: ["infrastructure", "bridge", "highway", "transit", "broadband", "utility", "grid", "water system", "road"],
  drugs: ["opioid", "addiction", "substance abuse", "fentanyl", "naloxone", "cannabis", "marijuana", "dea"],
  privacy: ["data privacy", "surveillance", "personal data", "tracking", "fourth amendment", "consumer data"],
};

function expandInterest(interest: string): string[] {
  const norm = normalizeText(interest);
  const terms = new Set([norm]);

  // Direct lookup
  const direct = INTEREST_EXPANSIONS[norm];
  if (direct) direct.forEach((t) => terms.add(t));

  // Partial key match: "health" picks up "healthcare", "mental health" etc.
  for (const [key, synonyms] of Object.entries(INTEREST_EXPANSIONS)) {
    if (key !== norm && (key.includes(norm) || norm.includes(key))) {
      terms.add(key);
      synonyms.forEach((t) => terms.add(t));
    }
  }

  return Array.from(terms);
}

// ─── Text scoring ─────────────────────────────────────────────────────────────

function scoreTextAgainstExpanded(
  text: string,
  expandedMap: Map<string, string[]>
): { score: number; matched: string[] } {
  const t = normalizeText(text);
  let score = 0;
  const matched: string[] = [];

  for (const [original, terms] of expandedMap.entries()) {
    const isCore = normalizeText(original);
    let localScore = 0;

    for (const term of terms) {
      if (t.includes(term)) {
        // Core term match worth more than synonym match
        localScore += term === isCore ? 2 : 0.5;
      }
    }

    if (localScore > 0) {
      score += localScore;
      matched.push(original);
    }
  }

  return { score, matched };
}

// ─── Audience matching ────────────────────────────────────────────────────────

function scoreBillAgainstProfileAudiences(
  billAudiences: BillAudience[],
  profileAudiences: ProfileAudience[]
) {
  let score = 0;
  const matches: string[] = [];

  for (const billAudience of billAudiences) {
    const billLabel = normalizeText(billAudience.audienceLabelRaw);
    const billKey = normalizeText(billAudience.normalizedAudienceKey ?? "");
    const billRationale = normalizeText(billAudience.audienceRationale);

    for (const profileAudience of profileAudiences) {
      const profileLabel = normalizeText(profileAudience.audienceLabel);
      const profileKey = normalizeText(profileAudience.normalizedAudienceKey ?? "");
      const profileConfidence = Number(profileAudience.confidence) || 0;

      let localScore = 0;

      if (billKey && profileKey && billKey === profileKey) {
        localScore += 7 + profileConfidence;
      }
      if (billLabel === profileLabel) {
        localScore += 6 + profileConfidence;
      }
      if (billLabel.includes(profileLabel) && profileLabel.length > 2) {
        localScore += 3.5 + profileConfidence * 0.5;
      }
      if (profileLabel.includes(billLabel) && billLabel.length > 3) {
        localScore += 2.5 + profileConfidence * 0.4;
      }
      localScore += overlapScore(billLabel, profileLabel) * 1.25;
      if (billRationale.includes(profileLabel)) {
        localScore += 1.5;
      }

      if (localScore > 0) {
        score += localScore + Number(billAudience.confidence || 0);
        matches.push(billAudience.audienceLabelRaw);
      }
    }
  }

  return {
    score,
    matchedAudienceLabels: Array.from(new Set(matches)).slice(0, 3),
  };
}

// ─── Topic / context matching ─────────────────────────────────────────────────

function scoreBillAgainstTopics(
  bill: Bill,
  interests: string[],
  contexts: string[],
  expandedMap: Map<string, string[]>
) {
  let score = 0;
  const topicMatches: string[] = [];
  const contextMatches: string[] = [];

  for (const topic of bill.topics) {
    const topicNorm = normalizeText(topic);
    let best = 0;

    for (const [, terms] of expandedMap.entries()) {
      for (const term of terms) {
        if (topicNorm === term) { best = Math.max(best, 3); break; }
        if (topicNorm.includes(term) || term.includes(topicNorm)) { best = Math.max(best, 2); }
        else if (overlapScore(topicNorm, term) > 0) { best = Math.max(best, 1); }
      }
    }

    if (best > 0) {
      score += best * 1.5; // topics are curated signals — upweight slightly
      topicMatches.push(topic);
    }
  }

  for (const group of bill.affectedGroups) {
    const groupNorm = normalizeText(group);
    const matched = contexts.some((context) => {
      const c = normalizeText(context);
      return groupNorm.includes(c) || c.includes(groupNorm) || overlapScore(groupNorm, c) > 0;
    });
    if (matched) {
      score += 2;
      contextMatches.push(group);
    }
  }

  return {
    score,
    topicMatches: Array.from(new Set(topicMatches)).slice(0, 2),
    contextMatches: Array.from(new Set(contextMatches)).slice(0, 2),
  };
}

// ─── Demographic scoring ──────────────────────────────────────────────────────

function scoreDemographics(
  bill: Bill,
  billAudiences: BillAudience[],
  profile: {
    income?: string;
    employment?: string;
    family?: string;
    education?: string;
    age?: string;
  }
): number {
  const allText = normalizeText(
    [bill.title, bill.summary, ...billAudiences.map((a) => a.whyItMatters)].join(" ")
  );

  let score = 0;

  if (profile.income) {
    const inc = normalizeText(profile.income);
    if (inc.includes("low") && /low.income|poverty|medicaid|snap|food stamp|welfare/.test(allText)) score += 1.5;
    if (inc.includes("middle") && /middle.class|middle.income|working family/.test(allText)) score += 1.5;
    if ((inc.includes("high") || inc.includes("upper")) && /capital gains|estate tax|wealth tax|high.income/.test(allText)) score += 1.5;
  }

  if (profile.employment) {
    const emp = normalizeText(profile.employment);
    if (/self.employ|freelan|contractor|gig/.test(emp) && /self.employed|small business|contractor|gig|sole proprietor/.test(allText)) score += 2;
    if (/student/.test(emp) && /student loan|tuition|financial aid|college/.test(allText)) score += 2;
    if (/retir/.test(emp) && /social security|medicare|retirement|pension/.test(allText)) score += 2;
    if (/unemploy|job seek/.test(emp) && /unemployment|job training|workforce development/.test(allText)) score += 2;
    if (/teacher|educator/.test(emp) && /school|teacher|education|curriculum/.test(allText)) score += 2;
    if (/health|nurse|doctor|physician/.test(emp) && /healthcare|medicaid|hospital|clinical/.test(allText)) score += 2;
  }

  if (profile.family) {
    const fam = normalizeText(profile.family);
    if (/parent|child|kid/.test(fam) && /child|parent|family|school|k-12|childcare/.test(allText)) score += 1.5;
    if (/caregiv/.test(fam) && /caregiver|elder care|disability|long.term care/.test(allText)) score += 1.5;
    if (/veteran/.test(fam) && /veteran|military|va benefit/.test(allText)) score += 1.5;
  }

  if (profile.education) {
    const edu = normalizeText(profile.education);
    if (/no degree|high school/.test(edu) && /workforce|vocational|community college|trade/.test(allText)) score += 1;
    if (/college|bachelor|graduate/.test(edu) && /student loan|higher education|research|university/.test(allText)) score += 1;
  }

  if (profile.age) {
    const age = parseInt(profile.age);
    if (!isNaN(age)) {
      if (age < 30 && /student loan|first.time homebuyer|young adult|youth/.test(allText)) score += 1;
      if (age >= 55 && /social security|medicare|retirement|senior|elder/.test(allText)) score += 1;
    }
  }

  return score;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RankedBill = {
  bill: Bill;
  score: number;
  matchedAudienceLabels: string[];
  topicMatches: string[];
  contextMatches: string[];
};

// ─── Main ranking function ────────────────────────────────────────────────────

export type UserDemographics = {
  income?: string;
  employment?: string;
  family?: string;
  education?: string;
  age?: string;
};

export function rankBillsForDashboard(input: {
  bills: Bill[];
  billAudiencesByBillId: Record<string, BillAudience[]>;
  profileAudiences: ProfileAudience[];
  interests: string[];
  contexts: string[];
  demographics?: UserDemographics;
}): RankedBill[] {
  // Expand interests once for the whole pass
  const expandedMap = new Map<string, string[]>();
  for (const interest of input.interests) {
    expandedMap.set(interest, expandInterest(interest));
  }

  const ranked = input.bills.map((bill) => {
    const billAudiences = input.billAudiencesByBillId[bill.id] ?? [];

    // 1. Audience label matching (structured, high-confidence)
    const audienceMatch = scoreBillAgainstProfileAudiences(billAudiences, input.profileAudiences);

    // 2. Topic array matching with expansion
    const topicMatch = scoreBillAgainstTopics(bill, input.interests, input.contexts, expandedMap);

    // 3. Full-text matching: title (high weight) + summary (lower weight)
    const { score: titleScore, matched: titleMatched } = scoreTextAgainstExpanded(bill.title, expandedMap);
    const { score: summaryScore } = scoreTextAgainstExpanded(bill.summary, expandedMap);

    // 4. Audience explanation text matching
    const audienceTextScore = billAudiences.reduce((sum, a) => {
      const { score } = scoreTextAgainstExpanded(a.whyItMatters, expandedMap);
      return sum + score * 0.3;
    }, 0);

    // 5. Demographic signals
    const demoScore = input.demographics
      ? scoreDemographics(bill, billAudiences, input.demographics)
      : 0;

    const totalScore =
      audienceMatch.score +
      topicMatch.score +
      titleScore * 1.5 +
      summaryScore * 0.8 +
      audienceTextScore +
      demoScore;

    const allTopicMatches = Array.from(
      new Set([...topicMatch.topicMatches, ...titleMatched])
    ).slice(0, 2);

    return {
      bill,
      score: totalScore,
      matchedAudienceLabels: audienceMatch.matchedAudienceLabels,
      topicMatches: allTopicMatches,
      contextMatches: topicMatch.contextMatches,
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

// ─── Badge + reason text ──────────────────────────────────────────────────────

export function buildRankingBadgeText(item: RankedBill): string {
  if (item.score >= 14) return "🪿 HONK!";
  if (item.score >= 8) return "Likely relevant";
  if (item.score >= 3) return "Worth a look";
  return "";
}

export function buildRankingReasonText(item: RankedBill): string {
  const reasons: string[] = [];

  if (item.matchedAudienceLabels.length > 0) {
    reasons.push("Overlaps with your audience profile");
  }
  if (item.topicMatches.length > 0) {
    reasons.push(`Topic match: ${item.topicMatches.join(", ")}`);
  }
  if (item.contextMatches.length > 0) {
    reasons.push(`Affects: ${item.contextMatches.join(", ")}`);
  }
  if (!reasons.length) {
    reasons.push("General Harnold relevance scan");
  }

  return reasons.slice(0, 2).join(" · ");
}

export type { RankedBill };
