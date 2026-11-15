import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  // Mengambil sesi user langsung dari server
  const session = await getServerSession(authOptions);

  // Jika tidak ada sesi (belum login), arahkan ke halaman login
  if (!session) {
    redirect("/login");
  }

  // Jika sudah login, baca rolenya
  const role = session.user?.role;

  // Arahkan ke dashboard masing-masing berdasarkan role
  switch (role) {
    case "super_admin":
      redirect("/super-admin/dashboard");
    case "admin":
      redirect("/admin/dashboard");
    case "pegawai":
      redirect("/pegawai/dashboard");
    case "keuangan":
      redirect("/keuangan/dashboard");
    case "leader":
      redirect("/leader/dashboard");
    case "guest":
      redirect("/guest/dashboard");
    case "supervisor":
      redirect("/supervisor/dashboard");
    case "mitra":
      redirect("/mitra/dashboard");
    default:
      redirect("/login");
  }
}