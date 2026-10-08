"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/auth/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      aria-label="Abmelden"
      title="Abmelden"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded text-text-muted hover:bg-surface-subtle hover:text-text disabled:opacity-60"
    >
      <LogOut aria-hidden="true" className="size-4" />
    </button>
  );
}
