import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const SUPABASE_URL = 'https://yrgpndfperwazvrtpgyj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ojOVzqSlYONkgrUkWp4uPw_3Yqp-Naz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
