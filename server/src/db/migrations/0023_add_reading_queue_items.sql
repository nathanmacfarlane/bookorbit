CREATE TABLE "reading_queue_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"book_id" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reading_queue_items" ADD CONSTRAINT "reading_queue_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_queue_items" ADD CONSTRAINT "reading_queue_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reading_queue_items_user_book_uidx" ON "reading_queue_items" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "reading_queue_items_user_position_idx" ON "reading_queue_items" USING btree ("user_id","position");
