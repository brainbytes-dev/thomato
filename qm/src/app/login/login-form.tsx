"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/auth/client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const failure = "Die Anmeldung hat nicht geklappt. Bitte prüfen Sie E-Mail und Passwort.";
    let succeeded = false;
    try {
      const { error: signInError } = await authClient.signIn.email({
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      if (signInError) {
        setError(failure);
      } else {
        succeeded = true;
        router.push("/");
      }
    } catch {
      setError(failure);
    } finally {
      // Bei Erfolg bleibt der Button pending, bis die Navigation die Seite ersetzt.
      if (!succeeded) setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="type-label">E-Mail</span>
        <input name="email" type="email" required autoComplete="username"
          className="h-10 rounded border border-field-border bg-surface px-3 text-text" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="type-label">Passwort</span>
        <input name="password" type="password" required autoComplete="current-password"
          className="h-10 rounded border border-field-border bg-surface px-3 text-text" />
      </label>
      {error && <p role="alert" className="text-critical">{error}</p>}
      <button type="submit" disabled={pending}
        className="type-label h-10 rounded bg-primary px-4 text-on-primary disabled:opacity-60">
        {pending ? "Anmelden..." : "Anmelden"}
      </button>
    </form>
  );
}
