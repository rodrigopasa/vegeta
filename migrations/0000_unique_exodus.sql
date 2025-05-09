CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone_number" text NOT NULL,
	"is_group" boolean DEFAULT false,
	"member_count" integer,
	"instance_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"recipient" text NOT NULL,
	"recipient_name" text,
	"is_group" boolean DEFAULT false,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"has_media" boolean DEFAULT false,
	"media_type" text,
	"media_path" text,
	"media_name" text,
	"media_caption" text,
	"instance_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone_number" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_connected_at" timestamp,
	CONSTRAINT "whatsapp_instances_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contact_instance_idx" ON "contacts" USING btree ("phone_number","instance_id");