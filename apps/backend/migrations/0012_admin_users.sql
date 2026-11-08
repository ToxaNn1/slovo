CREATE TABLE "action_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"who" jsonb NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"what" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"edition_id" text,
	"batch_id" text
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"totp_secret" text,
	"state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agent_tokens" (
	"name" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "agent_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "recovery_codes" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_codes" ADD CONSTRAINT "recovery_codes_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_log_edition_id_idx" ON "action_log" USING btree ("edition_id");--> statement-breakpoint
CREATE FUNCTION "action_log_is_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'the action log is append-only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER "action_log_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "action_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "action_log_is_append_only"();
