import { describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES } from "@/domain/file-validation";
import { linkInput, readFile, unlinkInput, uploadInput, versionInput } from "./evidence-input";

const UUID = "3f2b8c1e-5a4d-4e6f-8a7b-9c0d1e2f3a4b";

function fileLike(size: number, name = "konzept.pdf", bytes = new Uint8Array([1, 2, 3])) {
  const arrayBuffer = vi.fn(async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { name, size, arrayBuffer };
}

describe("uploadInput", () => {
  const base = { number: "7.3.10", title: "Hygiene" };
  it("accepts a 3 character title and rejects 2", () => {
    expect(uploadInput.safeParse({ ...base, title: "abc" }).success).toBe(true);
    expect(uploadInput.safeParse({ ...base, title: "ab" }).success).toBe(false);
  });
  it("limits the title to 120 characters like the service and the label", () => {
    expect(uploadInput.safeParse({ ...base, title: "a".repeat(120) }).success).toBe(true);
    expect(uploadInput.safeParse({ ...base, title: "a".repeat(121) }).success).toBe(false);
  });
  it("accepts an empty validUntil and rejects an impossible one", () => {
    expect(uploadInput.safeParse({ ...base, validUntil: "" }).success).toBe(true);
    expect(uploadInput.safeParse({ ...base, validUntil: "2026-12-31" }).success).toBe(true);
    expect(uploadInput.safeParse({ ...base, validUntil: "2026-02-30" }).success).toBe(false);
  });
  it("strips unknown fields", () => {
    const r = uploadInput.safeParse({ ...base, evil: "x" });
    expect(r.success && "evil" in r.data).toBe(false);
  });
});

describe("versionInput, linkInput, unlinkInput", () => {
  it("validates uuids", () => {
    expect(versionInput.safeParse({ number: "7.3.10", documentId: UUID }).success).toBe(true);
    expect(versionInput.safeParse({ number: "7.3.10", documentId: "nope" }).success).toBe(false);
    expect(linkInput.safeParse({ number: "7.3.10", documentId: UUID }).success).toBe(true);
    expect(linkInput.safeParse({ number: "7.3.10", documentId: "" }).success).toBe(false);
    expect(unlinkInput.safeParse({ number: "7.3.10", linkId: UUID }).success).toBe(true);
    expect(unlinkInput.safeParse({ number: "7.3.10", linkId: "1234" }).success).toBe(false);
  });
  it("rejects a bad validUntil on versions", () => {
    expect(versionInput.safeParse({ number: "7.3.10", documentId: UUID, validUntil: "x" }).success).toBe(false);
  });
});

describe("readFile", () => {
  it("rejects an oversized object without reading it", async () => {
    const f = fileLike(MAX_FILE_BYTES + 1);
    expect(await readFile(f)).toBeNull();
    expect(f.arrayBuffer).not.toHaveBeenCalled();
  });
  it("returns null for a string entry, null and an empty file", async () => {
    expect(await readFile("hello")).toBeNull();
    expect(await readFile(null)).toBeNull();
    const empty = fileLike(0, "a.pdf", new Uint8Array());
    expect(await readFile(empty)).toBeNull();
  });
  it("returns name and bytes for a valid file-like object", async () => {
    const f = fileLike(3);
    const r = await readFile(f);
    expect(r?.name).toBe("konzept.pdf");
    expect(Array.from(r?.bytes ?? [])).toEqual([1, 2, 3]);
  });
  it("rejects when the read size exceeds the limit despite a small declared size", async () => {
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    expect(await readFile(fileLike(3, "a.pdf", big))).toBeNull();
  });
});
