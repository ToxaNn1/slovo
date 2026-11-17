ALTER TABLE "mistake_reports" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "mistake_reports" ADD CONSTRAINT "mistake_reports_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mistake_reports_account_id_index" ON "mistake_reports" USING btree ("account_id");