const SUPABASE_URL = "https://urdmqqnmjjsckpcwszpr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Mo3RCBsNtnHeolzGbBuM6w_1UqOmxSw";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);