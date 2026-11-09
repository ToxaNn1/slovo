CREATE TABLE "alert_digests" (
	"day" date PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_thresholds" (
	"key" text PRIMARY KEY NOT NULL,
	"value" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"key" text,
	"alert" jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "alerts_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE INDEX "alerts_at_idx" ON "alerts" USING btree ("at");