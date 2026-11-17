CREATE TABLE "recording_stalls" (
	"edition_id" text PRIMARY KEY NOT NULL,
	"empty_runs" integer NOT NULL,
	"deployment" text NOT NULL,
	"content_version" integer NOT NULL
);
