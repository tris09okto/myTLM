"use client";

import { useState, useEffect } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";

export const dynamic = "force-dynamic";

function GuestDashboardContent() {
  const { data: session, status } = useSession();
  
  // --- STATE NAVIGASI MENU ---
  const [activeMenu, setActiveMenu] = useState<"dashboard" | "monitoring" | "mitra">("dashboard");

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
    const activeUsername = session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/guest/dashboard?username=${activeUsername}&filterBy=${filterBy}&keyword=${encodeURIComponent(keyword)}`);
      const result = await res.json();

      if (!result.success) throw new Error(result.error || "Gagal memuat data guest");
      setDashboardData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. FETCH MONITORING ABSENSI PEGAWAI NON-FRONTING
  const fetchMonitoringData = async () => {
    const activeUsername = session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    setIsLoadingMonitoring(true);
    try {
      const res = await fetch(
        `/api/guest/monitoring?username=${activeUsername}&date=${monitoringDate}&search=${encodeURIComponent(monitoringSearch)}&mitra=${encodeURIComponent(selectedMitraFilter)}`
      );
      const result = await res.json();

      if (!result.success) throw new Error(result.error || "Gagal memuat data monitoring");
      setMonitoringData(result.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingMonitoring(false);
    }
  };

  // 3. FETCH DAFTAR MITRA
  const fetchMitraData = async () => {
    const activeUsername = session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    setIsLoadingMitra(true);
    try {
      const res = await fetch(`/api/guest/mitra?username=${activeUsername}&search=${encodeURIComponent(mitraSearch)}`);
      const result = await res.json();

      if (!result.success) throw new Error(result.error || "Gagal memuat data mitra");
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
        // Load opsi daftar mitra untuk dropdown filter jika belum ada
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

    // Header Kolom Excel
    const headers = ["No", "NIK", "Nama Pegawai", "Nama Mitra", "Unit Kerja", "Login / Absen Terakhir", "Tag Lokasi Absen"];
    
    // Formatting Baris Data (Aman untuk Excel)
    const rows = filteredMonitoringData.map((log: any, index: number) => [
      index + 1,
      `'${log.nik || ''}`, // Petik tunggal agar NIK tidak diubah format ke eksponensial oleh Excel
      `"${(log.nama || '').replace(/"/g, '""')}"`,
      `"${(log.nama_mitra || '-').replace(/"/g, '""')}"`,
      `"${(log.unit_kerja || '-').replace(/"/g, '""')}"`,
      `"${log.last_login_at ? new Date(log.last_login_at).toLocaleString('id-ID') : 'Belum Absen'}"`,
      `"${(log.tag_lokasi || '-').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    // Tambahkan BOM (\ufeff) agar Excel membaca format UTF-8 dengan rapi
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Monitoring_Absensi_Pegawai_${monitoringDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
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

  if (status === "loading" || (activeMenu === "dashboard" && isLoading && !dashboardData)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-600 font-medium">
        Memuat Dashboard Guest...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-100">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a href="/login" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
          Login Sekarang
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* SIDEBAR GUEST */}
      <div className="w-72 bg-gray-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-gray-700 text-center tracking-wider text-emerald-400">
          GUEST AREA
        </div>
        
        <div className="p-4 flex-grow space-y-2">
          <button 
            type="button"
            onClick={() => setActiveMenu("dashboard")}
            className={`w-full text-left px-4 py-3 rounded-md font-bold transition-colors ${
              activeMenu === "dashboard" ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            📊 DASHBOARD UTAMA
          </button>

          <button 
            type="button"
            onClick={() => setActiveMenu("monitoring")}
            className={`w-full text-left px-4 py-3 rounded-md font-bold transition-colors ${
              activeMenu === "monitoring" ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            📍 MONITORING ABSENSI
          </button>

          <button 
            type="button"
            onClick={() => setActiveMenu("mitra")}
            className={`w-full text-left px-4 py-3 rounded-md font-bold transition-colors ${
              activeMenu === "mitra" ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            🤝 DAFTAR MITRA
          </button>
        </div>

        <button 
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full bg-red-600 hover:bg-red-700 text-white py-4 px-4 text-sm font-bold transition-colors"
          type="button"
        >
          LOGOUT
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-8 overflow-y-auto">
        
        {/* HEADER */}
        <div className="mb-8 border-b pb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800 uppercase">
            {activeMenu === "dashboard" && "Ringkasan Area & Omset Fronting"}
            {activeMenu === "monitoring" && "Monitoring Absensi Pegawai Non-Fronting"}
            {activeMenu === "mitra" && "Daftar Mitra Bekerja Sama & Jumlah Pegawai"}
          </h1>
          <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
            Login sebagai Guest: <b className="text-emerald-600 uppercase">{dashboardData?.guest?.nama_guest || session?.user?.name}</b>
          </span>
        </div>

        {error && (
           <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 font-semibold flex justify-between items-center">
             <span>⚠️ {error}</span>
             <button onClick={() => setError(null)} className="text-red-700 font-bold hover:text-red-900">X</button>
           </div>
        )}

        {/* VIEW 1: DASHBOARD UTAMA */}
        {activeMenu === "dashboard" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100 mb-6">
              <div className="flex-1 p-5 text-center hover:bg-emerald-50/50 transition-colors">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Fronting</h3>
                  <h4 className="text-2xl font-black text-emerald-600">
                  {dashboardData?.totalFronting || 0} <span className="text-xs font-bold text-gray-400">Orang</span>
                  </h4>
              </div>

              <div className="flex-1 p-5 text-center hover:bg-blue-50/50 transition-colors">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kanwil Terdaftar</h3>
                  <h4 className="text-2xl font-black text-blue-600">
                  {dashboardData?.totalKanwil || 0} <span className="text-xs font-bold text-gray-400">Titik</span>
                  </h4>
              </div>

              <div className="flex-1 p-5 text-center hover:bg-purple-50/50 transition-colors">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Area Terdaftar</h3>
                  <h4 className="text-2xl font-black text-purple-600">
                  {dashboardData?.totalArea || 0} <span className="text-xs font-bold text-gray-400">Titik</span>
                  </h4>
              </div>

              <div className="flex-1 p-5 text-center hover:bg-amber-50/50 transition-colors">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Penempatan</h3>
                  <h4 className="text-2xl font-black text-amber-500">
                  {dashboardData?.totalPenempatan || 0} <span className="text-xs font-bold text-gray-400">Titik</span>
                  </h4>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-800 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  👥 Daftar Fronting & Omset
                </h2>
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <select 
                    value={filterBy} 
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-600"
                    >
                    <option value="nama">Filter Berdasarkan Nama Fronting</option>
                    <option value="area">Filter Berdasarkan Area</option>
                    <option value="kanwil">Filter Berdasarkan Kanwil</option>
                    <option value="penempatan">Filter Berdasarkan Penempatan</option>
                    </select>

                    <div className="flex gap-2">
                    <input 
                        type="text"
                        placeholder="Masukkan kata kunci..."
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        className="px-3 py-2 rounded-lg text-sm bg-gray-700 text-white placeholder-gray-400 outline-none w-full sm:w-48 border border-gray-600"
                    />
                    <button 
                        type="submit"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                    >
                        Cari
                    </button>
                    </div>
                </form>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">No</th>
                      <th className="px-6 py-4 font-bold">NIK</th>
                      <th className="px-6 py-4 font-bold">Nama Fronting</th>
                      <th className="px-6 py-4 font-bold">Kanwil</th>
                      <th className="px-6 py-4 font-bold">Area</th>
                      <th className="px-6 py-4 font-bold">Penempatan</th>
                      <th className="px-6 py-4 font-bold text-right">Total Omset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoading ? (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat data...</td></tr>
                    ) : dashboardData?.team?.length > 0 ? (
                      dashboardData.team.map((member: any, index: number) => (
                        <tr key={member.nik || index} className="hover:bg-emerald-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-700">{member.nik}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-800">{member.nama}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{member.kanwil || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{member.area || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{member.penempatan || '-'}</td>
                          <td className="px-6 py-4 text-sm font-black text-emerald-700 text-right">
                            {formatRupiah(member.omset)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                          <span className="text-3xl block mb-2">📭</span>
                          Tidak ada data fronting yang sesuai dengan kriteria pencarian.
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
              <div className="bg-gray-800 p-5 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  📍 Data Absensi & Lokasi Pegawai Non-Fronting
                </h2>
                
                {/* OPSI SEARCH, FILTER MITRA, TANGGAL & BUTTON EXPORT EXCEL */}
                <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                  
                  {/* FILTER SELEKSI MITRA / SEMUA PEGAWAI */}
                  <select
                    value={selectedMitraFilter}
                    onChange={(e) => setSelectedMitraFilter(e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-600 focus:border-emerald-500"
                  >
                    <option value="ALL">Semua Pegawai / Semua Mitra</option>
                    {mitraData.map((m: any) => (
                      <option key={m.id || m.kode_mitra} value={m.id}>
                        {m.nama_mitra} ({m.kode_mitra})
                      </option>
                    ))}
                  </select>

                  {/* INPUT PENCARIAN NIK / NAMA / MITRA */}
                  <form onSubmit={handleMonitoringSearchSubmit} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Cari NIK / Nama / Mitra..." 
                      value={monitoringSearch}
                      onChange={(e) => setMonitoringSearch(e.target.value)}
                      className="px-3 py-2 rounded-lg text-sm bg-gray-700 text-white outline-none border border-gray-600 focus:border-emerald-500 w-44 sm:w-56"
                    />
                  </form>

                  {/* FILTER TANGGAL */}
                  <input 
                    type="date" 
                    value={monitoringDate}
                    onChange={(e) => setMonitoringDate(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm bg-gray-700 text-white outline-none border border-gray-600 focus:border-emerald-500"
                  />

                  {/* TOMBOL REFRESH */}
                  <button 
                    onClick={fetchMonitoringData}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3 py-2 rounded-lg transition-colors"
                    type="button"
                  >
                    Refresh
                  </button>

                  {/* TOMBOL DOWNLOAD EXCEL */}
                  <button 
                    onClick={exportToExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                    type="button"
                    title="Download Data Absensi ke Excel"
                  >
                    📥 Export Excel
                  </button>

                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">No</th>
                      <th className="px-6 py-4 font-bold">NIK</th>
                      <th className="px-6 py-4 font-bold">Nama Pegawai</th>
                      <th className="px-6 py-4 font-bold">Nama Mitra</th>
                      <th className="px-6 py-4 font-bold">Unit Kerja</th>
                      <th className="px-6 py-4 font-bold">Login / Absen Terakhir</th>
                      <th className="px-6 py-4 font-bold">Tag Lokasi Absen</th>
                      <th className="px-6 py-4 font-bold text-center">Titik Lokasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingMonitoring ? (
                      <tr><td colSpan={8} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat data absensi...</td></tr>
                    ) : filteredMonitoringData.length > 0 ? (
                      filteredMonitoringData.map((log: any, index: number) => (
                        <tr key={log.nik || index} className="hover:bg-blue-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-700">{log.nik}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-800">{log.nama}</td>
                          <td className="px-6 py-4 text-sm font-bold text-emerald-600">
                            {log.nama_mitra || '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {log.unit_kerja ? (
                              <span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold">{log.unit_kerja}</span>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                            {log.last_login_at ? new Date(log.last_login_at).toLocaleString('id-ID', { 
                              day: '2-digit', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit' 
                            }) : <span className="text-red-400 italic text-xs">Belum Absen / Login</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {log.tag_lokasi ? (
                              <span className="font-semibold text-emerald-600">{log.tag_lokasi}</span>
                            ) : <span className="italic text-gray-400">Belum ada lokasi</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            {log.tag_lokasi ? (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(log.tag_lokasi)}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-block bg-blue-100 text-blue-700 hover:bg-blue-600 hover:text-white px-3 py-1 rounded-md text-xs font-bold transition-colors"
                              >
                                Lihat di Maps
                              </a>
                            ) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                          <span className="text-3xl block mb-2">📍</span>
                          Tidak ada data pegawai non-fronting yang sesuai dengan kriteria pencarian.
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
              <div className="bg-gray-800 p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  🤝 Daftar Mitra Kerjasama
                </h2>
                
                <form onSubmit={handleMitraSearchSubmit} className="flex gap-2 w-full md:w-auto">
                  <input 
                    type="text" 
                    placeholder="Cari Kode atau Nama Mitra..." 
                    value={mitraSearch}
                    onChange={(e) => setMitraSearch(e.target.value)}
                    className="px-3 py-2 rounded-lg text-sm bg-gray-700 text-white outline-none w-full sm:w-64 border border-gray-600 focus:border-emerald-500"
                  />
                  <button 
                    type="submit" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                  >
                    Cari
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">No</th>
                      <th className="px-6 py-4 font-bold">Kode Mitra</th>
                      <th className="px-6 py-4 font-bold">Nama Mitra</th>
                      <th className="px-6 py-4 font-bold">Kontak / Email</th>
                      <th className="px-6 py-4 font-bold">Alamat</th>
                      <th className="px-6 py-4 font-bold text-center">Status</th>
                      <th className="px-6 py-4 font-bold text-center">Total Pegawai Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingMitra ? (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat data mitra...</td></tr>
                    ) : mitraData.length > 0 ? (
                      mitraData.map((item: any, index: number) => (
                        <tr key={item.id || index} className="hover:bg-purple-50/40 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                            <span className="bg-gray-100 text-gray-800 font-mono px-2 py-1 rounded text-xs">{item.kode_mitra}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.nama_mitra}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div>{item.email}</div>
                            <div className="text-xs text-gray-400 font-mono">{item.no_telp}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{item.alamat_mitra || '-'}</td>
                          <td className="px-6 py-4 text-sm text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              item.status === 'ACTIVE' 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            <span className="inline-flex items-center justify-center bg-blue-50 text-blue-700 font-black px-3 py-1 rounded-full text-sm border border-blue-200">
                              👥 {item.total_pegawai || 0} Pegawai
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
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

      </div>
    </div>
  );
}

export default function GuestDashboard() {
  return (
    <SessionProvider>
      <GuestDashboardContent />
    </SessionProvider>
  );
}