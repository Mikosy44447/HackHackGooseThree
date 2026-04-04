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
  const nameLine =
    input.profile.contexts?.length || input.profile.interests?.length
      ? `
        <p style="margin: 0 0 12px 0; color: #334155; font-size: 16px;">
          Harnold checked the pond and picked bills based on your profile:
          <strong>${[
            ...(input.profile.contexts ?? []),
            ...(input.profile.interests ?? []),
          ]
            .slice(0, 5)
            .join(", ")}</strong>.
        </p>
      `
      : `
        <p style="margin: 0 0 12px 0; color: #334155; font-size: 16px;">
          Harnold checked the pond and picked a few bills worth watching.
        </p>
      `;

  const billSections = input.digestBills
    .map(({ bill, analysis, rankingReason, matchedAudienceLabels }) => {
      const whyItMatters =
        analysis?.whyItMattersGeneral ||
        "Harnold thinks this one deserves attention, even if the full analysis cache is still warming up in the reeds.";

      const broaderPattern =
        analysis?.broaderPattern || bill.pattern || "Pattern still loading.";

      const audienceLine =
        matchedAudienceLabels.length > 0
          ? `<p style="margin: 8px 0 0 0; color: #0f766e; font-size: 14px;"><strong>Audience overlap:</strong> ${matchedAudienceLabels.join(
              ", "
            )}</p>`
          : "";

      return `
        <div style="border: 2px solid #d6d3d1; border-radius: 18px; padding: 18px; margin: 0 0 18px 0; background: #fffef8;">
          <div style="font-size: 12px; color: #c2410c; font-weight: 700; margin-bottom: 8px;">
            Harnold surfaced this
          </div>

          <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #111827;">
            ${bill.title}
          </h2>

          <p style="margin: 0 0 10px 0; color: #475569; font-size: 15px;">
            ${bill.summary}
          </p>

          <p style="margin: 0 0 10px 0; color: #334155; font-size: 14px;">
            <strong>Why Harnold picked this:</strong> ${rankingReason}
          </p>

          ${audienceLine}

          <p style="margin: 12px 0 0 0; color: #111827; font-size: 14px;">
            <strong>Why this may matter:</strong> ${whyItMatters}
          </p>

          <p style="margin: 12px 0 0 0; color: #475569; font-size: 14px;">
            <strong>Broader pattern:</strong> ${broaderPattern}
          </p>

          <p style="margin: 14px 0 0 0;">
            <a href="${bill.officialSourceUrl}" style="color: #0f766e; font-weight: 700;">
              View official source
            </a>
          </p>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; background: #f8f4ea; padding: 24px; color: #111827;">
      <div style="max-width: 760px; margin: 0 auto; background: white; border: 2px solid #d6d3d1; border-radius: 22px; padding: 28px;">
        <div style="font-size: 13px; color: #c2410c; font-weight: 700; margin-bottom: 8px;">
          HarnoldAlert digest
        </div>

        <h1 style="margin: 0 0 12px 0; font-size: 32px; color: #111827;">
          Harnold’s latest legislative honks
        </h1>

        ${nameLine}

        <p style="margin: 0 0 24px 0; color: #64748b; font-size: 14px;">
          Personalized using your saved interests, contexts, and audience matches.
        </p>

        ${billSections}

        <p style="margin: 24px 0 0 0; color: #64748b; font-size: 13px;">
          Sent by Harnold, who remains committed to less doomscrolling and more useful honking.
        </p>
      </div>
    </div>
  `;
}