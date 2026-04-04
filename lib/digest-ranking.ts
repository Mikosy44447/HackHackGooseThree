import { getAllBills, Bill } from "@/lib/supabase/bills-store";
import {
  getBillAnalysisByBillId,
  BillAnalysis,
} from "@/lib/supabase/bill-analysis-store";
import {
  getBillAudiencesByBillId,
  BillAudience,
} from "@/lib/supabase/bill-audiences-store";
import {
  getProfileAudiencesByEmail,
  ProfileAudience,
} from "@/lib/supabase/profile-audiences-store";
import {
  rankBillsForDashboard,
  buildRankingReasonText,
  RankedBill,
} from "@/lib/dashboard-ranking";
import type { UserProfile } from "@/lib/ai";

export type DigestBill = {
  bill: Bill;
  analysis: BillAnalysis | null;
  audiences: BillAudience[];
  rankingReason: string;
  matchedAudienceLabels: string[];
};

export async function buildRankedDigestBills(
  profile: UserProfile,
  limit = 3
): Promise<DigestBill[]> {
  const bills = await getAllBills();

  const profileAudiences: ProfileAudience[] = profile.email
    ? await getProfileAudiencesByEmail(profile.email)
    : [];

  const billAudienceEntries = await Promise.all(
    bills.map(async (bill) => {
      try {
        const audiences = await getBillAudiencesByBillId(bill.id);
        return [bill.id, audiences] as const;
      } catch (error) {
        console.error(`Failed to load bill audiences for ${bill.id}`, error);
        return [bill.id, []] as const;
      }
    })
  );

  const billAudiencesByBillId: Record<string, BillAudience[]> =
    Object.fromEntries(billAudienceEntries);

  const rankedBills: RankedBill[] = rankBillsForDashboard({
    bills,
    billAudiencesByBillId,
    profileAudiences,
    interests: profile.interests ?? [],
    contexts: profile.contexts ?? [],
    demographics: {
      income: profile.income,
      employment: profile.employment,
      family: profile.family,
      education: profile.education,
      age: profile.age,
    },
  });

  const topBills = rankedBills.slice(0, limit);

  const enriched = await Promise.all(
    topBills.map(async (item) => {
      let analysis: BillAnalysis | null = null;

      try {
        analysis = await getBillAnalysisByBillId(item.bill.id);
      } catch (error) {
        console.error(`Failed to load analysis for ${item.bill.id}`, error);
      }

      return {
        bill: item.bill,
        analysis,
        audiences: billAudiencesByBillId[item.bill.id] ?? [],
        rankingReason: buildRankingReasonText(item),
        matchedAudienceLabels: item.matchedAudienceLabels,
      };
    })
  );

  return enriched;
}

export function buildDigestHtml(input: {
  profile: UserProfile;
  digestBills: DigestBill[];
}) {
  const profileLine =
    (input.profile.interests?.length ?? 0) > 0
      ? input.profile.interests!.slice(0, 4).join(" · ")
      : "your saved profile";

  const billSections = input.digestBills
    .map(({ bill, analysis, matchedAudienceLabels }) => {
      // One sentence: prefer AI why-it-matters, fall back to truncated summary
      const whyItMatters = analysis?.whyItMattersGeneral
        ? analysis.whyItMattersGeneral.split(/[.!?]/)[0].trim() + "."
        : bill.summary.slice(0, 120) + (bill.summary.length > 120 ? "…" : "");

      const tagLine = matchedAudienceLabels.length > 0
        ? `<p style="margin: 6px 0 0 0; font-size: 12px; color: #0f766e;">
             ${matchedAudienceLabels.slice(0, 3).join(" · ")}
           </p>`
        : "";

      return `
        <div style="border: 2px solid #e2e8f0; border-radius: 14px; padding: 16px; margin: 0 0 12px 0; background: #fffef8;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <h2 style="margin: 0; font-size: 17px; font-weight: 700; color: #111827; line-height: 1.3;">
              ${bill.title}
            </h2>
            <span style="font-size: 11px; color: #c2410c; font-weight: 600; white-space: nowrap; background: #fff7ed; border-radius: 99px; padding: 2px 8px;">
              ${bill.status}
            </span>
          </div>

          <p style="margin: 8px 0 0 0; color: #475569; font-size: 14px; line-height: 1.5;">
            ${whyItMatters}
          </p>

          ${tagLine}

          <p style="margin: 10px 0 0 0;">
            <a href="${bill.officialSourceUrl}"
               style="font-size: 13px; color: #0f766e; font-weight: 600; text-decoration: none;">
              Read more →
            </a>
          </p>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; background: #f8f4ea; padding: 20px; color: #111827;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border: 2px solid #d6d3d1; border-radius: 18px; padding: 24px;">

        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <span style="font-size: 24px;">🪿</span>
          <div>
            <div style="font-size: 11px; color: #c2410c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
              PoliticAlert
            </div>
            <div style="font-size: 13px; color: #64748b;">${profileLine}</div>
          </div>
        </div>

        <h1 style="margin: 0 0 16px 0; font-size: 24px; color: #111827; line-height: 1.2;">
          Your legislative digest
        </h1>

        ${billSections}

        <p style="margin: 16px 0 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
          PoliticAlert · less doomscrolling, more useful honking
        </p>
      </div>
    </div>
  `;
}