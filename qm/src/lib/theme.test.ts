import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { applyTheme, parseTheme, readTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY, writeTheme } from "./theme";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

const brokenStorage = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("parseTheme", () => {
  it("accepts the three valid choices and falls back to system otherwise", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
    for (const bad of [null, undefined, "", "Dark", "blue", 3, {}]) expect(parseTheme(bad)).toBe("system");
  });
});

describe("readTheme / writeTheme", () => {
  it("round-trips light and dark", () => {
    const s = memoryStorage();
    expect(readTheme(s)).toBe("system");
    expect(writeTheme(s, "dark")).toBe(true);
    expect(readTheme(s)).toBe("dark");
    writeTheme(s, "light");
    expect(readTheme(s)).toBe("light");
  });

  it("removes the stored value for system", () => {
    const s = memoryStorage({ [THEME_STORAGE_KEY]: "dark" });
    writeTheme(s, "system");
    expect(s.data.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it("treats an invalid stored value as system", () => {
    expect(readTheme(memoryStorage({ [THEME_STORAGE_KEY]: "purple" }))).toBe("system");
  });

  it("survives unavailable storage", () => {
    expect(readTheme(brokenStorage)).toBe("system");
    expect(readTheme(null)).toBe("system");
    expect(writeTheme(brokenStorage, "dark")).toBe(false);
    expect(writeTheme(null, "dark")).toBe(false);
  });
});

describe("applyTheme", () => {
  it("sets data-theme for light and dark and removes it for system", () => {
    const attrs = new Map<string, string>();
    const root = {
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
      removeAttribute: (k: string) => void attrs.delete(k),
    };
    applyTheme(root, "dark");
    expect(attrs.get("data-theme")).toBe("dark");
    applyTheme(root, "system");
    expect(attrs.has("data-theme")).toBe(false);
    applyTheme(root, "light");
    expect(attrs.get("data-theme")).toBe("light");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  function run(localStorage: unknown): string | undefined {
    let theme: string | undefined;
    const document = { documentElement: { setAttribute: (_k: string, v: string) => (theme = v) } };
    vm.runInNewContext(THEME_INIT_SCRIPT, { document, localStorage });
    return theme;
  }

  it("applies a stored light or dark choice before paint", () => {
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: "dark" }))).toBe("dark");
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: "light" }))).toBe("light");
  });

  it("sets nothing for system, invalid values or blocked storage", () => {
    expect(run(memoryStorage())).toBeUndefined();
    expect(run(memoryStorage({ [THEME_STORAGE_KEY]: "neon" }))).toBeUndefined();
    expect(run(brokenStorage)).toBeUndefined();
  });
});

describe("globals.css token parity", () => {
  const css = readFileSync(path.join(import.meta.dirname, "../app/globals.css"), "utf8");

  function block(open: RegExp): Map<string, string> {
    const start = css.search(open);
    expect(start, `block ${open}`).toBeGreaterThanOrEqual(0);
    const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
    return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  }

  const light = block(/^:root \{/m);
  const systemDark = block(/:root:not\(\[data-theme="light"\]\) \{/);
  const explicitDark = block(/:root\[data-theme="dark"\] \{/);

  it("defines every colour token in the light palette and in both dark blocks", () => {
    const colourKeys = [...light.keys()].filter((k) => k !== "--radius");
    expect(colourKeys.length).toBeGreaterThan(15);
    for (const k of colourKeys) {
      expect(systemDark.has(k), `${k} missing in system dark`).toBe(true);
      expect(explicitDark.has(k), `${k} missing in explicit dark`).toBe(true);
    }
    expect(light.has("--critical-tint") && light.has("--warning-tint") && light.has("--success-tint")).toBe(true);
  });

  it("keeps both dark blocks identical", () => {
    const strip = (m: Map<string, string>) => [...m].filter(([k]) => k !== "color-scheme").sort();
    expect(strip(systemDark)).toEqual(strip(explicitDark));
  });

  it("declares color-scheme for light and both dark blocks", () => {
    expect(css).toMatch(/:root \{\s*color-scheme: light;/);
    expect(css).toMatch(/:root:not\(\[data-theme="light"\]\) \{\s*color-scheme: dark;/);
    expect(css).toMatch(/:root\[data-theme="dark"\] \{\s*color-scheme: dark;/);
  });
});
