CREATE TABLE "online_eliminations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"killer_id" uuid NOT NULL,
	"victim_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_distinct_players" CHECK ("online_eliminations"."killer_id" <> "online_eliminations"."victim_id")
);
--> statement-breakpoint
CREATE TABLE "online_guests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"display_name" varchar(24) NOT NULL,
	"kills" integer DEFAULT 0 NOT NULL,
	"deaths" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "online_guests_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "online_nonnegative_stats" CHECK ("online_guests"."kills" >= 0 and "online_guests"."deaths" >= 0)
);
--> statement-breakpoint
ALTER TABLE "online_eliminations" ADD CONSTRAINT "online_eliminations_killer_id_online_guests_id_fk" FOREIGN KEY ("killer_id") REFERENCES "public"."online_guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "online_eliminations" ADD CONSTRAINT "online_eliminations_victim_id_online_guests_id_fk" FOREIGN KEY ("victim_id") REFERENCES "public"."online_guests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "online_kills_idx" ON "online_guests" USING btree ("kills");--> statement-breakpoint
CREATE INDEX "online_deaths_idx" ON "online_guests" USING btree ("deaths");