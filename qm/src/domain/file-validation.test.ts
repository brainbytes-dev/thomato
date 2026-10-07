import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, sanitizeFileName, validateUpload } from "./file-validation";

const bytes = (...b: number[]) => Uint8Array.from(b);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);

describe("validateUpload", () => {
  it("accepts the allowed types when the content matches the extension", () => {
    expect(validateUpload({ name: "Hygienekonzept.pdf", bytes: PDF })).toEqual({
      ok: true,
      file: { fileName: "Hygienekonzept.pdf", mimeType: "application/pdf", size: PDF.length },
    });
    expect(validateUpload({ name: "scan.PNG", bytes: PNG })).toMatchObject({ ok: true, file: { mimeType: "image/png" } });
    expect(validateUpload({ name: "foto.jpeg", bytes: JPG })).toMatchObject({ ok: true, file: { mimeType: "image/jpeg" } });
    expect(validateUpload({ name: "foto.jpg", bytes: JPG })).toMatchObject({ ok: true });
    expect(validateUpload({ name: "liste.xlsx", bytes: ZIP })).toMatchObject({
      ok: true,
      file: { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
    expect(validateUpload({ name: "konzept.docx", bytes: ZIP })).toMatchObject({
      ok: true,
      file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
  });

  it("rejects a mismatch between extension and content", () => {
    expect(validateUpload({ name: "x.pdf", bytes: PNG })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.png", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.docx", bytes: PDF })).toMatchObject({ ok: false });
  });

  it("rejects unknown extensions, missing extension, empty and oversized files", () => {
    expect(validateUpload({ name: "x.exe", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.svg", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "ohne-endung", bytes: PDF })).toMatchObject({ ok: false });
    expect(validateUpload({ name: "x.pdf", bytes: new Uint8Array(0) })).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(PDF);
    expect(validateUpload({ name: "x.pdf", bytes: big })).toMatchObject({ ok: false });
    const exact = new Uint8Array(MAX_FILE_BYTES);
    exact.set(PDF);
    expect(validateUpload({ name: "x.pdf", bytes: exact })).toMatchObject({ ok: true });
  });

  it("stores a sanitized file name", () => {
    expect(validateUpload({ name: "../../etc/passwd.pdf", bytes: PDF })).toMatchObject({
      ok: true,
      file: { fileName: "passwd.pdf" },
    });
  });
});

describe("sanitizeFileName", () => {
  it("drops paths, control characters and quotes, limits the length and keeps umlauts", () => {
    expect(sanitizeFileName("C:\\Users\\x\\Hygiene.pdf")).toBe("Hygiene.pdf");
    expect(sanitizeFileName("a/b/Notfallkonzept Süd.pdf")).toBe("Notfallkonzept Süd.pdf");
    expect(sanitizeFileName('bad"name\r\n.pdf')).toBe("badname.pdf");
    expect(sanitizeFileName("   .pdf")).toBe("dokument.pdf");
    const long = `${"a".repeat(300)}.pdf`;
    const out = sanitizeFileName(long);
    expect(out.length).toBeLessThanOrEqual(120);
    expect(out.endsWith(".pdf")).toBe(true);
  });
});
