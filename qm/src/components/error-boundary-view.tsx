"use client";

import { ERROR_COPY, ErrorState, HomeLink, PRIMARY_ACTION } from "@/components/error-state";

/** Gemeinsame Ansicht der error.tsx-Dateien. `retry` lädt die Daten des Segments neu. Der Fehler selbst wird bewusst weder angezeigt noch protokolliert. */
export function ErrorBoundaryView({ retry }: { retry: () => void }) {
  return (
    <ErrorState title={ERROR_COPY.title} body={ERROR_COPY.body}>
      <button type="button" onClick={() => retry()} className={PRIMARY_ACTION}>
        {ERROR_COPY.retry}
      </button>
      <HomeLink primary={false} />
    </ErrorState>
  );
}
