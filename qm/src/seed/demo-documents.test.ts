import { describe, expect, it } from "vitest";
import { buildDemoPdf } from "./demo-documents";

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");

describe("buildDemoPdf", () => {
  const bytes = buildDemoPdf("Hygienekonzept (Demo)", ["Version 1", "Demo-Inhalt"]);
  const text = latin1(bytes);

  it("has header, EOF marker and visible Demo text", () => {
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).toContain("(Hygienekonzept \\(Demo\\)) Tj");
    expect(bytes.length).toBeLessThan(4096);
  });

  it("points every xref entry at its object and startxref at the table", () => {
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries).toHaveLength(5);
    entries.forEach((off, i) => {
      expect(text.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    expect(text).toContain("/Size 6");
  });

  it("is byte-identical for identical input and differs for different input", () => {
    expect(Buffer.from(buildDemoPdf("A (Demo)", ["x"])).equals(Buffer.from(buildDemoPdf("A (Demo)", ["x"])))).toBe(true);
    expect(Buffer.from(buildDemoPdf("A (Demo)", ["x"])).equals(Buffer.from(buildDemoPdf("B (Demo)", ["x"])))).toBe(false);
  });

  it("escapes parentheses and backslashes in text", () => {
    expect(latin1(buildDemoPdf("a\\b (c)", []))).toContain("(a\\\\b \\(c\\)) Tj");
  });
});
