-- Two racing first sign-ins could have written two rows for one provider identity: keep the oldest. Nothing references a sign-in method's id.
DELETE FROM "sign_in_methods" AS "later" USING "sign_in_methods" AS "kept" WHERE "later"."provider_id" = "kept"."provider_id" AND "later"."provider_account_id" = "kept"."provider_account_id" AND ("kept"."created_at", "kept"."id") < ("later"."created_at", "later"."id");--> statement-breakpoint
CREATE UNIQUE INDEX "sign_in_methods_provider_identity" ON "sign_in_methods" USING btree ("provider_id","provider_account_id");
