ALTER TABLE "content_curated_collections" ADD COLUMN "appeared_at" timestamp with time zone;--> statement-breakpoint
UPDATE "content_curated_collections" SET "appeared_at" = (("fields"->>'publishedOn')::date::timestamp AT TIME ZONE 'Europe/Kyiv');--> statement-breakpoint
ALTER TABLE "content_curated_collections" ALTER COLUMN "appeared_at" SET NOT NULL;
