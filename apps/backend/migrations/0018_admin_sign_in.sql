CREATE TABLE "admin_sign_in_codes" (
	"email" text PRIMARY KEY NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD COLUMN "last_seen_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "totp_confirmed_at" timestamp with time zone;