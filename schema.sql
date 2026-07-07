


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."get_public_stats"() RETURNS TABLE("machines_count" bigint, "services_count" bigint, "mechanics_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    (select count(*) from assets) as machines_count,
    (select count(*) from service_records) as services_count,
    (select count(*) from mechanics where is_mechanic = true) as mechanics_count;
$$;


ALTER FUNCTION "public"."get_public_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_mechanic"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.mechanics (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_mechanic"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "asset_type" "text" NOT NULL,
    "brand" "text",
    "model" "text",
    "nickname" "text",
    "vin_serial" "text",
    "year" integer,
    "plate" "text",
    "fuel_type" "text",
    "location" "text",
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_id" "uuid"
);


ALTER TABLE "public"."assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "title" "text" NOT NULL,
    "notes" "text",
    "task_date" "date" NOT NULL,
    "done" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_id" "uuid"
);


ALTER TABLE "public"."calendar_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "asset_id" "uuid",
    "service_record_id" "uuid",
    "customer_id" "uuid",
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "file_size" bigint,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mechanic_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "qr_code" "text",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mechanic_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mechanics" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "workshop_name" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_mechanic" boolean DEFAULT false NOT NULL,
    "is_verified_mechanic" boolean DEFAULT false NOT NULL,
    "suspended" boolean DEFAULT false NOT NULL,
    "photo_url" "text",
    "profession" "text",
    "certificate_path" "text",
    "verification_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "verification_requested_at" timestamp with time zone,
    "verification_reviewed_at" timestamp with time zone,
    "verification_note" "text",
    CONSTRAINT "mechanics_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."mechanics" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."mechanic_public_profile" AS
 SELECT "id",
    "name",
    "verified",
    "profession"
   FROM "public"."mechanics";


ALTER VIEW "public"."mechanic_public_profile" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid",
    "mechanic_id" "uuid" NOT NULL,
    "sender_name" "text" NOT NULL,
    "sender_contact" "text" NOT NULL,
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "from_admin" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "asset_id" "uuid",
    "created_by" "uuid",
    "first_scan_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qr_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."qr_scans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "asset_id" "uuid",
    "scanned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."qr_scans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "mechanic_id" "uuid",
    "service_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "service_type" "text" NOT NULL,
    "km_hours" numeric,
    "notes" "text",
    "tags" "text"[],
    "photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_due_date" "date",
    "next_due_km_hours" numeric,
    "customer_id" "uuid"
);


ALTER TABLE "public"."service_records" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_records"."next_due_date" IS 'Optional: date the mechanic expects the next service to be due, set manually per service record.';



COMMENT ON COLUMN "public"."service_records"."next_due_km_hours" IS 'Optional: km/hours reading the mechanic expects the next service to be due, set manually per service record.';



CREATE TABLE IF NOT EXISTS "public"."support_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mechanic_id" "uuid" NOT NULL,
    "body" "text" NOT NULL,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "from_admin" boolean DEFAULT false NOT NULL,
    "hidden_for_admin" boolean DEFAULT false NOT NULL,
    "hidden_for_mechanic" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."support_messages" OWNER TO "postgres";


ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_tasks"
    ADD CONSTRAINT "calendar_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mechanic_assets"
    ADD CONSTRAINT "mechanic_assets_mechanic_id_asset_id_key" UNIQUE ("mechanic_id", "asset_id");



ALTER TABLE ONLY "public"."mechanic_assets"
    ADD CONSTRAINT "mechanic_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mechanics"
    ADD CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_codes"
    ADD CONSTRAINT "qr_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."qr_codes"
    ADD CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."qr_scans"
    ADD CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id");



CREATE INDEX "assets_customer_idx" ON "public"."assets" USING "btree" ("customer_id");



CREATE INDEX "calendar_tasks_mechanic_date_idx" ON "public"."calendar_tasks" USING "btree" ("mechanic_id", "task_date");



CREATE INDEX "customers_mechanic_idx" ON "public"."customers" USING "btree" ("mechanic_id");



CREATE INDEX "documents_asset_idx" ON "public"."documents" USING "btree" ("asset_id");



CREATE INDEX "documents_customer_idx" ON "public"."documents" USING "btree" ("customer_id");



CREATE INDEX "documents_mechanic_idx" ON "public"."documents" USING "btree" ("mechanic_id");



CREATE INDEX "messages_mechanic_idx" ON "public"."messages" USING "btree" ("mechanic_id", "created_at" DESC);



CREATE INDEX "qr_scans_code_idx" ON "public"."qr_scans" USING "btree" ("code");



CREATE INDEX "qr_scans_scanned_at_idx" ON "public"."qr_scans" USING "btree" ("scanned_at");



CREATE INDEX "service_records_customer_idx" ON "public"."service_records" USING "btree" ("customer_id");



CREATE INDEX "support_messages_created_idx" ON "public"."support_messages" USING "btree" ("created_at" DESC);



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."mechanics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."assets"
    ADD CONSTRAINT "assets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_tasks"
    ADD CONSTRAINT "calendar_tasks_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_tasks"
    ADD CONSTRAINT "calendar_tasks_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_tasks"
    ADD CONSTRAINT "calendar_tasks_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_service_record_id_fkey" FOREIGN KEY ("service_record_id") REFERENCES "public"."service_records"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mechanic_assets"
    ADD CONSTRAINT "mechanic_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mechanic_assets"
    ADD CONSTRAINT "mechanic_assets_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mechanics"
    ADD CONSTRAINT "mechanics_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."qr_codes"
    ADD CONSTRAINT "qr_codes_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."qr_codes"
    ADD CONSTRAINT "qr_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."mechanics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."qr_scans"
    ADD CONSTRAINT "qr_scans_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_records"
    ADD CONSTRAINT "service_records_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_messages"
    ADD CONSTRAINT "support_messages_mechanic_id_fkey" FOREIGN KEY ("mechanic_id") REFERENCES "public"."mechanics"("id") ON DELETE CASCADE;



