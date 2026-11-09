CREATE TABLE "ci_runs" (
	"run_id" bigint PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"sha" text NOT NULL,
	"tests" integer NOT NULL,
	"failed_tests" jsonb NOT NULL,
	"coverage" jsonb NOT NULL,
	"jobs" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ci_runs_at_idx" ON "ci_runs" USING btree ("at");