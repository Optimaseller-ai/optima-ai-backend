/**
 * Railway / Docker often splits multi-line console.log objects into separate log lines.
 * Always log JSON on a single line for traceability.
 */
export function logStructured(tag: string, data: Record<string, unknown> = {}): void {
  try {
    console.log(`${tag} ${JSON.stringify(data)}`);
  } catch {
    console.log(tag, data);
  }
}
