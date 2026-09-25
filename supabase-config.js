// Vexa Supabase configuration.
// The anon/publishable key is safe to use in browser code when RLS is configured.
const SUPABASE_URL = "https://rcdmmszknzqwzvovubkp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjZG1tc3prbnpxd3p2b3Z1YmtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNDg3MjQsImV4cCI6MjEwNTkyNDcyNH0.EZy6XLdue0E14XNnjR0EWyICYf4ZBMVnDf0l7WFWPkk";
window.vexaSupabase = { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
