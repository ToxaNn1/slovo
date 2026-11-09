CREATE TABLE "owner_checks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"text" text NOT NULL,
	"added_by" jsonb NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	"ticked_at" timestamp with time zone,
	"ticked_by" jsonb,
	CONSTRAINT "owner_checks_tick" CHECK (("owner_checks"."ticked_at" is null) = ("owner_checks"."ticked_by" is null))
);
--> statement-breakpoint
CREATE INDEX "owner_checks_version_idx" ON "owner_checks" USING btree ("version");