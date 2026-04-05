var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
function normalizeBillIdFromParts(billType, billNumber, fallbackType) {
  const type = String(billType || fallbackType).toLowerCase();
  const number = String(billNumber || "").toLowerCase();
  return `${type}${number}`;
}
__name(normalizeBillIdFromParts, "normalizeBillIdFromParts");
function normalizeBillId(item, fallbackType) {
  return normalizeBillIdFromParts(item.type || item.billType, item.number, fallbackType);
}
__name(normalizeBillId, "normalizeBillId");
function normalizeOfficialSourceLabel(detail, fallbackType) {
  const type = String(detail.type || detail.billType || fallbackType).toUpperCase();
  const number = String(detail.number || "");
  return `Congress.gov: ${type} ${number}`;
}
__name(normalizeOfficialSourceLabel, "normalizeOfficialSourceLabel");
function normalizeOfficialSourceUrl(detail, fallbackCongress, fallbackType) {
  if (detail.legislationUrl) return detail.legislationUrl;
  const congress = String(detail.congress || fallbackCongress);
  const type = String(detail.type || detail.billType || fallbackType).toLowerCase();
  const number = String(detail.number || "");
  const pathTypeMap = {
    hr: "house-bill",
    s: "senate-bill",
    hjres: "house-joint-resolution",
    sjres: "senate-joint-resolution",
    hconres: "house-concurrent-resolution",
    sconres: "senate-concurrent-resolution",
    hres: "house-resolution",
    sres: "senate-resolution"
  };
  return `https://www.congress.gov/bill/${congress}th-congress/${pathTypeMap[type] ?? type}/${number}`;
}
__name(normalizeOfficialSourceUrl, "normalizeOfficialSourceUrl");
function withCongressApiParams(rawUrl, env) {
  const url = new URL(rawUrl);
  if (!url.searchParams.has("api_key")) url.searchParams.set("api_key", env.CONGRESS_API_KEY);
  if (!url.searchParams.has("format")) url.searchParams.set("format", "json");
  return url.toString();
}
__name(withCongressApiParams, "withCongressApiParams");
async function fetchCongressJson(rawUrl, env) {
  const response = await fetch(withCongressApiParams(rawUrl, env), {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Congress API fetch failed: ${response.status} ${raw}`);
  }
  return await response.json();
}
__name(fetchCongressJson, "fetchCongressJson");
function extractArray(data, candidateKeys) {
  for (const key of candidateKeys) {
    const value = data?.[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") {
      for (const nestedKey of ["items", "item", "summaries", "subjects", "legislativeSubjects", "relatedBills", "bills"]) {
        const nested = value?.[nestedKey];
        if (Array.isArray(nested)) return nested;
      }
    }
  }
  return [];
}
__name(extractArray, "extractArray");
function squashWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}
__name(squashWhitespace, "squashWhitespace");
function stripHtml(value) {
  return squashWhitespace(
    value.replace(/<!\[CDATA\[|\]\]>/g, " ").replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  );
}
__name(stripHtml, "stripHtml");
function unique(values) {
  return Array.from(new Set(values));
}
__name(unique, "unique");
function normalizeText(value) {
  return value.toLowerCase().trim();
}
__name(normalizeText, "normalizeText");
async function fetchBillDetail(env, item) {
  const congress = String(item.congress || env.CONGRESS_SYNC_CONGRESS);
  const billType = String(item.type || item.billType || env.CONGRESS_SYNC_BILL_TYPE).toLowerCase();
  const billNumber = String(item.number);
  const url = `${env.CONGRESS_API_BASE_URL}/bill/${encodeURIComponent(congress)}/${encodeURIComponent(billType)}/${encodeURIComponent(billNumber)}`;
  const data = await fetchCongressJson(url, env);
  return "bill" in data ? data.bill : data;
}
__name(fetchBillDetail, "fetchBillDetail");
async function fetchBillSummaries(env, detail) {
  const url = detail.summaries?.url;
  if (!url) return [];
  const data = await fetchCongressJson(url, env);
  return extractArray(data, ["summaries", "summary"]);
}
__name(fetchBillSummaries, "fetchBillSummaries");
async function fetchBillSubjects(env, detail) {
  const url = detail.subjects?.url;
  if (!url) return [];
  const data = await fetchCongressJson(url, env);
  return extractArray(data, ["subjects", "legislativeSubjects"]);
}
__name(fetchBillSubjects, "fetchBillSubjects");
async function fetchRelatedBillIds(env, detail) {
  const url = detail.relatedBills?.url;
  if (!url) return [];
  const data = await fetchCongressJson(url, env);
  const related = extractArray(data, ["relatedBills", "bills"]);
  return unique(
    related.map((item) => normalizeBillIdFromParts(item.type || item.billType, item.number, env.CONGRESS_SYNC_BILL_TYPE)).filter(Boolean)
  ).slice(0, 6);
}
__name(fetchRelatedBillIds, "fetchRelatedBillIds");
function pickBestSummary(detail, summaries) {
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
__name(pickBestSummary, "pickBestSummary");
function buildStatus(detail) {
  const latestAction = detail.latestAction?.text?.trim();
  if (latestAction) return latestAction;
  if (detail.introducedDate) return `Introduced ${detail.introducedDate}`;
  return "Recent action recorded on Congress.gov";
}
__name(buildStatus, "buildStatus");
function inferTopicsFromDetail(detail, subjects) {
  const topics = [];
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
__name(inferTopicsFromDetail, "inferTopicsFromDetail");
function inferAffectedGroupsFromDetail(detail, topics, summary) {
  const groups = [];
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
__name(inferAffectedGroupsFromDetail, "inferAffectedGroupsFromDetail");
function inferPatternFromDetail(detail, topics, summary) {
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
__name(inferPatternFromDetail, "inferPatternFromDetail");
function extractSponsors(detail) {
  const items = Array.isArray(detail.sponsors) ? detail.sponsors : [];
  return items.filter((s) => s.fullName || s.firstName && s.lastName).map((s) => ({
    fullName: s.fullName?.trim() ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
    party: s.party?.trim(),
    state: s.state?.trim(),
    district: s.district
  })).slice(0, 5);
}
__name(extractSponsors, "extractSponsors");
async function mapCongressBillToIngestBill(item, env) {
  const detail = await fetchBillDetail(env, item);
  const [summaries, subjects, relatedBillIds] = await Promise.all([
    fetchBillSummaries(env, detail),
    fetchBillSubjects(env, detail),
    fetchRelatedBillIds(env, detail)
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
    sponsors
  };
}
__name(mapCongressBillToIngestBill, "mapCongressBillToIngestBill");
function getFallbackBills() {
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
      sponsors: []
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
      sponsors: []
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
      sponsors: []
    }
  ];
}
__name(getFallbackBills, "getFallbackBills");
async function fetchRecentCongressBills(env) {
  const url = `${env.CONGRESS_API_BASE_URL}/bill/${encodeURIComponent(env.CONGRESS_SYNC_CONGRESS)}/${encodeURIComponent(env.CONGRESS_SYNC_BILL_TYPE)}?api_key=${encodeURIComponent(env.CONGRESS_API_KEY)}&format=json&limit=${encodeURIComponent(env.CONGRESS_SYNC_LIMIT)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Congress API fetch failed: ${response.status} ${raw}`);
  }
  const data = await response.json();
  return await Promise.all(
    (data.bills ?? []).filter((item) => item.title && item.number).map((item) => mapCongressBillToIngestBill(item, env))
  );
}
__name(fetchRecentCongressBills, "fetchRecentCongressBills");
function frDocToIngest(doc, contentType) {
  const docNum = doc.document_number?.trim();
  if (!docNum || !doc.title?.trim()) return null;
  const idPrefix = contentType === "regulation" ? "fr-reg-" : "fr-eo-";
  const id = (idPrefix + docNum.replace(/[^a-zA-Z0-9]/g, "-")).toLowerCase();
  const agencyNames = (doc.agencies ?? []).map((a) => a.name?.trim()).filter(Boolean);
  const primaryAgency = agencyNames[0] ?? "Federal Agency";
  const summary = doc.abstract?.trim() || `${contentType === "regulation" ? "Federal regulation" : "Executive order"} from ${primaryAgency}. Published ${doc.publication_date ?? "recently"}.`;
  const topics = contentType === "regulation" ? ["Federal Regulation", ...agencyNames.slice(0, 3)] : ["Executive Order", "Presidential Action", ...agencyNames.slice(0, 2)];
  return {
    id,
    title: doc.title.trim(),
    summary,
    status: `Published ${doc.publication_date ?? "recently"} in Federal Register`,
    topics,
    affectedGroups: contentType === "regulation" ? ["Regulated Industries", "General Public", "Businesses"] : ["Federal Agencies", "General Public"],
    pattern: contentType === "regulation" ? `Part of ongoing federal regulatory activity from ${primaryAgency}.` : `Presidential executive action directing federal policy and operations.`,
    relatedBillIds: [],
    officialSourceLabel: `Federal Register: ${docNum}`,
    officialSourceUrl: doc.html_url ?? "https://www.federalregister.gov",
    contentType,
    agency: primaryAgency,
    sponsors: []
  };
}
__name(frDocToIngest, "frDocToIngest");
async function fetchFederalRegisterRegulations(env, limit = 5) {
  const fields = ["document_number", "title", "abstract", "html_url", "agencies", "publication_date"].map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const url = `${env.FEDERAL_REGISTER_BASE_URL}/documents.json?conditions[type][]=RULE&${fields}&order=newest&per_page=${limit}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Federal Register regulations fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((doc) => frDocToIngest(doc, "regulation")).filter((x) => x !== null);
}
__name(fetchFederalRegisterRegulations, "fetchFederalRegisterRegulations");
async function fetchFederalRegisterExecutiveOrders(env, limit = 5) {
  const fields = ["document_number", "title", "abstract", "html_url", "agencies", "publication_date", "subtype"].map((f) => `fields[]=${encodeURIComponent(f)}`).join("&");
  const url = `${env.FEDERAL_REGISTER_BASE_URL}/documents.json?conditions[type][]=PRESIDENTIAL+DOCUMENT&${fields}&order=newest&per_page=${limit * 3}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Federal Register EO fetch failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  const eos = (data.results ?? []).filter((doc) => {
    const subtype = doc.subtype ?? "";
    const title = doc.title?.toLowerCase() ?? "";
    return subtype.toLowerCase().includes("executive order") || title.startsWith("executive order");
  });
  return eos.slice(0, limit).map((doc) => frDocToIngest(doc, "executive_order")).filter((x) => x !== null);
}
__name(fetchFederalRegisterExecutiveOrders, "fetchFederalRegisterExecutiveOrders");
async function fetchCourtListenerDecisions(env, limit = 5) {
  if (!env.COURT_LISTENER_API_KEY) {
    console.log("COURT_LISTENER_API_KEY not set \u2014 skipping court decisions");
    return [];
  }
  const url = `${env.COURT_LISTENER_BASE_URL}/clusters/?order_by=-date_filed&page_size=${limit}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Token ${env.COURT_LISTENER_API_KEY}`
    }
  });
  if (!res.ok) throw new Error(`CourtListener fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((cluster) => {
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
      sponsors: []
    };
  }).filter((x) => x !== null);
}
__name(fetchCourtListenerDecisions, "fetchCourtListenerDecisions");
function supabaseHeaders(env, extra) {
  return new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra || {}
  });
}
__name(supabaseHeaders, "supabaseHeaders");
async function supabaseFetch(env, path, init) {
  return fetch(`${env.SUPABASE_URL}${path}`, init);
}
__name(supabaseFetch, "supabaseFetch");
async function upsertBill(env, bill) {
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
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ])
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Supabase bill upsert failed: ${response.status} ${raw}`);
  }
}
__name(upsertBill, "upsertBill");
async function upsertBillAnalysis(env, billId, analysis) {
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
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }
    ])
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Supabase bill_analysis upsert failed: ${response.status} ${raw}`);
  }
}
__name(upsertBillAnalysis, "upsertBillAnalysis");
async function replaceBillAudiences(env, billId, audiences) {
  const deleteResponse = await supabaseFetch(env, `/rest/v1/bill_audiences?bill_id=eq.${encodeURIComponent(billId)}`, {
    method: "DELETE",
    headers: supabaseHeaders(env)
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
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  }));
  const insertResponse = await supabaseFetch(env, `/rest/v1/bill_audiences`, {
    method: "POST",
    headers: supabaseHeaders(env, { Prefer: "return=representation" }),
    body: JSON.stringify(payload)
  });
  if (!insertResponse.ok) {
    const raw = await insertResponse.text().catch(() => "");
    throw new Error(`Supabase bill_audiences insert failed: ${insertResponse.status} ${raw}`);
  }
}
__name(replaceBillAudiences, "replaceBillAudiences");
async function anthropicToolCall(env, toolName, toolDescription, inputSchema, prompt, maxTokens) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      tools: [{ name: toolName, description: toolDescription, input_schema: inputSchema }],
      tool_choice: { type: "tool", name: toolName },
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Anthropic call failed: ${response.status} ${raw}`);
  }
  const data = await response.json();
  const toolBlock = (data.content ?? []).find((block) => block.type === "tool_use" && block.name === toolName);
  if (!toolBlock || !toolBlock.input) throw new Error(`Anthropic did not return tool output for ${toolName}`);
  return toolBlock.input;
}
__name(anthropicToolCall, "anthropicToolCall");
async function generateBillAnalysis(env, bill) {
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
  const input = await anthropicToolCall(
    env,
    "return_bill_analysis",
    "Return cached bill-level analysis for the UI.",
    {
      type: "object",
      properties: {
        whyItMattersGeneral: { type: "string" },
        broaderPattern: { type: "string" },
        hotTake: { type: "string" }
      },
      required: ["whyItMattersGeneral", "broaderPattern", "hotTake"]
    },
    prompt,
    700
  );
  return {
    whyItMattersGeneral: String(input.whyItMattersGeneral ?? "").trim(),
    broaderPattern: String(input.broaderPattern ?? "").trim(),
    hotTake: String(input.hotTake ?? "").trim()
  };
}
__name(generateBillAnalysis, "generateBillAnalysis");
async function generateBillAudiences(env, bill) {
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
  const input = await anthropicToolCall(
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
              normalizedAudienceKey: { type: "string" }
            },
            required: ["audienceLabelRaw", "audienceRationale", "whyItMatters", "confidence", "normalizedAudienceKey"]
          }
        }
      },
      required: ["audiences"]
    },
    prompt,
    1400
  );
  return (input.audiences ?? []).map((audience) => ({
    audienceLabelRaw: String(audience.audienceLabelRaw ?? "").trim(),
    audienceRationale: String(audience.audienceRationale ?? "").trim(),
    whyItMatters: String(audience.whyItMatters ?? "").trim(),
    confidence: Number(audience.confidence ?? 0),
    normalizedAudienceKey: String(audience.normalizedAudienceKey ?? "").trim() || null
  })).filter((audience) => audience.audienceLabelRaw && audience.audienceRationale && audience.whyItMatters).slice(0, 6);
}
__name(generateBillAudiences, "generateBillAudiences");
async function ingestSingleBill(env, bill) {
  await upsertBill(env, bill);
  const analysis = await generateBillAnalysis(env, bill);
  await upsertBillAnalysis(env, bill.id, analysis);
  const audiences = await generateBillAudiences(env, bill);
  await replaceBillAudiences(env, bill.id, audiences);
  return { billId: bill.id, audienceCount: audiences.length };
}
__name(ingestSingleBill, "ingestSingleBill");
async function getIncomingBillsWithFallback(env) {
  try {
    const bills = await fetchRecentCongressBills(env);
    return { sourceUsed: "congress_api", sourceError: null, bills };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Congress fetch error";
    console.warn("Congress API failed, falling back to local bills:", message);
    return { sourceUsed: "fallback_local", sourceError: message, bills: getFallbackBills() };
  }
}
__name(getIncomingBillsWithFallback, "getIncomingBillsWithFallback");
async function runIngestion(env) {
  const incoming = await getIncomingBillsWithFallback(env);
  const ingestedIds = [];
  const errors = [];
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
    errors
  };
}
__name(runIngestion, "runIngestion");
async function runExternalIngestion(env) {
  const result = {
    regulations: { ingestedIds: [], errors: [] },
    executiveOrders: { ingestedIds: [], errors: [] },
    courtDecisions: { ingestedIds: [], errors: [] }
  };
  const [regulations, executiveOrders, courtDecisions] = await Promise.allSettled([
    fetchFederalRegisterRegulations(env, 5),
    fetchFederalRegisterExecutiveOrders(env, 5),
    fetchCourtListenerDecisions(env, 5)
  ]);
  async function processItems(settled, bucket, label) {
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
  __name(processItems, "processItems");
  await processItems(regulations, result.regulations, "Federal Register regulations");
  await processItems(executiveOrders, result.executiveOrders, "Federal Register EOs");
  await processItems(courtDecisions, result.courtDecisions, "CourtListener");
  return result;
}
__name(runExternalIngestion, "runExternalIngestion");
async function fetchDigestUsers(env) {
  const res = await supabaseFetch(
    env,
    `/rest/v1/goose_profiles?digest_enabled=eq.true&select=email,interests,contexts,digest_frequency,last_digest_sent_at`,
    { method: "GET", headers: supabaseHeaders(env) }
  );
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Supabase digest users fetch failed: ${res.status} ${raw}`);
  }
  return await res.json();
}
__name(fetchDigestUsers, "fetchDigestUsers");
function isUserDue(user) {
  if (!user.last_digest_sent_at) return true;
  const lastSent = new Date(user.last_digest_sent_at).getTime();
  const now = Date.now();
  const freq = (user.digest_frequency ?? "Weekly").toLowerCase();
  const thresholds = {
    daily: 23 * 60 * 60 * 1e3,
    "twice a week": 3.5 * 24 * 60 * 60 * 1e3,
    weekly: 6.5 * 24 * 60 * 60 * 1e3,
    monthly: 28 * 24 * 60 * 60 * 1e3
  };
  const threshold = thresholds[freq] ?? thresholds["weekly"];
  return now - lastSent >= threshold;
}
__name(isUserDue, "isUserDue");
async function fetchAllBillsForDigest(env) {
  const res = await supabaseFetch(
    env,
    `/rest/v1/bills?select=id,title,summary,status,topics,official_source_url,content_type&order=id.asc`,
    { method: "GET", headers: supabaseHeaders(env) }
  );
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Supabase bills fetch failed: ${res.status} ${raw}`);
  }
  return await res.json();
}
__name(fetchAllBillsForDigest, "fetchAllBillsForDigest");
function scoreAndRankBillsForUser(bills, user, limit) {
  const userText = [...user.interests ?? [], ...user.contexts ?? []].map((s) => s.toLowerCase()).join(" ");
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
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.bill);
}
__name(scoreAndRankBillsForUser, "scoreAndRankBillsForUser");
function buildWorkerDigestHtml(user, bills) {
  const profileLine = (user.interests?.length ?? 0) > 0 ? user.interests.slice(0, 4).join(" \xB7 ") : "your saved profile";
  const typeLabel = {
    bill: "Bill",
    regulation: "Regulation",
    executive_order: "Executive Order",
    court_decision: "Court Decision"
  };
  const billSections = bills.map((bill) => {
    const whyItMatters = bill.summary.slice(0, 140) + (bill.summary.length > 140 ? "\u2026" : "");
    const type = typeLabel[bill.content_type] ?? bill.content_type ?? "Bill";
    return `
        <div style="border:2px solid #e2e8f0;border-radius:14px;padding:16px;margin:0 0 12px 0;background:#fffef8;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
            <h2 style="margin:0;font-size:17px;font-weight:700;color:#111827;line-height:1.3;">${bill.title}</h2>
            <span style="font-size:11px;color:#c2410c;font-weight:600;white-space:nowrap;background:#fff7ed;border-radius:99px;padding:2px 8px;">${type}</span>
          </div>
          <p style="margin:8px 0 0 0;color:#475569;font-size:14px;line-height:1.5;">${whyItMatters}</p>
          <p style="margin:10px 0 0 0;">
            <a href="${bill.official_source_url}" style="font-size:13px;color:#0f766e;font-weight:600;text-decoration:none;">Read more \u2192</a>
          </p>
        </div>
      `;
  }).join("");
  return `
    <div style="font-family:Arial,sans-serif;background:#f8f4ea;padding:20px;color:#111827;">
      <div style="max-width:600px;margin:0 auto;background:white;border:2px solid #d6d3d1;border-radius:18px;padding:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <span style="font-size:24px;">\u{1FABF}</span>
          <div>
            <div style="font-size:11px;color:#c2410c;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">PoliticAlert</div>
            <div style="font-size:13px;color:#64748b;">${profileLine}</div>
          </div>
        </div>
        <h1 style="margin:0 0 16px 0;font-size:24px;color:#111827;line-height:1.2;">Your legislative digest</h1>
        ${billSections}
        <p style="margin:16px 0 0 0;color:#94a3b8;font-size:12px;text-align:center;">PoliticAlert \xB7 less doomscrolling, more useful honking</p>
      </div>
    </div>
  `;
}
__name(buildWorkerDigestHtml, "buildWorkerDigestHtml");
async function sendDigestEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: `PoliticAlert <${env.RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      html
    })
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${raw}`);
  }
}
__name(sendDigestEmail, "sendDigestEmail");
async function updateLastDigestSent(env, email) {
  const res = await supabaseFetch(
    env,
    `/rest/v1/goose_profiles?email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      headers: supabaseHeaders(env, { Prefer: "return=minimal" }),
      body: JSON.stringify({ last_digest_sent_at: (/* @__PURE__ */ new Date()).toISOString() })
    }
  );
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new Error(`Supabase last_digest_sent_at update failed: ${res.status} ${raw}`);
  }
}
__name(updateLastDigestSent, "updateLastDigestSent");
async function runDigestDelivery(env) {
  if (!env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY not set \u2014 skipping digest delivery");
    return { sent: 0, skipped: 0, errors: ["RESEND_API_KEY not set"] };
  }
  const [users, bills] = await Promise.all([fetchDigestUsers(env), fetchAllBillsForDigest(env)]);
  let sent = 0;
  let skipped = 0;
  const errors = [];
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
      await sendDigestEmail(env, user.email, "Harnold's latest legislative digest \u{1FABF}", html);
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
__name(runDigestDelivery, "runDigestDelivery");
function isAuthorized(request, env) {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${env.RUN_SECRET}`;
}
__name(isAuthorized, "isAuthorized");
var src_default = {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runIngestion(env).then(() => runExternalIngestion(env)).then(() => runDigestDelivery(env)).catch((err) => console.error("Scheduled job failed:", err))
    );
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "harnold-ingestion-worker" });
    }
    if (url.pathname === "/run-now" && request.method === "POST") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      try {
        const [bills, external] = await Promise.allSettled([
          runIngestion(env),
          runExternalIngestion(env)
        ]);
        return json({
          ok: true,
          bills: bills.status === "fulfilled" ? bills.value : { error: String(bills.reason) },
          external: external.status === "fulfilled" ? external.value : { error: String(external.reason) }
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
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-lkaoIe/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-lkaoIe/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
