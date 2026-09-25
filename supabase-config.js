// Vexa Supabase configuration.
// The publishable/anon key is designed for frontend use.
// NEVER put a service_role/secret key here.

const SUPABASE_URL = "https://rcdmmszknzqwzvovubkp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZG1tc3prbnpxd3p2b3Z1YmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNDg3MjQsImV4cCI6MjEwNTkyNDcyNH0.EZy6XLdue0E14XNnjR0EWyICYf4ZBMVnDf0l7WFWPkk";

window.vexaSupabase = {
  url: SUPABASE_URL,
  key: SUPABASE_PUBLISHABLE_KEY
};

window.supabaseClient = null;

if (
  window.supabase &&
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_YOUR")
) {
  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
}
