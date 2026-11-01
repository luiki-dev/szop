CREATE TABLE "categories" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"parent_id" uuid,
	"position" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_pkey" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "categories_name_check" CHECK (char_length("categories"."name") BETWEEN 1 AND 100),
	CONSTRAINT "categories_position_check" CHECK ("categories"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid,
	"unit_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_pkey" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "products_name_check" CHECK (char_length("products"."name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "units" (
	"workspace_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "units_pkey" PRIMARY KEY("workspace_id","id"),
	CONSTRAINT "units_name_check" CHECK (char_length("units"."name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspace_id_parent_id_fkey" FOREIGN KEY ("workspace_id","parent_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_category_id_fkey" FOREIGN KEY ("workspace_id","category_id") REFERENCES "public"."categories"("workspace_id","id") ON DELETE set null ("category_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_unit_id_fkey" FOREIGN KEY ("workspace_id","unit_id") REFERENCES "public"."units"("workspace_id","id") ON DELETE set null ("unit_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;