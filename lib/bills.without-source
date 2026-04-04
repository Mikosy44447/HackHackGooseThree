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
    id: "hr3127",
    title: "Fairness to Freedom Act of 2025",
    summary:
      "Would establish a right to government-funded counsel for people facing removal proceedings if they cannot afford representation.",
    status: "Introduced in House",
    topics: ["Immigration", "Civil Rights", "Language Access"],
    affectedGroups: [
      "Immigrant Families",
      "Detained Immigrants",
      "Limited English Proficiency Households",
    ],
    pattern:
      "Fits a broader legislative pattern focused on due process protections in immigration proceedings, especially for vulnerable and lower-income noncitizens.",
    relatedBillIds: ["hr6397"],
  },
  {
    id: "hr6397",
    title: "Dignity for Detained Immigrants Act",
    summary:
      "Would set standards for facilities where noncitizens are detained in Department of Homeland Security custody.",
    status: "Introduced in House",
    topics: ["Immigration", "Detention", "Civil Rights"],
    affectedGroups: [
      "Detained Immigrants",
      "Immigrant Families",
      "Asylum Seekers",
    ],
    pattern:
      "Fits a broader legislative pattern focused on detention conditions, immigrant rights, and oversight of federal immigration enforcement.",
    relatedBillIds: ["hr3127"],
  },
  {
    id: "hr4806",
    title: "College Transparency Act",
    summary:
      "Would establish a postsecondary student data system intended to improve information about college access, costs, completion, and outcomes.",
    status: "Introduced in House",
    topics: ["Education", "Higher Education", "Data Transparency"],
    affectedGroups: [
      "College Applicants",
      "First-Generation Students",
      "Middle Class Families",
    ],
    pattern:
      "Fits a broader legislative pattern pushing for clearer higher-education data so students and families can compare cost, completion, and outcomes.",
    relatedBillIds: ["hr6502"],
  },
  {
    id: "hr6502",
    title: "College Financial Aid Clarity Act of 2025",
    summary:
      "Would require the Department of Education to develop requirements for how colleges format financial aid offer forms.",
    status: "Reported in House",
    topics: ["Education", "Higher Education", "Financial Aid"],
    affectedGroups: [
      "College Applicants",
      "First-Generation Students",
      "Middle Class Families",
    ],
    pattern:
      "Fits a broader legislative pattern aimed at making college pricing and aid information easier for students and families to understand.",
    relatedBillIds: ["hr4806"],
  },
];