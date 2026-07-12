import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://duyrpjajnkezhxfvenfz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iEhhpH9xoDDjAL7bUn_ugA_qcJh-xDC";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
