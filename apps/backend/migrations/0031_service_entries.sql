CREATE TABLE "service_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"note" text,
	"open_value" text,
	"sealed_value" text,
	CONSTRAINT "service_entries_type" CHECK ("service_entries"."type" in ('login', 'link', 'password', 'token', 'recovery-codes')),
	CONSTRAINT "service_entries_value" CHECK (("service_entries"."type" in ('login', 'link')) = ("service_entries"."open_value" is not null and "service_entries"."sealed_value" is null) and ("service_entries"."open_value" is null) <> ("service_entries"."sealed_value" is null))
);
--> statement-breakpoint
ALTER TABLE "service_entries" ADD CONSTRAINT "service_entries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_entries_service_id_idx" ON "service_entries" USING btree ("service_id");