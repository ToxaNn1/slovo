-- The five social accounts, in a column of their own right of the eleven, with their open entries.
-- Metered with no usage port: no usage, no alert, no Cron. Their passwords the Власник adds himself, sealed, in the admin.
INSERT INTO "services" ("name", "kind", "x", "y") VALUES
	('Instagram', 'metered', 1240, 40),
	('Threads', 'metered', 1240, 180),
	('TikTok', 'metered', 1240, 320),
	('YouTube', 'metered', 1240, 460),
	('Telegram channel', 'metered', 1240, 600);--> statement-breakpoint
INSERT INTO "service_entries" ("service_id", "type", "label", "note", "open_value")
SELECT "services"."id", "entry"."type", "entry"."label", "entry"."note", "entry"."open_value"
FROM "services"
JOIN (VALUES
	('Instagram', 'login', 'Нік', NULL, '@slovoapp_official'),
	('Instagram', 'login', 'Пошта для входу', NULL, 'accounts@slovoapp.org'),
	('Instagram', 'link', 'Профіль', NULL, 'https://instagram.com/slovoapp_official'),
	('Threads', 'login', 'Нік', NULL, '@slovoapp_official'),
	('Threads', 'login', 'Пошта для входу', NULL, 'accounts@slovoapp.org'),
	('Threads', 'link', 'Профіль', NULL, 'https://threads.com/@slovoapp_official'),
	('TikTok', 'login', 'Нік', NULL, '@slovoapp_official'),
	('TikTok', 'login', 'Пошта для входу', NULL, 'accounts@slovoapp.org'),
	('TikTok', 'link', 'Профіль', NULL, 'https://tiktok.com/@slovoapp_official'),
	('YouTube', 'login', 'Нік', NULL, '@slovoapp_official'),
	('YouTube', 'login', 'Пошта для входу', 'вхід через Google', 'accounts@slovoapp.org'),
	('YouTube', 'link', 'Профіль', NULL, 'https://youtube.com/@slovoapp_official'),
	('Telegram channel', 'login', 'Нік', NULL, '@slovoapp_official'),
	('Telegram channel', 'login', 'Пошта для входу', NULL, 'accounts@slovoapp.org'),
	('Telegram channel', 'link', 'Профіль', NULL, 'https://t.me/slovoapp_official')
) AS "entry" ("service", "type", "label", "note", "open_value") ON "entry"."service" = "services"."name";
