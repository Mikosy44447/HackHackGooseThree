export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY: string;
  CONGRESS_API_KEY: string;
  RUN_SECRET: string;
  CONGRESS_API_BASE_URL: string;
  CONGRESS_SYNC_CONGRESS: string;
  CONGRESS_SYNC_BILL_TYPE: string;
  CONGRESS_SYNC_LIMIT: string;
  ANTHROPIC_MODEL: string;
  FEDERAL_REGISTER_BASE_URL: string;
  COURT_LISTENER_BASE_URL: string;
  RESEND_API_KEY?: string;
  COURT_LISTENER_API_KEY?: string;
  RESEND_FROM_EMAIL: string;
}

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

// ─── Congress API types ───────────────────────────────────────────────────────

type CongressBillListItem = {
  congress: number;
  number: string | number;
  title?: string;
  latestAction?: { actionDate?: string; text?: string };
  policyArea?: { name?: string };
  billType?: string;
  type?: string;
  updateDate?: string;
  url?: string;
  originChamber?: string;
};

type CongressBillsResponse = {
  bills?: CongressBillListItem[];
  pagination?: { count?: number; next?: string | null };
};

type CongressBillDetail = {
  congress?: number;
  number?: string | number;
  title?: string;
  billType?: string;
  type?: string;
  originChamber?: string;
  introducedDate?: string;
  updateDate?: string;
  legislationUrl?: string;
  url?: string;
  latestAction?: { actionDate?: string; actionTime?: string; text?: string };
  policyArea?: { name?: string };
  subjects?: { count?: number; url?: string };
  summaries?: { count?: number; url?: string };
  relatedBills?: { count?: number; url?: string };
  sponsors?: Array<{
    fullName?: string;
    firstName?: string;
    lastName?: string;
    party?: string;
    state?: string;
    district?: string | number;
    bioguideId?: string;
    isByRequest?: string;
  }>;
  cosponsors?: { count?: number; countIncludingWithdrawnCosponsors?: number };
};

type CongressBillDetailResponse = { bill?: CongressBillDetail };

type CongressSummaryItem = {
  text?: string;
  actionDesc?: string;
  actionDate?: string;
  updateDate?: string;
  lastSummaryUpdateDate?: string;
  versionCode?: string;
  currentChamber?: string;
};

type CongressSubjectItem = { name?: string; updateDate?: string };

type CongressRelatedBillItem = {
  congress?: number;
  type?: string;
  billType?: string;
  number?: string | number;
};

// ─── Shared types ─────────────────────────────────────────────────────────────

type Sponsor = {
  fullName: string;
  party?: string;
  state?: string;
  district?: string | number;
};

type IngestBillInput = {
  id: string;
  title: string;
  summary: string;
  status: string;
  topics: string[];
  affectedGroups: string[];
  pattern: string;
  relatedBillIds: string[];
  officialSourceLabel: string;
  officialSourceUrl: string;
  contentType?: string;
  sponsors?: Sponsor[];
  agency?: string;
};

type BillAnalysis = {
  whyItMattersGeneral: string;
  broaderPattern: string;
  hotTake: string;
};

type BillAudience = {
  audienceLabelRaw: string;
  audienceRationale: string;
  whyItMatters: string;
  confidence: number;
  normalizedAudienceKey?: string | null;
};

type IngestionResult = {
  ok: true;
  sourceUsed: "congress_api" | "fallback_local";
  sourceError: string | null;
  fetched: number;
  pending: number;
  ingestedIds: string[];
  errors: Array<{ billId: string; error: string }>;
};

// ─── Utility helpers ──────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function normalizeBillIdFromParts(
  billType: string | undefined,
  billNumber: string | number | undefined,
  fallbackType: string
) {
  const type = String(billType || fallbackType).toLowerCase();
  const number = String(billNumber || "").toLowerCase();
  return `${type}${number}`;
}

function normalizeBillId(item: CongressBillListItem, fallbackType: string) {
  return normalizeBillIdFromParts(item.type || item.billType, item.number, fallbackType);
}

function normalizeOfficialSourceLabel(detail: CongressBillDetail, fallbackType: string) {
  const type = String(detail.type || detail.billType || fallbackType).toUpperCase();
  const number = String(detail.number || "");
  return `Congress.gov: ${type} ${number}`;
}

function normalizeOfficialSourceUrl(
  detail: CongressBillDetail,
  fallbackCongress: string,
  fallbackType: string
) {
  if (detail.legislationUrl) return detail.legislationUrl;

  const congress = String(detail.congress || fallbackCongress);
  const type = String(detail.type || detail.billType || fallbackType).toLowerCase();
  const number = String(detail.number || "");

  const pathTypeMap: Record<string, string> = {
    hr: "house-bill",
    s: "senate-bill",
    hjres: "house-joint-resolution",
    sjres: "senate-joint-resolution",
    hconres: "house-concurrent-resolution",
    sconres: "senate-concurrent-resolution",
    hres: "house-resolution",
    sres: "senate-resolution",
  };

  return `https://www.congress.gov/bill/${congress}th-congress/${pathTypeMap[type] ?? type}/${number}`;
}

function withCongressApiParams(rawUrl: string, env: Env) {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("api_key")) url.searchParams.set("api_key", env.CONGRESS_API_KEY);
  if (!url.searchParams.has("format")) url.searchParams.set("format", "json");
  return url.toString();
}

