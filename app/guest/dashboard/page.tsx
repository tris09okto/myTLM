"use client";

import { useState, useEffect } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";

function GuestDashboardContent() {
  const { data: session, status } = useSession();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // --- STATE FILTER & SEARCH ---
  const [filterBy, setFilterBy] = useState("nama");
  const [keyword, setKeyword] = useState("");

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

  useEffect(() => {
    if (session) {
      fetchGuestData();
    }
  }, [session, filterBy]); // Auto-fetch saat pilihan filter diubah

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGuestData();
  };

  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(angka);
  };

  const formatArea = (areaData: string) => {
    if (!areaData) return '-';
    try {
      const parsed = JSON.parse(areaData);
      return Array.isArray(parsed) ? parsed.join(', ') : parsed;
    } catch (e) {
      return String(areaData).replace(/[\[\]"]/g, '');
    }
  };

  if (status === "loading" || isLoading) {
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

  const filteredTeam = dashboardData?.team?.filter((member: any) => 
    member.nama?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.nik?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* SIDEBAR GUEST */}
      <div className="w-72 bg-gray-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-gray-700 text-center tracking-wider text-emerald-400">
          GUEST AREA
        </div>
        
        <div className="p-4 flex-grow space-y-1">
          <div className="w-full text-left px-4 py-3 rounded-md bg-gray-800 font-bold text-white">
            📊 DASHBOARD UTAMA
          </div>
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
            Ringkasan Area & Omset Fronting
          </h1>
          <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
            Login sebagai Guest: <b className="text-emerald-600 uppercase">{dashboardData?.guest?.nama_guest || session?.user?.name}</b>
          </span>
        </div>

        {error && (
           <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 font-semibold">
             ⚠️ {error}
           </div>
        )}

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100 mb-6">
  
            {/* KOLOM 1: TOTAL FRONTING */}
            <div className="flex-1 p-5 text-center hover:bg-emerald-50/50 transition-colors">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Fronting</h3>
                <h4 className="text-2xl font-black text-emerald-600">
                {dashboardData?.totalFronting || 0} <span className="text-xs font-bold text-gray-400">Orang</span>
                </h4>
            </div>

            {/* KOLOM 2: TOTAL KANWIL */}
            <div className="flex-1 p-5 text-center hover:bg-blue-50/50 transition-colors">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kanwil Terdaftar</h3>
                <h4 className="text-2xl font-black text-blue-600">
                {dashboardData?.totalKanwil || 0} <span className="text-xs font-bold text-gray-400">Titik</span>
                </h4>
            </div>

            {/* KOLOM 3: TOTAL AREA */}
            <div className="flex-1 p-5 text-center hover:bg-purple-50/50 transition-colors">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Area Terdaftar</h3>
                <h4 className="text-2xl font-black text-purple-600">
                {dashboardData?.totalArea || 0} <span className="text-xs font-bold text-gray-400">Titik</span>
                </h4>
            </div>

            {/* KOLOM 4: TOTAL PENEMPATAN */}
            <div className="flex-1 p-5 text-center hover:bg-amber-50/50 transition-colors">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Penempatan</h3>
                <h4 className="text-2xl font-black text-amber-500">
                {dashboardData?.totalPenempatan || 0} <span className="text-xs font-bold text-gray-400">Titik</span>
                </h4>
            </div>

            </div>

          {/* TABEL LIST FRONTING & OMSET */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                👥 Daftar Fronting & Omset
              </h2>
              {/* FORM PENCARIAN BERDASARKAN PILIHAN */}
                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <select 
                    value={filterBy} 
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 outline-none border border-gray-600"
                    >
                    {/* Tambahkan Nama Fronting sebagai opsi pertama */}
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