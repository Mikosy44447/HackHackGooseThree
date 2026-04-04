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