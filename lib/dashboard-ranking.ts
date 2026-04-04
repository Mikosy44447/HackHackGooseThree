import type { Bill } from "@/lib/supabase/bills-store";
import type { BillAudience } from "@/lib/supabase/bill-audiences-store";
import type { ProfileAudience } from "@/lib/supabase/profile-audiences-store";

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function tokenSet(value: string) {
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function overlapScore(a: string, b: string) {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);

  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }

  return overlap;
}

type RankedBill = {
  bill: Bill;
  score: number;
  matchedAudienceLabels: string[];
  topicMatches: string[];
  contextMatches: string[];
};

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
      const profileKey = normalizeText(
        profileAudience.normalizedAudienceKey ?? ""
      );
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

function scoreBillAgainstTopics(
  bill: Bill,
  interests: string[],
  contexts: string[]
) {
  let score = 0;

  const topicMatches = bill.topics.filter((topic) =>
    interests.some((interest) => normalizeText(interest) === normalizeText(topic))
  );

  if (topicMatches.length > 0) {
    score += topicMatches.length * 3;
  }

  const contextMatches = bill.affectedGroups.filter((group) =>
    contexts.some((context) => {
      const contextNorm = normalizeText(context);
      const groupNorm = normalizeText(group);
      return (
        groupNorm.includes(contextNorm) ||
        contextNorm.includes(groupNorm) ||
        overlapScore(groupNorm, contextNorm) > 0
      );
    })
  );

  if (contextMatches.length > 0) {
    score += contextMatches.length * 2;
  }

  return {
    score,
    topicMatches: Array.from(new Set(topicMatches)).slice(0, 2),
    contextMatches: Array.from(new Set(contextMatches)).slice(0, 2),
  };
}

export function rankBillsForDashboard(input: {
  bills: Bill[];
  billAudiencesByBillId: Record<string, BillAudience[]>;
  profileAudiences: ProfileAudience[];
  interests: string[];
  contexts: string[];
}) {
  const ranked: RankedBill[] = input.bills.map((bill) => {
    const billAudiences = input.billAudiencesByBillId[bill.id] ?? [];

    const audienceMatch = scoreBillAgainstProfileAudiences(
      billAudiences,
      input.profileAudiences
    );

    const topicMatch = scoreBillAgainstTopics(
      bill,
      input.interests,
      input.contexts
    );

    return {
      bill,
      score: audienceMatch.score + topicMatch.score,
      matchedAudienceLabels: audienceMatch.matchedAudienceLabels,
      topicMatches: topicMatch.topicMatches,
      contextMatches: topicMatch.contextMatches,
    };
  });

  return ranked.sort((a, b) => b.score - a.score);
}

export function buildRankingBadgeText(item: RankedBill) {
  if (item.score >= 14) return "Strong Harnold match";
  if (item.score >= 8) return "Likely relevant";
  return "Worth a look";
}

export function buildRankingReasonText(item: RankedBill) {
  const reasons: string[] = [];

  if (item.matchedAudienceLabels.length > 0) {
    reasons.push("Strong overlap with your stored audience profile");
  }

  if (item.topicMatches.length > 0) {
    reasons.push(`Topic match: ${item.topicMatches.join(", ")}`);
  }

  if (item.contextMatches.length > 0) {
    reasons.push(`Community/context overlap: ${item.contextMatches.join(", ")}`);
  }

  if (!reasons.length) {
    reasons.push("General Harnold relevance scan");
  }

  return reasons.slice(0, 2).join(" • ");
}

export type { RankedBill };