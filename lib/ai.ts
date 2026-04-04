export type UserProfile = {
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
};

export function generateProfileSummary(profile: UserProfile): string {
  const parts: string[] = [];

  if (profile.interests.length > 0) {
    parts.push(`tracking ${profile.interests.join(", ").toLowerCase()}`);
  }

  if (profile.contexts.length > 0) {
    parts.push(`with a focus on ${profile.contexts.join(", ").toLowerCase()}`);
  }

  const demoParts: string[] = [];
  if (profile.age) demoParts.push(profile.age);
  if (profile.gender) demoParts.push(profile.gender.toLowerCase());
  if (profile.income) demoParts.push(profile.income);
  if (profile.education) demoParts.push(profile.education);
  if (profile.location) demoParts.push(profile.location);
  if (profile.employment) demoParts.push(profile.employment);
  if (demoParts.length > 0) {
    parts.push(`(${demoParts.join(", ")})`);
  }

  if (parts.length === 0) {
    return "Harnold is standing by, waiting to learn what matters to you.";
  }

  return `Harnold is ${parts.join(" ")}. In other words: less doomscrolling, more useful honking.`;
}

export function generateWhyItMatters(
  billTitle: string,
  billTopics: string[],
  billGroups: string[],
  profile: UserProfile
): string {
  const matchingInterests = profile.interests.filter((interest) =>
    billTopics.includes(interest)
  );

  const matchingContexts = profile.contexts.filter((context) =>
    billGroups.some((group) =>
      group.toLowerCase().includes(context.toLowerCase()) ||
      context.toLowerCase().includes(group.toLowerCase())
    )
  );

  if (matchingInterests.length > 0 && matchingContexts.length > 0) {
    return `${billTitle} may matter to you because it overlaps with your selected interests in ${matchingInterests.join(
      ", "
    )} and connects to your life context around ${matchingContexts.join(
      ", "
    )}. Harnold’s view: this one is flying directly through your lane.`;
  }

  if (matchingInterests.length > 0) {
    return `${billTitle} may matter to you because it directly overlaps with your selected interests in ${matchingInterests.join(
      ", "
    )}. This is the kind of bill Harnold would circle in red ink with unnecessary intensity.`;
  }

  if (matchingContexts.length > 0) {
    return `${billTitle} may matter to you because it appears relevant to your selected life context: ${matchingContexts.join(
      ", "
    )}. Even if the topic match is broad, Harnold thinks this is worth watching.`;
  }

  return `${billTitle} was included because it fits your broader legislative feed. Harnold cannot yet prove this is your main issue, but his feathers are mildly alert.`;
}