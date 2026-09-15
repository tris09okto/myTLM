"use client";

import { useState, useEffect, FormEvent } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages || 1);
  if (safeTotalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages = [];
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(safeTotalPages, currentPage + 2);

    if (currentPage <= 3) {
      endPage = Math.min(5, safeTotalPages);
    } else if (currentPage >= safeTotalPages - 2) {
      startPage = Math.max(1, safeTotalPages - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-2 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg gap-3">
      <span className="text-xs text-gray-500">
        Menampilkan halaman <b>{currentPage}</b> dari <b>{safeTotalPages}</b>
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Prev
        </button>
        {getPageNumbers().map((num) => (
          <button
            key={num}
            onClick={() => onPageChange(num)}
            className={`px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${
              currentPage === num
                ? "bg-green-600 text-white border-green-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === safeTotalPages}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

function SupervisorDashboardContent() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState("dashboard");
  
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE NOTIFIKASI ---
  const [notifikasiList, setNotifikasiList] = useState<any[]>([]);
  const [showNotifikasi, setShowNotifikasi] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotifikasi, setSelectedNotifikasi] = useState<any>(null);

  // --- STATE LAPORAN & ADUAN TIM ---
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [isLoadingLaporan, setIsLoadingLaporan] = useState(false);
  const [selectedLaporan, setSelectedLaporan] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState({ type: '', text: '' });

  // --- STATE SURVEY KUNJUNGAN ---
  const [surveyKeterangan, setSurveyKeterangan] = useState("");
  const [surveyFoto, setSurveyFoto] = useState<File | null>(null);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [surveyMsg, setSurveyMsg] = useState({ type: '', text: '' });

  // --- STATE STATUS GAJI / PEMASUKAN TIM ---
  const [gajiList, setGajiList] = useState<any[]>([]);
  const [isLoadingGaji, setIsLoadingGaji] = useState(false);
  const [searchGaji, setSearchGaji] = useState("");
  const [currentPageGaji, setCurrentPageGaji] = useState(1);
  const itemsPerPage = 10;

  // --- STATE GANTI PASSWORD SPV ---
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const filteredGaji = gajiList.filter((item: any) => {
    if (!searchGaji) return true;
    const keyword = searchGaji.toLowerCase();
    return (
      String(item.nama || "").toLowerCase().includes(keyword) ||
      String(item.unit_kerja || "").toLowerCase().includes(keyword) ||
      String(item.status || "").toLowerCase().includes(keyword)
    );
  });

  const indexOfLastGaji = currentPageGaji * itemsPerPage;
  const indexOfFirstGaji = indexOfLastGaji - itemsPerPage;
  const currentGajiList = filteredGaji.slice(indexOfFirstGaji, indexOfLastGaji);
  const totalPagesGaji = Math.ceil(filteredGaji.length / itemsPerPage);

  /*const fetchGajiTim = async () => {
    setIsLoadingGaji(true);
    try {
      const userName = session?.user?.name || (session?.user as any)?.username || ""; 
      if (!userName) return;

      const res = await fetch(`/api/spv/gaji-tim?username=${userName}`);
      const result = await res.json();
      
      if (result.success) {
        setGajiList(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil data gaji tim", error);
    } finally {
      setIsLoadingGaji(false);
    }
  };*/

  const formatArea = (areaData: string) => {
    if (!areaData) return '-';
    try {
      const parsed = JSON.parse(areaData);
      return Array.isArray(parsed) ? parsed.join(', ') : parsed;
    } catch (e) {
      return String(areaData).replace(/[\[\]"]/g, '');
    }
  };

  const parseDeskripsi = (desc: string) => {
    if (!desc) return { pertanyaan: '', jawaban: '' };
    const parts = desc.split('\n\nJawaban :\n');
    const rawPertanyaan = parts[0]?.replace('Pertanyaan :\n', '') || '';
    const rawJawaban = parts[1] || '';
    
    return {
      pertanyaan: rawPertanyaan,
      jawaban: rawJawaban.includes('[Menunggu balasan') ? '' : rawJawaban,
      isAnswered: !rawJawaban.includes('[Menunggu balasan') && rawJawaban.trim() !== ''
    };
  };

  const fetchNotifikasi = async () => {
    const activeUsername = session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    try {
      const response = await fetch(`/api/spv/notifikasi-absensi?username=${activeUsername}`);
      const result = await response.json();
      if (result.success) {
        setNotifikasiList(result.data);
        setUnreadCount(result.data.filter((n: any) => Number(n.is_read) === 0).length);
      }
    } catch (error) {
      console.error("Gagal menarik notifikasi:", error);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Password Baru dan Konfirmasi Password tidak cocok!' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password baru minimal harus 6 karakter.' });
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const activeUsername = session?.user?.name || (session?.user as any)?.username;
      const res = await fetch('/api/spv/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: activeUsername, oldPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg({ type: 'success', text: 'Password Anda berhasil diperbarui!' });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMsg({ type: 'error', text: data.message || 'Gagal mengubah password.' });
      }
    } catch (error) {
      setPasswordMsg({ type: 'error', text: 'Terjadi kesalahan jaringan/sistem.' });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  useEffect(() => {
    const fetchSpvData = async () => {
      const activeUsername = session?.user?.name || (session?.user as any)?.username;
      if (!activeUsername) return;

      try {
        const response = await fetch(`/api/spv/dashboard?username=${activeUsername}`);
        const result = await response.json();

        if (!response.ok) throw new Error(result.error || "Gagal memuat data dashboard SPV");
        setDashboardData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingData(false);
      }
    };

    if (session) {
      fetchSpvData();
      fetchNotifikasi(); 
      
      const intervalId = setInterval(fetchNotifikasi, 30000); 
      return () => clearInterval(intervalId);
    }
  }, [session]);

  useEffect(() => {
    const fetchLaporan = async () => {
      const activeSpvName = dashboardData?.spv?.nama_leader || session?.user?.name;
      if (!activeSpvName || currentView !== 'laporan') return;

      setIsLoadingLaporan(true);
      try {
        const res = await fetch(`/api/spv/laporan-aduan?spvName=${encodeURIComponent(activeSpvName)}`);
        const result = await res.json();
        if (result.success) {
          setLaporanList(result.data);
        }
      } catch (e) {
        console.error("Gagal menarik data laporan tim", e);
      } finally {
        setIsLoadingLaporan(false);
      }
    };

    if (currentView === 'laporan') fetchLaporan();
    //if (currentView === 'status-gaji') fetchGajiTim();

  }, [currentView, dashboardData, session]);

  const handleOpenNotifikasi = async (item: any) => {
    setSelectedNotifikasi(item);
    setShowNotifikasi(false);

    if (Number(item.is_read) === 0) {
      setNotifikasiList(prev => prev.map(n => n.id === item.id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));

      try {
        await fetch('/api/spv/notifikasi-absensi', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id })
        });
      } catch (e) {
        console.error("Gagal memperbarui status baca notifikasi");
      }
    }
  };

  const handleTandaiSemuaDibaca = async () => {
    const activeUsername = session?.user?.name || (session?.user as any)?.username;
    setUnreadCount(0);
    setNotifikasiList(prev => prev.map(n => ({ ...n, is_read: 1 })));
    
    try {
      await fetch('/api/spv/notifikasi-absensi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: activeUsername })
      });
    } catch (e) {
      console.error("Gagal update status read");
    }
  };

  const handleOpenLaporan = (item: any) => {
    setSelectedLaporan(item);
    const parsed = parseDeskripsi(item.deskripsi);
    setReplyText(parsed.jawaban);
    setReplyMsg({ type: '', text: '' });
  };

  const handleSubmitReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    setReplyMsg({ type: '', text: '' });

    try {
      const res = await fetch('/api/spv/laporan-aduan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLaporan.id,
          answer: replyText
        })
      });

      const result = await res.json();
      if (result.success) {
        setReplyMsg({ type: 'success', text: 'Balasan berhasil dikirim!' });
        
        setLaporanList(prev => prev.map(l => {
          if (l.id === selectedLaporan.id) {
            const parts = l.deskripsi.split('\n\nJawaban :\n');
            return { ...l, deskripsi: `${parts[0]}\n\nJawaban :\n${replyText}` };
          }
          return l;
        }));

        setTimeout(() => setSelectedLaporan(null), 1500);
      } else {
        setReplyMsg({ type: 'error', text: result.message || 'Gagal mengirim balasan.' });
      }
    } catch (e) {
      setReplyMsg({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Handler Submit Survey Kunjungan
  const handleSubmitSurvey = async (e: FormEvent) => {
    e.preventDefault();
    setSurveyMsg({ type: '', text: '' });
    if (!surveyKeterangan.trim()) {
      setSurveyMsg({ type: 'error', text: 'Keterangan survey kunjungan tidak boleh kosong!' });
      return;
    }

    setIsSubmittingSurvey(true);
    try {
      const formData = new FormData();
      formData.append('keterangan', surveyKeterangan);
      formData.append('spv_username', session?.user?.name || (session?.user as any)?.username || '');
      formData.append('spv_nama', dashboardData?.spv?.nama_leader || session?.user?.name || '');
      if (surveyFoto) formData.append('foto', surveyFoto);

      const res = await fetch('/api/spv/survey-kunjungan', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (result.success) {
        setSurveyMsg({ type: 'success', text: 'Survey kunjungan berhasil dikirim dan diteruskan ke MO & HRD!' });
        setSurveyKeterangan("");
        setSurveyFoto(null);
        const fileInput = document.getElementById('foto-survey') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setSurveyMsg({ type: 'error', text: result.message || 'Gagal mengirim survey kunjungan.' });
      }
    } catch (error) {
      setSurveyMsg({ type: 'error', text: 'Terjadi kesalahan jaringan saat mengirim data.' });
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-600 font-medium">
        Memuat Dashboard Supervisor (SPV)...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-100">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a href="/api/auth/signin" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
          Login Sekarang
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* SIDEBAR SUPERVISOR (SPV) */}
      <div className="w-72 bg-gray-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-gray-700 text-center tracking-wider text-green-400">
          SUPERVISOR AREA
        </div>
        
        <div className="p-4 flex-grow overflow-y-auto space-y-1">
          <button 
            onClick={() => setCurrentView("dashboard")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'dashboard' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            📊 DASHBOARD UTAMA
          </button>

          <button 
            onClick={() => setCurrentView("laporan")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'laporan' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            📝 LAPORAN & ADUAN TIM
          </button>

          {/* MENU BARU SURVEY KUNJUNGAN */}
          <button 
            onClick={() => setCurrentView("survey-kunjungan")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'survey-kunjungan' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            🗺️ SURVEY KUNJUNGAN
          </button>

          <button 
            onClick={() => setCurrentView("status-gaji")} 
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'status-gaji' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            💰 STATUS GAJI TIM
          </button>

          <button 
            onClick={() => setCurrentView("pengaturan")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'pengaturan' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
          >
            🔑 PENGATURAN AKUN
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
      <div className="flex-1 p-8 overflow-y-auto relative">
        
        <div className="mb-8 border-b pb-4 flex justify-between items-center relative z-20">
          <h1 className="text-2xl font-bold text-gray-800 uppercase">
            {currentView === 'dashboard' && 'Ringkasan Anggota Tim Non-Fronting'}
            {currentView === 'laporan' && 'Laporan & Aduan Anggota Tim'}
            {currentView === 'survey-kunjungan' && 'Form Survey Kunjungan Lapangan'}
            {currentView === 'status-gaji' && 'Status Gaji & Penghasilan Tim'}
            {currentView === 'pengaturan' && 'Pengaturan Akun'}
          </h1>
          
          <div className="flex items-center gap-6">
            
            <div className="relative">
              <button 
                onClick={() => setShowNotifikasi(!showNotifikasi)}
                className="relative p-2 text-gray-500 hover:text-green-600 transition-colors focus:outline-none"
                title="Pesan Notifikasi"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifikasi && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                  <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      🔔 Pesan Notifikasi
                    </h4>
                    <button onClick={() => setShowNotifikasi(false)} className="text-gray-400 hover:text-white font-bold text-lg leading-none">✕</button>
                  </div>
                  
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 flex-1">
                    {notifikasiList.length > 0 ? (
                      notifikasiList.map((notif: any, idx: number) => {
                        const isRead = Number(notif.is_read) === 1;
                        return (
                          <div 
                            key={idx} 
                            onClick={() => handleOpenNotifikasi(notif)}
                            className={`p-4 transition-colors cursor-pointer ${isRead ? 'bg-white hover:bg-gray-50' : 'bg-green-50/70 hover:bg-green-100'}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold text-gray-800 text-sm flex gap-1 items-center">
                                {!isRead && <span className="w-2 h-2 rounded-full bg-red-500 block"></span>}
                                {notif.pengirim_role || 'Sistem'}
                              </span>
                              <span className="text-[10px] text-gray-500 font-medium">
                                {new Date(notif.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-gray-700 mt-1">
                              {notif.tipe_pesan}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                              {notif.konten}
                            </p>
                          </div>
                        )
                      })
                    ) : (
                      <div className="p-8 text-center flex flex-col items-center justify-center text-gray-500">
                        <span className="text-3xl mb-2">📭</span>
                        <p className="text-sm font-medium">Belum ada notifikasi baru.</p>
                      </div>
                    )}
                  </div>

                  {notifikasiList.length > 0 && unreadCount > 0 && (
                    <div className="border-t border-gray-100 p-2 bg-gray-50">
                      <button 
                        onClick={handleTandaiSemuaDibaca}
                        className="w-full py-2 text-xs font-bold text-green-700 hover:text-green-800 hover:bg-green-100 rounded transition-colors"
                      >
                        Tandai Semua Dibaca
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
              Login sebagai SPV: <b className="text-green-600 uppercase">{dashboardData?.spv?.nama_leader || session?.user?.name}</b>
            </span>

          </div>
        </div>

        {error && (
           <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 font-semibold">
             ⚠️ {error}
           </div>
        )}

        {/* 1. DASHBOARD UTAMA */}
        {currentView === 'dashboard' && !error && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 border-b pb-2">Area Penugasan SPV</h3>
                {isLoadingData ? <span className="text-gray-400 animate-pulse">Memuat...</span> : <h4 className="text-2xl font-bold text-gray-800 mt-1">{formatArea(dashboardData?.spv?.area)}</h4>}
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl shadow-sm border border-green-100 flex flex-col justify-center">
                <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider mb-2 border-b border-green-200 pb-2">Total Anggota Tim (Non-Fronting)</h3>
                {isLoadingData ? <span className="text-green-400 animate-pulse">Menghitung...</span> : <h4 className="text-3xl font-black text-green-700 mt-1">{dashboardData?.team?.length || 0} Orang</h4>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-900 p-5 flex justify-between items-center">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">👥 Daftar Pegawai Under Supervisor</h2>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-bold">No</th>
                      <th className="px-6 py-4 font-bold">Nama Pegawai</th>
                      <th className="px-6 py-4 font-bold">NIK</th>
                      <th className="px-6 py-4 font-bold">Unit Kerja / Jabatan</th>
                      <th className="px-6 py-4 font-bold">Area Penempatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {isLoadingData ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat data tim...</td></tr>
                    ) : dashboardData?.team?.length > 0 ? (
                      dashboardData.team.map((pegawai: any, index: number) => (
                        <tr key={pegawai.id || index} className="hover:bg-green-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-800">{pegawai.nama}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{pegawai.nik || '-'}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <span className="font-semibold text-green-700">{pegawai.unit_kerja || '-'}</span> <br />
                            <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-500 mt-1 inline-block">{pegawai.jabatan || '-'}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-700">{pegawai.area_penempatan || '-'}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Belum ada anggota tim non-fronting terdaftar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. LAPORAN & ADUAN TIM */}
        {currentView === 'laporan' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-900 p-5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">📥 Pesan & Aduan Masuk dari Anggota Tim</h2>
            </div>
            
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold">Tgl. Laporan</th>
                    <th className="px-6 py-4 font-bold">Pengirim (Pegawai)</th>
                    <th className="px-6 py-4 font-bold">Isi Laporan</th>
                    <th className="px-6 py-4 font-bold text-center">Lampiran</th>
                    <th className="px-6 py-4 font-bold text-center">Status</th>
                    <th className="px-6 py-4 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingLaporan ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat laporan...</td></tr>
                  ) : laporanList.length > 0 ? (
                    laporanList.map((item: any) => {
                      const { isAnswered } = parseDeskripsi(item.deskripsi);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            {item.nama} <br />
                            <span className="text-xs text-gray-400 font-normal">NIK: {item.nik}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={item.deskripsi}>
                            {item.deskripsi}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.file_name ? <span className="text-xl" title="Ada Lampiran Foto">📎</span> : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isAnswered ? 'Selesai' : 'Menunggu'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => handleOpenLaporan(item)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors">
                              Lihat & Balas
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Belum ada laporan atau aduan dari anggota tim.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. FORM SURVEY KUNJUNGAN (BARU) */}
        {currentView === 'survey-kunjungan' && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
              <span className="text-3xl">🗺️</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Form Survey Kunjungan Lapangan</h2>
                <p className="text-sm text-gray-500 mt-1">Kirimkan hasil survey kunjungan beserta foto dokumentasi. Data akan diteruskan ke Admin MO dan HRD.</p>
              </div>
            </div>

            <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg shadow-sm">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-green-800 font-bold uppercase">Informasi Sistem</p>
                  <p className="text-sm text-green-700 mt-1">Data survey yang Anda kirim akan otomatis tercatat dan mengirimkan notifikasi instan kepada divisi <strong>Admin MO</strong> dan <strong>HRD</strong>.</p>
                </div>
              </div>
            </div>

            {surveyMsg.text && (
              <div className={`p-4 rounded-lg mb-6 text-sm font-semibold flex items-center gap-2 ${surveyMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {surveyMsg.type === 'success' ? '✅' : '⚠️'} {surveyMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitSurvey} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Upload Foto Dokumentasi Survey <span className="text-xs text-gray-400 font-normal">(Opsional)</span>
                </label>
                <input 
                  type="file" 
                  id="foto-survey" 
                  accept="image/*" 
                  onChange={(e) => setSurveyFoto(e.target.files ? e.target.files[0] : null)} 
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Keterangan / Hasil Survey <span className="text-red-500">*</span>
                </label>
                <textarea 
                  required 
                  rows={6} 
                  value={surveyKeterangan} 
                  onChange={(e) => setSurveyKeterangan(e.target.value)} 
                  placeholder="Tuliskan laporan hasil survey kunjungan lapangan secara detail..." 
                  className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors resize-y"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSubmittingSurvey || !surveyKeterangan.trim()} 
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmittingSurvey ? 'Mengirim Data...' : 'Kirim Survey ke MO & HRD ➤'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 4. STATUS GAJI TIM */}
        {/*currentView === 'status-gaji' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Status Gaji Bulanan Anggota Tim</h2>
                <p className="text-sm text-gray-500">Memantau status rekap gaji pegawai non-fronting di bawah supervisi Anda.</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <input 
                  type="text"
                  value={searchGaji}
                  onChange={(e) => { setSearchGaji(e.target.value); setCurrentPageGaji(1); }}
                  placeholder="Cari nama pegawai..."
                  className="w-full md:w-64 p-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-green-500 outline-none"
                />
                <button onClick={fetchGajiTim} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                  🔄 Muat Ulang
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                    <th className="px-6 py-4 font-bold">Periode</th>
                    <th className="px-6 py-4 font-bold">Nama Pegawai</th>
                    <th className="px-6 py-4 font-bold">Unit Kerja</th>
                    <th className="px-6 py-4 font-bold">Gaji Pokok</th>
                    <th className="px-6 py-4 font-bold">Total Diterima</th>
                    <th className="px-6 py-4 font-bold text-center">Status Validasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingGaji ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat data gaji...</td></tr>
                  ) : currentGajiList.length > 0 ? (
                    currentGajiList.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{item.periode || '-'}</td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.nama || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.unit_kerja || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Rp {Number(item.gaji_pokok || 0).toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">Rp {Number(item.total_gaji || 0).toLocaleString('id-ID')}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide 
                            ${item.status === 'Disetujui' || item.status === 'Selesai' ? 'bg-green-100 text-green-700' : 
                              item.status === 'Ditolak' ? 'bg-red-100 text-red-700' : 
                              'bg-amber-100 text-amber-700'}`}>
                            {item.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Tidak ada data gaji tim yang ditemukan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination 
              currentPage={currentPageGaji} 
              totalPages={totalPagesGaji} 
              onPageChange={(page) => setCurrentPageGaji(page)} 
            />
          </div>
        )*/}
        {/* 3. TAMPILAN STATUS GAJI TIM (SEDANG DI-DEVELOP) */}
        {currentView === 'status-gaji' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <span className="text-5xl block">🚧</span>
              <h2 className="text-xl font-bold text-gray-800">Status Gaji Tim</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Fitur dan halaman rekap status gaji anggota tim saat ini sedang dalam tahap pengembangan (<i>on development</i>). Mohon menunggu pembaruan selanjutnya.
              </p>
              <div className="pt-2">
                <span className="inline-block bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
                  Status: Coming Soon / Under Development
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 5. PENGATURAN AKUN & GANTI PASSWORD */}
        {currentView === 'pengaturan' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
              <span className="text-3xl">🔑</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Ganti Password Akun Supervisor</h2>
                <p className="text-sm text-gray-500 mt-1">Pastikan Anda menggunakan password yang kuat dan aman.</p>
              </div>
            </div>

            {passwordMsg.text && (
              <div className={`p-4 rounded-lg mb-6 text-sm font-semibold flex items-center gap-2 ${passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {passwordMsg.type === 'success' ? '✅' : '⚠️'} {passwordMsg.text}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Password Lama</label>
                <div className="relative">
                  <input 
                    type={showOldPassword ? "text" : "password"} 
                    required 
                    value={oldPassword} 
                    onChange={(e) => setOldPassword(e.target.value)} 
                    placeholder="Masukkan password saat ini..." 
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors" 
                  />
                  <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity">
                    {showOldPassword ? "👁️" : "🙈"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Password Baru</label>
                  <div className="relative">
                    <input 
                      type={showNewPassword ? "text" : "password"} 
                      required 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Minimal 6 karakter..." 
                      className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors" 
                    />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity">
                      {showNewPassword ? "👁️" : "🙈"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Konfirmasi Password Baru</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      required 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      placeholder="Ketik ulang password baru..." 
                      className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors" 
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity">
                      {showConfirmPassword ? "👁️" : "🙈"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSubmittingPassword || !oldPassword || !newPassword || !confirmPassword} 
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL FULL VIEW DETAIL NOTIFIKASI */}
        {selectedNotifikasi && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold">Detail Pesan / Notifikasi</h3>
                <button onClick={() => setSelectedNotifikasi(null)} className="text-gray-400 hover:text-white text-xl font-bold transition-colors">✕</button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div className="flex justify-between items-center text-xs text-gray-500 border-b pb-3">
                  <span>Pengirim: <b className="text-gray-800">{selectedNotifikasi.pengirim_role || 'Sistem'}</b></span>
                  <span>{new Date(selectedNotifikasi.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tipe Pesan</h4>
                  <p className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 inline-block">{selectedNotifikasi.tipe_pesan}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Isi Konten</h4>
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed">{selectedNotifikasi.konten}</div>
                </div>

                {selectedNotifikasi.file_lampiran && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lampiran File</h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 truncate mr-4">📎 {selectedNotifikasi.file_lampiran}</span>
                      <a href={`/uploads/${selectedNotifikasi.file_lampiran}`} target="_blank" rel="noopener noreferrer" className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap">
                        Buka / Unduh
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
                <button onClick={() => setSelectedNotifikasi(null)} className="px-5 py-2 text-sm font-bold text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors">
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL BACA & BALAS LAPORAN */}
        {selectedLaporan && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold">Detail Laporan Anggota Tim</h3>
                <button onClick={() => setSelectedLaporan(null)} className="text-gray-400 hover:text-white text-xl font-bold transition-colors">✕</button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Judul / Identitas</h4>
                  <p className="text-base font-bold text-gray-800">{selectedLaporan.judul}</p>
                </div>

                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Isi Pesan / Pertanyaan</h4>
                  <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed">
                    {parseDeskripsi(selectedLaporan.deskripsi).pertanyaan}
                  </div>
                </div>

                {/* Gunakan optional chaining (?.) di sini */}
                {selectedLaporan?.file_name && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lampiran Foto Laporan</h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 truncate mr-4">📎 {selectedLaporan?.file_name}</span>
                      <a 
                        href={`/uploads/non-fronting/${selectedLaporan?.file_name}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap"
                      >
                        Buka Foto Penuh
                      </a>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">💬 Berikan Balasan / Tanggapan</h4>
                  
                  {replyMsg.text && (
                    <div className={`p-3 rounded-lg mb-4 text-xs font-bold ${replyMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {replyMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleSubmitReply}>
                    <textarea 
                      required
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ketik jawaban atau tanggapan Anda di sini..."
                      className="w-full border border-gray-300 rounded-xl p-4 text-gray-900 text-sm focus:ring-2 focus:ring-green-500 outline-none bg-gray-50 focus:bg-white transition-colors resize-y mb-4"
                    ></textarea>
                    
                    <div className="flex justify-end gap-3">
                      <button type="button" onClick={() => setSelectedLaporan(null)} className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                        Batal
                      </button>
                      <button type="submit" disabled={isSubmittingReply || !replyText.trim()} className="px-6 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmittingReply ? 'Menyimpan...' : 'Simpan Balasan'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function SupervisorDashboard() {
  return (
    <SessionProvider>
      <SupervisorDashboardContent />
    </SessionProvider>
  );
}