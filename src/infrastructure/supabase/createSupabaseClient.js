export function hasSupabaseRuntime(config) {
  return Boolean(
    config?.supabaseUrl &&
      config?.supabaseAnonKey &&
      window.supabase &&
      typeof window.supabase.createClient === "function"
  );
}

export function createSupabaseClient(config) {
  return window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}
