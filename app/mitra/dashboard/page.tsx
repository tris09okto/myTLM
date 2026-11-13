"use client";

import { useState, useEffect, FormEvent } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";

export const dynamic = "force-dynamic";

function getTodayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatTanggalIndonesia(dateStr: string): string {
  if (!dateStr) return "-";
  const [year, month, day] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dateObj);
}

function getGoogleMapsUrl(lokasiStr: string): string {
  if (!lokasiStr) return "#";
  const coordMatch = lokasiStr.trim().match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  const query = coordMatch ? `${coordMatch[1]},${coordMatch[2]}` : lokasiStr.replace(/\n/g, " ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function getAssetUrl(fileValue: string, fallbackDir: string): string {
  if (!fileValue) return "#";
  return fileValue.startsWith("http") ? fileValue : `${fallbackDir}/${fileValue}`;
}

function StatusKehadiranBadge({
  status,
  jenisIzin,
  sudahPulang,
}: {
  status: string;
  jenisIzin?: string;
  sudahPulang?: boolean;
}) {
  if (status === "HADIR") {
    return (
      <span className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide whitespace-nowrap bg-emerald-50 text-emerald-700 border border-emerald-200 ring-1 ring-emerald-500/10 shadow-2xs">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
        </span>
        <span>{sudahPulang ? "Hadir • Pulang" : "Hadir"}</span>
      </span>
    );
  }

  if (status === "IZIN") {
    return (
      <span className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide whitespace-nowrap bg-amber-50 text-amber-700 border border-amber-200 ring-1 ring-amber-500/10 shadow-2xs capitalize">
        <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>{jenisIzin || "Izin"}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide whitespace-nowrap bg-rose-50 text-rose-700 border border-rose-200 ring-1 ring-rose-500/10 shadow-2xs">
      <svg className="w-3.5 h-3.5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Belum Absen</span>
    </span>
  );
}

function MitraDashboardContent() {
  const { data: session, status } = useSession();

  // --- STATE NAVIGASI & FILTER ---
  const [activeMenu, setActiveMenu] = useState<"absensi" | "pegawai">("absensi");
  const [todayDate, setTodayDate] = useState<string>(() => getTodayJakarta());
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // --- STATE DATA ---
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMitraData = async () => {
    const userSession = session?.user as any;
    const activeUsername = userSession?.username || userSession?.name || "";
    const activeEmail = userSession?.email || "";
    const activeKodeMitra = userSession?.kode_mitra || "";
    const activeIdMitra = userSession?.id_mitra || "";

    if (!activeUsername && !activeEmail && !activeKodeMitra && !activeIdMitra) return;

    const currentToday = getTodayJakarta();
    setTodayDate(currentToday);
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        username: activeUsername,
        email: activeEmail,
        kode_mitra: activeKodeMitra,
        id_mitra: String(activeIdMitra),
        date: currentToday,
      });

      const res = await fetch(`/api/mitra/dashboard?${params.toString()}`);
      const result = await res.json();

      if (!result.success) throw new Error(result.error || "Gagal memuat data mitra");
      setDashboardData(result);
      if (result.tanggal) {
        setTodayDate(result.tanggal);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchMitraData();
    }
  }, [session]);

  const handleRefresh = (e: FormEvent) => {
    e.preventDefault();
    fetchMitraData();
  };

  const filteredPegawaiList = (dashboardData?.pegawaiList || []).filter((pegawai: any) => {
    const matchesSearch =
      String(pegawai.nama || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(pegawai.nik || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(pegawai.unit_kerja || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === "ALL" || pegawai.status_kehadiran === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // --- EXPORT DATA ABSENSI & IZIN HARI INI KE EXCEL ---
  const exportToExcel = () => {
    if (!filteredPegawaiList || filteredPegawaiList.length === 0) {
      alert("Tidak ada data absensi hari ini untuk diexport.");
      return;
    }

    const headers: string[] = [
      "No",
      "Tanggal",
      "NIK",
      "Nama Pegawai",
      "Unit Kerja",
      "Status Kehadiran",
      "Waktu Masuk",
      "Waktu Keluar",
      "Keterangan Izin / Sakit",
      "Lokasi Absensi",
    ];

    const rows: string[][] = filteredPegawaiList.map((pegawai: any, index: number) => {
      const no = String(index + 1);
      const tanggal = `"${todayDate}"`;
      const nik = `'${pegawai.nik || ""}`;
      const nama = `"${String(pegawai.nama || "").replace(/"/g, '""')}"`;
      const unitKerja = `"${String(pegawai.unit_kerja || "-").replace(/"/g, '""')}"`;
      const statusKehadiran = `"${String(pegawai.status_kehadiran || "BELUM_ABSEN")}"`;
      const waktuMasuk = `"${pegawai.status_kehadiran === "HADIR" && pegawai.waktu_masuk ? pegawai.waktu_masuk : "-"}"`;
      const waktuKeluar = `"${pegawai.status_kehadiran === "HADIR" && pegawai.waktu_keluar ? pegawai.waktu_keluar : "-"}"`;
      const ketIzin =
        pegawai.status_kehadiran === "IZIN"
          ? `"${String(pegawai.jenis_izin || "IZIN")} - ${String(pegawai.alasan_izin || "-").replace(/"/g, '""')}"`
          : `"-"`;
      const lokasiAbsen = `"${
        pegawai.status_kehadiran === "HADIR" && pegawai.lokasi_absen
          ? String(pegawai.lokasi_absen).replace(/\n/g, ", ").replace(/"/g, '""')
          : "-"
      }"`;

      return [
        no,
        tanggal,
        nik,
        nama,
        unitKerja,
        statusKehadiran,
        waktuMasuk,
        waktuKeluar,
        ketIzin,
        lokasiAbsen,
      ];
    });

    const headerString = headers.join(",");
    const rowStrings = rows.map((row: string[]) => row.join(","));
    const csvContent = [headerString, ...rowStrings].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Absensi_Mitra_${dashboardData?.mitra?.kode_mitra || "Report"}_${todayDate}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (status === "loading" || (isLoading && !dashboardData)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-600 font-medium">
        Memuat Dashboard Mitra...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-100">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a
          href="/login"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Login Sekarang
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* SIDEBAR ROLE MITRA */}
      <div className="w-72 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-800 text-center">
          <h2 className="text-xl font-black text-blue-400 tracking-wider">MITRA PORTAL</h2>
          <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">
            {dashboardData?.mitra?.nama_mitra || (isLoading ? "Memuat Mitra..." : "-")}
          </p>
        </div>

        <div className="p-4 flex-grow space-y-2">
          <button
            type="button"
            onClick={() => setActiveMenu("absensi")}
            className={`w-full text-left px-4 py-3 rounded-md font-bold transition-colors ${
              activeMenu === "absensi"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            📊 MONITORING ABSENSI
          </button>

          <button
            type="button"
            onClick={() => setActiveMenu("pegawai")}
            className={`w-full text-left px-4 py-3 rounded-md font-bold transition-colors ${
              activeMenu === "pegawai"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            👥 DAFTAR ANGGOTA TIM
          </button>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-4 px-4 text-sm font-bold transition-colors"
          type="button"
        >
          LOGOUT
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* HEADER */}
        <div className="mb-8 border-b pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 uppercase">
              {activeMenu === "absensi" && "Monitoring Kehadiran & Izin Pegawai (Hari Ini)"}
              {activeMenu === "pegawai" && "Master Data Pegawai Assigned Mitra"}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <p className="text-xs text-gray-500">
                Kode Mitra:{" "}
                <b className="font-mono text-blue-600">
                  {dashboardData?.mitra?.kode_mitra || "-"}
                </b>
              </p>
              <span className="text-gray-300">|</span>
              <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
                📅 Hari Ini: {formatTanggalIndonesia(todayDate)}
              </span>
            </div>
          </div>
          <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
            User Login: <b className="text-blue-600 uppercase">{session?.user?.name}</b>
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 font-semibold flex justify-between items-center">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-700 font-bold hover:text-red-900">
              X
            </button>
          </div>
        )}

        {/* SUMMARY CARDS (PER TANGGAL HARI INI) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm text-center">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
              Total Pegawai Mitra
            </h3>
            <h4 className="text-2xl font-black text-slate-800">
              {dashboardData?.stats?.totalPegawai || 0}{" "}
              <span className="text-xs font-semibold text-gray-400">Orang</span>
            </h4>
          </div>

          <div className="bg-white p-5 rounded-xl border border-emerald-200 shadow-sm text-center bg-emerald-50/30">
            <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">
              Hadir Hari Ini
            </h3>
            <h4 className="text-2xl font-black text-emerald-600">
              {dashboardData?.stats?.totalHadir || 0}{" "}
              <span className="text-xs font-semibold text-gray-400">Orang</span>
            </h4>
          </div>

          <div className="bg-white p-5 rounded-xl border border-amber-200 shadow-sm text-center bg-amber-50/30">
            <h3 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">
              Izin / Sakit Hari Ini
            </h3>
            <h4 className="text-2xl font-black text-amber-600">
              {dashboardData?.stats?.totalIzin || 0}{" "}
              <span className="text-xs font-semibold text-gray-400">Orang</span>
            </h4>
          </div>

          <div className="bg-white p-5 rounded-xl border border-rose-200 shadow-sm text-center bg-rose-50/30">
            <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">
              Belum Absen Hari Ini
            </h3>
            <h4 className="text-2xl font-black text-rose-600">
              {dashboardData?.stats?.totalBelumAbsen || 0}{" "}
              <span className="text-xs font-semibold text-gray-400">Orang</span>
            </h4>
          </div>
        </div>

        {/* VIEW 1: MONITORING ABSENSI & IZIN HARI INI */}
        {activeMenu === "absensi" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-slate-900 p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    📍 Status Kehadiran & Izin Pegawai
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Data kehadiran dari tabel absensi & izin per tanggal{" "}
                    <b className="text-blue-400">{todayDate}</b>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-800 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700 focus:border-blue-500"
                  >
                    <option value="ALL">Semua Status (Hadir, Izin, Belum)</option>
                    <option value="HADIR">Hadir Hari Ini</option>
                    <option value="IZIN">Izin / Sakit</option>
                    <option value="BELUM_ABSEN">Belum Absen</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Cari NIK / Nama / Unit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm bg-slate-800 text-white outline-none border border-slate-700 w-48 sm:w-56 focus:border-blue-500"
                  />

                  <span className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-800 text-blue-300 border border-slate-700 select-none whitespace-nowrap">
                    📅 {todayDate}
                  </span>

                  <button
                    onClick={handleRefresh}
                    type="button"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3.5 py-2 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Refresh
                  </button>

                  <button
                    onClick={exportToExcel}
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    📥 Export Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider">
                      <th className="px-5 py-4 font-bold whitespace-nowrap">No</th>
                      <th className="px-5 py-4 font-bold whitespace-nowrap">NIK</th>
                      <th className="px-5 py-4 font-bold whitespace-nowrap">Nama Pegawai</th>
                      <th className="px-5 py-4 font-bold whitespace-nowrap">Unit Kerja / Jabatan</th>
                      <th className="px-5 py-4 font-bold text-center whitespace-nowrap min-w-[155px]">
                        Status Hari Ini
                      </th>
                      <th className="px-5 py-4 font-bold whitespace-nowrap">
                        Waktu Masuk / Keluar & Keterangan
                      </th>
                      <th className="px-5 py-4 font-bold whitespace-nowrap">Lokasi Absensi</th>
                      <th className="px-5 py-4 font-bold text-center whitespace-nowrap min-w-[165px]">
                        Lampiran / Maps
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-400 animate-pulse">
                          Memuat data absensi & izin hari ini...
                        </td>
                      </tr>
                    ) : filteredPegawaiList.length > 0 ? (
                      filteredPegawaiList.map((item: any, index: number) => (
                        <tr key={item.id || index} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {index + 1}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-gray-700 font-mono whitespace-nowrap">
                            {item.nik}
                          </td>
                          <td className="px-5 py-4 text-sm font-bold text-gray-900 capitalize">
                            {item.nama}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            <div className="font-medium text-gray-800">{item.unit_kerja || "-"}</div>
                            <div className="text-xs text-gray-400">{item.jabatan || "PEGAWAI"}</div>
                          </td>
                          <td className="px-5 py-4 text-sm text-center whitespace-nowrap">
                            <StatusKehadiranBadge
                              status={item.status_kehadiran}
                              jenisIzin={item.jenis_izin}
                              sudahPulang={Boolean(item.waktu_keluar)}
                            />
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600">
                            {item.status_kehadiran === "HADIR" ? (
                              <div className="space-y-1 font-mono text-xs whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  <span className="text-emerald-700 font-bold">Masuk:</span>
                                  <span className="text-gray-800">{item.waktu_masuk || "-"} WIB</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                  <span className="text-slate-600 font-bold">Keluar:</span>
                                  <span className="text-gray-700">
                                    {item.waktu_keluar ? `${item.waktu_keluar} WIB` : "Belum Pulang"}
                                  </span>
                                </div>
                              </div>
                            ) : item.status_kehadiran === "IZIN" ? (
                              <div>
                                <span className="font-semibold text-amber-800 block">
                                  Alasan: {item.alasan_izin || "-"}
                                </span>
                                {item.approved_by && (
                                  <span className="text-xs text-gray-400">
                                    Disetujui oleh: {item.approved_by}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs whitespace-nowrap">
                                Belum Absen Hari Ini
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-gray-600 max-w-xs">
                            {item.status_kehadiran === "HADIR" && item.lokasi_absen ? (
                              <p
                                className="text-xs text-gray-700 line-clamp-2 leading-relaxed"
                                title={item.lokasi_absen}
                              >
                                {item.lokasi_absen.replace(/\n/g, ", ")}
                              </p>
                            ) : (
                              <span className="italic text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-sm text-center whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              {item.status_kehadiran === "HADIR" && item.lokasi_absen && (
                                <a
                                  href={getGoogleMapsUrl(item.lokasi_absen)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap"
                                >
                                  📍 Maps
                                </a>
                              )}
                              {item.status_kehadiran === "HADIR" && item.foto_masuk && (
                                <a
                                  href={getAssetUrl(item.foto_masuk, "/uploads/pegawai/absensi")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap"
                                >
                                  📷 Foto Masuk
                                </a>
                              )}
                              {item.status_kehadiran === "HADIR" && item.foto_keluar && (
                                <a
                                  href={getAssetUrl(item.foto_keluar, "/uploads/pegawai/absensi")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-700 hover:text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap"
                                >
                                  📷 Foto Pulang
                                </a>
                              )}
                              {item.status_kehadiran === "IZIN" && item.file_bukti_izin && (
                                <a
                                  href={getAssetUrl(item.file_bukti_izin, "/uploads/izin")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-600 hover:text-white px-2.5 py-1 rounded-md text-xs font-bold transition-colors whitespace-nowrap"
                                >
                                  📎 Bukti Izin
                                </a>
                              )}
                              {item.status_kehadiran === "BELUM_ABSEN" && (
                                <span className="text-gray-300">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                          <span className="text-3xl block mb-2">📋</span>
                          Tidak ada data pegawai hari ini yang sesuai dengan kriteria filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DAFTAR ANGGOTA TIM MITRA */}
        {activeMenu === "pegawai" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-slate-900 p-5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                👥 Daftar Seluruh Pegawai Terdaftar pada Mitra
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold">No</th>
                    <th className="px-6 py-4 font-bold">NIK</th>
                    <th className="px-6 py-4 font-bold">Nama Pegawai</th>
                    <th className="px-6 py-4 font-bold">Unit Kerja</th>
                    <th className="px-6 py-4 font-bold">Area Penempatan</th>
                    <th className="px-6 py-4 font-bold">Kontak / WhatsApp</th>
                    <th className="px-6 py-4 font-bold text-center">Status Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(dashboardData?.pegawaiList || []).map((pegawai: any, idx: number) => (
                    <tr key={pegawai.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-700 font-mono">
                        {pegawai.nik}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900 capitalize">
                        {pegawai.nama}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{pegawai.unit_kerja || "-"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {pegawai.area_penempatan || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {pegawai.no_whatsapp || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${
                            pegawai.status === "AKTIF"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {pegawai.status || "AKTIF"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MitraDashboard() {
  return (
    <SessionProvider>
      <MitraDashboardContent />
    </SessionProvider>
  );
}