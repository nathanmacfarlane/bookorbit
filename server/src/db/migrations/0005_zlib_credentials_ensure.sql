CREATE TABLE IF NOT EXISTS "zlib_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"remix_user_id" varchar(100) NOT NULL,
	"remix_user_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zlib_credentials_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "zlib_credentials" ADD CONSTRAINT "zlib_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zlib_credentials_user_id_uidx" ON "zlib_credentials" USING btree ("user_id");
