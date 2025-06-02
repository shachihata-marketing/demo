import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ダミーのSupabaseクライアント（環境変数が設定されていない場合）
const createDummyClient = (): SupabaseClient => {
  return {
    auth: {
      signInAnonymously: async () => ({ data: null, error: new Error('No Supabase configured') }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('No Supabase configured') }),
        }),
      }),
      upsert: async () => ({ data: null, error: new Error('No Supabase configured') }),
      update: async () => ({ data: null, error: new Error('No Supabase configured') }),
    }),
  } as unknown as SupabaseClient;
};

// 環境変数が設定されている場合は本物のクライアント、そうでなければダミー
export const supabase: SupabaseClient = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : createDummyClient(); 