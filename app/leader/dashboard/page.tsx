"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import RoleSidebarLayout from "@/app/components/RoleSidebarLayout";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (currentPage <= 3) {
      endPage = Math.min(5, totalPages);
    } else if (currentPage >= totalPages - 2) {
      startPage = Math.max(1, totalPages - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-3 sm:px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl gap-3">
      <span className="text-xs text-gray-500 text-center sm:text-left">
        Menampilkan halaman <b>{currentPage}</b> dari <b>{totalPages}</b>
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Prev
        </button>
        {getPageNumbers().map((num) => (
          <button
            type="button"
            key={num}
            onClick={() => onPageChange(num)}
            className={`px-2.5 sm:px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${
              currentPage === num
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

function LeaderDashboardContent() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState("dashboard");

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE LAPORAN & ADUAN TIM ---
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [isLoadingLaporan, setIsLoadingLaporan] = useState(false);
  const [selectedLaporan, setSelectedLaporan] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState({ type: "", text: "" });

  // --- STATE MODAL ID CARD ---
  const [isIdCardModalOpen, setIsIdCardModalOpen] = useState(false);

  // --- STATE PERKIRAAN PEMASUKAN ---
  const [perkiraanList, setPerkiraanList] = useState<any[]>([]);
  const [isLoadingPerkiraan, setIsLoadingPerkiraan] = useState(false);
  const [searchPerkiraan, setSearchPerkiraan] = useState("");
  const [currentPagePerkiraan, setCurrentPagePerkiraan] = useState(1);
  const itemsPerPage = 10;

  // Filter & Paging
  const filteredPerkiraan = perkiraanList.filter((item: any) => {
    if (!searchPerkiraan) return true;
    const keyword = searchPerkiraan.toLowerCase();

    return (
      String(item.status || "").toLowerCase().includes(keyword) ||
      String(item.nama_fronting || "").toLowerCase().includes(keyword) ||
      String(item.nama_nasabah || "").toLowerCase().includes(keyword) ||
      String(item.produk || "").toLowerCase().includes(keyword) ||
      String(item.area || "").toLowerCase().includes(keyword)
    );
  });

  const indexOfLastPerkiraan = currentPagePerkiraan * itemsPerPage;
  const indexOfFirstPerkiraan = indexOfLastPerkiraan - itemsPerPage;
  const currentPerkiraanList = filteredPerkiraan.slice(
    indexOfFirstPerkiraan,
    indexOfLastPerkiraan
  );
  const totalPagesPerkiraan = Math.ceil(
    filteredPerkiraan.length / itemsPerPage
  );

  // --- STATE GANTI PASSWORD LEADER ---
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fetchPerkiraanPemasukan = async () => {
    setIsLoadingPerkiraan(true);
    try {
      const role = "leader";
      const userName =
        session?.user?.name || (session?.user as any)?.username || "";

      if (!userName) return;

      const res = await fetch(
        `/api/perkiraan-pemasukan?role=${role}&username=${encodeURIComponent(
          userName
        )}`
      );
      const result = await res.json();

      if (result.success) {
        setPerkiraanList(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil data perkiraan pemasukan", error);
    } finally {
      setIsLoadingPerkiraan(false);
    }
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(angka);
  };

  const formatArea = (areaData: string) => {
    if (!areaData) return "-";
    try {
      const parsed = JSON.parse(areaData);
      return Array.isArray(parsed) ? parsed.join(", ") : parsed;
    } catch (e) {
      return String(areaData).replace(/[\[\]"]/g, "");
    }
  };

  const parseDeskripsi = (desc: string) => {
    if (!desc) return { pertanyaan: "", jawaban: "", isAnswered: false };
    const parts = desc.split("\n\nJawaban :\n");
    const rawPertanyaan = parts[0]?.replace("Pertanyaan :\n", "") || "";
    const rawJawaban = parts[1] || "";

    return {
      pertanyaan: rawPertanyaan,
      jawaban: rawJawaban.includes("[Menunggu balasan") ? "" : rawJawaban,
      isAnswered:
        !rawJawaban.includes("[Menunggu balasan") && rawJawaban.trim() !== "",
    };
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg({ type: "", text: "" });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({
        type: "error",
        text: "Password Baru dan Konfirmasi Password tidak cocok!",
      });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({
        type: "error",
        text: "Password baru minimal harus 6 karakter.",
      });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const activeUsername =
        session?.user?.name || (session?.user as any)?.username;
      const res = await fetch("/api/leaders/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: activeUsername,
          oldPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg({
          type: "success",
          text: "Password Anda berhasil diperbarui!",
        });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg({
          type: "error",
          text: data.message || "Gagal mengubah password.",
        });
      }
    } catch (error) {
      setPasswordMsg({
        type: "error",
        text: "Terjadi kesalahan jaringan/sistem.",
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  useEffect(() => {
    const fetchLeaderData = async () => {
      const activeUsername =
        session?.user?.name || (session?.user as any)?.username;
      if (!activeUsername) return;

      try {
        const response = await fetch(
          `/api/leaders/dashboard?username=${encodeURIComponent(
            activeUsername
          )}`
        );
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || "Gagal memuat data");
        setDashboardData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (session) fetchLeaderData();
  }, [session]);

  useEffect(() => {
    const fetchLaporan = async () => {
      const activeLeader =
        dashboardData?.leader?.nama_leader || session?.user?.name;
      if (!activeLeader) return;

      if (currentView === "laporan") {
        setIsLoadingLaporan(true);
      }
      try {
        const res = await fetch(
          `/api/leaders/laporan?leaderName=${encodeURIComponent(activeLeader)}`
        );
        const result = await res.json();
        if (result.success) {
          setLaporanList(result.data);
        }
      } catch (e) {
        console.error("Gagal menarik data laporan", e);
      } finally {
        setIsLoadingLaporan(false);
      }
    };

    if (session) {
      fetchLaporan();
    }
    if (currentView === "status-pemasukan") {
      fetchPerkiraanPemasukan();
    }
  }, [currentView, dashboardData, session]);

  const handleOpenLaporan = (item: any) => {
    setSelectedLaporan(item);
    const parsed = parseDeskripsi(item.deskripsi);
    setReplyText(parsed.jawaban);
    setReplyMsg({ type: "", text: "" });
  };

  const handleSubmitReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    setReplyMsg({ type: "", text: "" });

    try {
      const res = await fetch("/api/leaders/laporan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedLaporan.id,
          answer: replyText,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setReplyMsg({ type: "success", text: "Balasan berhasil dikirim!" });

        setLaporanList((prev) =>
          prev.map((l) => {
            if (l.id === selectedLaporan.id) {
              const parts = l.deskripsi.split("\n\nJawaban :\n");
              return { ...l, deskripsi: `${parts[0]}\n\nJawaban :\n${replyText}` };
            }
            return l;
          })
        );

        setTimeout(() => setSelectedLaporan(null), 1500);
      } else {
        setReplyMsg({
          type: "error",
          text: result.message || "Gagal mengirim balasan.",
        });
      }
    } catch (e) {
      setReplyMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-100 text-gray-600 font-medium px-4 text-center">
        Memuat Dashboard Leader...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center flex-col gap-4 bg-gray-100 px-4 text-center">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a
          href="/api/auth/signin"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold"
        >
          Login Sekarang
        </a>
      </div>
    );
  }

  const leaderDisplayName =
    dashboardData?.leader?.nama_leader || session?.user?.name || "Leader";

  const unansweredCount = laporanList.filter(
    (item) => !parseDeskripsi(item.deskripsi).isAnswered
  ).length;

  const teamMembers =
    dashboardData?.team ||
    dashboardData?.fronting ||
    dashboardData?.anggota ||
    [];

  const pageTitleMap: Record<string, string> = {
    dashboard: "Ringkasan Pencapaian Tim",
    laporan: "Laporan & Aduan Fronting",
    "status-pemasukan": "Status Perkiraan Pemasukan",
    pengaturan: "Pengaturan Akun",
  };

  const activePageTitle = pageTitleMap[currentView] || "Dashboard Leader";

  // Shortcut laporan masuk untuk top bar mobile
  const mobileReportShortcut = (
    <button
      type="button"
      onClick={() => setCurrentView("laporan")}
      aria-label="Laporan & Aduan Tim"
      className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-full transition"
    >
      <span className="text-lg">📝</span>
      {unansweredCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full border-2 border-white">
          {unansweredCount}
        </span>
      )}
    </button>
  );

  // Konten Sidebar untuk Desktop & Mobile Drawer
  const sidebarContent = (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <div
        onClick={() => setCurrentView("dashboard")}
        className="p-5 text-lg lg:text-xl font-bold border-b border-gray-700 text-center tracking-wider text-blue-400 cursor-pointer hover:bg-gray-800/60 transition"
      >
        LEADER AREA
        <span className="block text-[11px] font-semibold text-gray-400 uppercase mt-0.5 tracking-widest truncate px-2">
          {leaderDisplayName}
        </span>
      </div>

      <div className="p-4 flex-grow overflow-y-auto space-y-1.5">
        <button
          type="button"
          onClick={() => setCurrentView("dashboard")}
          className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
            currentView === "dashboard"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          📊 DASHBOARD UTAMA
        </button>

        <button
          type="button"
          onClick={() => setCurrentView("laporan")}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-sm transition-colors ${
            currentView === "laporan"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          <span>📝 LAPORAN & ADUAN TIM</span>
          {unansweredCount > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse ml-2 shrink-0">
              {unansweredCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setCurrentView("status-pemasukan")}
          className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
            currentView === "status-pemasukan"
              ? "bg-gray-800 text-white font-bold"
              : "text-gray-300 hover:text-white hover:bg-gray-800"
          }`}
        >
          💰 STATUS PERKIRAAN PEMASUKAN
        </button>

        <button
          type="button"
          onClick={() => setCurrentView("pengaturan")}
          className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
            currentView === "pengaturan"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          🔑 PENGATURAN AKUN
        </button>
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 px-4 rounded-lg text-sm font-bold transition-colors"
          type="button"
        >
          LOGOUT
        </button>
      </div>
    </div>
  );

  return (
    <RoleSidebarLayout
      title={activePageTitle}
      subtitle={`Leader: ${leaderDisplayName}`}
      headerRight={mobileReportShortcut}
      sidebarContent={sidebarContent}
    >
      {/* HEADER DESKTOP */}
      <div className="hidden lg:flex mb-8 border-b pb-4 justify-between items-center relative z-20 gap-4">
        <h1 className="text-2xl font-bold text-gray-800 uppercase">
          {activePageTitle}
        </h1>

        <div className="flex items-center gap-6 shrink-0">
          <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
            Login sebagai Leader:{" "}
            <b className="text-blue-600 uppercase">{leaderDisplayName}</b>
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 sm:px-6 sm:py-4 rounded-xl mb-6 text-xs sm:text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* 1. TAMPILAN DASHBOARD LEADER UTAMA */}
      {currentView === "dashboard" && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* BOX 1: PROFIL & ID CARD */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
              <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 border-b pb-2">
                Profil Leader
              </h3>
              {isLoadingData ? (
                <span className="text-gray-400 animate-pulse text-sm">
                  Memuat...
                </span>
              ) : (
                <div className="flex items-center gap-3.5 sm:gap-4 mt-2">
                  {dashboardData?.leader?.idcard_file ? (
                    <button
                      type="button"
                      onClick={() => setIsIdCardModalOpen(true)}
                      className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-300 shadow-sm shrink-0 bg-gray-100"
                    >
                      <img
                        src={`/uploads/leader/idcard/${dashboardData.leader.idcard_file}`}
                        alt="ID Card"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">
                          Lihat
                        </span>
                      </div>
                    </button>
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-gray-300 bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-gray-400 text-center uppercase font-bold">
                        No
                        <br />
                        Photo
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-base font-bold text-gray-800 leading-tight mb-1 break-words">
                      {dashboardData?.leader?.nama_leader || "-"}
                    </h4>
                    <p className="text-xs text-gray-500 font-medium bg-gray-100 inline-block px-2 py-0.5 rounded">
                      {session?.user?.name}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* BOX 2: AREA KELOLAAN */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
              <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 border-b pb-2">
                Area Kelolaan
              </h3>
              {isLoadingData ? (
                <span className="text-gray-400 animate-pulse text-sm">
                  Memuat...
                </span>
              ) : (
                <h4
                  className="text-lg sm:text-xl font-bold text-gray-800 mt-1 line-clamp-2"
                  title={formatArea(dashboardData?.leader?.area)}
                >
                  {formatArea(dashboardData?.leader?.area)}
                </h4>
              )}
            </div>

            {/* BOX 3: TOTAL CLOSING */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-center">
              <h3 className="text-xs sm:text-sm font-bold text-blue-800 uppercase tracking-wider mb-2 border-b border-blue-200 pb-2">
                Total Nominal Closing Tim
              </h3>
              {isLoadingData ? (
                <span className="text-blue-400 animate-pulse text-sm">
                  Menghitung...
                </span>
              ) : (
                <h4 className="text-2xl sm:text-3xl font-black text-blue-700 mt-1 break-words">
                  {formatRupiah(dashboardData?.totalClosing || 0)}
                </h4>
              )}
            </div>
          </div>

          {/* TABEL ANGGOTA TIM */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-4 sm:p-5 flex justify-between items-center">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                👥 Daftar Anggota Tim Fronting
              </h2>
              <span className="text-xs font-semibold bg-gray-700 text-gray-200 px-2.5 py-1 rounded-full">
                {teamMembers.length} Orang
              </span>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap">
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      No
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      NIK
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Nama Fronting
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Area
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Penempatan
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-right">
                      Total Closing / Omset
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                  {isLoadingData ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-8 text-center text-gray-400 animate-pulse text-sm"
                      >
                        Memuat daftar anggota tim...
                      </td>
                    </tr>
                  ) : teamMembers.length > 0 ? (
                    teamMembers.map((member: any, idx: number) => (
                      <tr
                        key={member.nik || member.id || idx}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                          {idx + 1}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-mono text-gray-600">
                          {member.nik || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-bold text-gray-800">
                          {member.nama || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {member.area || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {member.penempatan || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-black text-blue-700 text-right">
                          {formatRupiah(
                            Number(
                              member.omset ??
                                member.closing ??
                                member.estimasi ??
                                0
                            )
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                      >
                        Belum ada data anggota tim yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAMPILAN LAPORAN & ADUAN */}
      {currentView === "laporan" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-800 p-4 sm:p-5 flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              📥 Pesan Masuk dari Anggota Tim
            </h2>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Tgl. Laporan
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Judul / Pengirim
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Lampiran
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                {isLoadingLaporan ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-gray-400 animate-pulse text-sm"
                    >
                      Memuat laporan...
                    </td>
                  </tr>
                ) : laporanList.length > 0 ? (
                  laporanList.map((item: any) => {
                    const { isAnswered } = parseDeskripsi(item.deskripsi);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-500">
                          {new Date(item.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-semibold text-gray-800">
                          {item.judul}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          {item.file_name ? (
                            <span className="text-xl" title="Ada Lampiran">
                              📎
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide ${
                              isAnswered
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {isAnswered ? "Selesai" : "Menunggu"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenLaporan(item)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
                          >
                            Lihat & Balas
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                    >
                      <span className="text-3xl block mb-2">📬</span>
                      Belum ada laporan atau aduan dari tim Anda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TAMPILAN STATUS PERKIRAAN PEMASUKAN */}
      {currentView === "status-pemasukan" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 sm:gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800">
                Daftar Status Perkiraan Pemasukan
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Memantau status entri data perkiraan pemasukan tim.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
              <input
                type="text"
                value={searchPerkiraan}
                onChange={(e) => {
                  setSearchPerkiraan(e.target.value);
                  setCurrentPagePerkiraan(1);
                }}
                placeholder="Cari data..."
                className="w-full sm:w-64 p-2.5 border border-gray-300 rounded-lg text-base md:text-sm font-medium text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={fetchPerkiraanPemasukan}
                className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
              >
                🔄 Muat Ulang
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Tanggal
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Nama Fronting
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Nama Nasabah
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Nama Produk
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Area
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Nominal
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                {isLoadingPerkiraan ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-400 animate-pulse text-sm"
                    >
                      Memuat data...
                    </td>
                  </tr>
                ) : currentPerkiraanList.length > 0 ? (
                  currentPerkiraanList.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-700">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString(
                              "id-ID"
                            )
                          : "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-semibold text-gray-900">
                        {item.nama_fronting || "-"}
                      </td>
                      <td
                        className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-600 max-w-xs truncate"
                        title={item.nama_nasabah}
                      >
                        {item.nama_nasabah || "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-semibold text-gray-900">
                        {item.produk || "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-semibold text-gray-900">
                        {item.area || "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-medium text-gray-900">
                        {item.up_pengajuan
                          ? `Rp ${Number(item.up_pengajuan).toLocaleString(
                              "id-ID"
                            )}`
                          : "-"}
                      </td>
                      <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                            item.status === "Disetujui"
                              ? "bg-green-100 text-green-700"
                              : item.status === "Ditolak"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.status || "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                    >
                      Tidak ada data perkiraan pemasukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPagePerkiraan}
            totalPages={totalPagesPerkiraan}
            onPageChange={(page) => setCurrentPagePerkiraan(page)}
          />
        </div>
      )}

      {/* 4. PENGATURAN AKUN & GANTI PASSWORD */}
      {currentView === "pengaturan" && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 animate-fade-in">
          <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6 border-b border-gray-100 pb-4">
            <span className="text-2xl sm:text-3xl shrink-0">🔑</span>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                Ganti Password Akun Leader
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Pastikan Anda menggunakan password yang kuat dan aman.
              </p>
            </div>
          </div>

          {passwordMsg.text && (
            <div
              className={`p-3.5 sm:p-4 rounded-lg mb-5 sm:mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                passwordMsg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {passwordMsg.type === "success" ? "✅" : "⚠️"} {passwordMsg.text}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Password Lama
              </label>
              <div className="relative">
                <input
                  type={showOldPassword ? "text" : "password"}
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Masukkan password saat ini..."
                  className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity"
                >
                  {showOldPassword ? "👁️" : "🙈"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 pt-1">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter..."
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity"
                  >
                    {showNewPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Konfirmasi Password Baru
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ketik ulang password baru..."
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity"
                  >
                    {showConfirmPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={
                  isSubmittingPassword ||
                  !oldPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingPassword ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL BACA & BALAS LAPORAN */}
      {selectedLaporan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="bg-gray-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <h3 className="text-base sm:text-lg font-bold">
                Detail Laporan Pegawai
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLaporan(null)}
                className="text-gray-400 hover:text-white text-xl font-bold transition-colors focus:outline-none px-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Judul / Identitas
                </h4>
                <p className="text-sm sm:text-base font-bold text-gray-800 break-words">
                  {selectedLaporan.judul}
                </p>
              </div>

              <div className="mb-5 sm:mb-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Isi Pesan / Pertanyaan
                </h4>
                <div className="bg-blue-50 border border-blue-100 p-3.5 sm:p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed break-words">
                  {parseDeskripsi(selectedLaporan.deskripsi).pertanyaan}
                </div>
              </div>

              {selectedLaporan.file_name && (
                <div className="mb-5 sm:mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Lampiran Foto
                  </h4>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      📎 {selectedLaporan.file_name}
                    </span>
                    <a
                      href={`/uploads/qna/${selectedLaporan.file_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto text-center bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap shrink-0"
                    >
                      Buka Foto
                    </a>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-5 sm:pt-6">
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  💬 Berikan Balasan / Tanggapan
                </h4>

                {replyMsg.text && (
                  <div
                    className={`p-3 rounded-lg mb-4 text-xs font-bold ${
                      replyMsg.type === "success"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {replyMsg.text}
                  </div>
                )}

                <form onSubmit={handleSubmitReply}>
                  <textarea
                    required
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Ketik jawaban atau tanggapan Anda di sini..."
                    className="w-full border border-gray-300 rounded-xl p-3.5 sm:p-4 text-gray-900 text-base md:text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors resize-y mb-4"
                  ></textarea>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLaporan(null)}
                      className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReply || !replyText.trim()}
                      className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmittingReply ? "Menyimpan..." : "Simpan Balasan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIHAT FULL ID CARD LEADER */}
      {isIdCardModalOpen && dashboardData?.leader?.idcard_file && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
          <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full flex flex-col max-h-[92dvh]">
            <div className="bg-gray-900 text-white p-4 flex justify-between items-center gap-2 shrink-0">
              <h3 className="font-bold text-sm sm:text-lg flex items-center gap-2 truncate">
                🪪 ID Card: {dashboardData.leader.nama_leader}
              </h3>
              <button
                type="button"
                onClick={() => setIsIdCardModalOpen(false)}
                className="text-gray-400 hover:text-white text-2xl font-bold transition-colors focus:outline-none leading-none px-1 shrink-0"
              >
                &times;
              </button>
            </div>

            <div className="p-4 sm:p-6 flex justify-center items-center bg-gray-100 flex-1 overflow-auto">
              <img
                src={`/uploads/leader/idcard/${dashboardData.leader.idcard_file}`}
                alt="ID Card Full"
                className="max-w-full max-h-[60dvh] object-contain rounded shadow-sm border border-gray-200"
              />
            </div>

            <div className="p-4 bg-white flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 border-t shrink-0">
              <button
                type="button"
                onClick={() => setIsIdCardModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Tutup
              </button>
              <a
                href={`/uploads/leader/idcard/${dashboardData.leader.idcard_file}`}
                download={`IDCard_${dashboardData.leader.nama_leader.replace(
                  /\s+/g,
                  "_"
                )}`}
                className="w-full sm:w-auto justify-center px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors"
              >
                ⬇️ Download ID Card
              </a>
            </div>
          </div>
        </div>
      )}
    </RoleSidebarLayout>
  );
}

export default function LeaderDashboard() {
  return <LeaderDashboardContent />;
}