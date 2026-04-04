const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";

const OLLAMA_EMBED_MODEL =
  process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text-v2-moe";

const OLLAMA_EMBED_DIMENSIONS = Number(
  process.env.OLLAMA_EMBED_DIMENSIONS || "768"
);

export function audienceTextForEmbedding(input: {
  label: string;
  rationale?: string | null;
  normalizedKey?: string | null;
}) {
  return [input.label, input.rationale ?? "", input.normalizedKey ?? ""]
    .filter(Boolean)
    .join("\n");
}

export async function embedText(text: string): Promise<number[]> {
  const input = text.trim();

  if (!input) {
    throw new Error("Cannot embed empty text");
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OLLAMA_EMBED_MODEL,
      input,
      dimensions: OLLAMA_EMBED_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(`Ollama embed failed: ${response.status} ${raw}`);
  }

  const data = await response.json();

  if (
    !data ||
    !Array.isArray(data.embeddings) ||
    !Array.isArray(data.embeddings[0])
  ) {
    throw new Error("Ollama returned invalid embedding payload");
  }

  return data.embeddings[0] as number[];
}