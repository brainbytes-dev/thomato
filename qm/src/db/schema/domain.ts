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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`clock_timestamp()`),
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

export const MEASURE_STATUSES = ["open", "in_progress", "done"] as const;
export type MeasureStatus = (typeof MEASURE_STATUSES)[number];

export const MEASURE_PHASES = ["plan", "do", "check", "act"] as const;
export type MeasurePhase = (typeof MEASURE_PHASES)[number];

export const REVIEW_RESULTS = ["effective", "partly", "not_effective"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

export const measure = pgTable(
  "measure",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    standardVersionId: text("standard_version_id").notNull(),
    criterionNumber: text("criterion_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id),
    dueDate: date("due_date").notNull(),
    status: text("status", { enum: MEASURE_STATUSES }).notNull().default("open"),
    phase: text("phase", { enum: MEASURE_PHASES }).notNull().default("plan"),
    cycle: integer("cycle").notNull().default(1),
    effectivenessCriterion: text("effectiveness_criterion"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("measure_id_org").on(t.id, t.organizationId),
    foreignKey({
      name: "measure_criterion_fk",
      columns: [t.standardVersionId, t.criterionNumber],
      foreignColumns: [criterion.standardVersionId, criterion.number],
    }),
    check("measure_status_check", sql`${t.status} in ('open', 'in_progress', 'done')`),
    check(
      "measure_status_completed_check",
      sql`(${t.status} = 'done' AND ${t.completedAt} IS NOT NULL) OR (${t.status} <> 'done' AND ${t.completedAt} IS NULL)`,
    ),
    check("measure_phase_check", sql`${t.phase} in ('plan', 'do', 'check', 'act')`),
    check("measure_done_phase_check", sql`${t.status} <> 'done' OR ${t.phase} = 'act'`),
    check("measure_cycle_check", sql`${t.cycle} >= 1`),
    check(
      "measure_effectiveness_criterion_check",
      sql`${t.effectivenessCriterion} IS NULL OR char_length(btrim(${t.effectivenessCriterion})) BETWEEN 3 AND 500`,
    ),
    index("measure_org_criterion_idx").on(t.organizationId, t.criterionNumber),
    index("measure_org_due_idx").on(t.organizationId, t.dueDate),
  ],
);

// Checkliste einer Massnahme. Die Organisation steckt im zusammengesetzten Fremdschlüssel: ein Schritt kann
// nie an einer Massnahme einer anderen Organisation hängen.
export const measureStep = pgTable(
  "measure_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    measureId: uuid("measure_id").notNull(),
    phase: text("phase", { enum: MEASURE_PHASES }).notNull().default("do"),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: text("done_by").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "measure_step_measure_fk",
      columns: [t.measureId, t.organizationId],
      foreignColumns: [measure.id, measure.organizationId],
    }),
    check("measure_step_phase_check", sql`${t.phase} in ('plan', 'do', 'check', 'act')`),
    check("measure_step_title_check", sql`char_length(btrim(${t.title})) BETWEEN 3 AND 200`),
    check("measure_step_done_check", sql`(${t.doneAt} IS NULL) = (${t.doneBy} IS NULL)`),
    check("measure_step_position_check", sql`${t.position} >= 1`),
    index("measure_step_measure_idx").on(t.organizationId, t.measureId, t.position),
  ],
);

// Wirksamkeitsbewertungen: append-only (Trigger und Rollenrechte), damit kein Zyklus die Historie überschreibt.
export const measureReview = pgTable(
  "measure_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull(),
    measureId: uuid("measure_id").notNull(),
    cycle: integer("cycle").notNull(),
    result: text("result", { enum: REVIEW_RESULTS }).notNull(),
    note: text("note").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    checkedBy: text("checked_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    foreignKey({
      name: "measure_review_measure_fk",
      columns: [t.measureId, t.organizationId],
      foreignColumns: [measure.id, measure.organizationId],
    }),
    check("measure_review_result_check", sql`${t.result} in ('effective', 'partly', 'not_effective')`),
    check("measure_review_note_check", sql`char_length(btrim(${t.note})) BETWEEN 3 AND 1000`),
    check("measure_review_cycle_check", sql`${t.cycle} >= 1`),
    index("measure_review_measure_idx").on(t.organizationId, t.measureId, t.checkedAt),
  ],
);

export type MeasureRow = typeof measure.$inferSelect;
export type MeasureStepRow = typeof measureStep.$inferSelect;
export type MeasureReviewRow = typeof measureReview.$inferSelect;
