CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_ends" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limits_window_ends_index" ON "rate_limits" USING btree ("window_ends");