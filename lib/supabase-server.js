import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente Supabase para uso no servidor (rotas de API, server components).
// Lê/escreve a sessão nos cookies via @supabase/ssr.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Chamado de um Server Component — o middleware cuida do refresh.
          }
        },
      },
    }
  );
}

// Retorna o usuário logado + o perfil (role/status). null se não autenticado.
export async function getSessionProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { adminFetch } = await import("./supabase-admin");
  const rows = await adminFetch(
    `profiles?id=eq.${user.id}&select=id,nome,email,role,status`
  );
  const profile = Array.isArray(rows) && rows.length ? rows[0] : null;
  return { user, profile };
}
