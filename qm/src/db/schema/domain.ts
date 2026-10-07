import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export const VALIDATION_STATUSES = ["draft_extracted", "validated"] as const;
export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const ASSESSMENT_STATUSES = [
  "not_assessed",
  "met",
  "open",
  "critical",
  "not_applicable",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const ACTIVE_STANDARD_VERSION = "ivr-rd-draft";

export const standardVersion = pgTable("standard_version", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  validationStatus: text("validation_status", { enum: VALIDATION_STATUSES })
    .notNull()
    .default("draft_extracted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Globaler Katalog: gehört dem Regelwerk, nicht einer Organisation.
export const criterion = pgTable(
  "criterion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    standardVersionId: text("standard_version_id")
      .notNull()
      .references(() => standardVersion.id),
    number: text("number").notNull(),
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    mandatoryAccreditation: boolean("mandatory_accreditation").notNull().default(false),
    shouldAccreditation: boolean("should_accreditation").notNull().default(false),
    mandatoryRenewal: boolean("mandatory_renewal").notNull().default(false),
    shouldRenewal: boolean("should_renewal").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ruleValidationStatus: text("rule_validation_status", { enum: VALIDATION_STATUSES })
      .notNull()
      .default("draft_extracted"),
  },
  (t) => [unique("criterion_version_number").on(t.standardVersionId, t.number)],
);

export const criterionAssessment = pgTable(
  "criterion_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    criterionId: uuid("criterion_id")
      .notNull()
      .references(() => criterion.id),
    status: text("status", { enum: ASSESSMENT_STATUSES }).notNull().default("not_assessed"),
    ownerUserId: text("owner_user_id").references(() => user.id),
    dueDate: date("due_date"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assessment_org_criterion").on(t.organizationId, t.criterionId),
    index("assessment_org_idx").on(t.organizationId),
  ],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    actorUserId: text("actor_user_id").references(() => user.id),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    requestId: text("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_org_created_idx").on(t.organizationId, t.createdAt)],
);

export type AuditEventRow = typeof auditEvent.$inferSelect;
