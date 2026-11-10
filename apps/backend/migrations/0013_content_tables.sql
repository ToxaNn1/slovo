CREATE TABLE "content_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_id" text NOT NULL,
	"changed_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_corrections" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "content_corrections_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_crossword_days" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "content_crossword_days_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_curated_collections" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "content_curated_collections_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_idioms" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "content_idioms_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_ids" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "content_ids_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_synonym_rows" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "content_synonym_rows_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_tips" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "content_tips_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"edition_id" text PRIMARY KEY NOT NULL,
	"content_version" integer NOT NULL,
	"imported_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_words" (
	"edition_id" text NOT NULL,
	"id" text NOT NULL,
	"fields" jsonb NOT NULL,
	"record_version" integer NOT NULL,
	"content_version" integer NOT NULL,
	"retired" boolean NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone NOT NULL,
	"batch_id" uuid NOT NULL,
	"needs_new_recording" boolean NOT NULL,
	CONSTRAINT "content_words_edition_id_id_pk" PRIMARY KEY("edition_id","id")
);
--> statement-breakpoint
ALTER TABLE "content_corrections" ADD CONSTRAINT "content_corrections_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_crossword_days" ADD CONSTRAINT "content_crossword_days_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_curated_collections" ADD CONSTRAINT "content_curated_collections_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_idioms" ADD CONSTRAINT "content_idioms_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_synonym_rows" ADD CONSTRAINT "content_synonym_rows_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_tips" ADD CONSTRAINT "content_tips_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_words" ADD CONSTRAINT "content_words_batch_id_content_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."content_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_corrections_edition_id_content_version_index" ON "content_corrections" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE INDEX "content_crossword_days_edition_id_content_version_index" ON "content_crossword_days" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE INDEX "content_curated_collections_edition_id_content_version_index" ON "content_curated_collections" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE INDEX "content_idioms_edition_id_content_version_index" ON "content_idioms" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE INDEX "content_synonym_rows_edition_id_content_version_index" ON "content_synonym_rows" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE INDEX "content_tips_edition_id_content_version_index" ON "content_tips" USING btree ("edition_id","content_version");--> statement-breakpoint
CREATE INDEX "content_words_edition_id_content_version_index" ON "content_words" USING btree ("edition_id","content_version");