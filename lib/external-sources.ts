import type { IngestBillInput } from "@/lib/ingestion";

// ─── Federal Register ────────────────────────────────────────────────────────

type FRAgency = { name?: string; raw_name?: string };

type FRDocument = {
  document_number?: string;
  title?: string;
  abstract?: string;
  html_url?: string;
  agencies?: FRAgency[];
  publication_date?: string;
  type?: string;
  presidential_document_type?: string;
};

type FRResponse = {
  results?: FRDocument[];
  count?: number;
};

function frDocumentToIngestInput(
  doc: FRDocument,
  contentType: "regulation" | "executive_order"
): IngestBillInput | null {
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

  const affectedGroups =
    contentType === "regulation"
      ? ["Regulated Industries", "General Public", "Businesses"]
      : ["Federal Agencies", "General Public"];

  const pattern =
    contentType === "regulation"
      ? `Part of ongoing federal regulatory activity from ${primaryAgency}.`
      : `Presidential executive action directing federal policy and operations.`;

  return {
    id,
    title: doc.title.trim(),
    summary,
    status: `Published ${doc.publication_date ?? "recently"} in Federal Register`,
    topics,
    affectedGroups,
    pattern,
    relatedBillIds: [],
    officialSourceLabel: `Federal Register: ${docNum}`,
    officialSourceUrl: doc.html_url ?? "https://www.federalregister.gov",
    contentType,
    agency: primaryAgency,
    sponsors: [],
  };
}

const FR_BASE = "https://www.federalregister.gov/api/v1";

export async function fetchRegulations(limit = 5): Promise<IngestBillInput[]> {
  const fields = [
    "document_number", "title", "abstract", "html_url",
    "agencies", "publication_date", "type",
  ].map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");

  const url =
    `${FR_BASE}/documents.json?` +
    `conditions[type][]=RULE&${fields}&order=newest&per_page=${limit}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Federal Register regulations fetch failed: ${res.status}`);

  const data = (await res.json()) as FRResponse;
  return (data.results ?? [])
    .map((doc) => frDocumentToIngestInput(doc, "regulation"))
    .filter((item): item is IngestBillInput => item !== null);
}

export async function fetchExecutiveOrders(limit = 5): Promise<IngestBillInput[]> {
  const fields = [
    "document_number", "title", "abstract", "html_url",
    "agencies", "publication_date", "type", "subtype",
  ].map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");

  const url =
    `${FR_BASE}/documents.json?` +
    `conditions[type][]=PRESIDENTIAL+DOCUMENT` +
    `&${fields}&order=newest&per_page=${limit * 3}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Federal Register executive orders fetch failed: ${res.status}`);

  const data = (await res.json()) as FRResponse;
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
    .map((doc) => frDocumentToIngestInput(doc, "executive_order"))
    .filter((item): item is IngestBillInput => item !== null);
}

// ─── CourtListener ────────────────────────────────────────────────────────────

type CLCourt = { full_name?: string; short_name?: string };

type CLCluster = {
  id?: number;
  case_name?: string;
  date_filed?: string;
  syllabus?: string;
  headnotes?: string;
  nature_of_suit?: string;
  precedential_status?: string;
  absolute_url?: string;
  docket?: string | { court?: string | CLCourt; absolute_url?: string };
  court?: CLCourt;
  court_full_name?: string;
};

type CLResponse = {
  results?: CLCluster[];
  count?: number;
  next?: string | null;
};

export async function fetchCourtDecisions(limit = 5): Promise<IngestBillInput[]> {
  const url =
    `https://www.courtlistener.com/api/rest/v4/clusters/` +
    `?order_by=-date_filed&page_size=${limit}`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CourtListener fetch failed: ${res.status}`);

  const data = (await res.json()) as CLResponse;
  const items = data.results ?? [];

  return items
    .map((cluster): IngestBillInput | null => {
      const clusterId = cluster.id;
      if (!clusterId || !cluster.case_name?.trim()) return null;

      const id = `cl-${clusterId}`;
      const courtName = cluster.court_full_name ?? "Federal Court";
      const summary =
        cluster.syllabus?.trim() ||
        cluster.headnotes?.trim() ||
        `Federal court decision in ${cluster.case_name}. Filed ${cluster.date_filed ?? "recently"}.`;

      const officialUrl = cluster.absolute_url
        ? `https://www.courtlistener.com${cluster.absolute_url}`
        : `https://www.courtlistener.com/opinion/${clusterId}/`;

      return {
        id,
        title: cluster.case_name.trim(),
        summary: summary.slice(0, 800),
        status: `Decided ${cluster.date_filed ?? "recently"}`,
        topics: ["Federal Court", "Legal Precedent", courtName].filter(Boolean),
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
    .filter((item): item is IngestBillInput => item !== null);
}
