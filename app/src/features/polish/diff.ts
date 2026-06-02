export type DiffPart = {
  value: string;
  type: "same" | "added" | "removed";
};

function tokenize(value: string): string[] {
  return Array.from(value.matchAll(/[\p{Script=Han}]|[A-Za-z0-9_+#.-]+|\s+|[^\s\p{Script=Han}A-Za-z0-9_+#.-]/gu)).map((match) => match[0]);
}

export function diffText(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      parts.push({ value: a[i], type: "same" });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      parts.push({ value: a[i], type: "removed" });
      i += 1;
    } else {
      parts.push({ value: b[j], type: "added" });
      j += 1;
    }
  }
  while (i < a.length) {
    parts.push({ value: a[i], type: "removed" });
    i += 1;
  }
  while (j < b.length) {
    parts.push({ value: b[j], type: "added" });
    j += 1;
  }
  return parts;
}
