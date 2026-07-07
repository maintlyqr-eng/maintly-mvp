// One-off script: creates the public "Demo Generator" asset used by the
// homepage's live example / demo QR sticker on fondo.png.
//
// Run ONCE from the project root, with your real .env.local already in place
// (it must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY):
//
//   node --env-file=.env.local scripts/seed-demo-asset.mjs
//
// If your Node version is older than 20.6 and doesn't support --env-file,
// install dotenv (`npm i -D dotenv`) and add `import "dotenv/config";` as
// the first line of this file instead.
//
// Safe to re-run: it checks for the fixed demo code first and exits without
// changing anything if it already exists.

import { createClient } from "@supabase/supabase-js";

const DEMO_CODE = "demogen001";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Run with: node --env-file=.env.local scripts/seed-demo-asset.mjs"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Already seeded? Don't duplicate.
  const { data: existing } = await admin
    .from("qr_codes")
    .select("code, asset_id")
    .eq("code", DEMO_CODE)
    .maybeSingle();

  if (existing) {
    console.log(`Demo asset already exists. URL: https://www.maintlyqr.com/asset/${DEMO_CODE}`);
    return;
  }

  const { data: asset, error: assetError } = await admin
    .from("assets")
    .insert({
      created_by: null,
      asset_type: "generator",
      brand: "Cummins",
      model: "C150 D5",
      nickname: "Demo Generator",
      vin_serial: "DEMO-GEN-001",
      year: 2023,
      plate: null,
      fuel_type: "Diesel",
      location: "Sample Facility – Demo",
      customer_id: null,
    })
    .select()
    .single();

  if (assetError || !asset) {
    console.error("Could not create demo asset:", assetError?.message);
    process.exit(1);
  }

  const services = [
    { service_date: "2024-11-02", service_type: "Inspection", km_hours: 0,
      notes: "Initial installation and commissioning inspection. All systems nominal." },
    { service_date: "2025-02-15", service_type: "Service", km_hours: 250,
      notes: "250-hour scheduled service: oil sample analysis, belt inspection, coolant check." },
    { service_date: "2025-06-20", service_type: "Oil Change", km_hours: 500,
      notes: "Full oil and filter change per manufacturer schedule. No abnormal wear detected." },
    { service_date: "2025-11-05", service_type: "Inspection", km_hours: 750,
      notes: "Load bank test performed at 100% capacity for 2 hours. Passed all performance checks." },
    { service_date: "2026-03-10", service_type: "Repair", km_hours: 900,
      notes: "Replaced fuel filter and cleaned injectors after a minor performance dip. Resolved." },
  ].map((s) => ({ ...s, asset_id: asset.id, mechanic_id: null }));

  const { error: svcError } = await admin.from("service_records").insert(services);
  if (svcError) {
    console.error("Asset created, but could not insert service records:", svcError.message);
    process.exit(1);
  }

  const { error: qrError } = await admin
    .from("qr_codes")
    .insert({ code: DEMO_CODE, asset_id: asset.id });

  if (qrError) {
    console.error("Asset and services created, but could not create the QR code row:", qrError.message);
    process.exit(1);
  }

  console.log("Demo asset created successfully!");
  console.log(`URL: https://www.maintlyqr.com/asset/${DEMO_CODE}`);
}

main();
