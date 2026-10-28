CREATE TABLE "favorites_adds" (
	"edition_id" text NOT NULL,
	"week" date NOT NULL,
	"entry_id" text NOT NULL,
	"adds" integer NOT NULL,
	CONSTRAINT "favorites_adds_edition_id_week_entry_id_pk" PRIMARY KEY("edition_id","week","entry_id")
);
