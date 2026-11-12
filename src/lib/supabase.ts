import { createClient } from '@supabase/supabase-js';

// مفاتيح عامة (Publishable) مصممة لتظهر في المتصفح؛ الحماية الفعلية عبر RLS في قاعدة البيانات.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://kpzidjnfntxklbkimpon.supabase.co';
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sxWq_iXy6O4xpR6gFIXp2Q_yC_YcQLH';

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
