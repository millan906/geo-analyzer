import { createClient } from '@supabase/supabase-js';

export function getSupabaseServerClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
