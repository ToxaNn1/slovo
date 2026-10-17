CREATE TABLE "content_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" text NOT NULL,
	"content_version" integer NOT NULL,
	"pack_format" integer NOT NULL,
	"content_checksum" text NOT NULL,
	"file_sha256" text NOT NULL,
	"size" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "content_packs_edition_id_content_version_unique" UNIQUE("edition_id","content_version")
);
