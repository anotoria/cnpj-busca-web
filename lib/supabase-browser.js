import { createBrowserClient } from "@supabase/ssr";

// Cliente Supabase para uso no navegador (login, cadastro, logout, reset).
// Usa apenas a anon key pública.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
