CREATE TABLE "user_records" (
	"account_id" uuid NOT NULL,
	"edition_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb,
	"changed_at" timestamp with time zone NOT NULL,
	"sequence" bigserial NOT NULL,
	CONSTRAINT "user_records_account_id_edition_id_key_pk" PRIMARY KEY("account_id","edition_id","key")
);
--> statement-breakpoint
ALTER TABLE "user_records" ADD CONSTRAINT "user_records_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_records_account_id_edition_id_sequence_index" ON "user_records" USING btree ("account_id","edition_id","sequence");