async function fetchCongressJson<T>(rawUrl: string, env: Env): Promise<T> {
  const response = await fetch(withCongressApiParams(rawUrl, env), {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Congress API fetch failed: ${response.status} ${raw}`);
  }
  return (await response.json()) as T;
}

function extractArray<T = any>(data: any, candidateKeys: string[]): T[] {
  for (const key of candidateKeys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      for (const nestedKey of ["items", "item", "summaries", "subjects", "legislativeSubjects", "relatedBills", "bills"]) {
        const nested = value?.[nestedKey];
        if (Array.isArray(nested)) return nested as T[];
      }
    }
  }
  return [];
}

function squashWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function stripHtml(value: string) {
  return squashWhitespace(
    value
      .replace(/<!\[CDATA\[|\]\]>/g, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/p>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
  );
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

// ─── Congress bill fetch ───────────────────────────────────────────────────────

async function fetchBillDetail(env: Env, item: CongressBillListItem): Promise<CongressBillDetail> {
  const congress = String(item.congress || env.CONGRESS_SYNC_CONGRESS);
  const billType = String(item.type || item.billType || env.CONGRESS_SYNC_BILL_TYPE).toLowerCase();
  const billNumber = String(item.number);

  const url = `${env.CONGRESS_API_BASE_URL}/bill/${encodeURIComponent(congress)}/${encodeURIComponent(billType)}/${encodeURIComponent(billNumber)}`;
  const data = await fetchCongressJson<CongressBillDetailResponse | CongressBillDetail>(url, env);
  return ("bill" in data ? data.bill : data) as CongressBillDetail;
}

async function fetchBillSummaries(env: Env, detail: CongressBillDetail): Promise<CongressSummaryItem[]> {
  const url = detail.summaries?.url;
  if (!url) return [];
  const data = await fetchCongressJson<any>(url, env);
  return extractArray<CongressSummaryItem>(data, ["summaries", "summary"]);
}

async function fetchBillSubjects(env: Env, detail: CongressBillDetail): Promise<CongressSubjectItem[]> {
  const url = detail.subjects?.url;
  if (!url) return [];
  const data = await fetchCongressJson<any>(url, env);
  return extractArray<CongressSubjectItem>(data, ["subjects", "legislativeSubjects"]);
}

async function fetchRelatedBillIds(env: Env, detail: CongressBillDetail): Promise<string[]> {
  const url = detail.relatedBills?.url;
  if (!url) return [];
  const data = await fetchCongressJson<any>(url, env);
  const related = extractArray<CongressRelatedBillItem>(data, ["relatedBills", "bills"]);
  return unique(
    related
      .map((item) => normalizeBillIdFromParts(item.type || item.billType, item.number, env.CONGRESS_SYNC_BILL_TYPE))
      .filter(Boolean)
  ).slice(0, 6);
}

function pickBestSummary(detail: CongressBillDetail, summaries: CongressSummaryItem[]) {
  const sorted = [...summaries].sort((a, b) => {
    const aDate = Date.parse(a.lastSummaryUpdateDate || a.updateDate || a.actionDate || "");
    const bDate = Date.parse(b.lastSummaryUpdateDate || b.updateDate || b.actionDate || "");
    return bDate - aDate;
  });

  const fromSummary = sorted.map((item) => stripHtml(String(item.text || ""))).find(Boolean);
  if (fromSummary) return fromSummary;

  const fallbackLatestAction = detail.latestAction?.text?.trim();
  if (fallbackLatestAction) return fallbackLatestAction;

  return "Recent congressional activity recorded in the official Congress.gov feed.";
}

function buildStatus(detail: CongressBillDetail) {
  const latestAction = detail.latestAction?.text?.trim();
  if (latestAction) return latestAction;
  if (detail.introducedDate) return `Introduced ${detail.introducedDate}`;
  return "Recent action recorded on Congress.gov";
}

function inferTopicsFromDetail(detail: CongressBillDetail, subjects: CongressSubjectItem[]): string[] {
  const topics: string[] = [];
  const title = normalizeText(detail.title || "");
  const policyArea = detail.policyArea?.name?.trim();
  if (policyArea) topics.push(policyArea);
  for (const subject of subjects) {
    if (subject.name?.trim()) topics.push(subject.name.trim());
  }
  if (title.includes("education") || title.includes("student") || title.includes("college") || title.includes("university")) {
    topics.push("Education", "Higher Education");
  }
  if (title.includes("immigration") || title.includes("detention") || title.includes("asylum") || title.includes("removal")) {
    topics.push("Immigration");
  }
  if (title.includes("financial aid") || title.includes("tuition") || title.includes("pell")) {
    topics.push("Financial Aid");
  }
  if (title.includes("privacy") || title.includes("data")) {
    topics.push("Data Privacy");
  }
  if (title.includes("civil rights") || title.includes("rights")) {
    topics.push("Civil Rights");
  }
  return unique(topics.filter(Boolean)).slice(0, 8);
}

function inferAffectedGroupsFromDetail(detail: CongressBillDetail, topics: string[], summary: string): string[] {
  const groups: string[] = [];
  const title = normalizeText(detail.title || "");
  const fullText = `${title} ${normalizeText(summary)} ${topics.map(normalizeText).join(" ")}`;

  if (fullText.includes("student") || fullText.includes("college") || fullText.includes("higher education")) {
    groups.push("College Students", "First-Generation Students");
  }
  if (fullText.includes("financial aid") || fullText.includes("tuition") || fullText.includes("affordability")) {
    groups.push("Middle Class Families");
  }
  if (fullText.includes("immigration") || fullText.includes("detention") || fullText.includes("asylum") || fullText.includes("removal")) {
    groups.push("Immigrant Families", "Detained Immigrants", "Asylum Seekers");
  }
  if (fullText.includes("privacy") || fullText.includes("data") || fullText.includes("consumer")) {
    groups.push("Consumers", "Students");
  }
  if (fullText.includes("english") || fullText.includes("language access") || fullText.includes("interpret")) {
    groups.push("Limited English Proficiency Households");
  }
  return unique(groups).slice(0, 6);
}

function inferPatternFromDetail(detail: CongressBillDetail, topics: string[], summary: string): string {
  const title = normalizeText(detail.title || "");
  const fullText = `${title} ${normalizeText(summary)} ${topics.map(normalizeText).join(" ")}`;

  if (fullText.includes("student") || fullText.includes("college") || fullText.includes("higher education")) {
    return "Fits a broader legislative pattern focused on college affordability, transparency, and student-facing disclosures.";
  }
  if (fullText.includes("immigration") || fullText.includes("detention") || fullText.includes("asylum") || fullText.includes("removal")) {
    return "Fits a broader legislative pattern focused on immigration process, detention oversight, and due process protections.";
  }
  if (fullText.includes("privacy") || fullText.includes("data")) {
    return "Fits a broader legislative pattern toward stronger disclosure, transparency, and data-handling standards.";
  }
  if (fullText.includes("civil rights") || fullText.includes("language access")) {
    return "Fits a broader legislative pattern around civil-rights enforcement, language access, and equal access to public systems.";
  }
  return "Fits a broader legislative pattern around federal oversight, public transparency, and consumer-facing protections.";
}

function extractSponsors(detail: CongressBillDetail): Sponsor[] {
  const items = Array.isArray(detail.sponsors) ? detail.sponsors : [];
  return items
    .filter((s) => s.fullName || (s.firstName && s.lastName))
    .map((s) => ({
      fullName: s.fullName?.trim() ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
      party: s.party?.trim(),
      state: s.state?.trim(),
      district: s.district,
    }))
    .slice(0, 5);
}

async function mapCongressBillToIngestBill(item: CongressBillListItem, env: Env): Promise<IngestBillInput> {
  const detail = await fetchBillDetail(env, item);
  const [summaries, subjects, relatedBillIds] = await Promise.all([
    fetchBillSummaries(env, detail),
    fetchBillSubjects(env, detail),
    fetchRelatedBillIds(env, detail),
  ]);

  const summary = pickBestSummary(detail, summaries);
  const topics = inferTopicsFromDetail(detail, subjects);
  const affectedGroups = inferAffectedGroupsFromDetail(detail, topics, summary);
  const pattern = inferPatternFromDetail(detail, topics, summary);
  const sponsors = extractSponsors(detail);

  return {
    id: normalizeBillIdFromParts(detail.type || detail.billType, detail.number, env.CONGRESS_SYNC_BILL_TYPE),
    title: detail.title?.trim() || item.title?.trim() || `Untitled bill ${normalizeBillId(item, env.CONGRESS_SYNC_BILL_TYPE)}`,
    summary,
    status: buildStatus(detail),
    topics,
    affectedGroups,
    pattern,
    relatedBillIds,
    officialSourceLabel: normalizeOfficialSourceLabel(detail, env.CONGRESS_SYNC_BILL_TYPE),
    officialSourceUrl: normalizeOfficialSourceUrl(detail, env.CONGRESS_SYNC_CONGRESS, env.CONGRESS_SYNC_BILL_TYPE),
    contentType: "bill",
    sponsors,
  };
}

function getFallbackBills(): IngestBillInput[] {
  return [
    {
      id: "hr9101",
      title: "College Cost Notice Standardization Act",
      summary: "Would require colleges participating in federal aid programs to use clearer, standardized financial aid notices for students and families.",
      status: "Introduced in House",
      topics: ["Education", "Higher Education", "Financial Aid"],
      affectedGroups: ["College Students", "First-Generation Students", "Middle Class Families"],
      pattern: "Fits a broader legislative pattern focused on making college pricing and aid disclosures easier for students and families to compare.",
      relatedBillIds: ["hr4806", "hr6502"],
      officialSourceLabel: "Fallback Source: H.R. 9101",
      officialSourceUrl: "https://www.congress.gov/",
      contentType: "bill",
      sponsors: [],
    },
    {
      id: "hr9102",
      title: "Immigration Family Notification and Legal Access Act",
      summary: "Would require clearer family notification procedures and expanded access to legal resources for certain people held in immigration detention.",
      status: "Introduced in House",
      topics: ["Immigration", "Civil Rights", "Detention"],
      affectedGroups: ["Immigrant Families", "Detained Immigrants", "Asylum Seekers"],
      pattern: "Fits a broader legislative pattern focused on due process, detention oversight, and family communication protections in immigration enforcement.",
      relatedBillIds: ["hr3127", "hr6397"],
      officialSourceLabel: "Fallback Source: H.R. 9102",
      officialSourceUrl: "https://www.congress.gov/",
      contentType: "bill",
      sponsors: [],
    },
    {
      id: "hr9103",
      title: "Student Data Transparency and Privacy Protection Act",
      summary: "Would establish disclosure and privacy standards for student outcome reporting systems used by colleges receiving certain federal support.",
      status: "Introduced in House",
      topics: ["Education", "Higher Education", "Data Privacy"],
      affectedGroups: ["College Students", "First-Generation Students", "Consumers"],
      pattern: "Fits a broader legislative pattern toward stronger transparency requirements paired with tighter data-handling standards in higher education.",
      relatedBillIds: ["hr4806"],
      officialSourceLabel: "Fallback Source: H.R. 9103",
      officialSourceUrl: "https://www.congress.gov/",
      contentType: "bill",
      sponsors: [],
    },
  ];
}

async function fetchRecentCongressBills(env: Env): Promise<IngestBillInput[]> {
  const url =
    `${env.CONGRESS_API_BASE_URL}/bill/${encodeURIComponent(env.CONGRESS_SYNC_CONGRESS)}/${encodeURIComponent(env.CONGRESS_SYNC_BILL_TYPE)}` +
    `?api_key=${encodeURIComponent(env.CONGRESS_API_KEY)}&format=json&limit=${encodeURIComponent(env.CONGRESS_SYNC_LIMIT)}`;

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Congress API fetch failed: ${response.status} ${raw}`);
  }

  const data = (await response.json()) as CongressBillsResponse;
  return await Promise.all(
    (data.bills ?? []).filter((item) => item.title && item.number).map((item) => mapCongressBillToIngestBill(item, env))
  );
}

