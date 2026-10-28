CREATE TABLE "mistake_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"type" text NOT NULL,
	"comment" text NOT NULL,
	"app_version" text NOT NULL,
	"content_version" integer NOT NULL,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "mistake_reports_edition_id_received_at_index" ON "mistake_reports" USING btree ("edition_id","received_at");