CREATE TABLE "media_illustrations" (
	"edition_id" text NOT NULL,
	"word_id" text NOT NULL,
	"hash" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"content_version" integer NOT NULL,
	CONSTRAINT "media_illustrations_edition_id_word_id_hash_pk" PRIMARY KEY("edition_id","word_id","hash")
);
--> statement-breakpoint
CREATE TABLE "media_recordings" (
	"edition_id" text NOT NULL,
	"word_id" text NOT NULL,
	"hash" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"retired_at" timestamp with time zone,
	"content_version" integer NOT NULL,
	"narrator_voice" text NOT NULL,
	"recording_kind" text NOT NULL,
	"duration_ms" integer NOT NULL,
	CONSTRAINT "media_recordings_edition_id_word_id_narrator_voice_recording_kind_hash_pk" PRIMARY KEY("edition_id","word_id","narrator_voice","recording_kind","hash")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_illustrations_live" ON "media_illustrations" USING btree ("edition_id","word_id") WHERE "media_illustrations"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "media_illustrations_edition_id_content_version_index" ON "media_illustrations" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE UNIQUE INDEX "media_recordings_live" ON "media_recordings" USING btree ("edition_id","word_id","narrator_voice","recording_kind") WHERE "media_recordings"."retired_at" is null;--> statement-breakpoint
CREATE INDEX "media_recordings_edition_id_content_version_index" ON "media_recordings" USING btree ("edition_id","content_version");