CREATE POLICY "anyone can log a scan" ON "public"."qr_scans" FOR INSERT WITH CHECK (true);



CREATE POLICY "anyone can read scan counts" ON "public"."qr_scans" FOR SELECT USING (true);



ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "assets: lectura pública" ON "public"."assets" FOR SELECT USING (true);



CREATE POLICY "assets: solo el dueño crea" ON "public"."assets" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "assets: solo logueados actualizan" ON "public"."assets" FOR UPDATE USING (("auth"."uid"() IS NOT NULL));



ALTER TABLE "public"."calendar_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_tasks: mecanico dueño administra sus tareas" ON "public"."calendar_tasks" USING (("auth"."uid"() = "mechanic_id")) WITH CHECK (("auth"."uid"() = "mechanic_id"));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers: el mecanico administra los suyos" ON "public"."customers" USING (("auth"."uid"() = "mechanic_id")) WITH CHECK (("auth"."uid"() = "mechanic_id"));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents: el mecanico administra los suyos" ON "public"."documents" USING (("auth"."uid"() = "mechanic_id")) WITH CHECK (("auth"."uid"() = "mechanic_id"));



ALTER TABLE "public"."mechanic_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mechanic_assets: solo el dueño elimina" ON "public"."mechanic_assets" FOR DELETE USING (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "mechanic_assets: solo el dueño ve sus activos" ON "public"."mechanic_assets" FOR SELECT USING (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "mechanic_assets: solo logueados insertan" ON "public"."mechanic_assets" FOR INSERT WITH CHECK (("auth"."uid"() = "mechanic_id"));



ALTER TABLE "public"."mechanics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mechanics: solo el dueño actualiza su perfil" ON "public"."mechanics" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "mechanics: solo el dueño lee su perfil" ON "public"."mechanics" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages: cualquiera puede enviar" ON "public"."messages" FOR INSERT WITH CHECK (("from_admin" = false));



CREATE POLICY "messages: el mecanico dueño actualiza" ON "public"."messages" FOR UPDATE USING (("auth"."uid"() = "mechanic_id")) WITH CHECK (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "messages: el mecanico dueño borra" ON "public"."messages" FOR DELETE USING (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "messages: el mecanico dueño lee" ON "public"."messages" FOR SELECT USING (("auth"."uid"() = "mechanic_id"));



ALTER TABLE "public"."qr_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qr_codes: lectura pública" ON "public"."qr_codes" FOR SELECT USING (true);



CREATE POLICY "qr_codes: solo el dueño actualiza" ON "public"."qr_codes" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by")) WITH CHECK (("auth"."uid"() = "created_by"));



CREATE POLICY "qr_codes: solo el dueño crea" ON "public"."qr_codes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "created_by"));



ALTER TABLE "public"."qr_scans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_records: lectura pública" ON "public"."service_records" FOR SELECT USING (true);



CREATE POLICY "service_records: solo el dueño actualiza" ON "public"."service_records" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "mechanic_id")) WITH CHECK (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "service_records: solo el dueño crea" ON "public"."service_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "mechanic_id"));



ALTER TABLE "public"."support_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_messages: el mecanico actualiza" ON "public"."support_messages" FOR UPDATE USING (("auth"."uid"() = "mechanic_id")) WITH CHECK (("auth"."uid"() = "mechanic_id"));



CREATE POLICY "support_messages: el mecanico envia" ON "public"."support_messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "mechanic_id") AND ("from_admin" = false)));



CREATE POLICY "support_messages: el mecanico ve las suyas" ON "public"."support_messages" FOR SELECT USING (("auth"."uid"() = "mechanic_id"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_public_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_public_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_mechanic"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_mechanic"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_mechanic"() TO "service_role";



GRANT ALL ON TABLE "public"."assets" TO "anon";
GRANT ALL ON TABLE "public"."assets" TO "authenticated";
GRANT ALL ON TABLE "public"."assets" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_tasks" TO "anon";
GRANT ALL ON TABLE "public"."calendar_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."mechanic_assets" TO "anon";
GRANT ALL ON TABLE "public"."mechanic_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."mechanic_assets" TO "service_role";



GRANT ALL ON TABLE "public"."mechanics" TO "anon";
GRANT ALL ON TABLE "public"."mechanics" TO "authenticated";
GRANT ALL ON TABLE "public"."mechanics" TO "service_role";



GRANT ALL ON TABLE "public"."mechanic_public_profile" TO "anon";
GRANT ALL ON TABLE "public"."mechanic_public_profile" TO "authenticated";
GRANT ALL ON TABLE "public"."mechanic_public_profile" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."qr_codes" TO "anon";
GRANT ALL ON TABLE "public"."qr_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_codes" TO "service_role";



GRANT ALL ON TABLE "public"."qr_scans" TO "anon";
GRANT ALL ON TABLE "public"."qr_scans" TO "authenticated";
GRANT ALL ON TABLE "public"."qr_scans" TO "service_role";



GRANT ALL ON TABLE "public"."service_records" TO "anon";
GRANT ALL ON TABLE "public"."service_records" TO "authenticated";
GRANT ALL ON TABLE "public"."service_records" TO "service_role";



GRANT ALL ON TABLE "public"."support_messages" TO "anon";
GRANT ALL ON TABLE "public"."support_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."support_messages" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