// ─── Federal Register ─────────────────────────────────────────────────────────

type FRAgency = { name?: string };
type FRDocument = {
  document_number?: string;
  title?: string;
  abstract?: string;
  html_url?: string;
  agencies?: FRAgency[];
  publication_date?: string;
  type?: string;
};
type FRResponse = { results?: FRDocument[] };

function frDocToIngest(doc: FRDocument, contentType: "regulation" | "executive_order"): IngestBillInput | null {
  const docNum = doc.document_number?.trim();
  if (!docNum || !doc.title?.trim()) return null;

  const idPrefix = contentType === "regulation" ? "fr-reg-" : "fr-eo-";
  const id = (idPrefix + docNum.replace(/[^a-zA-Z0-9]/g, "-")).toLowerCase();
  const agencyNames = (doc.agencies ?? []).map((a) => a.name?.trim()).filter(Boolean) as string[];
  const primaryAgency = agencyNames[0] ?? "Federal Agency";

  const summary =
    doc.abstract?.trim() ||
    `${contentType === "regulation" ? "Federal regulation" : "Executive order"} from ${primaryAgency}. Published ${doc.publication_date ?? "recently"}.`;

  const topics =
    contentType === "regulation"
      ? ["Federal Regulation", ...agencyNames.slice(0, 3)]
      : ["Executive Order", "Presidential Action", ...agencyNames.slice(0, 2)];

  return {
    id,
    title: doc.title.trim(),
    summary,
    status: `Published ${doc.publication_date ?? "recently"} in Federal Register`,
    topics,
    affectedGroups: contentType === "regulation" ? ["Regulated Industries", "General Public", "Businesses"] : ["Federal Agencies", "General Public"],
    pattern: contentType === "regulation"
      ? `Part of ongoing federal regulatory activity from ${primaryAgency}.`
      : `Presidential executive action directing federal policy and operations.`,
    relatedBillIds: [],
    officialSourceLabel: `Federal Register: ${docNum}`,
    officialSourceUrl: doc.html_url ?? "https://www.federalregister.gov",
    contentType,
    agency: primaryAgency,
    sponsors: [],
  };
}

