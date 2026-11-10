CREATE TABLE "recording_leases" (
	"edition_id" text PRIMARY KEY NOT NULL,
	"holder" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
