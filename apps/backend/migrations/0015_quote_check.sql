CREATE TABLE "quote_checks" (
	"edition_id" text NOT NULL,
	"kind" text NOT NULL,
	"id" text NOT NULL,
	"record_version" integer NOT NULL,
	"outcome" text NOT NULL,
	"finding" text,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "quote_checks_edition_id_kind_id_pk" PRIMARY KEY("edition_id","kind","id")
);
--> statement-breakpoint
CREATE TABLE "sourcing_cache" (
	"url" text PRIMARY KEY NOT NULL,
	"status" integer NOT NULL,
	"body" text NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