async function fetchFederalRegisterRegulations(env: Env, limit = 5): Promise<IngestBillInput[]> {
  const fields = ["document_number", "title", "abstract", "html_url", "agencies", "publication_date"]
    .map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const url = `${env.FEDERAL_REGISTER_BASE_URL}/documents.json?conditions[type][]=RULE&${fields}&order=newest&per_page=${limit}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Federal Register regulations fetch failed: ${res.status}`);

  const data = (await res.json()) as FRResponse;
  return (data.results ?? []).map((doc) => frDocToIngest(doc, "regulation")).filter((x): x is IngestBillInput => x !== null);
}

async function fetchFederalRegisterExecutiveOrders(env: Env, limit = 5): Promise<IngestBillInput[]> {
  const fields = ["document_number", "title", "abstract", "html_url", "agencies", "publication_date", "subtype"]
    .map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  // Fetch all Presidential Documents — the API doesn't support subtype filtering
  // We request extra to account for non-EO items we may skip
  const url =
    `${env.FEDERAL_REGISTER_BASE_URL}/documents.json` +
    `?conditions[type][]=PRESIDENTIAL+DOCUMENT` +
    `&${fields}&order=newest&per_page=${limit * 3}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Federal Register EO fetch failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as FRResponse;

  // Keep only Executive Orders (subtype field or title match)
  const eos = (data.results ?? []).filter((doc) => {
    const subtype = (doc as any).subtype ?? "";
    const title = doc.title?.toLowerCase() ?? "";
    return (
      subtype.toLowerCase().includes("executive order") ||
      title.startsWith("executive order")
    );
  });

  return eos
    .slice(0, limit)
    .map((doc) => frDocToIngest(doc, "executive_order"))
    .filter((x): x is IngestBillInput => x !== null);
}

// ─── CourtListener (requires COURT_LISTENER_API_KEY secret) ──────────────────

type CLCluster = {
  id?: number;
  case_name?: string;
  date_filed?: string;
  syllabus?: string;
  headnotes?: string;
  absolute_url?: string;
  court_full_name?: string;
};
type CLResponse = { results?: CLCluster[] };

async function fetchCourtListenerDecisions(env: Env, limit = 5): Promise<IngestBillInput[]> {
  if (!env.COURT_LISTENER_API_KEY) {
    console.log("COURT_LISTENER_API_KEY not set — skipping court decisions");
    return [];
  }

  const url = `${env.COURT_LISTENER_BASE_URL}/clusters/?order_by=-date_filed&page_size=${limit}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Token ${env.COURT_LISTENER_API_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`CourtListener fetch failed: ${res.status}`);

  const data = (await res.json()) as CLResponse;
  return (data.results ?? [])
    .map((cluster): IngestBillInput | null => {
      if (!cluster.id || !cluster.case_name?.trim()) return null;
      const id = `cl-${cluster.id}`;
      const courtName = cluster.court_full_name ?? "Federal Court";
      const summary = (cluster.syllabus?.trim() || cluster.headnotes?.trim() || `Federal court decision in ${cluster.case_name}. Filed ${cluster.date_filed ?? "recently"}.`).slice(0, 800);
      const officialUrl = cluster.absolute_url ? `https://www.courtlistener.com${cluster.absolute_url}` : `https://www.courtlistener.com/opinion/${cluster.id}/`;

      return {
        id,
        title: cluster.case_name.trim(),
        summary,
        status: `Decided ${cluster.date_filed ?? "recently"}`,
        topics: ["Federal Court", "Legal Precedent", courtName],
        affectedGroups: ["Legal Community", "Litigants", "General Public"],
        pattern: `Federal court decision establishing precedent in ${courtName}.`,
        relatedBillIds: [],
        officialSourceLabel: `CourtListener: ${cluster.case_name.trim()}`,
        officialSourceUrl: officialUrl,
        contentType: "court_decision",
        agency: courtName,
        sponsors: [],
      };
    })
    .filter((x): x is IngestBillInput => x !== null);
}

