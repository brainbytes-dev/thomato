const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Zwei Hürden vor dem TRUNCATE: explizites Flag und lokale Datenbank (oder explizite Remote-Freigabe).
export function assertResetAllowed(env: Readonly<Record<string, string | undefined>>): void {
  if (env.ALLOW_DEMO_RESET !== "1") {
    throw new Error("seedDemo setzt die Datenbank zurück: nur mit ALLOW_DEMO_RESET=1");
  }
  let host: string;
  try {
    host = new URL(env.DATABASE_URL ?? "").hostname;
  } catch {
    throw new Error("seedDemo verweigert den Reset: DATABASE_URL fehlt oder ist ungültig");
  }
  if (!LOCAL_HOSTS.has(host) && env.ALLOW_DEMO_RESET_REMOTE !== "1") {
    throw new Error(
      `seedDemo verweigert den Reset auf ${host}: nur lokale Datenbanken, sonst ALLOW_DEMO_RESET_REMOTE=1`,
    );
  }
}
