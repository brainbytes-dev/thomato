export type FormResult = { ok: boolean; message: string } | null;

/** Next wirft Weiterleitungen und 404 als Fehler mit digest "NEXT_...". Die müssen durchgereicht werden. */
function isNextControlFlow(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/**
 * Fängt Fehler ab, die eine Server Action nicht selbst melden kann (z. B. 413 bei zu grossem Body,
 * Verbindungsabbruch). Statt der Fehlerseite bleibt das Formular samt Eingaben stehen und zeigt `message`.
 */
export function guardAction<S extends FormResult>(
  action: (prev: S, formData: FormData) => Promise<S>,
  message: string,
): (prev: S, formData: FormData) => Promise<S> {
  return async (prev, formData) => {
    try {
      return await action(prev, formData);
    } catch (e) {
      if (isNextControlFlow(e)) throw e;
      return { ok: false, message } as S;
    }
  };
}