// ─── Supabase REST helpers ────────────────────────────────────────────────────

function supabaseHeaders(env: Env, extra?: Record<string, string>): Headers {
  return new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  });
}

async function supabaseFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}${path}`, init);
}

async function upsertBill(env: Env, bill: IngestBillInput) {
  const response = await supabaseFetch(env, `/rest/v1/bills?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders(env, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify([
      {
        id: bill.id,
        title: bill.title,
        summary: bill.summary,
        status: bill.status,
        topics: bill.topics,
        affected_groups: bill.affectedGroups,
        pattern: bill.pattern,
        related_bill_ids: bill.relatedBillIds,
        official_source_label: bill.officialSourceLabel,
        official_source_url: bill.officialSourceUrl,
        content_type: bill.contentType ?? "bill",
        sponsors: bill.sponsors ?? [],
        agency: bill.agency ?? null,
        updated_at: new Date().toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Supabase bill upsert failed: ${response.status} ${raw}`);
  }
}

async function upsertBillAnalysis(env: Env, billId: string, analysis: BillAnalysis) {
  const response = await supabaseFetch(env, `/rest/v1/bill_analysis?on_conflict=bill_id`, {
    method: "POST",
    headers: supabaseHeaders(env, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify([
      {
        bill_id: billId,
        why_it_matters_general: analysis.whyItMattersGeneral,
        broader_pattern: analysis.broaderPattern,
        hot_take: analysis.hotTake,
        analysis_version: "v1",
        model: env.ANTHROPIC_MODEL,
        updated_at: new Date().toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Supabase bill_analysis upsert failed: ${response.status} ${raw}`);
  }
}

async function replaceBillAudiences(env: Env, billId: string, audiences: BillAudience[]) {
  const deleteResponse = await supabaseFetch(env, `/rest/v1/bill_audiences?bill_id=eq.${encodeURIComponent(billId)}`, {
    method: "DELETE",
    headers: supabaseHeaders(env),
  });

  if (!deleteResponse.ok) {
    const raw = await deleteResponse.text().catch(() => "");
    throw new Error(`Supabase bill_audiences delete failed: ${deleteResponse.status} ${raw}`);
  }

  const payload = audiences.map((audience) => ({
    bill_id: billId,
    audience_label_raw: audience.audienceLabelRaw,
    audience_rationale: audience.audienceRationale,
    why_it_matters: audience.whyItMatters,
    confidence: audience.confidence,
    normalized_audience_key: audience.normalizedAudienceKey ?? null,
    updated_at: new Date().toISOString(),
  }));

  const insertResponse = await supabaseFetch(env, `/rest/v1/bill_audiences`, {
    method: "POST",
    headers: supabaseHeaders(env, { Prefer: "return=representation" }),
    body: JSON.stringify(payload),
  });

  if (!insertResponse.ok) {
    const raw = await insertResponse.text().catch(() => "");
    throw new Error(`Supabase bill_audiences insert failed: ${insertResponse.status} ${raw}`);
  }
}

// ─── Anthropic helper ─────────────────────────────────────────────────────────

async function anthropicToolCall<T>(
  env: Env,
  toolName: string,
  toolDescription: string,
  inputSchema: Record<string, unknown>,
  prompt: string,
  maxTokens: number
): Promise<T> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      tools: [{ name: toolName, description: toolDescription, input_schema: inputSchema }],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Anthropic call failed: ${response.status} ${raw}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };

  const toolBlock = (data.content ?? []).find((block) => block.type === "tool_use" && block.name === toolName);
  if (!toolBlock || !toolBlock.input) throw new Error(`Anthropic did not return tool output for ${toolName}`);

  return toolBlock.input as T;
}

