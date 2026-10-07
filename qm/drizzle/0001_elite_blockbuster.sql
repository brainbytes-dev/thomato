CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"actor_user_id" text,
	"event_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "criterion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standard_version_id" text NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"chapter" text NOT NULL,
	"mandatory_accreditation" boolean DEFAULT false NOT NULL,
	"should_accreditation" boolean DEFAULT false NOT NULL,
	"mandatory_renewal" boolean DEFAULT false NOT NULL,
	"should_renewal" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"rule_validation_status" text DEFAULT 'draft_extracted' NOT NULL,
	CONSTRAINT "criterion_version_number" UNIQUE("standard_version_id","number")
);
--> statement-breakpoint
CREATE TABLE "criterion_assessment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"criterion_id" uuid NOT NULL,
	"status" text DEFAULT 'not_assessed' NOT NULL,
	"owner_user_id" text,
	"due_date" date,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_org_criterion" UNIQUE("organization_id","criterion_id")
);
--> statement-breakpoint
CREATE TABLE "standard_version" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"validation_status" text DEFAULT 'draft_extracted' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion" ADD CONSTRAINT "criterion_standard_version_id_standard_version_id_fk" FOREIGN KEY ("standard_version_id") REFERENCES "public"."standard_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_assessment" ADD CONSTRAINT "criterion_assessment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_assessment" ADD CONSTRAINT "criterion_assessment_criterion_id_criterion_id_fk" FOREIGN KEY ("criterion_id") REFERENCES "public"."criterion"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "criterion_assessment" ADD CONSTRAINT "criterion_assessment_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_org_created_idx" ON "audit_event" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "assessment_org_idx" ON "criterion_assessment" USING btree ("organization_id");