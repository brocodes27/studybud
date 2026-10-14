/** Groq Orpheus accepts at most 200 characters per speech request. */
export function splitSpeechText(text: string): string[] {
  let remaining = Array.from(text.trim());
  const chunks: string[] = [];
  while (remaining.length > 200) {
    const prefix = remaining.slice(0, 200).join("");
    const breaks = [...prefix.matchAll(/[.!?](?:\s|$)|\s/g)];
    const last = breaks[breaks.length - 1];
    const length =
      last && last.index! > 80
        ? Array.from(prefix.slice(0, last.index! + last[0].length)).length
        : 200;
    chunks.push(remaining.slice(0, length).join("").trim());
    remaining = remaining.slice(length);
  }
  const tail = remaining.join("").trim();
  if (tail) chunks.push(tail);
  return chunks;
}
