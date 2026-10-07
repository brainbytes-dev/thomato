import { BRAND } from "@/brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <header>
        <h1 className="text-xl font-semibold">{BRAND.name}</h1>
        <p className="text-text-muted">{BRAND.tagline}</p>
      </header>
      <LoginForm />
    </main>
  );
}
