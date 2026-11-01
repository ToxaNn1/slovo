CREATE TABLE "questionnaire_counters" (
	"edition_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "questionnaire_counters_edition_id_question_answer_pk" PRIMARY KEY("edition_id","question","answer")
);
