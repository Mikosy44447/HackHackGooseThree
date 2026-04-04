export type Bill = {
  id: string;
  title: string;
  summary: string;
  status: string;
  topics: string[];
  affectedGroups: string[];
  pattern: string;
  relatedBillIds: string[];
};

export const bills: Bill[] = [
  {
    id: "b1",
    title: "Language Access in Public Schools Act",
    summary:
      "Requires public schools receiving federal funds to expand multilingual family communications and interpretation access.",
    status: "Introduced",
    topics: ["Education", "Civil Rights", "Language Access"],
    affectedGroups: ["Immigrant Families", "Asian American Communities", "English Learners"],
    pattern:
      "Part of a broader legislative pattern around language access and educational equity.",
    relatedBillIds: ["b2", "b3"],
  },
  {
    id: "b2",
    title: "College Transparency and Admissions Fairness Act",
    summary:
      "Expands reporting requirements for admissions practices and student outcomes.",
    status: "In Committee",
    topics: ["Education", "Higher Education"],
    affectedGroups: ["First-Generation Students", "Asian American Students", "Middle Class Families"],
    pattern:
      "Appears related to a broader push for admissions transparency and higher-education accountability.",
    relatedBillIds: ["b1", "b4"],
  },
  {
    id: "b3",
    title: "Community Interpreter Access Act",
    summary:
      "Creates grant funding for interpretation and translation support in health and public-service settings.",
    status: "Introduced",
    topics: ["Healthcare", "Civil Rights", "Language Access"],
    affectedGroups: ["Immigrants", "Asian American Communities", "Limited English Proficiency Households"],
    pattern:
      "Part of a broader public-services access trend focused on translation and interpretation support.",
    relatedBillIds: ["b1"],
  },
  {
    id: "b4",
    title: "Middle Class Family Affordability Act",
    summary:
      "Provides tax credits and cost-of-living relief targeted at middle-income households.",
    status: "Passed House",
    topics: ["Taxes", "Economy"],
    affectedGroups: ["Middle Class Families", "First-Generation Workers"],
    pattern:
      "Fits into a larger affordability-focused legislative pattern aimed at middle-income households.",
    relatedBillIds: ["b2"],
  },
];