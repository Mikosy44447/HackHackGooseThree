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
}

type WorkerExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

type CongressBillListItem = {
  congress: number;
  number: string | number;
  title?: string;
  latestAction?: {
    actionDate?: string;
    text?: string;
  };
  policyArea?: {
    name?: string;
  };
  billType?: string;
  type?: string;
  updateDate?: string;
  url?: string;
  originChamber?: string;
};

type CongressBillsResponse = {
  bills?: CongressBillListItem[];
  pagination?: {
    count?: number;
    next?: string | null;
  };
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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function normalizeBillId(item: CongressBillListItem, fallbackType: string) {
  const type = String(item.type || item.billType || fallbackType).toLowerCase();
  const number = String(item.number).toLowerCase();
  return `${type}${number}`;
}

function normalizeOfficialSourceLabel(
  item: CongressBillListItem,
  fallbackType: string
) {
  const type = String(item.type || item.billType || fallbackType).toUpperCase();
  const number = String(item.number);
  return `Congress.gov: ${type} ${number}`;
}

function normalizeOfficialSourceUrl(
  item: CongressBillListItem,
  fallbackCongress: string,
  fallbackType: string
) {
  if (item.url) return item.url;
  const congress = String(item.congress || fallbackCongress);
  const type = String(item.type || item.billType || fallbackType).toLowerCase();
  const number = String(item.number);

  const pathType = type === "hr" ? "house-bill" : type;
  return `https://www.congress.gov/bill/${congress}th-congress/${pathType}/${number}`;
}

function inferTopics(item: CongressBillListItem): string[] {
  const topics: string[] = [];
  const title = (item.title || "").toLowerCase();
  const policyArea = item.policyArea?.name?.trim();

  if (policyArea) topics.push(policyArea);

  if (
    title.includes("education") ||
    title.includes("student") ||
    title.includes("college")
  ) {
    topics.push("Education", "Higher Education");
  }

  if (
    title.includes("immigration") ||
    title.includes("detention") ||
    title.includes("asylum")
  ) {
    topics.push("Immigration");
  }

  if (title.includes("financial aid") || title.includes("tuition")) {
    topics.push("Financial Aid");
  }

  if (title.includes("privacy") || title.includes("data")) {
    topics.push("Data Privacy");
  }

  if (title.includes("civil rights") || title.includes("rights")) {
    topics.push("Civil Rights");
  }

  return Array.from(new Set(topics.filter(Boolean))).slice(0, 5);
}

function inferAffectedGroups(item: CongressBillListItem): string[] {
  const title = (item.title || "").toLowerCase();
  const groups: string[] = [];

  if (title.includes("student") || title.includes("college")) {
    groups.push("College Students", "First-Generation Students");
  }

  if (title.includes("financial aid")) {
    groups.push("Middle Class Families");
  }

  if (
    title.includes("immigration") ||
    title.includes("detention") ||
    title.includes("asylum")
  ) {
    groups.push("Immigrant Families", "Detained Immigrants", "Asylum Seekers");
  }

  if (title.includes("privacy") || title.includes("data")) {
    groups.push("Consumers", "Students");
  }

  return Array.from(new Set(groups)).slice(0, 4);
}

function inferPattern(item: CongressBillListItem): string {
  const title = (item.title || "").toLowerCase();

  if (title.includes("student") || title.includes("college")) {
    return "Fits a broader legislative pattern focused on college affordability, transparency, and student-facing disclosures.";
  }

  if (
    title.includes("immigration") ||
    title.includes("detention") ||
    title.includes("asylum")
  ) {
    return "Fits a broader legislative pattern focused on immigration process, detention oversight, and due process protections.";
  }

  if (title.includes("privacy") || title.includes("data")) {
    return "Fits a broader legislative pattern toward stronger disclosure, transparency, and data-handling standards.";
  }

  return "Fits a broader legislative pattern around federal oversight, public transparency, and consumer-facing protections.";
}

function mapCongressBillToIngestBill(
  item: CongressBillListItem,
  env: Env
): IngestBillInput {
  const summary =
    item.latestAction?.text?.trim() ||
    "Recent congressional activity recorded in the official Congress.gov feed.";

  const status =
    item.latestAction?.text?.trim() ||
    "Recent action recorded on Congress.gov";

  return {
    id: normalizeBillId(item, env.CONGRESS_SYNC_BILL_TYPE),
    title:
      item.title?.trim() ||
      `Untitled bill ${normalizeBillId(item, env.CONGRESS_SYNC_BILL_TYPE)}`,
    summary,
    status,
    topics: inferTopics(item),
    affectedGroups: inferAffectedGroups(item),
    pattern: inferPattern(item),
    relatedBillIds: [],
    officialSourceLabel: normalizeOfficialSourceLabel(
      item,
      env.CONGRESS_SYNC_BILL_TYPE
    ),
    officialSourceUrl: normalizeOfficialSourceUrl(
      item,
      env.CONGRESS_SYNC_CONGRESS,
      env.CONGRESS_SYNC_BILL_TYPE
    ),
  };
}

async function fetchRecentCongressBills(env: Env): Promise<IngestBillInput[]> {
  const url =
    `${env.CONGRESS_API_BASE_URL}/bill/${encodeURIComponent(
      env.CONGRESS_SYNC_CONGRESS
    )}/${encodeURIComponent(env.CONGRESS_SYNC_BILL_TYPE)}` +
    `?api_key=${encodeURIComponent(env.CONGRESS_API_KEY)}` +
    `&format=json&limit=${encodeURIComponent(env.CONGRESS_SYNC_LIMIT)}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Congress API fetch failed: ${response.status} ${raw}`);
  }

  const data = (await response.json()) as CongressBillsResponse;
  const bills = data.bills ?? [];

  return bills
    .filter((item) => item.title && item.number)
    .map((item) => mapCongressBillToIngestBill(item, env));
}

