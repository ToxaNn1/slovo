CREATE TABLE "remote_switches" (
	"edition_id" text NOT NULL,
	"feature" text NOT NULL,
	"off" boolean NOT NULL,
	"set_at" timestamp with time zone NOT NULL,
	CONSTRAINT "remote_switches_edition_id_feature_pk" PRIMARY KEY("edition_id","feature")
);
