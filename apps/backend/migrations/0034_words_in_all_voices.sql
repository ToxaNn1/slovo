CREATE TABLE "words_in_all_voices" (
	"edition_id" text NOT NULL,
	"word_id" text NOT NULL,
	"added_at" timestamp with time zone NOT NULL,
	CONSTRAINT "words_in_all_voices_edition_id_word_id_pk" PRIMARY KEY("edition_id","word_id")
);--> statement-breakpoint
-- ADR 0195: every Word with a live Recording in a voice other than its Edition's
-- default goes on the list, so no Recording is retired. The UA Edition's default
-- is oksana; an Edition whose default this migration doesn't know keeps every
-- recorded Word in all voices.
INSERT INTO "words_in_all_voices" ("edition_id", "word_id", "added_at")
SELECT DISTINCT "edition_id", "word_id", now() FROM "media_recordings"
WHERE "retired_at" IS NULL AND NOT ("edition_id" = 'uk' AND "narrator_voice" = 'oksana')
ON CONFLICT DO NOTHING;
