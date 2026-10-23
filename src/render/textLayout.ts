export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
}
export function richRuns(text: string): TextRun[] {
  const result: TextRun[] = [];
  const pattern = /\*([^*\s](?:[^*\n]*[^*\s])?)\*|(?<![\w])_([^_\s](?:[^_\n]*[^_\s])?)_(?![\w])/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index! > start) result.push({ text: text.slice(start, match.index) });
    result.push({ text: match[1] ?? match[2], bold: !!match[1], italic: !!match[2] });
    start = match.index! + match[0].length;
  }
  if (start < text.length) result.push({ text: text.slice(start) });
  return result;
}
export function estimatedWidth(text: string, size: number): number {
  return Array.from(text).reduce(
    (sum, c) =>
      sum +
      (/\s/.test(c)
        ? 0.278
        : /[ilI.,:;'!|]/.test(c)
          ? 0.24
          : /[mwMW@%]/.test(c)
            ? 0.84
            : /[A-Z]/.test(c)
              ? 0.65
              : 0.51) *
        size,
    0,
  );
}
export function layoutText(text: string, width: number, size: number, wrap = true): TextRun[][] {
  return text.split(/\r?\n/).flatMap((paragraph) => {
    const runs = richRuns(paragraph);
    if (!wrap) return [runs];
    const lines: TextRun[][] = [[]];
    let used = 0;
    for (const run of runs) {
      for (const word of run.text.split(/(\s+)/).filter(Boolean)) {
        const advance = estimatedWidth(word, size) * (run.bold ? 1.06 : 1);
        if (used > 0 && used + advance > width && word.trim()) {
          lines.push([]);
          used = 0;
        }
        if (used === 0 && !word.trim()) continue;
        lines.at(-1)!.push({ ...run, text: word });
        used += advance;
      }
    }
    return lines;
  });
}
