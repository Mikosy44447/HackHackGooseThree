import type { UserProfile } from "@/lib/ai";
import type { BillAudience } from "@/lib/supabase/bill-audiences-store";
import type { ProfileAudience } from "@/lib/supabase/profile-audiences-store";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function toKey(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function uniqueByLabel<T extends { audienceLabel: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeText(item.audienceLabel);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function deriveProfileAudiences(profile: UserProfile): Array<{
  audienceLabel: string;
  normalizedAudienceKey?: string | null;
  source?: string;
  confidence?: number;
}> {
  const items: Array<{
    audienceLabel: string;
    normalizedAudienceKey?: string | null;
    source?: string;
    confidence?: number;
  }> = [];

  for (const context of profile.contexts ?? []) {
    items.push({
      audienceLabel: context,
      normalizedAudienceKey: toKey(context),
      source: "context",
      confidence: 1,
    });
  }

  for (const interest of profile.interests ?? []) {
    items.push({
      audienceLabel: interest,
      normalizedAudienceKey: toKey(interest),
      source: "interest",
      confidence: 0.6,
    });
  }

  if (profile.age) {
    items.push({
      audienceLabel: profile.age,
      normalizedAudienceKey: toKey(profile.age),
      source: "age",
      confidence: 0.4,
    });
  }

  if (profile.gender) {
    items.push({
      audienceLabel: profile.gender,
      normalizedAudienceKey: toKey(profile.gender),
      source: "gender",
      confidence: 0.4,
    });
  }

  if (profile.income) {
    items.push({
      audienceLabel: profile.income,
      normalizedAudienceKey: toKey(profile.income),
      source: "income",
      confidence: 0.7,
    });
  }

  if (profile.education) {
    items.push({
      audienceLabel: profile.education,
      normalizedAudienceKey: toKey(profile.education),
      source: "education",
      confidence: 0.6,
    });
  }

  for (const r of profile.race ?? []) {
    items.push({
      audienceLabel: r,
      normalizedAudienceKey: toKey(r),
      source: "race",
      confidence: 0.8,
    });
  }

  if (profile.location) {
    items.push({
      audienceLabel: profile.location,
      normalizedAudienceKey: toKey(profile.location),
      source: "location",
      confidence: 0.5,
    });
  }

  if (profile.employment) {
    items.push({
      audienceLabel: profile.employment,
      normalizedAudienceKey: toKey(profile.employment),
      source: "employment",
      confidence: 0.6,
    });
  }

  if (profile.family) {
    items.push({
      audienceLabel: profile.family,
      normalizedAudienceKey: toKey(profile.family),
      source: "family",
      confidence: 0.5,
    });
  }

  const normalizedContexts = (profile.contexts ?? []).map(normalizeText);

  if (normalizedContexts.some((v) => v.includes("student") || v.includes("college"))) {
    items.push(
      {
        audienceLabel: "Students",
        normalizedAudienceKey: "student",
        source: "derived",
        confidence: 0.95,
      },
      {
        audienceLabel: "College Students",
        normalizedAudienceKey: "college_student",
        source: "derived",
        confidence: 0.9,
      },
      {
        audienceLabel: "First-Generation College Students",
        normalizedAudienceKey: "first_generation_student",
        source: "derived",
        confidence: 0.9,
      }
    );
  }

  if (normalizedContexts.some((v) => v.includes("asian") || v.includes("aapi"))) {
    items.push(
      {
        audienceLabel: "Asian Communities",
        normalizedAudienceKey: "asian",
        source: "derived",
        confidence: 0.95,
      },
      {
        audienceLabel: "Asian American Communities",
        normalizedAudienceKey: "asian_american",
        source: "derived",
        confidence: 0.9,
      }
    );
  }

  if (normalizedContexts.some((v) => v.includes("immigrant"))) {
    items.push(
      {
        audienceLabel: "Immigrant Families",
        normalizedAudienceKey: "immigrant_family",
        source: "derived",
        confidence: 0.95,
      },
      {
        audienceLabel: "Children of Immigrants",
        normalizedAudienceKey: "children_of_immigrants",
        source: "derived",
        confidence: 0.85,
      }
    );
  }

  if (normalizedContexts.some((v) => v.includes("middle class"))) {
    items.push({
      audienceLabel: "Middle Class Families",
      normalizedAudienceKey: "middle_class_family",
      source: "derived",
      confidence: 0.85,
    });
  }

  // Income-derived audiences
  const income = normalizeText(profile.income ?? "");
  if (income.includes("25k") || income.includes("under") || income.includes("low")) {
    items.push({ audienceLabel: "Low-Income Households", normalizedAudienceKey: "low_income", source: "derived", confidence: 0.9 });
  }
  if (income.includes("50k") || income.includes("75k") || income.includes("middle")) {
    items.push({ audienceLabel: "Middle-Income Households", normalizedAudienceKey: "middle_income", source: "derived", confidence: 0.85 });
  }
  if (income.includes("150k") || income.includes("over") || income.includes("high")) {
    items.push({ audienceLabel: "High-Income Households", normalizedAudienceKey: "high_income", source: "derived", confidence: 0.8 });
  }

  // Education-derived audiences
  const edu = normalizeText(profile.education ?? "");
  if (edu.includes("bachelor") || edu.includes("college") || edu.includes("graduate") || edu.includes("some college")) {
    items.push({ audienceLabel: "College-Educated Adults", normalizedAudienceKey: "college_educated", source: "derived", confidence: 0.8 });
  }
  if (edu.includes("graduate") || edu.includes("master") || edu.includes("phd") || edu.includes("professional")) {
    items.push({ audienceLabel: "Graduate Degree Holders", normalizedAudienceKey: "graduate_degree", source: "derived", confidence: 0.85 });
  }
  if (edu.includes("high school") || edu.includes("ged")) {
    items.push({ audienceLabel: "High School Graduates", normalizedAudienceKey: "high_school_grad", source: "derived", confidence: 0.8 });
  }

  // Employment-derived audiences
  const emp = normalizeText(profile.employment ?? "");
  if (emp.includes("student")) {
    items.push({ audienceLabel: "Students", normalizedAudienceKey: "student", source: "derived", confidence: 0.95 });
  }
  if (emp.includes("retired")) {
    items.push({ audienceLabel: "Retirees", normalizedAudienceKey: "retiree", source: "derived", confidence: 0.9 });
  }
  if (emp.includes("self-employed") || emp.includes("freelance")) {
    items.push({ audienceLabel: "Self-Employed Workers", normalizedAudienceKey: "self_employed", source: "derived", confidence: 0.85 });
  }
  if (emp.includes("unemployed") || emp.includes("job")) {
    items.push({ audienceLabel: "Job Seekers", normalizedAudienceKey: "job_seeker", source: "derived", confidence: 0.85 });
  }

  // Family-derived audiences
  const fam = normalizeText(profile.family ?? "");
  if (fam.includes("parent") || fam.includes("child")) {
    items.push({ audienceLabel: "Parents", normalizedAudienceKey: "parent", source: "derived", confidence: 0.9 });
  }
  if (fam.includes("caregiver")) {
    items.push({ audienceLabel: "Caregivers", normalizedAudienceKey: "caregiver", source: "derived", confidence: 0.9 });
  }

  // Race-derived audiences
  const races = (profile.race ?? []).map(normalizeText);
  if (races.some((v) => v.includes("black") || v.includes("african"))) {
    items.push({ audienceLabel: "Black Americans", normalizedAudienceKey: "black_american", source: "derived", confidence: 0.95 });
  }
  if (races.some((v) => v.includes("hispanic") || v.includes("latino"))) {
    items.push({ audienceLabel: "Hispanic and Latino Communities", normalizedAudienceKey: "hispanic_latino", source: "derived", confidence: 0.95 });
  }
  if (races.some((v) => v.includes("native") || v.includes("indigenous"))) {
    items.push({ audienceLabel: "Native American Communities", normalizedAudienceKey: "native_american", source: "derived", confidence: 0.95 });
  }
  if (races.some((v) => v.includes("pacific") || v.includes("islander"))) {
    items.push({ audienceLabel: "Pacific Islander Communities", normalizedAudienceKey: "pacific_islander", source: "derived", confidence: 0.95 });
  }

  return uniqueByLabel(items);
}

export function profileAudienceLabels(
  audiences: ProfileAudience[]
): string[] {
  return audiences.map((item) => item.audienceLabel);
}

function scoreAudienceMatch(
  billAudience: BillAudience,
  profileAudiences: ProfileAudience[]
): number {
  const billLabel = normalizeText(billAudience.audienceLabelRaw);
  const billRationale = normalizeText(billAudience.audienceRationale);
  const billKey = normalizeText(billAudience.normalizedAudienceKey ?? "");

  let score = Number(billAudience.confidence) || 0;

  for (const profileAudience of profileAudiences) {
    const profileLabel = normalizeText(profileAudience.audienceLabel);
    const profileKey = normalizeText(profileAudience.normalizedAudienceKey ?? "");
    const profileConfidence = Number(profileAudience.confidence) || 0;

    if (billKey && profileKey && billKey === profileKey) {
      score += 6 + profileConfidence;
    }

    if (billLabel === profileLabel) {
      score += 5 + profileConfidence;
    }

    if (billLabel.includes(profileLabel) && profileLabel.length > 2) {
      score += 3 + profileConfidence * 0.5;
    }

    if (profileLabel.includes(billLabel) && billLabel.length > 3) {
      score += 2 + profileConfidence * 0.4;
    }

    if (billRationale.includes(profileLabel)) {
      score += 1.5;
    }
  }

  return score;
}

export function getTopMatchingAudiencesForProfile(
  billAudiences: BillAudience[],
  profileAudiences: ProfileAudience[],
  limit = 3
) {
  return [...billAudiences]
    .map((audience) => ({
      audience,
      score: scoreAudienceMatch(audience, profileAudiences),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.audience)
    .slice(0, limit);
}