import { redirect } from "next/navigation";
import { getSessionProfile } from "../../lib/supabase-server";
import AdminPanel from "../../components/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login?next=/admin");
  if (!profile || profile.role !== "admin" || profile.status !== "aprovado") redirect("/");
  return <AdminPanel nome={profile.nome} />;
}
