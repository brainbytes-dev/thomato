"use client";

import Link from "next/link";
import "./globals.css";
import { ERROR_COPY } from "@/components/error-state";

// Ersetzt das Root-Layout, daher eigenes html/body.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full">
        <title>Fehler</title>
        <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-4 py-12">
          <div className="flex flex-col gap-2" role="alert">
            <h1 className="text-xl font-semibold">{ERROR_COPY.title}</h1>
            <p className="text-text-muted">{ERROR_COPY.body}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] bg-primary px-4 font-medium text-on-primary"
            >
              {ERROR_COPY.retry}
            </button>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius)] border border-border bg-surface px-4 font-medium"
            >
              {ERROR_COPY.home}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
