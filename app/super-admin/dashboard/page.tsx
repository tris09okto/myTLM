import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
// Sesuaikan path import authOptions dengan lokasi konfigurasi NextAuth di project Anda
import { authOptions } from "../../api/auth/[...nextauth]/route";
import SuperAdminClient from "./SuperAdminClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <SuperAdminClient session={session} />;
}