async function generateBillAnalysis(env: Env, bill: IngestBillInput): Promise<BillAnalysis> {
  const prompt = `
You are generating reusable bill-level analysis for a civic-tech app called PoliticAlert.

Return structured output with exactly these fields:
- whyItMattersGeneral
- broaderPattern
- hotTake

Rules:
- whyItMattersGeneral: 2-4 sentences, broad and reusable across users
- broaderPattern: 2-4 sentences about the wider legislative or policy trend
- hotTake: 1-3 sentences, playful but informative, in Harnold's voice
- Do not invent facts beyond the bill data provided
- Keep the output concise and readable
- No markdown

Content (type: ${bill.contentType ?? "bill"}):
${JSON.stringify(bill, null, 2)}
  `.trim();

  const input = await anthropicToolCall<BillAnalysis>(
    env,
    "return_bill_analysis",
    "Return cached bill-level analysis for the UI.",
    {
      type: "object",
      properties: {
        whyItMattersGeneral: { type: "string" },
        broaderPattern: { type: "string" },
        hotTake: { type: "string" },
      },
      required: ["whyItMattersGeneral", "broaderPattern", "hotTake"],
    },
    prompt,
    700
  );

  return {
    whyItMattersGeneral: String(input.whyItMattersGeneral ?? "").trim(),
    broaderPattern: String(input.broaderPattern ?? "").trim(),
    hotTake: String(input.hotTake ?? "").trim(),
  };
}

async function generateBillAudiences(env: Env, bill: IngestBillInput): Promise<BillAudience[]> {
  const prompt = `
You are generating reusable audience-specific explainers for a civic-tech app called PoliticAlert.

For this item (type: ${bill.contentType ?? "bill"}), identify 3 to 6 audiences who may be meaningfully affected.

Important:
- Use flexible, natural audience descriptions.
- Do NOT force every audience into a rigid taxonomy.
- If a normalized audience key is obvious, include one.
- If not obvious, leave normalizedAudienceKey empty.
- Keep the rationale concise and factual.
- Keep whyItMatters concise, readable, and useful for that audience.
- Do not invent facts beyond the data.

Return a tool payload with:
- audiences: an array of audience objects

Each audience object must include:
- audienceLabelRaw
- audienceRationale
- whyItMatters
- confidence (0.0-1.0)
- normalizedAudienceKey

Content:
${JSON.stringify(bill, null, 2)}
  `.trim();

  const input = await anthropicToolCall<{
    audiences: Array<{
      audienceLabelRaw: string;
      audienceRationale: string;
      whyItMatters: string;
      confidence: number;
      normalizedAudienceKey?: string | null;
    }>;
  }>(
    env,
    "return_bill_audiences",
    "Return free-form affected audiences and cached explainers.",
    {
      type: "object",
      properties: {
        audiences: {
          type: "array",
          items: {
            type: "object",
            properties: {
              audienceLabelRaw: { type: "string" },
              audienceRationale: { type: "string" },
              whyItMatters: { type: "string" },
              confidence: { type: "number" },
              normalizedAudienceKey: { type: "string" },
            },
            required: ["audienceLabelRaw", "audienceRationale", "whyItMatters", "confidence", "normalizedAudienceKey"],
          },
        },
      },
      required: ["audiences"],
    },
    prompt,
    1400
  );

  return (input.audiences ?? [])
    .map((audience) => ({
      audienceLabelRaw: String(audience.audienceLabelRaw ?? "").trim(),
      audienceRationale: String(audience.audienceRationale ?? "").trim(),
      whyItMatters: String(audience.whyItMatters ?? "").trim(),
      confidence: Number(audience.confidence ?? 0),
      normalizedAudienceKey: String(audience.normalizedAudienceKey ?? "").trim() || null,
    }))
    .filter((audience) => audience.audienceLabelRaw && audience.audienceRationale && audience.whyItMatters)
    .slice(0, 6);
}

async function ingestSingleBill(env: Env, bill: IngestBillInput) {
  await upsertBill(env, bill);
  const analysis = await generateBillAnalysis(env, bill);
  await upsertBillAnalysis(env, bill.id, analysis);
  const audiences = await generateBillAudiences(env, bill);
  await replaceBillAudiences(env, bill.id, audiences);
  return { billId: bill.id, audienceCount: audiences.length };
}

// ─── Congress ingestion pipeline ──────────────────────────────────────────────

