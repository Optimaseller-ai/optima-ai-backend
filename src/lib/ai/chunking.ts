export function chunkText(input: string, opts?: { chunkSize?: number; overlap?: number }) {
  const chunkSize = Math.max(200, opts?.chunkSize ?? 1200);
  const overlap = Math.max(0, Math.min(chunkSize - 50, opts?.overlap ?? 150));

  const text = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!text) return [] as string[];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const slice = text.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

