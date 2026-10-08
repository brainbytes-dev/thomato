"use client";

import Link from "next/link";
import "./globals.css";
import { ERROR_COPY } from "@/components/error-state";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { FONT_CLASSES } from "./fonts";

// Ersetzt das Root-Layout, daher eigenes html/body.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="de" className={`${FONT_CLASSES} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <title>Fehler</title>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
          <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
            <div className="flex flex-col gap-2" role="alert">
              <h1 className="type-headline-section">{ERROR_COPY.title}</h1>
              <p className="text-text-muted">{ERROR_COPY.body}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => retry()}
                className="type-label inline-flex h-10 items-center justify-center rounded bg-primary px-4 text-on-primary"
              >
                {ERROR_COPY.retry}
              </button>
              <Link
                href="/"
                className="type-label inline-flex h-10 items-center justify-center rounded border border-border bg-surface px-4 text-text hover:bg-surface-subtle"
              >
                {ERROR_COPY.home}
              </Link>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