async function getIncomingBillsWithFallback(env: Env): Promise<{
  sourceUsed: "congress_api" | "fallback_local";
  sourceError: string | null;
  bills: IngestBillInput[];
}> {
  try {
    const bills = await fetchRecentCongressBills(env);
    return { sourceUsed: "congress_api", sourceError: null, bills };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Congress fetch error";
    console.warn("Congress API failed, falling back to local bills:", message);
    return { sourceUsed: "fallback_local", sourceError: message, bills: getFallbackBills() };
  }
}

async function runIngestion(env: Env): Promise<IngestionResult> {
  const incoming = await getIncomingBillsWithFallback(env);
  const ingestedIds: string[] = [];
  const errors: Array<{ billId: string; error: string }> = [];

  for (const bill of incoming.bills) {
    try {
      await ingestSingleBill(env, bill);
      ingestedIds.push(bill.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingestion error";
      errors.push({ billId: bill.id, error: message });
    }
  }

  return {
    ok: true,
    sourceUsed: incoming.sourceUsed,
    sourceError: incoming.sourceError,
    fetched: incoming.bills.length,
    pending: incoming.bills.length,
    ingestedIds,
    errors,
  };
}

// ─── External source ingestion pipeline ──────────────────────────────────────

async function runExternalIngestion(env: Env): Promise<{
  regulations: { ingestedIds: string[]; errors: string[] };
  executiveOrders: { ingestedIds: string[]; errors: string[] };
  courtDecisions: { ingestedIds: string[]; errors: string[] };
}> {
  const result = {
    regulations: { ingestedIds: [] as string[], errors: [] as string[] },
    executiveOrders: { ingestedIds: [] as string[], errors: [] as string[] },
    courtDecisions: { ingestedIds: [] as string[], errors: [] as string[] },
  };

  const [regulations, executiveOrders, courtDecisions] = await Promise.allSettled([
    fetchFederalRegisterRegulations(env, 5),
    fetchFederalRegisterExecutiveOrders(env, 5),
    fetchCourtListenerDecisions(env, 5),
  ]);

  async function processItems(
    settled: PromiseSettledResult<IngestBillInput[]>,
    bucket: { ingestedIds: string[]; errors: string[] },
    label: string
  ) {
    if (settled.status === "rejected") {
      console.error(`${label} fetch failed:`, settled.reason);
      bucket.errors.push(String(settled.reason));
      return;
    }
    for (const item of settled.value) {
      try {
        await ingestSingleBill(env, item);
        bucket.ingestedIds.push(item.id);
      } catch (err) {
        bucket.errors.push(`${item.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  await processItems(regulations, result.regulations, "Federal Register regulations");
  await processItems(executiveOrders, result.executiveOrders, "Federal Register EOs");
  await processItems(courtDecisions, result.courtDecisions, "CourtListener");

  return result;
}

// ─── Digest delivery ──────────────────────────────────────────────────────────

type DigestUser = {
  email: string;
  interests: string[];
  contexts: string[];
  digest_frequency: string;
  last_digest_sent_at: string | null;
};

type WorkerBill = {
  id: string;
  title: string;
  summary: string;
  status: string;
  topics: string[];
  official_source_url: string;
  content_type: string;
};

async function fetchDigestUsers(env: Env): Promise<DigestUser[]> {
  const res = await supabaseFetch(
    env,
    `/rest/v1/goose_profiles?digest_enabled=eq.true&select=email,interests,contexts,digest_frequency,last_digest_sent_at`,
    { method: "GET", headers: supabaseHeaders(env) }
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Supabase digest users fetch failed: ${res.status} ${raw}`);
  }

  return (await res.json()) as DigestUser[];
}

function isUserDue(user: DigestUser): boolean {
  if (!user.last_digest_sent_at) return true;

  const lastSent = new Date(user.last_digest_sent_at).getTime();
  const now = Date.now();
  const freq = (user.digest_frequency ?? "Weekly").toLowerCase();

  const thresholds: Record<string, number> = {
    daily: 23 * 60 * 60 * 1000,
    "twice a week": 3.5 * 24 * 60 * 60 * 1000,
    weekly: 6.5 * 24 * 60 * 60 * 1000,
    monthly: 28 * 24 * 60 * 60 * 1000,
  };

  const threshold = thresholds[freq] ?? thresholds["weekly"];
  return now - lastSent >= threshold;
}

async function fetchAllBillsForDigest(env: Env): Promise<WorkerBill[]> {
  const res = await supabaseFetch(
    env,
    `/rest/v1/bills?select=id,title,summary,status,topics,official_source_url,content_type&order=id.asc`,
    { method: "GET", headers: supabaseHeaders(env) }
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Supabase bills fetch failed: ${res.status} ${raw}`);
  }

  return (await res.json()) as WorkerBill[];
}

function scoreAndRankBillsForUser(bills: WorkerBill[], user: DigestUser, limit: number): WorkerBill[] {
  const userText = [...(user.interests ?? []), ...(user.contexts ?? [])].map((s) => s.toLowerCase()).join(" ");

  if (!userText.trim()) return bills.slice(0, limit);

  const scored = bills.map((bill) => {
    let score = 0;
    for (const topic of bill.topics ?? []) {
      if (userText.includes(topic.toLowerCase())) score += 2;
    }
    for (const interest of user.interests ?? []) {
      if (bill.title.toLowerCase().includes(interest.toLowerCase())) score += 1;
    }
    return { bill, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.bill);
}

function buildWorkerDigestHtml(user: DigestUser, bills: WorkerBill[]): string {
  const profileLine = (user.interests?.length ?? 0) > 0
    ? user.interests.slice(0, 4).join(" · ")
    : "your saved profile";

  const typeLabel: Record<string, string> = {
    bill: "Bill",
    regulation: "Regulation",
    executive_order: "Executive Order",
    court_decision: "Court Decision",
  };

  const billSections = bills
    .map((bill) => {
      const whyItMatters = bill.summary.slice(0, 140) + (bill.summary.length > 140 ? "…" : "");
      const type = typeLabel[bill.content_type] ?? bill.content_type ?? "Bill";

      return `
        <div style="border:2px solid #e2e8f0;border-radius:14px;padding:16px;margin:0 0 12px 0;background:#fffef8;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <h2 style="margin:0;font-size:17px;font-weight:700;color:#111827;line-height:1.3;">${bill.title}</h2>
            <span style="font-size:11px;color:#c2410c;font-weight:600;white-space:nowrap;background:#fff7ed;border-radius:99px;padding:2px 8px;">${type}</span>
          </div>
          <p style="margin:8px 0 0 0;color:#475569;font-size:14px;line-height:1.5;">${whyItMatters}</p>
          <p style="margin:10px 0 0 0;">
            <a href="${bill.official_source_url}" style="font-size:13px;color:#0f766e;font-weight:600;text-decoration:none;">Read more →</a>
          </p>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;background:#f8f4ea;padding:20px;color:#111827;">
      <div style="max-width:600px;margin:0 auto;background:white;border:2px solid #d6d3d1;border-radius:18px;padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="font-size:24px;">🪿</span>
          <div>
            <div style="font-size:11px;color:#c2410c;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">PoliticAlert</div>
            <div style="font-size:13px;color:#64748b;">${profileLine}</div>
          </div>
        </div>
        <h1 style="margin:0 0 16px 0;font-size:24px;color:#111827;line-height:1.2;">Your legislative digest</h1>
        ${billSections}
        <p style="margin:16px 0 0 0;color:#94a3b8;font-size:12px;text-align:center;">PoliticAlert · less doomscrolling, more useful honking</p>
      </div>
    </div>
  `;
}

async function sendDigestEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `PoliticAlert <${env.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${raw}`);
  }
}

async function updateLastDigestSent(env: Env, email: string): Promise<void> {
  const res = await supabaseFetch(
    env,
    `/rest/v1/goose_profiles?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(env, { Prefer: "return=minimal" }),
      body: JSON.stringify({ last_digest_sent_at: new Date().toISOString() }),
    }
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Supabase last_digest_sent_at update failed: ${res.status} ${raw}`);
  }
}

async function runDigestDelivery(env: Env): Promise<{ sent: number; skipped: number; errors: string[] }> {
  if (!env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set — skipping digest delivery");
    return { sent: 0, skipped: 0, errors: ["RESEND_API_KEY not set"] };
  }

  const [users, bills] = await Promise.all([fetchDigestUsers(env), fetchAllBillsForDigest(env)]);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const user of users) {
    if (!isUserDue(user)) {
      skipped++;
      continue;
    }

    try {
      const topBills = scoreAndRankBillsForUser(bills, user, 3);
      if (!topBills.length) {
        skipped++;
        continue;
      }

      const html = buildWorkerDigestHtml(user, topBills);
      await sendDigestEmail(env, user.email, "Harnold's latest legislative digest 🪿", html);
      await updateLastDigestSent(env, user.email);
      sent++;
    } catch (err) {
      const msg = `${user.email}: ${err instanceof Error ? err.message : String(err)}`;
      console.error("Digest delivery failed for", user.email, err);
      errors.push(msg);
    }
  }

  console.log(`Digest delivery: sent=${sent} skipped=${skipped} errors=${errors.length}`);
  return { sent, skipped, errors };
}

// ─── Authorization ────────────────────────────────────────────────────────────

function isAuthorized(request: Request, env: Env) {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${env.RUN_SECRET}`;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export default {
  async scheduled(_controller: unknown, env: Env, ctx: WorkerExecutionContext) {
    ctx.waitUntil(
      runIngestion(env)
        .then(() => runExternalIngestion(env))
        .then(() => runDigestDelivery(env))
        .catch((err) => console.error("Scheduled job failed:", err))
    );
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "harnold-ingestion-worker" });
    }

    if (url.pathname === "/run-now" && request.method === "POST") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      try {
        const [bills, external] = await Promise.allSettled([
          runIngestion(env),
          runExternalIngestion(env),
        ]);
        return json({
          ok: true,
          bills: bills.status === "fulfilled" ? bills.value : { error: String((bills as PromiseRejectedResult).reason) },
          external: external.status === "fulfilled" ? external.value : { error: String((external as PromiseRejectedResult).reason) },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown worker error";
        return json({ error: message }, 500);
      }
    }

    if (url.pathname === "/run-external" && request.method === "POST") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      try {
        const result = await runExternalIngestion(env);
        return json({ ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return json({ error: message }, 500);
      }
    }

    if (url.pathname === "/run-digest" && request.method === "POST") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      try {
        const result = await runDigestDelivery(env);
        return json({ ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return json({ error: message }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};
