ALTER TABLE "users" ADD COLUMN "registered_by_guest" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "keep_guest_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "converted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_registered_by_guest_fkey" FOREIGN KEY ("registered_by_guest") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;