import { describe, expect, it } from "vitest";
import { checkClientFile, formatBytes } from "./file-check";

const MAX = 4 * 1024 * 1024;

describe("checkClientFile", () => {
  it("rejects an empty file", () => {
    expect(checkClientFile(0, MAX)).toBe("Die Datei ist leer.");
  });
  it("accepts exactly the limit", () => {
    expect(checkClientFile(MAX, MAX)).toBeNull();
  });
  it("rejects one byte above the limit", () => {
    expect(checkClientFile(MAX + 1, MAX)).toBe("Die Datei ist grösser als 4 MB.");
  });
  it("accepts a small file", () => {
    expect(checkClientFile(1200, MAX)).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats bytes, KB and MB with a decimal comma", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3,0 MB");
  });
});
