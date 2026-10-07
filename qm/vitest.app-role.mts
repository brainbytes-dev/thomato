/** Wegwerf-Passwort der Rolle qm_app, ausschliesslich für die lokale Test-DB (qm_test). */
export const TEST_APP_PASSWORD = "test-app-password";

/** Leitet die Verbindung der Rolle qm_app aus der Besitzer-URL der Test-DB ab (gleicher Host und gleiche DB). */
export function appUrlFrom(ownerUrl: string): string {
  const u = new URL(ownerUrl);
  u.username = "qm_app";
  u.password = TEST_APP_PASSWORD;
  return u.toString();
}
