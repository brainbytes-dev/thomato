import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4 sm:right-8 sm:top-6">
        <ThemeToggle />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <header className="flex flex-col gap-2">
          <BrandMark />
          <h1 className="type-headline-section mt-4">Anmelden</h1>
          <p className="type-meta text-text-muted">{BRAND.tagline}</p>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