function supabaseHeaders(env: Env, extra?: HeadersInit): Headers {
  return new Headers({
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  });
}

async function supabaseFetch(
  env: Env,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}${path}`, init);
}

async function getExistingBillIds(
  env: Env,
  ids: string[]
): Promise<Set<string>> {
  if (!ids.length) return new Set();

  const response = await supabaseFetch(
    env,
    `/rest/v1/bills?select=id`,
    {
      method: "GET",
      headers: supabaseHeaders(env),
    }
  );

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(
      `Supabase existing bill lookup failed: ${response.status} ${raw}`
    );
  }

  const rows = (await response.json()) as Array<{ id: string }>;
  const wanted = new Set(ids);
  return new Set(rows.map((row) => row.id).filter((id) => wanted.has(id)));
}

async function upsertBill(env: Env, bill: IngestBillInput) {
  const response = await supabaseFetch(env, `/rest/v1/bills?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders(env, {
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
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
        updated_at: new Date().toISOString(),
      },
    ]),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Supabase bill upsert failed: ${response.status} ${raw}`);
  }
}

async function upsertBillAnalysis(
  env: Env,
  billId: string,
  analysis: BillAnalysis
) {
  const response = await supabaseFetch(
    env,
    `/rest/v1/bill_analysis?on_conflict=bill_id`,
    {
      method: "POST",
      headers: supabaseHeaders(env, {
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
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
    }
  );

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(
      `Supabase bill_analysis upsert failed: ${response.status} ${raw}`
    );
  }
}

async function replaceBillAudiences(
  env: Env,
  billId: string,
  audiences: BillAudience[]
) {
  const deleteResponse = await supabaseFetch(
    env,
    `/rest/v1/bill_audiences?bill_id=eq.${encodeURIComponent(billId)}`,
    {
      method: "DELETE",
      headers: supabaseHeaders(env),
    }
  );

  if (!deleteResponse.ok) {
    const raw = await deleteResponse.text().catch(() => "");
    throw new Error(
      `Supabase bill_audiences delete failed: ${deleteResponse.status} ${raw}`
    );
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
    headers: supabaseHeaders(env, {
      Prefer: "return=representation",
    }),
    body: JSON.stringify(payload),
  });

  if (!insertResponse.ok) {
    const raw = await insertResponse.text().catch(() => "");
    throw new Error(
      `Supabase bill_audiences insert failed: ${insertResponse.status} ${raw}`
    );
  }
}

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
      tools: [
        {
          name: toolName,
          description: toolDescription,
          input_schema: inputSchema,
        },
      ],
      tool_choice: {
        type: "tool",
        name: toolName,
      },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Anthropic call failed: ${response.status} ${raw}`);
  }

  const data = (await response.json()) as {
    content?: Array<{
      type: string;
      name?: string;
      input?: unknown;
    }>;
  };

  const toolBlock = (data.content ?? []).find(
    (block) => block.type === "tool_use" && block.name === toolName
  );

  if (!toolBlock || !toolBlock.input) {
    throw new Error(`Anthropic did not return tool output for ${toolName}`);
  }

  return toolBlock.input as T;
}

