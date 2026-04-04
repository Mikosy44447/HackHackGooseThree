export type BillLike = {
  id: string;
  topics: string[];
  affectedGroups: string[];
  relatedBillIds: string[];
};

export function getBillsForInterests<T extends BillLike>(
  allBills: T[],
  interests: string[]
): T[] {
  return allBills.filter((bill) =>
    bill.topics.some((topic) => interests.includes(topic))
  );
}

export function getBillById<T extends BillLike>(
  allBills: T[],
  id: string
): T | undefined {
  return allBills.find((bill) => bill.id === id);
}

export function getRelatedBills<T extends BillLike>(bill: T, allBills: T[]): T[] {
  return allBills
    .filter((candidate) => candidate.id !== bill.id)
    .map((candidate) => {
      const sharedTopics = candidate.topics.filter((topic) =>
        bill.topics.includes(topic)
      ).length;

      const sharedGroups = candidate.affectedGroups.filter((group) =>
        bill.affectedGroups.includes(group)
      ).length;

      const manualBoost = bill.relatedBillIds.includes(candidate.id) ? 2 : 0;

      const score = sharedTopics * 2 + sharedGroups + manualBoost;

      return { candidate, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.candidate)
    .slice(0, 3);
}

export function scoreBillForProfile(
  bill: {
    topics: string[];
    affectedGroups: string[];
  },
  profile: {
    interests: string[];
    contexts: string[];
  }
): number {
  const interestMatches = bill.topics.filter((topic) =>
    profile.interests.includes(topic)
  ).length;

  const contextMatches = profile.contexts.filter((context) =>
    bill.affectedGroups.some(
      (group) =>
        group.toLowerCase().includes(context.toLowerCase()) ||
        context.toLowerCase().includes(group.toLowerCase())
    )
  ).length;

  return interestMatches * 3 + contextMatches * 2;
}

export function rankBillsForProfile<T extends { topics: string[]; affectedGroups: string[] }>(
  allBills: T[],
  profile: {
    interests: string[];
    contexts: string[];
  }
): T[] {
  return [...allBills]
    .map((bill) => ({
      bill,
      score: scoreBillForProfile(bill, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.bill);
}