CREATE TABLE "measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"standard_version_id" text NOT NULL,
	"criterion_number" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_user_id" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measure_status_check" CHECK ("measure"."status" in ('open', 'in_progress', 'done')),
	CONSTRAINT "measure_status_completed_check" CHECK (("measure"."status" = 'done' AND "measure"."completed_at" IS NOT NULL) OR ("measure"."status" <> 'done' AND "measure"."completed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure" ADD CONSTRAINT "measure_criterion_fk" FOREIGN KEY ("standard_version_id","criterion_number") REFERENCES "public"."criterion"("standard_version_id","number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "measure_org_criterion_idx" ON "measure" USING btree ("organization_id","criterion_number");--> statement-breakpoint
CREATE INDEX "measure_org_due_idx" ON "measure" USING btree ("organization_id","due_date");