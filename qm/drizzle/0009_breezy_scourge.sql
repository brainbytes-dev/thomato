CREATE TABLE "measure_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"measure_id" uuid NOT NULL,
	"cycle" integer NOT NULL,
	"result" text NOT NULL,
	"note" text NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_by" text NOT NULL,
	CONSTRAINT "measure_review_result_check" CHECK ("measure_review"."result" in ('effective', 'partly', 'not_effective')),
	CONSTRAINT "measure_review_note_check" CHECK (char_length(btrim("measure_review"."note")) BETWEEN 3 AND 1000),
	CONSTRAINT "measure_review_cycle_check" CHECK ("measure_review"."cycle" >= 1)
);
--> statement-breakpoint
CREATE TABLE "measure_step" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"measure_id" uuid NOT NULL,
	"phase" text DEFAULT 'do' NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measure_step_phase_check" CHECK ("measure_step"."phase" in ('plan', 'do', 'check', 'act')),
	CONSTRAINT "measure_step_title_check" CHECK (char_length(btrim("measure_step"."title")) BETWEEN 3 AND 200),
	CONSTRAINT "measure_step_done_check" CHECK (("measure_step"."done_at" IS NULL) = ("measure_step"."done_by" IS NULL)),
	CONSTRAINT "measure_step_position_check" CHECK ("measure_step"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "measure" ADD COLUMN "phase" text DEFAULT 'plan' NOT NULL;--> statement-breakpoint
ALTER TABLE "measure" ADD COLUMN "cycle" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "measure" ADD COLUMN "effectiveness_criterion" text;--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_id_org" UNIQUE("id","organization_id");--> statement-breakpoint
/* Bestandsdaten mappen, BEVOR die DB-Regel «done nur in Phase act» angelegt wird: open wird plan (Standard), in_progress wird do, done wird act. Erledigte Massnahmen bekommen keine Bewertungszeile (gelten als «nicht geprüft»). */
UPDATE "measure" SET "phase" = CASE "status" WHEN 'in_progress' THEN 'do' WHEN 'done' THEN 'act' ELSE 'plan' END;--> statement-breakpoint
ALTER TABLE "measure_review" ADD CONSTRAINT "measure_review_checked_by_user_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_review" ADD CONSTRAINT "measure_review_measure_fk" FOREIGN KEY ("measure_id","organization_id") REFERENCES "public"."measure"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_step" ADD CONSTRAINT "measure_step_done_by_user_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_step" ADD CONSTRAINT "measure_step_measure_fk" FOREIGN KEY ("measure_id","organization_id") REFERENCES "public"."measure"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "measure_review_measure_idx" ON "measure_review" USING btree ("organization_id","measure_id","checked_at");--> statement-breakpoint
CREATE INDEX "measure_step_measure_idx" ON "measure_step" USING btree ("organization_id","measure_id","position");--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_phase_check" CHECK ("measure"."phase" in ('plan', 'do', 'check', 'act'));--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_done_phase_check" CHECK ("measure"."status" <> 'done' OR "measure"."phase" = 'act');--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_cycle_check" CHECK ("measure"."cycle" >= 1);--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_effectiveness_criterion_check" CHECK ("measure"."effectiveness_criterion" IS NULL OR char_length(btrim("measure"."effectiveness_criterion")) BETWEEN 3 AND 500);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION measure_review_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'measure_review is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER measure_review_no_change
  BEFORE UPDATE OR DELETE ON measure_review
  FOR EACH ROW EXECUTE FUNCTION measure_review_immutable();
