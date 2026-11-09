CREATE TABLE "force_update_minimums" (
	"edition_id" text NOT NULL,
	"platform" text NOT NULL,
	"soft" text,
	"hard" text,
	"set_at" timestamp with time zone NOT NULL,
	CONSTRAINT "force_update_minimums_edition_id_platform_pk" PRIMARY KEY("edition_id","platform")
);
--> statement-breakpoint
CREATE TABLE "switch_rules" (
	"edition_id" text NOT NULL,
	"feature" text NOT NULL,
	"order" integer NOT NULL,
	"rule_id" text NOT NULL,
	"verdict" jsonb NOT NULL,
	"targets" jsonb NOT NULL,
	"set_at" timestamp with time zone NOT NULL,
	CONSTRAINT "switch_rules_edition_id_feature_order_pk" PRIMARY KEY("edition_id","feature","order")
);
--> statement-breakpoint
DROP TABLE "remote_switches" CASCADE;