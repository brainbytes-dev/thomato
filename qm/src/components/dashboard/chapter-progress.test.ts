import { describe, expect, it } from "vitest";
import { chapterBarTone, chapterNote } from "./chapter-progress";

describe("chapterBarTone", () => {
  it("is success from 90, warning below 70, primary between", () => {
    expect(chapterBarTone(100)).toBe("success");
    expect(chapterBarTone(90)).toBe("success");
    expect(chapterBarTone(89)).toBe("primary");
    expect(chapterBarTone(70)).toBe("primary");
    expect(chapterBarTone(69)).toBe("warning");
    expect(chapterBarTone(0)).toBe("warning");
    expect(chapterBarTone(null)).toBe("primary");
  });
});

describe("chapterNote", () => {
  it("describes the remainder in words", () => {
    expect(chapterNote({ chapter: "x", met: 3, applicable: 3, percent: 100 })).toBe("Alle erfüllt");
    expect(chapterNote({ chapter: "x", met: 2, applicable: 3, percent: 66 })).toBe("1 noch nicht erfüllt");
    expect(chapterNote({ chapter: "x", met: 0, applicable: 4, percent: 0 })).toBe("4 noch nicht erfüllt");
    expect(chapterNote({ chapter: "x", met: 0, applicable: 0, percent: null })).toBe("Keine anwendbaren Kriterien");
  });
});
