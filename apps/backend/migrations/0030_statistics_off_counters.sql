CREATE TABLE "statistics_off_counters" (
	"edition_id" text NOT NULL,
	"day" date NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "statistics_off_counters_edition_id_day_pk" PRIMARY KEY("edition_id","day")
);
