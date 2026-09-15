"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";

interface ChatMessage {
  role: string;
  text: string;
  isSaved?: boolean; 
}

// ==========================================
// 1. KOMPONEN HALAMAN QnA & CHAT AGENT
// ==========================================
function QnaView() {
  const [qnaList, setQnaList] = useState([]);
  const [isLoadingQna, setIsLoadingQna] = useState(true);
  const [selectedQnaDetail, setSelectedQnaDetail] = useState(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: "agent", 
      text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan terkait produk, promo, atau sistem hari ini?",
      isSaved: true 
    }
  ]);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const forceSaveMessages = async (currentMessages: any[]) => {
    if (currentMessages.length <= 1) return;
    try {
      await fetch('/api/pegawai/chat-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatArray: currentMessages }),
      });
      setMessages(prev => prev.map(m => ({ ...m, isSaved: true })));
    } catch (error) {
      console.error("Gagal auto-save chat:", error);
    }
  };

  const triggerAutoSaveTimer = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      forceSaveMessages(messagesRef.current);
    }, 300000); 
  };

  useEffect(() => {
    fetchQna();
    fetchChatHistory();

    const handleBeforeUnload = () => forceSaveMessages(messagesRef.current);
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      forceSaveMessages(messagesRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchQna = async () => {
    try {
      const res = await fetch('/api/get-qna');
      const result = await res.json();
      if (result.success) {
        setQnaList(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil materi QnA", error);
    } finally {
      setIsLoadingQna(false);
    }
  };

  const fetchChatHistory = async () => {
    try {
      const res = await fetch('/api/pegawai/chat-history');
      const result = await res.json();
      
      if (result.success && result.data.length > 0) {
        setMessages(result.data.map((m: any) => ({ ...m, isSaved: true })));
      } else {
        setMessages([{ role: "agent", text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan?", isSaved: true }]);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setMessages([
        { role: "agent", text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan terkait produk, promo, atau sistem hari ini?" }
      ]);
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessageText = inputText.trim();
    const newUserMsg = { role: "user", text: userMessageText, isSaved: false };
    const updatedMessages = [...messages, newUserMsg];
    
    setMessages(updatedMessages);
    setInputText("");
    setIsAgentTyping(true);
    triggerAutoSaveTimer();

    try {
      const res = await fetch('/api/chat-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        const newAgentMsg = { role: "agent", text: result.reply, isSaved: false };
        setMessages((prev) => [...prev, newAgentMsg]);
        triggerAutoSaveTimer();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAgentTyping(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)] relative">
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">📄 Dokumen Materi Terkini</h2>
          <span className="text-xs text-gray-500">Klik kartu untuk melihat detail</span>
        </div>
        
        <div className="p-5 overflow-y-auto flex-1">
          {isLoadingQna ? (
            <div className="text-center text-gray-500 py-10">Memuat dokumen...</div>
          ) : qnaList.length === 0 ? (
            <div className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-200 rounded-xl">
              Belum ada materi QnA yang dibagikan oleh Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {qnaList.map((item: any) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedQnaDetail(item)}
                  className="border border-gray-200 p-4 rounded-xl hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col bg-white"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{item.kategori}</span>
                    <span className="text-[10px] text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : ''}</span>
                  </div>
                  <h3 className="text-md font-bold text-gray-900 mb-2 leading-tight">{item.judul}</h3>
                  <p className="text-sm text-gray-600 flex-grow mb-4 line-clamp-2">{item.deskripsi || "Tidak ada deskripsi."}</p>
                  <div className="w-full text-center bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold py-2 px-3 rounded-lg text-sm transition-colors border border-gray-200 mt-auto">
                    Lihat Detail & Dokumen
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full">
        <div className="p-4 bg-blue-600 text-white flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">🤖</div>
          <div>
            <h2 className="font-bold text-sm">MyTLM Assistant</h2>
            <p className="text-xs text-blue-100 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> Online
            </p>
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isAgentTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-white border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 text-black">
            <input 
              type="text" 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik pertanyaan..." 
              className="flex-1 p-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
              disabled={isAgentTyping}
            />
            <button 
              type="submit" 
              disabled={!inputText.trim() || isAgentTyping}
              className="bg-blue-600 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-blue-300 shadow-sm"
            >
              ➤
            </button>
          </form>
        </div>
      </div>

      {selectedQnaDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-blue-600 text-white p-5 flex justify-between items-start">
              <div>
                <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  {(selectedQnaDetail as any).kategori}
                </span>
                <h3 className="text-xl font-bold mt-2 leading-snug">{(selectedQnaDetail as any).judul}</h3>
              </div>
              <button 
                onClick={() => setSelectedQnaDetail(null)}
                className="text-white hover:bg-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Deskripsi / Catatan</h4>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {(selectedQnaDetail as any).deskripsi || "Tidak ada deskripsi tambahan untuk materi ini."}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lampiran Dokumen</h4>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-2xl">📁</span>
                    <span className="text-xs font-medium text-blue-900 truncate">
                      {(selectedQnaDetail as any).file_name}
                    </span>
                  </div>
                  <a 
                    href={`/uploads/qna/${(selectedQnaDetail as any).file_name}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-colors whitespace-nowrap"
                  >
                    Buka / Download
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setSelectedQnaDetail(null)}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-2 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg gap-3">
      <span className="text-xs text-gray-500">Menampilkan halaman <b>{currentPage}</b> dari <b>{totalPages}</b></span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">&larr; Prev</button>
        {getPageNumbers().map((num) => (
          <button key={num} onClick={() => onPageChange(num)} className={`px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${currentPage === num ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}>
            {num}
          </button>
        ))}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Next &rarr;</button>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN: PENGUMUMAN UMUM (SISI FRONTING)
// ==========================================
function PengumumanFrontingView() {
  const [pengumumanList, setPengumumanList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPengumuman = async () => {
      try {
        const res = await fetch('/api/pegawai/pengumuman');
        if (res.ok) {
          const result = await res.json();
          setPengumumanList(Array.isArray(result.data) ? result.data : []);
        }
      } catch (error) {
        console.error("Gagal memuat data pengumuman:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPengumuman();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-1">📢 Pengumuman Umum</h2>
        <p className="text-sm text-gray-500">Informasi dan pengumuman penting terbaru dari manajemen pusat.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Memuat pengumuman...</div>
      ) : pengumumanList.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500 border border-gray-100">
          <span className="text-4xl block mb-2">📭</span>
          Belum ada pengumuman umum saat ini.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pengumumanList.map((item: any) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start gap-4 mb-3">
                <h3 className="text-base font-bold text-gray-900">{item.judul}</h3>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </span>
              </div>
              
              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed mb-4">
                {item.isi}
              </p>

              {item.file_lampiran && (
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600 truncate">
                    📎 Lampiran: {item.file_lampiran.split('-').slice(1).join('-')}
                  </span>
                  <a 
                    href={`/uploads/pengumuman/${item.file_lampiran}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded text-xs transition-colors"
                  >
                    Buka Lampiran
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. KOMPONEN DASHBOARD UTAMA
// ==========================================
function PegawaiDashboardContent() {
  const { data: session, status } = useSession();
  const [currentView, setCurrentView] = useState("dashboard");
  const [isIdStOpen, setIsIdStOpen] = useState(true);
  const [isPengumumanOpen, setIsPengumumanOpen] = useState(false);
  
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // IDENTIFIKATOR UTAMA: Cek apakah user adalah pegawai Non-Fronting
  const isNonFronting = Boolean(profile?.unit_kerja);

  // --- STATE NOTIFIKASI / PENGUMUMAN ---
  const [notifikasi, setNotifikasi] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [selectedPengumuman, setSelectedPengumuman] = useState<any>(null);
  const [estimasiGaji, setEstimasiGaji] = useState<any>(null);
  const [isLoadingGaji, setIsLoadingGaji] = useState(true);

  // --- STATE GANTI PASSWORD ---
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // --- STATE LAPORAN & ADUAN ---
  const [laporanTarget, setLaporanTarget] = useState("leader"); 
  const [laporanPesan, setLaporanPesan] = useState("");
  const [laporanFoto, setLaporanFoto] = useState<File | null>(null);
  const [isSubmittingLaporan, setIsSubmittingLaporan] = useState(false);
  const [laporanMsg, setLaporanMsg] = useState({ type: '', text: '' });

  // --- STATE PERKIRAAN PEMASUKAN ---
  const [perkiraanList, setPerkiraanList] = useState<any[]>([]);
  const [isLoadingPerkiraan, setIsLoadingPerkiraan] = useState(false);
  const [searchPerkiraan, setSearchPerkiraan] = useState("");
  const [currentPagePerkiraan, setCurrentPagePerkiraan] = useState(1);
  const itemsPerPage = 10;

  // --- STATE RIWAYAT PESAN / BALASAN ---
  const [riwayatPesan, setRiwayatPesan] = useState<any[]>([]);

  // Tambahkan state ini di dekat state riwayatPesan
  const [selectedPesanku, setSelectedPesanku] = useState<any>(null);

  const fetchRiwayatPesan = async () => {
    const targetNik = profile?.nik || session?.user?.name;
    if (!targetNik) return;
    try {
      const res = await fetch(`/api/notifikasi?nik=${targetNik}`);
      if (res.ok) {
        const data = await res.json();
        setRiwayatPesan(data);
      }
    } catch (error) {
      console.error("Gagal memuat riwayat pesan", error);
    }
  };

  useEffect(() => {
    if (currentView === 'riwayat-pesan') {
      fetchRiwayatPesan();
    }
  }, [currentView, profile, session]);

  const filteredPerkiraan = perkiraanList.filter((item: any) => {
    if (!searchPerkiraan) return true;
    const keyword = searchPerkiraan.toLowerCase();
    
    if (isNonFronting) {
      return (
        String(item.status || "").toLowerCase().includes(keyword) ||
        String(item.periode || "").toLowerCase().includes(keyword) ||
        String(item.unit_kerja || "").toLowerCase().includes(keyword)
      );
    } else {
      return (
        String(item.status || "").toLowerCase().includes(keyword) ||
        String(item.nama_fronting || "").toLowerCase().includes(keyword) ||
        String(item.nama_nasabah || "").toLowerCase().includes(keyword) ||
        String(item.produk || "").toLowerCase().includes(keyword) ||
        String(item.area || "").toLowerCase().includes(keyword)
      );
    }
  });

  const indexOfLastPerkiraan = currentPagePerkiraan * itemsPerPage;
  const indexOfFirstPerkiraan = indexOfLastPerkiraan - itemsPerPage;
  const currentPerkiraanList = filteredPerkiraan.slice(indexOfFirstPerkiraan, indexOfLastPerkiraan);
  const totalPagesPerkiraan = Math.ceil(filteredPerkiraan.length / itemsPerPage);

  // --- STATE ABSENSI ---
  const [sudahMasuk, setSudahMasuk] = useState(false);
  const [sudahPulang, setSudahPulang] = useState(false);

  useEffect(() => {
    const cekStatusAbsen = async () => {
      const targetNik = profile?.nik || session?.user?.name;
      if (!targetNik) return;

      try {
        const res = await fetch(`/api/pegawai/cek-absen?nik=${targetNik}`);
        const result = await res.json();
        if (result.success) {
          setSudahMasuk(result.sudahMasuk);
          setSudahPulang(result.sudahPulang);
        }
      } catch (e) {
        console.error("Gagal mengecek status absen", e);
      }
    };

    if (profile) cekStatusAbsen();
  }, [profile, session]);

  const handleAbsenMasuk = async () => {
    if (!confirm("Apakah Anda yakin ingin melakukan absen masuk sekarang?")) return;

    try {
      const res = await fetch('/api/pegawai/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik: profile?.nik,
          nama: profile?.nama,
          unit_kerja: profile?.unit_kerja || 'FRONTING',
          jenis_absen: 'Masuk',
          lokasi: 'Kantor / Lapangan'
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("✅ " + data.message);
        setSudahMasuk(true);
      } else {
        alert("⚠️ " + data.message);
      }
    } catch (error) {
      alert("❌ Terjadi kesalahan jaringan.");
    }
  };

  const handleAbsenPulang = async () => {
    if (!confirm("Apakah Anda yakin ingin melakukan absen pulang sekarang?")) return;

    try {
      const res = await fetch('/api/pegawai/absen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nik: profile?.nik,
          nama: profile?.nama,
          unit_kerja: profile?.unit_kerja || 'FRONTING',
          jenis_absen: 'Pulang',
          lokasi: 'Kantor / Lapangan'
        })
      });

      const data = await res.json();
      if (data.success) {
        alert("✅ " + data.message);
        setSudahPulang(true);
      } else {
        alert("⚠️ " + data.message);
      }
    } catch (error) {
      alert("❌ Terjadi kesalahan jaringan.");
    }
  };

  const fetchPerkiraanPemasukan = async () => {
    const userNik = profile?.nik || session?.user?.name || "";
    if (!userNik) return; 

    setIsLoadingPerkiraan(true);
    try {
      const role = session?.user?.role || "pegawai"; 
      const res = await fetch(`/api/perkiraan-pemasukan?role=${role}&nik=${userNik}`);
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

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMsg({ type: '', text: '' });
    if (newPassword !== confirmPassword) { setPasswordMsg({ type: 'error', text: 'Password Baru dan Konfirmasi Password tidak cocok!' }); return; }
    if (newPassword.length < 6) { setPasswordMsg({ type: 'error', text: 'Password baru minimal harus 6 karakter.' }); return; }

    setIsSubmittingPassword(true);
    try {
      const targetNik = profile?.nik || session?.user?.name;
      const res = await fetch('/api/pegawai/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nik: targetNik, oldPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setPasswordMsg({ type: 'success', text: 'Password Anda berhasil diperbarui!' });
        setOldPassword(""); setNewPassword(""); setConfirmPassword("");
      } else { setPasswordMsg({ type: 'error', text: data.message || 'Gagal mengubah password.' }); }
    } catch (error) {
      setPasswordMsg({ type: 'error', text: 'Terjadi kesalahan jaringan/sistem.' });
    } finally { setIsSubmittingPassword(false); }
  };

  useEffect(() => {
    const fetchEstimasiGaji = async () => {
      const targetNik = profile?.nik || session?.user?.name;
      if (!targetNik) return;
      try {
        const res = await fetch(`/api/pegawai/estimasi-gaji?nik=${targetNik}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) setEstimasiGaji(result.data); 
        }
      } catch (error) { console.error("Gagal memuat estimasi gaji", error); } 
      finally { setIsLoadingGaji(false); }
    };

    if (profile || session) fetchEstimasiGaji();
    if (currentView === 'status-pemasukan') fetchPerkiraanPemasukan();
  }, [profile, currentView, session]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/pegawai/profile');
        const result = await res.json();
        if (result.success) setProfile(result.data);
      } catch (error) { console.error("Gagal memuat profil", error); } 
      finally { setIsLoading(false); }
    }
    if (session) fetchProfile();
  }, [session]);

  useEffect(() => {
    const fetchNotifikasi = async () => {
      const targetId = profile?.nik || session?.user?.name;
      if (!targetId) return;
      try {
        const res = await fetch(`/api/notifikasi?nik=${targetId}`);
        if (res.ok) {
          const data = await res.json();
          setNotifikasi(data);
        }
      } catch (error) { console.error("Gagal memuat notifikasi", error); }
    };

    if (profile || session) {
      fetchNotifikasi(); 
      const interval = setInterval(fetchNotifikasi, 30000); 
      return () => clearInterval(interval);
    }
  }, [profile, session]);

  const handleReadNotif = (notif: any) => {
    setNotifikasi(notifikasi.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
    setSelectedPengumuman(notif);
    
    const tipe = notif.tipe_pesan?.toLowerCase() || '';
    const penerima = notif.penerima_nik?.toUpperCase() || '';

    // Logika pengarahan halaman menu pengumuman berdasarkan tipe atau target
    if (tipe.includes('umum') || penerima === 'ALL' || penerima === 'ALL_FRONTING' || penerima === 'ALL_NON_FRONTING') {
      setCurrentView('pengumuman-umum');
    } else if (tipe.includes('produk') || tipe.includes('informasi')) {
      setCurrentView('pengumuman-produk');
    } else {
      setCurrentView('pengumuman-pribadi');
    }

    setIsPengumumanOpen(true);
    setShowNotif(false);

    fetch('/api/notifikasi/read', {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ id: notif.id })
    }).catch(e => console.error('Gagal update status read:', e));
  };

  const unreadCount = notifikasi.filter(n => !n.is_read).length;

  if (status === "loading" || isLoading) {
    return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-600 font-medium">Memuat Dashboard Pegawai...</div>;
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-100">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a href="/api/auth/signin" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">Login Sekarang</a>
      </div>
    );
  }

  const getSubMenuClass = (viewName: string) => `block px-4 py-2 text-sm rounded transition-colors ${currentView === viewName ? 'text-white font-bold bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`;

  // Handler kirim laporan (mendukung target Admin MO & SPV untuk pegawai non-fronting)
  const handleSubmitLaporan = async (e: FormEvent) => {
    e.preventDefault();
    setLaporanMsg({ type: '', text: '' });
    if (!laporanPesan.trim()) { setLaporanMsg({ type: 'error', text: 'Keterangan laporan atau aduan tidak boleh kosong!' }); return; }

    setIsSubmittingLaporan(true);
    try {
      const formData = new FormData();
      // Jika non-fronting, arahkan target otomatis ke 'admin_mo_spv' (Admin MO & SPV)
      formData.append('target', isNonFronting ? 'admin_mo_spv' : laporanTarget);
      formData.append('pesan', laporanPesan);
      formData.append('nik', profile?.nik || session?.user?.name || '');
      formData.append('nama', profile?.nama || '');
      formData.append('nama_leader', profile?.leader || profile?.jabatan || '');
      if (laporanFoto) formData.append('foto', laporanFoto);

      const res = isNonFronting ? await fetch('/api/pegawai/laporan-aduan-non-fronting', { method: 'POST', body: formData }) : await fetch('/api/pegawai/laporan-aduan', { method: 'POST', body: formData });

      const data = await res.json();
      if (data.success) {
        setLaporanMsg({ 
          type: 'success', 
          text: isNonFronting 
            ? 'Pelaporan ke Supervisor & Admin MO berhasil dikirim!' 
            : 'Laporan/Aduan berhasil dikirim dan tercatat dalam sistem.' 
        });
        setLaporanPesan(""); setLaporanFoto(null);
        const fileInput = document.getElementById('foto-laporan') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else { setLaporanMsg({ type: 'error', text: data.message || 'Gagal mengirim laporan.' }); }
    } catch (error) {
      setLaporanMsg({ type: 'error', text: 'Terjadi kesalahan saat menghubungi server.' });
    } finally { setIsSubmittingLaporan(false); }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      
      {/* SIDEBAR */}
      <div className="w-72 bg-gray-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-gray-700 text-center tracking-wider">
          {isNonFronting ? 'PEGAWAI TLM' : 'PEGAWAI AREA'}
        </div>
        
        <div className="p-4 flex-grow overflow-y-auto space-y-1">
          <button onClick={() => setCurrentView("dashboard")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'dashboard' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>📊 DASHBOARD</button>
          
          <div>
            <button onClick={() => setIsIdStOpen(!isIdStOpen)} className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-800 rounded-md transition-colors">
              <span>🪪 ID / ST</span><span>{isIdStOpen ? '▾' : '◀'}</span>
            </button>
            {isIdStOpen && (
              <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
                <li><button onClick={() => setCurrentView("id-card")} className={`w-full text-left ${getSubMenuClass("id-card")}`}>- ID Card / Foto</button></li>
                <li><button onClick={() => setCurrentView("surat-tugas")} className={`w-full text-left ${getSubMenuClass("surat-tugas")}`}>- Surat Tugas (ST)</button></li>
              </ul>
            )}
          </div>

          {!isNonFronting && 
            <button onClick={() => setCurrentView("qna")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'qna' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>❓ QnA</button>
          }
          
          {/* MENU PELAPORAN YANG DIUBAH DINAMIS UNTUK NON-FRONTING */}
          <button onClick={() => setCurrentView("laporan-aduan")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'laporan-aduan' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>
            📝 {isNonFronting ? 'PELAPORAN KE SUPERVISOR' : 'LAPORAN & ADUAN'}
          </button>
          
          <button onClick={() => setCurrentView("status-pemasukan")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'status-pemasukan' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
            💰 {isNonFronting ? 'STATUS GAJI BULANAN' : 'STATUS PERKIRAAN PEMASUKAN'}
          </button>

          {isNonFronting && 
          
            <button 
              onClick={() => setCurrentView("riwayat-pesan")} 
              className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'riwayat-pesan' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
            >
              💬 PESAN & BALASAN
            </button>
          }

          <div>
            <button onClick={() => setIsPengumumanOpen(!isPengumumanOpen)} className="w-full flex items-center justify-between px-4 py-3 text-gray-300 hover:bg-gray-800 rounded-md transition-colors"><span>📢 PENGUMUMAN ▾</span></button>
            {isPengumumanOpen && (
              <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
                <li><button onClick={() => { setCurrentView("pengumuman-produk"); setSelectedPengumuman(null); }} className={`w-full text-left ${getSubMenuClass("pengumuman-produk")}`}>- Produk / Informasi</button></li>
                <li><button onClick={() => { setCurrentView("pengumuman-umum"); setSelectedPengumuman(null); }} className={`w-full text-left ${getSubMenuClass("pengumuman-umum")}`}>- Umum</button></li>
                <li><button onClick={() => { setCurrentView("pengumuman-pribadi"); setSelectedPengumuman(null); }} className={`w-full text-left ${getSubMenuClass("pengumuman-pribadi")}`}>- Pribadi</button></li>
              </ul>
            )}
          </div>

          {/* TOMBOL ABSEN KHUSUS PEGAWAI NON-FRONTING */}
          {isNonFronting && (
            <div className="mt-6 flex flex-col gap-2">
              <button 
                onClick={handleAbsenMasuk}
                disabled={sudahMasuk}
                className={`w-full py-3 px-4 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-xs ${
                  sudahMasuk 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                🕒 {sudahMasuk ? 'SUDAH ABSEN MASUK' : 'KLIK ABSEN MASUK'}
              </button>

              <button 
                onClick={handleAbsenPulang}
                disabled={!sudahMasuk || sudahPulang}
                className={`w-full py-3 px-4 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-xs ${
                  !sudahMasuk || sudahPulang 
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                🏃 {sudahPulang ? 'SUDAH ABSEN PULANG' : 'KLIK ABSEN PULANG'}
              </button>
            </div>
          )}

          <button onClick={() => setCurrentView("ganti-password")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'ganti-password' ? 'bg-gray-800 font-bold text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}>🔑 RESET / GANTI PASS AKUN</button>
        </div>

        <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm transition-colors" type="button">Logout</button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8 border-b pb-4 flex justify-between items-center relative z-20">
          <h1 className="text-2xl font-bold text-gray-800 uppercase">
            {currentView === 'dashboard' && 'Dashboard Utama Pegawai'}
            {currentView === 'id-card' && (isNonFronting ? 'Pas Foto / ID Pegawai' : 'ID Card Pegawai')}
            {currentView === 'surat-tugas' && 'Surat Tugas (ST)'}
            {currentView === 'qna' && 'Pusat Bantuan & QnA'}
            {currentView === 'laporan-aduan' && (isNonFronting ? 'Pelaporan Pegawai ke Supervisor & Admin MO' : 'Laporan Kegiatan & Aduan')}
            {currentView.includes('pengumuman') && 'Pengumuman Sistem'}
            {currentView === 'ganti-password' && 'Pengaturan Akun & Password'}
          </h1>
          
          <div className="flex items-center gap-6">
            <div className="relative shrink-0">
              <button onClick={() => setShowNotif(!showNotif)} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full relative transition focus:outline-none">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadCount > 0 && <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full border-2 border-gray-100">{unreadCount}</span>}
              </button>

              {showNotif && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 shadow-2xl rounded-xl z-50 overflow-hidden">
                  <div className="bg-indigo-600 px-4 py-3 text-white font-bold flex justify-between items-center">
                    <span>Notifikasi Baru</span>
                    {unreadCount > 0 && <span className="text-xs bg-indigo-800 px-2 py-1 rounded-full">{unreadCount} Belum Dibaca</span>}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifikasi.length > 0 ? (
                      notifikasi.map((notif) => (
                        <div key={notif.id} onClick={() => handleReadNotif(notif)} className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${!notif.is_read ? 'bg-blue-50/40' : 'bg-white'}`}>
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${notif.tipe_pesan?.includes('Peringatan') ? 'bg-red-100 text-red-700' : notif.tipe_pesan?.includes('Tugas') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{notif.tipe_pesan}</span>
                            {!notif.is_read && <span className="w-2 h-2 rounded-full bg-blue-600 shadow-sm"></span>}
                          </div>
                          <p className="text-sm text-gray-800 mt-2 font-medium line-clamp-3">{notif.konten}</p>
                          <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                            <span>Oleh: {notif.pengirim_role}</span>
                            {notif.file_lampiran && <span className="flex items-center text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">📎 Lampiran</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 flex flex-col items-center justify-center text-gray-500 text-sm"><span className="text-4xl mb-2">📭</span>Belum ada pesan / pengumuman.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
              Login sebagai: <b className="text-indigo-600">{profile?.nama || session?.user?.name}</b>
            </span>

          </div>
        </div>

        {/* 1. TAMPILAN UTAMA DASHBOARD */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                <div className="w-full h-56 bg-gray-50 rounded-lg border border-dashed border-gray-300 overflow-hidden flex flex-col items-center justify-center p-2 mb-3 relative group">
                  {profile?.idcard_file || profile?.pas_foto ? (
                    <img src={`/uploads/${isNonFronting ? 'pas_foto/' : ''}${profile.idcard_file || profile.pas_foto}`} alt="Foto/ID Card Pegawai" className="w-full h-full object-contain rounded-md" />
                  ) : (
                    <div className="text-gray-400 text-xs">Foto/ID belum tersedia</div>
                  )}
                </div>
                {(profile?.idcard_file || profile?.pas_foto) && (
                  <a href={`/uploads/${isNonFronting ? 'pas_foto/' : ''}${profile.idcard_file || profile.pas_foto}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline font-semibold">
                    🔍 Lihat Ukuran Penuh
                  </a>
                )}
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Informasi Penugasan</h3>
                  {isNonFronting ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 block">UNIT KERJA:</span><strong className="text-gray-800 text-base">{profile?.unit_kerja || '-'}</strong></div>
                      <div><span className="text-gray-500 block">JABATAN:</span><strong className="text-gray-800 text-base">{profile?.jabatan || '-'}</strong></div>
                      <div><span className="text-gray-500 block">AREA PENEMPATAN:</span><strong className="text-gray-800 text-base">{profile?.area_penempatan || '-'}</strong></div>
                      <div><span className="text-gray-500 block">ALAMAT AREA:</span><strong className="text-gray-800 text-base line-clamp-2" title={profile?.alamat_area_penempatan}>{profile?.alamat_area_penempatan || '-'}</strong></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500 block">KANWIL:</span><strong className="text-gray-800 text-base">{profile?.kanwil || '-'}</strong></div>
                      <div><span className="text-gray-500 block">AREA:</span><strong className="text-gray-800 text-base">{profile?.area || '-'}</strong></div>
                      <div><span className="text-gray-500 block">PENEMPATAN (CP):</span><strong className="text-gray-800 text-base">{profile?.penempatan || '-'}</strong></div>
                      <div><span className="text-gray-500 block">LEADER:</span><strong className="text-gray-800 text-base">{profile?.leader || '-'}</strong></div>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t flex items-center justify-between">
                  <span className="text-xs text-gray-500">Dokumen Surat Tugas resmi tersedia:</span>
                  {(profile?.st_file || profile?.surat_tugas) ? (
                    <button onClick={() => { setIsIdStOpen(true); setCurrentView("surat-tugas"); }} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2">
                      🔍 Lihat Semua Surat Tugas
                    </button>
                  ) : (
                    <span className="text-xs text-red-500 font-medium">File Surat Tugas belum tersedia</span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
                PERKIRAAN JUMLAH PENDAPATAN
              </h3>
              
              {isLoadingGaji ? (
                <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg"><span className="text-sm text-gray-500 animate-pulse">Memuat data estimasi...</span></div>
              ) : estimasiGaji && estimasiGaji.estimasi_shared === 1 ? (
                <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase">{isNonFronting ? 'Total Gaji Bulan Ini' : 'Total Estimasi Fee Bulan Ini'}</p>
                    <h4 className="text-2xl font-bold text-blue-700 mt-1">Rp {Number(estimasiGaji.estimasi || estimasiGaji.total_gaji || 0).toLocaleString('id-ID')}</h4>
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end gap-2">
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm border border-green-200">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                      Divalidasi Keuangan
                    </span>
                    {estimasiGaji.slip_sent === 1 && estimasiGaji.slip_name && (
                      <a href={`/uploads/slips/${estimasiGaji.slip_name}`} target="_blank" rel="noopener noreferrer" className="mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors flex items-center gap-1.5">
                        📄 Unduh Slip PDF
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center">
                  <span className="text-3xl mb-2">⏳</span>
                  <p className="text-sm text-gray-500 font-medium max-w-sm">
                    Estimasi pendapatan bulan ini belum tersedia atau masih dalam tahap validasi oleh tim Keuangan.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. TAMPILAN ID CARD / FOTO */}
        {currentView === 'id-card' && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center max-w-lg mx-auto">
            <h3 className="text-lg font-bold text-gray-800 mb-4">{isNonFronting ? 'Pas Foto Digital' : 'ID Card Digital Pegawai'}</h3>
            <div className="bg-gray-50 p-4 rounded-xl border flex flex-col items-center justify-center">
              {profile?.idcard_file || profile?.pas_foto ? (
                <img src={`/uploads/${isNonFronting ? 'pas_foto/' : ''}${profile.idcard_file || profile.pas_foto}`} alt="ID/Foto" className="max-h-96 object-contain rounded-lg shadow" />
              ) : (
                <p className="text-gray-500 text-sm">Tidak ada ID/Foto yang diunggah.</p>
              )}
            </div>
            {(profile?.idcard_file || profile?.pas_foto) && (
              <a href={`/uploads/${isNonFronting ? 'pas_foto/' : ''}${profile.idcard_file || profile.pas_foto}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block bg-blue-600 text-white text-xs px-4 py-2 rounded hover:bg-blue-700 font-semibold">
                Buka Gambar di Tab Baru
              </a>
            )}
          </div>
        )}

        {/* 3. TAMPILAN SURAT TUGAS */}
        {currentView === 'surat-tugas' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-xl mx-auto border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Surat Tugas (ST)</h3>
            <p className="text-sm text-gray-500 mb-6">Berikut adalah daftar file surat tugas Anda.</p>
            
            {(() => {
              const rawString = profile?.st_file || profile?.surat_tugas || "";
              const allFiles = rawString ? rawString.split(',').map((f: string) => f.trim()) : [];
              const displayFiles = allFiles.slice(0, 3);

              if (displayFiles.length === 0 || (displayFiles.length === 1 && displayFiles[0] === "")) {
                return (
                  <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                    <p className="text-sm text-gray-400">Belum ada Surat Tugas yang diunggah.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {displayFiles.map((fileName: string, index: number) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <span className="text-2xl flex-shrink-0">📄</span>
                        <div className="truncate">
                          <p className="text-sm font-semibold text-gray-800 truncate">Surat Tugas {index + 1}</p>
                          <p className="text-[10px] text-gray-400 truncate" title={fileName}>{fileName}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <a href={`/uploads/${isNonFronting ? 'surat_tugas/' : ''}${fileName}`} target="_blank" rel="noopener noreferrer" className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors">Lihat</a>
                        <a href={`/uploads/${isNonFronting ? 'surat_tugas/' : ''}${fileName}`} download className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-md transition-colors shadow-sm">Unduh</a>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 4. TAMPILAN QnA */}
        {currentView === 'qna' && <QnaView />}

        {/* 5. TAMPILAN PELAPORAN KE SUPERVISOR & ADMIN MO */}
        {currentView === 'laporan-aduan' && (
          <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-4 border-b border-gray-100 pb-4">
              <span className="text-3xl">📝</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {isNonFronting ? 'Pelaporan Pegawai ke Supervisor & Admin MO' : 'Laporan Kegiatan & Aduan'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {isNonFronting 
                    ? 'Kirimkan laporan kegiatan lapangan beserta dokumentasi foto kepada Supervisor dan Admin MO.' 
                    : 'Kirimkan dokumentasi kegiatan atau laporan permasalahan.'}
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded-r-lg shadow-sm">
              <div className="flex">
                <div className="flex-shrink-0"><svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg></div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700 font-bold uppercase">Pemberitahuan Sistem</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    {isNonFronting 
                      ? 'Laporan yang dikirim akan otomatis diteruskan kepada pihak Admin MO dan Supervisor (SPV).' 
                      : 'Pertanyaan atau laporan yang Anda berikan terekam di sistem database (QnA).'}
                  </p>
                </div>
              </div>
            </div>

            {laporanMsg.text && (
              <div className={`p-4 rounded-lg mb-6 text-sm font-semibold flex items-center gap-2 ${laporanMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {laporanMsg.type === 'success' ? '✅' : '⚠️'} {laporanMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitLaporan} className="space-y-6">
              {/* Jika Non-Fronting, tampilkan info tujuan target laporan */}
              {isNonFronting ? (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
                  <span className="text-2xl">👥</span>
                  <div>
                    <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">Tujuan Penerima Laporan</p>
                    <p className="text-sm font-bold text-indigo-900">Admin MO & Supervisor (SPV)</p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Kirim Laporan / Bertanya Kepada:</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${laporanTarget === 'leader' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                      <input type="radio" name="targetLaporan" value="leader" checked={laporanTarget === 'leader'} onChange={() => setLaporanTarget('leader')} className="hidden" />
                      <span className="text-xl">🧑‍💼</span><span className="font-semibold">Leader Area</span>
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${laporanTarget === 'superadmin' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                      <input type="radio" name="targetLaporan" value="superadmin" checked={laporanTarget === 'superadmin'} onChange={() => setLaporanTarget('superadmin')} className="hidden" />
                      <span className="text-xl">👑</span><span className="font-semibold">Super Admin</span>
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Upload Foto Kegiatan / Bukti <span className="text-xs text-gray-400 font-normal">(Opsional)</span>
                </label>
                <input type="file" id="foto-laporan" accept="image/*" onChange={(e) => setLaporanFoto(e.target.files ? e.target.files[0] : null)} className="w-full border border-gray-300 rounded-lg p-2 text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none" />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Keterangan / Detail Laporan <span className="text-red-500">*</span>
                </label>
                <textarea required rows={5} value={laporanPesan} onChange={(e) => setLaporanPesan(e.target.value)} placeholder="Tuliskan keterangan laporan, kegiatan, atau kendala di sini..." className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors resize-y"></textarea>
              </div>

              <div className="pt-2 flex justify-end">
                <button type="submit" disabled={isSubmittingLaporan || !laporanPesan.trim()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isSubmittingLaporan ? 'Mengirim...' : 'Kirim Pelaporan ➤'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 6. STATUS PERKIRAAN PEMASUKAN / GAJI BULANAN */}
        {currentView === 'status-pemasukan' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{isNonFronting ? 'Rekap Histori Gaji Bulanan' : 'Daftar Status Perkiraan Pemasukan'}</h2>
                <p className="text-sm text-gray-500">Memantau status pencairan dana Anda.</p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <input type="text" value={searchPerkiraan} onChange={(e) => { setSearchPerkiraan(e.target.value); setCurrentPagePerkiraan(1); }} placeholder="Cari data..." className="w-full md:w-64 p-2.5 border border-gray-300 text-sm font-bold text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                <button onClick={fetchPerkiraanPemasukan} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">🔄 Muat Ulang</button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200">
                    {isNonFronting ? (
                      <>
                        <th className="px-6 py-4 font-bold">Periode / Tanggal</th>
                        <th className="px-6 py-4 font-bold">Unit Kerja</th>
                        <th className="px-6 py-4 font-bold">Gaji Pokok</th>
                        <th className="px-6 py-4 font-bold">Total Diterima</th>
                        <th className="px-6 py-4 font-bold text-center">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 font-bold">Tanggal</th>
                        <th className="px-6 py-4 font-bold">Nama Fronting</th>
                        <th className="px-6 py-4 font-bold">Nama Nasabah</th>
                        <th className="px-6 py-4 font-bold">Nama Produk</th>
                        <th className="px-6 py-4 font-bold">Area</th>
                        <th className="px-6 py-4 font-bold">Nominal</th>
                        <th className="px-6 py-4 font-bold text-center">Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingPerkiraan ? (
                    <tr><td colSpan={isNonFronting ? 5 : 7} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat data...</td></tr>
                  ) : currentPerkiraanList.length > 0 ? (
                    currentPerkiraanList.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                        {isNonFronting ? (
                          <>
                            <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{item.periode || (item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-')}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.unit_kerja || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">Rp {Number(item.gaji_pokok || 0).toLocaleString('id-ID')}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">Rp {Number(item.total_gaji || item.up_pengajuan || 0).toLocaleString('id-ID')}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${item.status === 'Disetujui' || item.status === 'Selesai' ? 'bg-green-100 text-green-700' : item.status === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.status || 'Pending'}</span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.nama_fronting || '-'}</td>
                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={item.nama_nasabah}>{item.nama_nasabah || '-'}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.produk || '-'}</td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.area || '-'}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.up_pengajuan ? `Rp ${Number(item.up_pengajuan).toLocaleString('id-ID')}` : '-'}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${item.status === 'Disetujui' ? 'bg-green-100 text-green-700' : item.status === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{item.status || 'Pending'}</span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={isNonFronting ? 5 : 7} className="px-6 py-10 text-center text-gray-500">Tidak ada data pembayaran/pemasukan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPagePerkiraan} totalPages={totalPagesPerkiraan} onPageChange={(page) => setCurrentPagePerkiraan(page)} />
          </div>
        )}

        {/* TAMPILAN MENU PESAN & BALASAN */}
        {currentView === 'riwayat-pesan' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Riwayat Pesan & Balasan</h2>
                <p className="text-sm text-gray-500">Daftar tanggapan atau informasi dari Supervisor dan Admin MO.</p>
              </div>
              <button onClick={fetchRiwayatPesan} className="bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                🔄 Muat Ulang
              </button>
            </div>
            
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto p-6 space-y-4">
              {riwayatPesan.length > 0 ? (
                riwayatPesan.map((item: any) => (
                  <div key={item.id} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-300 transition-all">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded uppercase">
                          {item.pengirim_role || 'Sistem'}
                        </span>
                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">
                          {item.tipe_pesan}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 font-medium line-clamp-2">{item.konten}</p>
                      <span className="text-xs text-gray-400 block">
                        {new Date(item.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>

                    <button 
                      onClick={() => setSelectedPesanku(item)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-colors whitespace-nowrap flex items-center gap-1.5 ml-auto sm:ml-0"
                    >
                      Buka Detail &rarr;
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p className="text-sm font-medium">Belum ada riwayat pesan atau balasan.</p>
                </div>
              )}
            </div>

            {/* MODAL / TAMPILAN DETAIL THREAD PERCAKAPAN */}
            {selectedPesanku && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
                  
                  {/* Header Modal */}
                  <div className="bg-blue-600 text-white p-5 flex justify-between items-center">
                    <div>
                      <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        {selectedPesanku.tipe_pesan}
                      </span>
                      <h3 className="text-lg font-bold mt-1">Detail Percakapan dengan: {selectedPesanku.pengirim_role}</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedPesanku(null)}
                      className="text-white hover:bg-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Body Isi Pesan & Riwayat Balasan Kronologis */}
                  <div className="p-6 overflow-y-auto space-y-4 bg-gray-50 flex-1">
                    <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
                      <div className="flex justify-between items-center text-xs text-gray-400 border-b pb-2">
                        <span className="font-bold text-indigo-600 uppercase">Pengirim: {selectedPesanku.pengirim_role}</span>
                        <span>{new Date(selectedPesanku.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>

                      <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium">
                        {selectedPesanku.konten}
                      </div>

                      {selectedPesanku.file_lampiran && (
                        <div className="pt-3 border-t border-gray-100">
                          <a 
                            href={`/uploads/non-fronting/${selectedPesanku.file_lampiran}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-indigo-600 font-semibold bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors border border-indigo-100"
                          >
                            📎 Lihat Lampiran File ({selectedPesanku.file_lampiran})
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Modal */}
                  <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 flex justify-end">
                    <button 
                      onClick={() => setSelectedPesanku(null)}
                      className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm"
                    >
                      Tutup
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* 7. TAMPILAN PENGUMUMAN & GANTI PASSWORD */}
        {currentView.includes('pengumuman') && (
          <div className="max-w-4xl mx-auto">
            {currentView === 'pengumuman-umum' && !selectedPengumuman ? (
              <PengumumanFrontingView />
            ) : selectedPengumuman ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8">
                <div className="space-y-6 animate-fade-in">
                  <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-3 py-1 rounded-md uppercase tracking-wide ${selectedPengumuman.tipe_pesan?.includes('Peringatan') ? 'bg-red-100 text-red-700' : selectedPengumuman.tipe_pesan?.includes('Tugas') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {selectedPengumuman.tipe_pesan}
                        </span>
                        {selectedPengumuman.penerima_nik === 'ALL_FRONTING' && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700">Broadcast Khusus Fronting</span>
                        )}
                        {selectedPengumuman.penerima_nik === 'ALL_NON_FRONTING' && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-700">Broadcast Khusus Non-Fronting</span>
                        )}
                        {selectedPengumuman.penerima_nik === 'ALL' && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 text-gray-700">Broadcast Umum Seluruh Pegawai</span>
                        )}
                      </div>
                      <h2 className="text-xl font-bold text-gray-800 mt-3">Surat / Pesan Masuk</h2>
                    </div>
                    <button onClick={() => setSelectedPengumuman(null)} className="text-sm text-gray-500 hover:text-indigo-600 underline font-medium">Kembali ke Daftar</button>
                  </div>
                  <div className="bg-gray-50 p-5 md:p-6 rounded-xl border border-gray-200">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 text-sm text-gray-500 border-b border-gray-200 pb-4 gap-2">
                      <span>Dari: <strong className="text-gray-800 uppercase">{selectedPengumuman.pengirim_role}</strong></span>
                      <span>Tanggal: {new Date(selectedPengumuman.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">{selectedPengumuman.konten}</p>
                  </div>
                  {selectedPengumuman.file_lampiran && (
                    <div className="mt-6">
                      <h4 className="text-sm font-bold text-gray-700 mb-3">Lampiran Dokumen:</h4>
                      <div className="flex items-center justify-between gap-4 bg-indigo-50 border border-indigo-100 p-4 rounded-xl md:w-2/3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-3xl">📁</span>
                          <div className="flex-1 truncate pr-2"><p className="text-sm font-bold text-indigo-900 truncate" title={selectedPengumuman.file_lampiran}>{selectedPengumuman.file_lampiran}</p></div>
                        </div>
                        <a href={`/uploads/${selectedPengumuman.file_lampiran}`} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors whitespace-nowrap">Buka / Unduh</a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 text-center py-16">
                <span className="text-5xl mb-4 block">📢</span>
                <h3 className="text-xl font-bold text-gray-700 mb-2">Halaman {currentView.replace('-', ' ').toUpperCase()}</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">Silakan pilih dan klik pesan melalui ikon lonceng notifikasi di pojok kanan atas untuk membaca detail pesan secara utuh.</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'ganti-password' && (
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-8 animate-fade-in">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
              <span className="text-3xl">🔑</span>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Ganti Password Akun</h2>
                <p className="text-sm text-gray-500 mt-1">Pastikan Anda menggunakan password yang kuat dan mudah diingat.</p>
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
                  <input type={showOldPassword ? "text" : "password"} required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Masukkan password saat ini..." className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors" />
                  <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity">{showOldPassword ? "👁️" : "🙈"}</button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Password Baru</label>
                  <div className="relative">
                    <input type={showNewPassword ? "text" : "password"} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter..." className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity">{showNewPassword ? "👁️" : "🙈"}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Konfirmasi Password Baru</label>
                  <div className="relative">
                    <input type={showConfirmPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ketik ulang password baru..." className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-xl focus:outline-none opacity-60 hover:opacity-100 transition-opacity">{showConfirmPassword ? "👁️" : "🙈"}</button>
                  </div>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isSubmittingPassword || !oldPassword || !newPassword || !confirmPassword} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmittingPassword ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

export default function PegawaiDashboard() {
  return (
    <SessionProvider>
      <PegawaiDashboardContent />
    </SessionProvider>
  );
}