import { describe, expect, it } from "vitest";
import { guardAction, type FormResult } from "./guard-action";

const fd = new FormData();

describe("guardAction", () => {
  it("passes results through", async () => {
    const guarded = guardAction<FormResult>(async () => ({ ok: true, message: "Gespeichert." }), "Fehler");
    expect(await guarded(null, fd)).toEqual({ ok: true, message: "Gespeichert." });
  });

  it("turns a thrown error (for example the 413 of an oversized body) into the form message, hiding its text", async () => {
    const guarded = guardAction<FormResult>(async () => {
      throw new Error("Body exceeded 5mb limit. At /srv/app");
    }, "Die Datei konnte nicht übertragen werden.");
    expect(await guarded(null, fd)).toEqual({ ok: false, message: "Die Datei konnte nicht übertragen werden." });
  });

  it("rethrows redirects and not-found, which Next models as errors with a NEXT_ digest", async () => {
    for (const digest of ["NEXT_REDIRECT;replace;/login;307;", "NEXT_HTTP_ERROR_FALLBACK;404"]) {
      const guarded = guardAction<FormResult>(async () => {
        throw Object.assign(new Error("x"), { digest });
      }, "Fehler");
      await expect(guarded(null, fd)).rejects.toMatchObject({ digest });
    }
  });
});
