CREATE TABLE "zlib_credentials" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"remix_user_id" varchar(100) NOT NULL,
	"remix_user_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "zlib_credentials" ADD CONSTRAINT "zlib_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "zlib_credentials_user_id_uidx" ON "zlib_credentials" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "zlib_credentials_user_id_idx" ON "zlib_credentials" USING btree ("user_id");
