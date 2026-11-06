CREATE TABLE "list_items" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer,
	"unit_id" uuid,
	"price" integer,
	"category_id" uuid,
	"note" text,
	"checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_pkey" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "list_items_name_check" CHECK (char_length("list_items"."name") BETWEEN 1 AND 100),
	CONSTRAINT "list_items_note_check" CHECK (char_length("list_items"."note") <= 500),
	CONSTRAINT "list_items_quantity_check" CHECK ("list_items"."quantity" BETWEEN 1 AND 9999000),
	CONSTRAINT "list_items_price_check" CHECK ("list_items"."price" BETWEEN 0 AND 9999999)
);
--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "sort_by_category" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_workspace_id_list_id_fkey" FOREIGN KEY ("workspace_id","list_id") REFERENCES "public"."lists"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_workspace_id_unit_id_fkey" FOREIGN KEY ("workspace_id","unit_id") REFERENCES "public"."units"("workspace_id","id") ON DELETE set null ("unit_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_workspace_id_category_id_fkey" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE set null ("category_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "list_items_workspace_id_list_id_idx" ON "list_items" USING btree ("workspace_id","list_id");