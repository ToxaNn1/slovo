CREATE TABLE "community_counters" (
	"edition_id" text NOT NULL,
	"entry_id" text NOT NULL,
	"known" integer DEFAULT 0 NOT NULL,
	"unknown" integer DEFAULT 0 NOT NULL,
	"saved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "community_counters_edition_id_entry_id_pk" PRIMARY KEY("edition_id","entry_id")
);
