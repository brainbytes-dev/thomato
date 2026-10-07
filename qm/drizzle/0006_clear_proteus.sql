CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"title" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_id_org" UNIQUE("id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "document_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"content" "bytea" NOT NULL,
	"valid_until" date,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_version_number" UNIQUE("document_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "evidence_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"document_id" uuid NOT NULL,
	"standard_version_id" text NOT NULL,
	"criterion_number" text NOT NULL,
	"linked_by" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_link_unique" UNIQUE("organization_id","document_id","standard_version_id","criterion_number")
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_fk" FOREIGN KEY ("document_id","organization_id") REFERENCES "public"."document"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_linked_by_user_id_fk" FOREIGN KEY ("linked_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_document_fk" FOREIGN KEY ("document_id","organization_id") REFERENCES "public"."document"("id","organization_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_link" ADD CONSTRAINT "evidence_link_criterion_fk" FOREIGN KEY ("standard_version_id","criterion_number") REFERENCES "public"."criterion"("standard_version_id","number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_org_idx" ON "document" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "document_version_org_idx" ON "document_version" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "evidence_link_org_criterion_idx" ON "evidence_link" USING btree ("organization_id","criterion_number");--> statement-breakpoint
CREATE OR REPLACE FUNCTION document_version_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'document_version is immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER document_version_no_change
  BEFORE UPDATE OR DELETE ON document_version
  FOR EACH ROW EXECUTE FUNCTION document_version_immutable();
