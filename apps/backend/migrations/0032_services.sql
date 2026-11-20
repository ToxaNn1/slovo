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
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"plan" text,
	"monthly_price_usd_cents" integer,
	"billing_day" integer,
	"limits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "services_name_unique" UNIQUE("name"),
	CONSTRAINT "services_kind" CHECK ("services"."kind" in ('railway', 'cron', 'metered')),
	CONSTRAINT "services_price" CHECK ("services"."monthly_price_usd_cents" >= 0),
	CONSTRAINT "services_billing_day" CHECK ("services"."billing_day" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "service_entries" ADD CONSTRAINT "service_entries_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_entries_service_id_idx" ON "service_entries" USING btree ("service_id");--> statement-breakpoint
-- The eleven known Services and their fixed places on the canvas.
INSERT INTO "services" ("name", "kind", "x", "y", "links") VALUES
	('GitHub', 'metered', 40, 40, '[{"to":"Railway","kind":"constant"},{"to":"Cloudflare","kind":"constant"}]'),
	('Cloudflare', 'metered', 40, 260, '[{"to":"Railway","kind":"constant"}]'),
	('Expo/EAS', 'metered', 40, 480, '[{"to":"Apple Developer / App Store Connect","kind":"constant"},{"to":"Google Play","kind":"constant"}]'),
	('Apple Developer / App Store Connect', 'metered', 340, 400, '[{"to":"Railway","kind":"constant"}]'),
	('Google Play', 'metered', 340, 560, '[{"to":"Railway","kind":"constant"}]'),
	('Railway', 'railway', 640, 260, '[{"to":"Neon","kind":"constant"},{"to":"Sentry","kind":"constant"},{"to":"PostHog","kind":"constant"},{"to":"Zoho Mail","kind":"constant"},{"to":"Telegram bot","kind":"scheduled"}]'),
	('Neon', 'metered', 940, 40, '[]'),
	('Sentry', 'metered', 940, 180, '[]'),
	('PostHog', 'metered', 940, 320, '[]'),
	('Zoho Mail', 'metered', 940, 460, '[]'),
	('Telegram bot', 'metered', 940, 600, '[]');
