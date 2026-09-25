// Vexa Supabase configuration.
// The publishable/anon key is designed for frontend use.
// NEVER put a service_role/secret key here.

const SUPABASE_URL = "https://rcdmmszknzqwzvovubkp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "PASTE_YOUR_PUBLISHABLE_KEY_HERE";

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
