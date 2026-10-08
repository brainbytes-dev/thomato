import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
// next/font läuft nur im Next-Compiler; die Fehlerseiten-Tests prüfen Inhalt, nicht Schriftladen.
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font-var", className: "font-class" });
  return { Inter: font, JetBrains_Mono: font };
});

import { ErrorBoundaryView } from "@/components/error-boundary-view";
import ErrorPage from "./error";
import AppErrorPage from "./(app)/error";
import GlobalError from "./global-error";
import NotFound from "./not-found";
import AppNotFound from "./(app)/not-found";

const SECRET = "Error: connect ECONNREFUSED 10.0.0.5:5432 at Object.query (/srv/app/db.ts:12:3) password=hunter2";
const error = Object.assign(new Error(SECRET), { digest: "abc123" });
const noop = () => undefined;

const pages: Array<[string, () => ReactElement]> = [
  ["error.tsx", () => createElement(ErrorPage, { error, retry: noop })],
  ["(app)/error.tsx", () => createElement(AppErrorPage, { error, retry: noop })],
  ["global-error.tsx", () => createElement(GlobalError, { error, retry: noop })],
  ["not-found.tsx", () => createElement(NotFound)],
  ["(app)/not-found.tsx", () => createElement(AppNotFound)],
];

describe.each(pages)("%s", (_name, render) => {
  const html = renderToStaticMarkup(render());
  const text = html.replace(/<[^>]+>/g, " ");

  it("is German, calm and links back to the overview", () => {
    expect(html).toContain("Zur Übersicht");
    expect(html).toMatch(/href="\/"/);
    expect(html).toContain("<h1");
  });

  it("shows no error text, stack, digest or technical detail", () => {
    for (const bad of ["Error:", "ECONNREFUSED", "hunter2", "abc123", "/srv/app", " at ", "stack", "undefined", "null", "500", "Exception"]) {
      expect(text).not.toContain(bad);
    }
  });

  it("uses no hex colours, no em dashes and no emoji", () => {
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(text).not.toMatch(/[—–]|--/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

describe("retry", () => {
  it("error pages offer a retry button that calls retry()", () => {
    for (const page of [pages[0], pages[1], pages[2]]) {
      expect(renderToStaticMarkup(page[1]())).toContain("Erneut versuchen");
    }
    for (const page of [pages[3], pages[4]]) {
      expect(renderToStaticMarkup(page[1]())).not.toContain("Erneut versuchen");
    }
  });

  it("wires the button to retry", () => {
    let calls = 0;
    const retry = () => { calls += 1; };
    const view = ErrorBoundaryView({ retry });
    const state = view.type as (p: { title: string; body: string; children: ReactElement[] }) => ReactElement;
    const children = (view.props as { children: ReactElement<{ onClick?: () => void }>[] }).children;
    const button = children.find((c) => c.type === "button");
    button?.props.onClick?.();
    expect(typeof state).toBe("function");
    expect(calls).toBe(1);
  });

  it("global-error renders its own html and body", () => {
    const html = renderToStaticMarkup(createElement(GlobalError, { error, retry: noop }));
    expect(html.startsWith("<html")).toBe(true);
    expect(html).toContain("<body");
    expect(html).toContain('lang="de"');
  });
});
