"use client";

import { useState, useEffect } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import RoleSidebarLayout from "@/app/components/RoleSidebarLayout";

export const dynamic = "force-dynamic";

function GuestDashboardContent() {
  const { data: session, status } = useSession();

  // --- STATE NAVIGASI MENU ---
  const [activeMenu, setActiveMenu] = useState<
    "dashboard" | "monitoring" | "mitra"
  >("dashboard");

  // --- STATE DASHBOARD UTAMA (FRONTING & OMSET) ---
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBy, setFilterBy] = useState("nama");
  const [keyword, setKeyword] = useState("");

  // --- STATE MONITORING ABSENSI (PEGAWAI NON-FRONTING) ---
  const [monitoringData, setMonitoringData] = useState<any[]>([]);
  const [isLoadingMonitoring, setIsLoadingMonitoring] = useState(false);
  const [monitoringDate, setMonitoringDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [monitoringSearch, setMonitoringSearch] = useState("");
  const [selectedMitraFilter, setSelectedMitraFilter] = useState("ALL");

  // --- STATE DAFTAR MITRA ---
  const [mitraData, setMitraData] = useState<any[]>([]);
  const [isLoadingMitra, setIsLoadingMitra] = useState(false);
  const [mitraSearch, setMitraSearch] = useState("");

  // 1. FETCH DASHBOARD UTAMA (FRONTING)
  const fetchGuestData = async () => {
    const activeUsername =
      session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/guest/dashboard?username=${activeUsername}&filterBy=${filterBy}&keyword=${encodeURIComponent(
          keyword
        )}`
      );
      const result = await res.json();

      if (!result.success)
        throw new Error(result.error || "Gagal memuat data guest");
      setDashboardData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. FETCH MONITORING ABSENSI PEGAWAI NON-FRONTING
  const fetchMonitoringData = async () => {
    const activeUsername =
      session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    setIsLoadingMonitoring(true);
    try {
      const res = await fetch(
        `/api/guest/monitoring?username=${activeUsername}&date=${monitoringDate}&search=${encodeURIComponent(
          monitoringSearch
        )}&mitra=${encodeURIComponent(selectedMitraFilter)}`
      );
      const result = await res.json();

      if (!result.success)
        throw new Error(result.error || "Gagal memuat data monitoring");
      setMonitoringData(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  // 3. FETCH DAFTAR MITRA
  const fetchMitraData = async () => {
    const activeUsername =
      session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    setIsLoadingMitra(true);
    try {
      const res = await fetch(
        `/api/guest/mitra?username=${activeUsername}&search=${encodeURIComponent(
          mitraSearch
        )}`
      );
      const result = await res.json();

      if (!result.success)
        throw new Error(result.error || "Gagal memuat data mitra");
      setMitraData(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingMitra(false);
    }
  };

  useEffect(() => {
    if (session) {
      if (activeMenu === "dashboard") {
        fetchGuestData();
      } else if (activeMenu === "monitoring") {
        fetchMonitoringData();
        if (mitraData.length === 0) fetchMitraData();
      } else if (activeMenu === "mitra") {
        fetchMitraData();
      }
    }
  }, [session, activeMenu, filterBy, monitoringDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGuestData();
  };

  const handleMonitoringSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMonitoringData();
  };

  const handleMitraSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMitraData();
  };

  // --- FUNGSI EXPORT DATA MONITORING KE EXCEL ---
  const exportToExcel = () => {
    if (!filteredMonitoringData || filteredMonitoringData.length === 0) {
      alert("Tidak ada data absensi untuk di-download.");
      return;
    }

    const headers = [
      "No",
      "NIK",
      "Nama Pegawai",
      "Nama Mitra",
      "Unit Kerja",
      "Login / Absen Terakhir",
      "Tag Lokasi Absen",
    ];

    const rows = filteredMonitoringData.map((log: any, index: number) => [
      index + 1,
      `'${log.nik || ""}`,
      `"${(log.nama || "").replace(/"/g, '""')}"`,
      `"${(log.nama_mitra || "-").replace(/"/g, '""')}"`,
      `"${(log.unit_kerja || "-").replace(/"/g, '""')}"`,
      `"${
        log.last_login_at
          ? new Date(log.last_login_at).toLocaleString("id-ID")
          : "Belum Absen"
      }"`,
      `"${(log.tag_lokasi || "-").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Monitoring_Absensi_Pegawai_${monitoringDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(angka);
  };

  // Filter client-side tambahan untuk respon pencarian instan
  const filteredMonitoringData = monitoringData.filter((item: any) => {
    const matchesSearch =
      item.nama?.toLowerCase().includes(monitoringSearch.toLowerCase()) ||
      item.nik?.toLowerCase().includes(monitoringSearch.toLowerCase()) ||
      item.nama_mitra?.toLowerCase().includes(monitoringSearch.toLowerCase());

    const matchesMitra =
      selectedMitraFilter === "ALL" ||
      String(item.id_mitra) === String(selectedMitraFilter) ||
      item.nama_mitra?.toLowerCase() === selectedMitraFilter.toLowerCase();

    return matchesSearch && matchesMitra;
  });

  if (
    status === "loading" ||
    (activeMenu === "dashboard" && isLoading && !dashboardData)
  ) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-100 text-gray-600 font-medium px-4 text-center">
        Memuat Dashboard Guest...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center flex-col gap-4 bg-gray-100 px-4 text-center">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a
          href="/login"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold"
        >
          Login Sekarang
        </a>
      </div>
    );
  }

  const guestDisplayName =
    dashboardData?.guest?.nama_guest || session?.user?.name || "Guest";

  const pageTitleMap: Record<typeof activeMenu, string> = {
    dashboard: "Ringkasan Area & Omset Fronting",
    monitoring: "Monitoring Absensi Pegawai Non-Fronting",
    mitra: "Daftar Mitra Bekerja Sama & Jumlah Pegawai",
  };

  const activePageTitle = pageTitleMap[activeMenu];

  // Konten Sidebar untuk Desktop & Mobile Drawer
  const sidebarContent = (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <div
        onClick={() => setActiveMenu("dashboard")}
        className="p-5 text-lg lg:text-xl font-bold border-b border-gray-700 text-center tracking-wider text-emerald-400 cursor-pointer hover:bg-gray-800/60 transition"
      >
        GUEST AREA
        <span className="block text-[11px] font-semibold text-gray-400 uppercase mt-0.5 tracking-widest truncate px-2">
          {guestDisplayName}
        </span>
      </div>

      <div className="p-4 flex-grow overflow-y-auto space-y-2">
        <button
          type="button"
          onClick={() => setActiveMenu("dashboard")}
          className={`w-full text-left px-4 py-3 rounded-md font-bold text-sm transition-colors ${
            activeMenu === "dashboard"
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
        >
          📊 DASHBOARD UTAMA
        </button>

        <button
          type="button"
          onClick={() => setActiveMenu("monitoring")}
          className={`w-full text-left px-4 py-3 rounded-md font-bold text-sm transition-colors ${
            activeMenu === "monitoring"
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
        >
          📍 MONITORING ABSENSI
        </button>

        <button
          type="button"
          onClick={() => setActiveMenu("mitra")}
          className={`w-full text-left px-4 py-3 rounded-md font-bold text-sm transition-colors ${
            activeMenu === "mitra"
              ? "bg-gray-800 text-white"
              : "text-gray-400 hover:bg-gray-800 hover:text-white"
          }`}
        >
          🤝 DAFTAR MITRA
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
      subtitle={`Guest: ${guestDisplayName}`}
      sidebarContent={sidebarContent}
    >
      {/* HEADER DESKTOP */}
      <div className="hidden lg:flex mb-8 border-b pb-4 justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 uppercase">
          {activePageTitle}
        </h1>
        <span className="text-sm text-gray-600 border-l border-gray-300 pl-6 shrink-0">
          Login sebagai Guest:{" "}
          <b className="text-emerald-600 uppercase">{guestDisplayName}</b>
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 sm:px-6 sm:py-4 rounded-xl mb-6 text-xs sm:text-sm font-semibold flex justify-between items-center gap-3">
          <span>⚠️ {error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 font-bold hover:text-red-900 px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* VIEW 1: DASHBOARD UTAMA */}
      {activeMenu === "dashboard" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden grid grid-cols-2 md:grid-cols-4 mb-6">
            <div className="p-4 sm:p-5 text-center border-b md:border-b-0 border-r border-gray-100 hover:bg-emerald-50/50 transition-colors">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Total Fronting
              </h3>
              <h4 className="text-xl sm:text-2xl font-black text-emerald-600">
                {dashboardData?.totalFronting || 0}{" "}
                <span className="text-xs font-bold text-gray-400">Orang</span>
              </h4>
            </div>

            <div className="p-4 sm:p-5 text-center border-b md:border-b-0 md:border-r border-gray-100 hover:bg-blue-50/50 transition-colors">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Kanwil Terdaftar
              </h3>
              <h4 className="text-xl sm:text-2xl font-black text-blue-600">
                {dashboardData?.totalKanwil || 0}{" "}
                <span className="text-xs font-bold text-gray-400">Titik</span>
              </h4>
            </div>

            <div className="p-4 sm:p-5 text-center border-r border-gray-100 hover:bg-purple-50/50 transition-colors">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Area Terdaftar
              </h3>
              <h4 className="text-xl sm:text-2xl font-black text-purple-600">
                {dashboardData?.totalArea || 0}{" "}
                <span className="text-xs font-bold text-gray-400">Titik</span>
              </h4>
            </div>

            <div className="p-4 sm:p-5 text-center hover:bg-amber-50/50 transition-colors">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                Total Penempatan
              </h3>
              <h4 className="text-xl sm:text-2xl font-black text-amber-500">
                {dashboardData?.totalPenempatan || 0}{" "}
                <span className="text-xs font-bold text-gray-400">Titik</span>
              </h4>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 sm:gap-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                👥 Daftar Fronting & Omset
              </h2>
              <form
                onSubmit={handleSearchSubmit}
                className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto"
              >
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value)}
                  className="bg-gray-700 text-white text-base md:text-sm rounded-lg px-3 py-2 outline-none border border-gray-600"
                >
                  <option value="nama">Filter Berdasarkan Nama Fronting</option>
                  <option value="area">Filter Berdasarkan Area</option>
                  <option value="kanwil">Filter Berdasarkan Kanwil</option>
                  <option value="penempatan">
                    Filter Berdasarkan Penempatan
                  </option>
                </select>

                <div className="flex gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Masukkan kata kunci..."
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="px-3 py-2 rounded-lg text-base md:text-sm bg-gray-700 text-white placeholder-gray-400 outline-none flex-1 sm:w-48 border border-gray-600"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shrink-0"
                  >
                    Cari
                  </button>
                </div>
              </form>
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
                      Kanwil
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Area
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Penempatan
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-right">
                      Total Omset
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-8 text-center text-gray-400 animate-pulse text-sm"
                      >
                        Memuat data...
                      </td>
                    </tr>
                  ) : dashboardData?.team?.length > 0 ? (
                    dashboardData.team.map((member: any, index: number) => (
                      <tr
                        key={member.nik || index}
                        className="hover:bg-emerald-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-gray-700">
                          {member.nik}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-bold text-gray-800">
                          {member.nama}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {member.kanwil || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {member.area || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {member.penempatan || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-black text-emerald-700 text-right">
                          {formatRupiah(member.omset)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                      >
                        <span className="text-3xl block mb-2">📭</span>
                        Tidak ada data fronting yang sesuai dengan kriteria
                        pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: MONITORING ABSENSI (SEARCHABLE & EXPORT EXCEL) */}
      {activeMenu === "monitoring" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-4 sm:p-5 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-3 sm:gap-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                📍 Data Absensi & Lokasi Pegawai Non-Fronting
              </h2>

              {/* OPSI SEARCH, FILTER MITRA, TANGGAL & BUTTON EXPORT EXCEL */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full xl:w-auto items-stretch sm:items-center">
                {/* FILTER SELEKSI MITRA / SEMUA PEGAWAI */}
                <select
                  value={selectedMitraFilter}
                  onChange={(e) => setSelectedMitraFilter(e.target.value)}
                  className="w-full sm:w-auto bg-gray-700 text-white text-base md:text-sm rounded-lg px-3 py-2 outline-none border border-gray-600 focus:border-emerald-500"
                >
                  <option value="ALL">Semua Pegawai / Semua Mitra</option>
                  {mitraData.map((m: any) => (
                    <option key={m.id || m.kode_mitra} value={m.id}>
                      {m.nama_mitra} ({m.kode_mitra})
                    </option>
                  ))}
                </select>

                {/* INPUT PENCARIAN NIK / NAMA / MITRA */}
                <form
                  onSubmit={handleMonitoringSearchSubmit}
                  className="w-full sm:w-auto"
                >
                  <input
                    type="text"
                    placeholder="Cari NIK / Nama / Mitra..."
                    value={monitoringSearch}
                    onChange={(e) => setMonitoringSearch(e.target.value)}
                    className="w-full sm:w-52 px-3 py-2 rounded-lg text-base md:text-sm bg-gray-700 text-white placeholder-gray-400 outline-none border border-gray-600 focus:border-emerald-500"
                  />
                </form>

                {/* FILTER TANGGAL */}
                <input
                  type="date"
                  value={monitoringDate}
                  onChange={(e) => setMonitoringDate(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-lg text-base md:text-sm bg-gray-700 text-white outline-none border border-gray-600 focus:border-emerald-500"
                />

                {/* GROUP TOMBOL AKSI */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={fetchMonitoringData}
                    className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3.5 py-2 rounded-lg transition-colors"
                    type="button"
                  >
                    Refresh
                  </button>

                  <button
                    onClick={exportToExcel}
                    className="flex-1 sm:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm whitespace-nowrap"
                    type="button"
                    title="Download Data Absensi ke Excel"
                  >
                    📥 Export Excel
                  </button>
                </div>
              </div>
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
                      Nama Pegawai
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Nama Mitra
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Unit Kerja
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Login / Absen Terakhir
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Tag Lokasi Absen
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                      Titik Lokasi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                  {isLoadingMonitoring ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-8 text-center text-gray-400 animate-pulse text-sm"
                      >
                        Memuat data absensi...
                      </td>
                    </tr>
                  ) : filteredMonitoringData.length > 0 ? (
                    filteredMonitoringData.map((log: any, index: number) => (
                      <tr
                        key={log.nik || index}
                        className="hover:bg-blue-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-gray-700">
                          {log.nik}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-bold text-gray-800">
                          {log.nama}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-bold text-emerald-600">
                          {log.nama_mitra || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {log.unit_kerja ? (
                            <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold">
                              {log.unit_kerja}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600 font-mono">
                          {log.last_login_at ? (
                            new Date(log.last_login_at).toLocaleString(
                              "id-ID",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )
                          ) : (
                            <span className="text-red-400 italic text-xs">
                              Belum Absen / Login
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          {log.tag_lokasi ? (
                            <span className="font-semibold text-emerald-600">
                              {log.tag_lokasi}
                            </span>
                          ) : (
                            <span className="italic text-gray-400">
                              Belum ada lokasi
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-center">
                          {log.tag_lokasi ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                log.tag_lokasi
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors"
                            >
                              Lihat di Maps
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                      >
                        <span className="text-3xl block mb-2">📍</span>
                        Tidak ada data pegawai non-fronting yang sesuai dengan
                        kriteria pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: DAFTAR MITRA KERJASAMA */}
      {activeMenu === "mitra" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-4 sm:p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 sm:gap-4">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                🤝 Daftar Mitra Kerjasama
              </h2>

              <form
                onSubmit={handleMitraSearchSubmit}
                className="flex gap-2 w-full md:w-auto"
              >
                <input
                  type="text"
                  placeholder="Cari Kode atau Nama Mitra..."
                  value={mitraSearch}
                  onChange={(e) => setMitraSearch(e.target.value)}
                  className="px-3 py-2 rounded-lg text-base md:text-sm bg-gray-700 text-white placeholder-gray-400 outline-none flex-1 sm:w-64 border border-gray-600 focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shrink-0"
                >
                  Cari
                </button>
              </form>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap">
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      No
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Kode Mitra
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Nama Mitra
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Kontak / Email
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Alamat
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                      Total Pegawai Assigned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 whitespace-nowrap">
                  {isLoadingMitra ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-8 text-center text-gray-400 animate-pulse text-sm"
                      >
                        Memuat data mitra...
                      </td>
                    </tr>
                  ) : mitraData.length > 0 ? (
                    mitraData.map((item: any, index: number) => (
                      <tr
                        key={item.id || index}
                        className="hover:bg-purple-50/40 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-semibold text-gray-700">
                          <span className="bg-gray-100 text-gray-800 font-mono px-2 py-1 rounded text-xs">
                            {item.kode_mitra}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm font-bold text-gray-900">
                          {item.nama_mitra}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600">
                          <div>{item.email}</div>
                          <div className="text-xs text-gray-400 font-mono">
                            {item.no_telp}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-600 max-w-xs truncate">
                          {item.alamat_mitra || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 text-sm text-center">
                          <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 font-black px-3 py-1 rounded-full text-xs sm:text-sm border border-blue-200">
                            👥 {item.total_pegawai || 0} Pegawai
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
                        <span className="text-3xl block mb-2">🤝</span>
                        Tidak ada data mitra yang ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </RoleSidebarLayout>
  );
}

export default function GuestDashboard() {
  return (
    <SessionProvider>
      <GuestDashboardContent />
    </SessionProvider>
  );
}