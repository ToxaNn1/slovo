CREATE TABLE "collection_links" (
	"id" text PRIMARY KEY NOT NULL,
	"edition_id" text NOT NULL,
	"name" text NOT NULL,
	"entry_ids" text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
