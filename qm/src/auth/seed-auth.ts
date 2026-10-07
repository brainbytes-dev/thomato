import { makeAuth } from "./auth";

// Nur für Seed-Skripte und Tests. Laufzeitcode (App-Router, Server Actions, Route Handler)
// importiert diese Datei nie; src/auth/registration.test.ts erzwingt das.
export const seedAuth = makeAuth({ disableSignUp: false });
