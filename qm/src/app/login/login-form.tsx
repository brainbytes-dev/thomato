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
    const failure = "Anmeldung fehlgeschlagen. E-Mail oder Passwort stimmt nicht.";
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
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">E-Mail</span>
        <input name="email" type="email" required autoComplete="username"
          className="h-10 rounded-[var(--radius)] border border-field-border bg-surface px-3" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-text-muted">Passwort</span>
        <input name="password" type="password" required autoComplete="current-password"
          className="h-10 rounded-[var(--radius)] border border-field-border bg-surface px-3" />
      </label>
      {error && <p role="alert" className="text-critical">{error}</p>}
      <button type="submit" disabled={pending}
        className="h-10 rounded-[var(--radius)] bg-primary px-4 font-medium text-on-primary disabled:opacity-60">
        {pending ? "Anmelden..." : "Anmelden"}
      </button>
    </form>
  );
}
