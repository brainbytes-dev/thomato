import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  foreignKey,
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
    notApplicableReason: text("not_applicable_reason"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("assessment_org_criterion").on(t.organizationId, t.criterionId),
    index("assessment_org_idx").on(t.organizationId),
    check(
      "assessment_na_reason_check",
      sql`(${t.status} = 'not_applicable' AND ${t.notApplicableReason} IS NOT NULL AND char_length(btrim(${t.notApplicableReason})) BETWEEN 10 AND 500) OR (${t.status} <> 'not_applicable' AND ${t.notApplicableReason} IS NULL)`,
    ),
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

export const DEADLINE_KINDS = ["application", "dossier", "expiry", "custom"] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];

export const deadline = pgTable(
  "deadline",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    kind: text("kind", { enum: DEADLINE_KINDS }).notNull(),
    label: text("label").notNull(),
    dueDate: date("due_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("deadline_org_due_idx").on(t.organizationId, t.dueDate)],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const document = pgTable(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    title: text("title").notNull(),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_id_org").on(t.id, t.organizationId),
    index("document_org_idx").on(t.organizationId),
  ],
);

export const documentVersion = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    content: bytea("content").notNull(),
    validUntil: date("valid_until"),
    uploadedBy: text("uploaded_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("document_version_number").on(t.documentId, t.versionNumber),
    foreignKey({
      name: "document_version_document_fk",
      columns: [t.documentId, t.organizationId],
      foreignColumns: [document.id, document.organizationId],
    }),
    index("document_version_org_idx").on(t.organizationId),
  ],
);

export const evidenceLink = pgTable(
  "evidence_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    documentId: uuid("document_id").notNull(),
    standardVersionId: text("standard_version_id").notNull(),
    criterionNumber: text("criterion_number").notNull(),
    linkedBy: text("linked_by").references(() => user.id),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("evidence_link_unique").on(t.organizationId, t.documentId, t.standardVersionId, t.criterionNumber),
    foreignKey({
      name: "evidence_link_document_fk",
      columns: [t.documentId, t.organizationId],
      foreignColumns: [document.id, document.organizationId],
    }),
    foreignKey({
      name: "evidence_link_criterion_fk",
      columns: [t.standardVersionId, t.criterionNumber],
      foreignColumns: [criterion.standardVersionId, criterion.number],
    }),
    index("evidence_link_org_criterion_idx").on(t.organizationId, t.criterionNumber),
  ],
);
