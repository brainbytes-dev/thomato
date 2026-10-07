import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { ac, roles } from "./permissions";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // E-Mail-Verifikation und Reset kommen mit Resend nach dem Pitch.
    requireEmailVerification: false,
  },
  plugins: [
    // Organisationen legt nur der Betreiber an (Seed/Admin-Skript), nicht die Endnutzer.
    // Serverseitige Aufrufe mit userId (auth.api.createOrganization) bleiben möglich.
    // Löschen ist gesperrt, weil Audit-Events an der Organisation hängen.
    organization({
      ac,
      roles,
      creatorRole: "owner",
      allowUserToCreateOrganization: false,
      disableOrganizationDeletion: true,
    }),
    nextCookies(),
  ],
  databaseHooks: {
    session: {
      create: {
        // Ein Rettungsdienst pro User: die älteste Mitgliedschaft wird aktiv (deterministisch).
        before: async (session) => {
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt), asc(schema.member.id))
            .limit(1);
          return {
            data: { ...session, activeOrganizationId: first?.organizationId ?? null },
          };
        },
      },
    },
  },
});