async function generateBillAnalysis(
  env: Env,
  bill: IngestBillInput
): Promise<BillAnalysis> {
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

Bill:
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

async function generateBillAudiences(
  env: Env,
  bill: IngestBillInput
): Promise<BillAudience[]> {
  const prompt = `
You are generating reusable audience-specific bill explainers for a civic-tech app called PoliticAlert.

For this bill, identify 3 to 6 audiences who may be meaningfully affected.

Important:
- Use flexible, natural audience descriptions.
- Do NOT force every audience into a rigid taxonomy.
- If a normalized audience key is obvious, include one.
- If not obvious, leave normalizedAudienceKey empty.
- Keep the rationale concise and factual.
- Keep whyItMatters concise, readable, and useful for that audience.
- Do not invent facts beyond the bill data.

Return a tool payload with:
- audiences: an array of audience objects

Each audience object must include:
- audienceLabelRaw
- audienceRationale
- whyItMatters
- confidence
- normalizedAudienceKey

Confidence should be a number from 0.0 to 1.0.

Bill:
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
    "Return free-form affected audiences and cached explainers for a bill.",
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
            required: [
              "audienceLabelRaw",
              "audienceRationale",
              "whyItMatters",
              "confidence",
              "normalizedAudienceKey",
            ],
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
      normalizedAudienceKey:
        String(audience.normalizedAudienceKey ?? "").trim() || null,
    }))
    .filter(
      (audience) =>
        audience.audienceLabelRaw &&
        audience.audienceRationale &&
        audience.whyItMatters
    )
    .slice(0, 6);
}

async function ingestSingleBill(env: Env, bill: IngestBillInput) {
  await upsertBill(env, bill);

  const analysis = await generateBillAnalysis(env, bill);
  await upsertBillAnalysis(env, bill.id, analysis);

  const audiences = await generateBillAudiences(env, bill);
  await replaceBillAudiences(env, bill.id, audiences);

  return {
    billId: bill.id,
    audienceCount: audiences.length,
  };
}

async function runIngestion(env: Env) {
  const incomingBills = await fetchRecentCongressBills(env);
  const existingIds = await getExistingBillIds(
    env,
    incomingBills.map((bill) => bill.id)
  );
  const pendingBills = incomingBills.filter(
    (bill) => !existingIds.has(bill.id)
  );

  const ingestedIds: string[] = [];
  const errors: Array<{ billId: string; error: string }> = [];

  for (const bill of pendingBills) {
    try {
      await ingestSingleBill(env, bill);
      ingestedIds.push(bill.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown ingestion error";
      errors.push({ billId: bill.id, error: message });
    }
  }

  return {
    ok: true,
    fetched: incomingBills.length,
    pending: pendingBills.length,
    ingestedIds,
    errors,
  };
}

function isAuthorized(request: Request, env: Env) {
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${env.RUN_SECRET}`;
}

export default {
  async scheduled(_controller: unknown, env: Env, ctx: WorkerExecutionContext) {
    ctx.waitUntil(runIngestion(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "harnold-ingestion-worker" });
    }

    if (url.pathname === "/run-now" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return json({ error: "Unauthorized" }, 401);
      }

      try {
        const result = await runIngestion(env);
        return json(result);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown worker error";
        return json({ error: message }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};