// app/pegawai/dashboard/page.tsx
"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import { getFileUrl } from "@/lib/getFileUrl";
import RoleSidebarLayout from "@/app/components/RoleSidebarLayout";

interface ChatMessage {
  role: string;
  text: string;
  isSaved?: boolean;
}

// ==========================================
// HELPER: FORMAT & VALIDASI TANGGAL (dd-MM-yyyy)
// ==========================================
const getTodayISO = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatToDDMMYYYY = (dateStr?: string | null): string => {
  if (!dateStr) return "";
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) return dateStr;

  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    return `${day}-${month}-${year}`;
  }
  return dateStr;
};

const formatToISO = (ddmmyyyy?: string | null): string => {
  if (!ddmmyyyy) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(ddmmyyyy)) return ddmmyyyy;

  const match = String(ddmmyyyy).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return "";

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};

const isValidDDMMYYYY = (ddmmyyyy: string): boolean => {
  const match = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return false;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const dateObj = new Date(year, month - 1, day);
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() === month - 1 &&
    dateObj.getDate() === day
  );
};

const maskDDMMYYYY = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};

// ==========================================
// HELPER: BADGE JENIS PENGUMUMAN
// ==========================================
const renderJenisBadge = (jenis?: string) => {
  const j = (jenis || "").trim().toUpperCase();

  if (j.includes("PRODUK") || j.includes("INFORMASI")) {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-blue-100 text-blue-700">
        📦 Produk / Informasi
      </span>
    );
  } else if (j.includes("UMUM")) {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-green-100 text-green-700">
        📢 Umum
      </span>
    );
  } else if (j.includes("PRIBADI") || j.includes("BALASAN")) {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-purple-100 text-purple-700">
        🔒 Pribadi
      </span>
    );
  }

  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-100 text-gray-700">
      📢 Informasi
    </span>
  );
};

// ==========================================
// 1. KOMPONEN HALAMAN QnA & CHAT AGENT
// ==========================================
function QnaView() {
  const [qnaList, setQnaList] = useState<any[]>([]);
  const [isLoadingQna, setIsLoadingQna] = useState(true);
  const [selectedQnaDetail, setSelectedQnaDetail] = useState<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "agent",
      text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan terkait produk, promo, atau sistem hari ini?",
      isSaved: true,
    },
  ]);
  const [isLoadingChat, setIsLoadingChat] = useState(true);
  const [inputText, setInputText] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const forceSaveMessages = async (currentMessages: any[]) => {
    if (currentMessages.length <= 1) return;
    try {
      await fetch("/api/pegawai/chat-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatArray: currentMessages }),
      });
      setMessages((prev) => prev.map((m) => ({ ...m, isSaved: true })));
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

  const fetchQna = async () => {
    try {
      const res = await fetch("/api/get-qna");
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
      const res = await fetch("/api/pegawai/chat-history");
      const result = await res.json();

      if (result.success && result.data.length > 0) {
        setMessages(result.data.map((m: any) => ({ ...m, isSaved: true })));
      } else {
        setMessages([
          {
            role: "agent",
            text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan?",
            isSaved: true,
          },
        ]);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      setMessages([
        {
          role: "agent",
          text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan terkait produk, promo, atau sistem hari ini?",
        },
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
      const res = await fetch("/api/chat-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const result = await res.json();

      if (result.success) {
        const newAgentMsg = {
          role: "agent",
          text: result.reply,
          isSaved: false,
        };
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
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100dvh-170px)] relative">
      {/* Daftar Dokumen Materi */}
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-h-[50dvh] lg:max-h-none">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
          <h2 className="text-base sm:text-lg font-bold text-gray-700 flex items-center gap-2">
            📄 Dokumen Materi Terkini
          </h2>
          <span className="text-xs text-gray-500">
            Klik kartu untuk melihat detail
          </span>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {isLoadingQna ? (
            <div className="text-center text-gray-500 py-10 text-sm">
              Memuat dokumen...
            </div>
          ) : qnaList.length === 0 ? (
            <div className="text-center text-gray-500 py-10 px-4 border-2 border-dashed border-gray-200 rounded-xl text-sm">
              Belum ada materi QnA yang dibagikan oleh Admin.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {qnaList.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedQnaDetail(item)}
                  className="border border-gray-200 p-4 rounded-xl hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col bg-white"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                      {item.kategori}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString("id-ID")
                        : ""}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2 leading-tight">
                    {item.judul}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 flex-grow mb-4 line-clamp-2">
                    {item.deskripsi || "Tidak ada deskripsi."}
                  </p>
                  <div className="w-full text-center bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold py-2 px-3 rounded-lg text-xs sm:text-sm transition-colors border border-gray-200 mt-auto">
                    Lihat Detail & Dokumen
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Assistant */}
      <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[62dvh] min-h-[400px] lg:h-full shrink-0">
        <div className="p-3.5 sm:p-4 bg-blue-600 text-white flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center text-lg sm:text-xl shadow-sm shrink-0">
            🤖
          </div>
          <div>
            <h2 className="font-bold text-sm">MyTLM Assistant</h2>
            <p className="text-xs text-blue-100 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400"></span> Online
            </p>
          </div>
        </div>

        <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-sm break-words ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-none"
                    : "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
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

        <div className="p-3 bg-white border-t border-gray-200 shrink-0">
          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 text-black"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ketik pertanyaan..."
              className="flex-1 min-w-0 p-2.5 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base md:text-sm"
              disabled={isAgentTyping}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isAgentTyping}
              className="bg-blue-600 w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-white hover:bg-blue-700 transition-colors disabled:bg-blue-300 shadow-sm"
            >
              ➤
            </button>
          </form>
        </div>
      </div>

      {/* Modal Detail QnA */}
      {selectedQnaDetail && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="bg-blue-600 text-white p-4 sm:p-5 flex justify-between items-start gap-3 shrink-0">
              <div className="min-w-0">
                <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  {selectedQnaDetail.kategori}
                </span>
                <h3 className="text-lg sm:text-xl font-bold mt-2 leading-snug break-words">
                  {selectedQnaDetail.judul}
                </h3>
              </div>
              <button
                onClick={() => setSelectedQnaDetail(null)}
                className="text-white hover:bg-blue-700 w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Deskripsi / Catatan
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-line bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {selectedQnaDetail.deskripsi ||
                    "Tidak ada deskripsi tambahan untuk materi ini."}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Lampiran Dokumen
                </h4>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <span className="text-2xl shrink-0">📁</span>
                    <span className="text-xs font-medium text-blue-900 truncate">
                      {selectedQnaDetail.file_name}
                    </span>
                  </div>
                  <a
                    href={getFileUrl(selectedQnaDetail.file_name, "qna")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-colors whitespace-nowrap text-center"
                  >
                    Buka / Download
                  </a>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-4 sm:px-6 py-3.5 border-t border-gray-100 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedQnaDetail(null)}
                className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-5 py-2 rounded-xl text-sm transition-colors"
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

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
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
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-3 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg gap-3">
      <span className="text-xs text-gray-500">
        Menampilkan halaman <b>{currentPage}</b> dari <b>{totalPages}</b>
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
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
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {num}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

// ==========================================
// KOMPONEN: PENGUMUMAN KATEGORI (UNIVERSAL)
// ==========================================
function PengumumanKategoriView({
  isNonFronting,
  kategoriFilter,
  title,
  subtitle,
  onSelectPengumuman,
  userNik,
  notifikasiList = [],
}: {
  isNonFronting: boolean;
  kategoriFilter: "UMUM" | "PRODUK_INFORMASI" | "PRIBADI";
  title: string;
  subtitle: string;
  onSelectPengumuman: (item: any) => void;
  userNik?: string;
  notifikasiList?: any[];
}) {
  const [listData, setListData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (
          kategoriFilter === "UMUM" ||
          kategoriFilter === "PRODUK_INFORMASI"
        ) {
          const queryTarget = isNonFronting
            ? "ALL_NON_FRONTING"
            : "ALL_FRONTING";
          const res = await fetch(
            `/api/pegawai/pengumuman?target=${queryTarget}`
          );

          if (res.ok) {
            const result = await res.json();
            let fetchedData = Array.isArray(result.data) ? result.data : [];

            fetchedData = fetchedData.filter((item: any) => {
              const target = (item.target_penerima || "ALL").toUpperCase();
              const jenis = (item.jenis_pengumuman || "").toUpperCase();

              const matchTarget = isNonFronting
                ? target === "ALL" || target === "ALL_NON_FRONTING"
                : target === "ALL" || target === "ALL_FRONTING";

              let matchJenis = false;
              if (kategoriFilter === "UMUM") {
                matchJenis =
                  jenis.includes("UMUM") &&
                  !jenis.includes("PRODUK") &&
                  !jenis.includes("INFORMASI");
              } else if (kategoriFilter === "PRODUK_INFORMASI") {
                matchJenis =
                  jenis.includes("PRODUK") || jenis.includes("INFORMASI");
              }

              return matchTarget && matchJenis;
            });

            setListData(fetchedData);
          }
        } else if (kategoriFilter === "PRIBADI") {
          const filteredPribadi = notifikasiList.filter((notif) => {
            const penerima = (notif.penerima_nik || "").toUpperCase();
            const jenis = (
              notif.jenis_pengumuman ||
              notif.tipe_pesan ||
              ""
            ).toUpperCase();

            const isBroadcast =
              penerima.includes("ALL") ||
              penerima === "ALL_FRONTING" ||
              penerima === "ALL_NON_FRONTING";
            if (isBroadcast) return false;

            const isForUser = userNik
              ? penerima === userNik.toUpperCase()
              : true;
            const isPribadiType =
              jenis.includes("PRIBADI") || jenis.includes("BALASAN");

            return isForUser || isPribadiType;
          });

          setListData(filteredPribadi);
        }
      } catch (error) {
        console.error("Gagal memuat data kategori:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isNonFronting, kategoriFilter, userNik, notifikasiList]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-1">
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-gray-500">{subtitle}</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400 text-sm">
          Memuat data...
        </div>
      ) : listData.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center text-gray-500 border border-gray-100">
          <span className="text-4xl block mb-2">📭</span>
          <p className="text-sm">Belum ada data di kategori ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4">
          {listData.map((item: any) => (
            <div
              key={item.id}
              onClick={() => onSelectPengumuman(item)}
              className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-100 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                <div className="space-y-1 min-w-0">
                  {renderJenisBadge(item.jenis_pengumuman)}
                  <h3 className="text-base font-bold text-gray-900 mt-1 break-words">
                    {item.judul || item.tipe_pesan}
                  </h3>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {item.created_at
                    ? new Date(item.created_at).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </span>
              </div>

              <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed mb-4 line-clamp-2">
                {item.isi || item.konten}
              </p>

              {item.file_lampiran && item.file_lampiran !== "NULL" && (
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-600 truncate">
                    📎 Lampiran: {item.file_lampiran}
                  </span>
                  <span className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded text-xs transition-colors text-center">
                    Lihat Detail
                  </span>
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

  const isNonFronting = Boolean(profile?.unit_kerja);

  const [notifikasi, setNotifikasi] = useState<any[]>([]);
  const [showNotif, setShowNotif] = useState(false);
  const [selectedPengumuman, setSelectedPengumuman] = useState<any>(null);
  const [estimasiGaji, setEstimasiGaji] = useState<any>(null);
  const [isLoadingGaji, setIsLoadingGaji] = useState(true);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [laporanTarget, setLaporanTarget] = useState("leader");
  const [laporanPesan, setLaporanPesan] = useState("");
  const [laporanFoto, setLaporanFoto] = useState<File | null>(null);
  const [isSubmittingLaporan, setIsSubmittingLaporan] = useState(false);
  const [laporanMsg, setLaporanMsg] = useState({ type: "", text: "" });

  // --- STATE PENGAJUAN IZIN PEGAWAI NON-FRONTING ---
  const [jenisIzin, setJenisIzin] = useState("Sakit");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [alasan, setAlasan] = useState("");
  const [fileBukti, setFileBukti] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [fileError, setFileError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mulaiPickerRef = useRef<HTMLInputElement>(null);
  const selesaiPickerRef = useRef<HTMLInputElement>(null);
  const [riwayatIzin, setRiwayatIzin] = useState<any[]>([]);
  const [isLoadingIzin, setIsLoadingIzin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [izinMsg, setIzinMsg] = useState({ type: "", text: "" });

  const [perkiraanList, setPerkiraanList] = useState<any[]>([]);
  const [isLoadingPerkiraan, setIsLoadingPerkiraan] = useState(false);
  const [searchPerkiraan, setSearchPerkiraan] = useState("");
  const [currentPagePerkiraan, setCurrentPagePerkiraan] = useState(1);
  const itemsPerPage = 10;

  const [riwayatPesan, setRiwayatPesan] = useState<any[]>([]);
  const [selectedPesanku, setSelectedPesanku] = useState<any>(null);

  // --- STATE UNTUK BALAS PESAN SURAT TUGAS ---
  const [replyText, setReplyText] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const fileReplyRef = useRef<HTMLInputElement>(null);

  // State untuk menampung data lokasi & waktu login
  const [tagLokasi, setTagLokasi] = useState<string>("Mendeteksi lokasi...");
  const [lastLoginText, setLastLoginText] = useState<string>("");

  const todayISO = getTodayISO();

  const openDatePicker = (
    pickerRef: React.RefObject<HTMLInputElement | null>
  ) => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.focus();
        el.click();
      }
    } catch {
      el.focus();
      el.click();
    }
  };

  const applyTanggalMulai = (ddmmyyyyValue: string) => {
    const currentTodayISO = getTodayISO();

    if (isValidDDMMYYYY(ddmmyyyyValue)) {
      const isoStart = formatToISO(ddmmyyyyValue);
      if (isoStart < currentTodayISO) {
        const msg =
          "Tanggal mulai tidak dapat memilih tanggal sebelum hari ini karena sudah berakhir.";
        setIzinMsg({ type: "error", text: msg });
        alert(`⚠️ ${msg}`);
        setTanggalMulai("");
        return;
      }

      if (izinMsg.type === "error") {
        setIzinMsg({ type: "", text: "" });
      }

      if (
        isValidDDMMYYYY(tanggalSelesai) &&
        formatToISO(tanggalSelesai) < isoStart
      ) {
        setTanggalSelesai("");
      }
    }

    setTanggalMulai(ddmmyyyyValue);
  };

  const applyTanggalSelesai = (ddmmyyyyValue: string) => {
    const currentTodayISO = getTodayISO();

    if (isValidDDMMYYYY(ddmmyyyyValue)) {
      const isoEnd = formatToISO(ddmmyyyyValue);
      const minAllowedISO = isValidDDMMYYYY(tanggalMulai)
        ? formatToISO(tanggalMulai)
        : currentTodayISO;

      if (isoEnd < minAllowedISO) {
        const msg = isValidDDMMYYYY(tanggalMulai)
          ? `Tanggal selesai minimal sama atau lebih dari tanggal mulai (${tanggalMulai}).`
          : "Tanggal selesai tidak dapat memilih tanggal sebelum hari ini.";
        setIzinMsg({ type: "error", text: msg });
        alert(`⚠️ ${msg}`);
        setTanggalSelesai("");
        return;
      }

      if (izinMsg.type === "error") {
        setIzinMsg({ type: "", text: "" });
      }
    }

    setTanggalSelesai(ddmmyyyyValue);
  };

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const handleFileBuktiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const file = e.target.files?.[0];

    if (!file) {
      setFileBukti(null);
      setFilePreviewUrl("");
      return;
    }

    const fileNameLower = file.name.toLowerCase();
    const isValidExtension =
      fileNameLower.endsWith(".jpg") || fileNameLower.endsWith(".jpeg");
    const isValidMime = file.type === "image/jpeg";

    if (!isValidExtension || !isValidMime) {
      const errorMsg =
        "Format file ditolak! Sistem hanya menerima file bukti berupa gambar .JPG atau .JPEG.";
      setFileError(errorMsg);
      alert(`⚠️ ${errorMsg}`);
      setFileBukti(null);
      setFilePreviewUrl("");
      e.target.value = "";
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      const errorMsg =
        "Ukuran gambar terlalu besar. Maksimal ukuran file adalah 5MB.";
      setFileError(errorMsg);
      alert(`⚠️ ${errorMsg}`);
      setFileBukti(null);
      setFilePreviewUrl("");
      e.target.value = "";
      return;
    }

    setFileBukti(file);
    setFilePreviewUrl(URL.createObjectURL(file));
  };

  useEffect(() => {
    if (!isNonFronting || !profile?.nik) return;

    if (profile.tag_lokasi) setTagLokasi(profile.tag_lokasi);
    if (profile.last_login_at) {
      setLastLoginText(
        new Date(profile.last_login_at).toLocaleString("id-ID", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      );
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
            );
            const data = await res.json();

            const namaLokasi =
              data.address?.city ||
              data.address?.town ||
              data.address?.subdistrict ||
              data.address?.county ||
              data.display_name?.split(",")[0] ||
              `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

            setTagLokasi(namaLokasi);

            const nowFormatted = new Date().toLocaleString("id-ID", {
              dateStyle: "medium",
              timeStyle: "short",
            });
            setLastLoginText(nowFormatted);

            await fetch("/api/pegawai/update-lokasi", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nik: profile.nik,
                tagLokasi: namaLokasi,
              }),
            });
          } catch (error) {
            console.error("Gagal menyimpan lokasi & waktu login:", error);
          }
        },
        (error) => {
          console.warn("Izin GPS tidak diberikan:", error.message);
          setTagLokasi(
            profile?.tag_lokasi ||
              profile?.area_penempatan ||
              "Lokasi Tidak Aktif"
          );
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [isNonFronting, profile?.nik]);

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

  const fetchRiwayatIzin = async () => {
    const targetNik =
      profile?.nik || (session?.user as any)?.nik || session?.user?.name;
    if (!targetNik) return;

    setIsLoadingIzin(true);
    try {
      const res = await fetch(
        `/api/pegawai/pengajuan-izin?nik=${encodeURIComponent(targetNik)}`
      );
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setRiwayatIzin(result.data || []);
        }
      }
    } catch (error) {
      console.error("Gagal memuat riwayat pengajuan izin:", error);
    } finally {
      setIsLoadingIzin(false);
    }
  };

  const handleRemoveFile = () => {
    setFileBukti(null);
    setFilePreviewUrl("");
    setFileError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmitIzin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIzinMsg({ type: "", text: "" });

    const activeNik =
      profile?.nik || (session?.user as any)?.nik || session?.user?.name || "";
    if (!activeNik) {
      const msg = "Identitas NIK pegawai tidak ditemukan. Silakan login ulang.";
      setIzinMsg({ type: "error", text: msg });
      alert(msg);
      return;
    }

    if (!tanggalMulai || !tanggalSelesai || !alasan.trim()) {
      const msg =
        "Tanggal mulai, tanggal selesai, dan alasan izin wajib diisi.";
      setIzinMsg({ type: "error", text: msg });
      alert(msg);
      return;
    }

    if (!isValidDDMMYYYY(tanggalMulai)) {
      const msg =
        "Format Tanggal Mulai tidak valid. Gunakan format dd-MM-yyyy (contoh: 12-11-2026).";
      setIzinMsg({ type: "error", text: msg });
      alert(msg);
      return;
    }

    if (!isValidDDMMYYYY(tanggalSelesai)) {
      const msg =
        "Format Tanggal Selesai tidak valid. Gunakan format dd-MM-yyyy (contoh: 14-11-2026).";
      setIzinMsg({ type: "error", text: msg });
      alert(msg);
      return;
    }

    const currentTodayISO = getTodayISO();
    const isoMulai = formatToISO(tanggalMulai);
    const isoSelesai = formatToISO(tanggalSelesai);

    if (isoMulai < currentTodayISO) {
      const msg =
        "Tanggal mulai tidak dapat memilih tanggal sebelum hari ini karena sudah berakhir.";
      setIzinMsg({ type: "error", text: msg });
      alert(msg);
      return;
    }

    if (isoSelesai < isoMulai) {
      const msg =
        "Tanggal selesai minimal harus sama atau lebih dari tanggal mulai.";
      setIzinMsg({ type: "error", text: msg });
      alert(msg);
      return;
    }

    if (fileError) {
      setIzinMsg({ type: "error", text: fileError });
      alert(fileError);
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("nik", activeNik);
      formData.append("nama", profile?.nama || session?.user?.name || "");
      formData.append("unit_kerja", profile?.unit_kerja || "");
      formData.append("jenis_izin", jenisIzin);
      formData.append("tanggal_mulai", isoMulai);
      formData.append("tanggal_selesai", isoSelesai);
      formData.append("alasan", alasan.trim());

      if (fileBukti instanceof File) {
        formData.append("file_bukti", fileBukti);
      }

      const res = await fetch("/api/pegawai/pengajuan-izin", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        const errText =
          result.message || result.error || "Gagal mengajukan izin.";
        setIzinMsg({ type: "error", text: errText });
        alert(errText);
        return;
      }

      const successText = result.message || "Pengajuan izin berhasil dikirim!";
      setIzinMsg({ type: "success", text: successText });
      alert("✅ " + successText);

      setJenisIzin("Sakit");
      setTanggalMulai("");
      setTanggalSelesai("");
      setAlasan("");
      handleRemoveFile();

      await fetchRiwayatIzin();
    } catch (error) {
      console.error("Error submit izin:", error);
      const errNet =
        "Terjadi kesalahan jaringan saat mengirim pengajuan izin.";
      setIzinMsg({ type: "error", text: errNet });
      alert(errNet);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKirimBalasan = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    try {
      const formData = new FormData();

      const namaPegawai = profile?.nama || session?.user?.name;
      formData.append("pengirimRole", namaPegawai);

      const rolePengirimAwal = (
        selectedPengumuman?.pengirim_role || ""
      ).toUpperCase();
      const targetDivisi = rolePengirimAwal.includes("HRD") ? "HRD" : "MO";
      formData.append("nikTujuan", targetDivisi);

      formData.append("tipe", "Balasan Surat Perintah Tugas");
      formData.append("konten", replyText);

      if (replyFile) {
        formData.append("file_lampiran", replyFile);
      }

      const res = await fetch("/api/kirim-pesan", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (result.success) {
        alert("Balasan berhasil dikirim!");
        setReplyText("");
        setReplyFile(null);
        if (fileReplyRef.current) {
          fileReplyRef.current.value = "";
        }
      } else {
        alert("Gagal mengirim balasan: " + result.message);
      }
    } catch (error) {
      console.error("Error balas pesan:", error);
      alert("Terjadi kesalahan pada sistem.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  useEffect(() => {
    if (currentView === "riwayat-pesan") {
      fetchRiwayatPesan();
    }
    if (currentView === "pengajuan-izin") {
      fetchRiwayatIzin();
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
  const currentPerkiraanList = filteredPerkiraan.slice(
    indexOfFirstPerkiraan,
    indexOfLastPerkiraan
  );
  const totalPagesPerkiraan = Math.ceil(
    filteredPerkiraan.length / itemsPerPage
  );

  const [sudahMasuk, setSudahMasuk] = useState(false);
  const [sudahPulang, setSudahPulang] = useState(false);

  // --- STATE ABSENSI FOTO & LOKASI ---
  const [showAbsenModal, setShowAbsenModal] = useState(false);
  const [absenType, setAbsenType] = useState<"Masuk" | "Pulang">("Masuk");
  const [absenPhoto, setAbsenPhoto] = useState<File | null>(null);
  const [absenPhotoPreview, setAbsenPhotoPreview] = useState<string | null>(
    null
  );
  const [absenLocation, setAbsenLocation] = useState({
    lat: 0,
    lng: 0,
    address: "",
  });
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmittingAbsen, setIsSubmittingAbsen] = useState(false);

  // --- STATE & REF UNTUK LIVE CAMERA ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

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

  useEffect(() => {
    if (profile) cekStatusAbsen();
  }, [profile, session]);

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert(
        "Kamera tidak dapat diakses. Pastikan Anda memberikan izin akses kamera pada browser."
      );
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;

        context.drawImage(
          videoRef.current,
          0,
          0,
          canvasRef.current.width,
          canvasRef.current.height
        );

        canvasRef.current.toBlob(
          (blob) => {
            if (blob) {
              const fileName = `absen_${profile?.nik || "user"}_${Date.now()}.jpg`;
              const photoFile = new File([blob], fileName, {
                type: "image/jpeg",
              });

              setAbsenPhoto(photoFile);
              setAbsenPhotoPreview(URL.createObjectURL(photoFile));

              stopCamera();
            } else {
              alert("Gagal memproses gambar dari kamera.");
            }
          },
          "image/jpeg",
          0.8
        );
      }
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    setShowAbsenModal(false);
  };

  const getGeoLocation = () => {
    setIsLocating(true);

    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await res.json();
          setAbsenLocation({
            lat,
            lng,
            address: data.display_name || "Alamat tidak ditemukan",
          });
        } catch (e) {
          setAbsenLocation({
            lat,
            lng,
            address: `Koordinat: ${lat}, ${lng} (Gagal mengambil teks alamat)`,
          });
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            alert(
              "Silakan izinkan akses lokasi pada browser Anda untuk absensi."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            alert("Informasi lokasi tidak dapat ditemukan.");
            break;
          case error.TIMEOUT:
            alert("Waktu permintaan lokasi telah habis.");
            break;
          default:
            alert("Terjadi kesalahan saat mengambil lokasi.");
        }
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleAbsenMasuk = () => {
    setAbsenType("Masuk");
    setAbsenPhoto(null);
    setAbsenPhotoPreview(null);
    setShowAbsenModal(true);
    getGeoLocation();
  };

  const handleAbsenPulang = () => {
    setAbsenType("Pulang");
    setAbsenPhoto(null);
    setAbsenPhotoPreview(null);
    setShowAbsenModal(true);
    getGeoLocation();
  };

  const submitAbsenRealtime = async (e: FormEvent) => {
    e.preventDefault();

    if (!absenPhoto) {
      alert("⚠️ Foto absensi wajib diambil terlebih dahulu!");
      return;
    }

    if (!profile?.nik) {
      alert("⚠️ Data profil NIK tidak ditemukan. Silakan muat ulang halaman.");
      return;
    }

    setIsSubmittingAbsen(true);

    try {
      const formData = new FormData();
      formData.append("nik", profile.nik);
      formData.append("nama", profile?.nama || "");
      formData.append("unit_kerja", profile?.unit_kerja || "");
      formData.append("jenis_absen", absenType);
      formData.append(
        "latitude",
        absenLocation?.lat ? absenLocation.lat.toString() : ""
      );
      formData.append(
        "longitude",
        absenLocation?.lng ? absenLocation.lng.toString() : ""
      );
      formData.append(
        "lokasi_alamat",
        absenLocation?.address || "Lokasi tidak diketahui"
      );
      formData.append(
        "foto_absen",
        absenPhoto,
        `absen_${profile.nik}_${Date.now()}.jpg`
      );

      const response = await fetch("/api/pegawai/absen", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${result.message}`);
        handleCloseModal();
        await cekStatusAbsen();
      } else {
        alert(`❌ Gagal: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error("Error submitting absen:", error);
      alert("❌ Terjadi kesalahan jaringan saat mengirim data absensi.");
    } finally {
      setIsSubmittingAbsen(false);
    }
  };

  const fetchPerkiraanPemasukan = async () => {
    const userNik = profile?.nik || session?.user?.name || "";
    if (!userNik) return;

    setIsLoadingPerkiraan(true);
    try {
      const role = session?.user?.role || "pegawai";
      const res = await fetch(
        `/api/perkiraan-pemasukan?role=${role}&nik=${userNik}`
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
      const targetNik = profile?.nik || session?.user?.name;
      const res = await fetch("/api/pegawai/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nik: targetNik, oldPassword, newPassword }),
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
    const fetchEstimasiGaji = async () => {
      const targetNik = profile?.nik || session?.user?.name;
      if (!targetNik) return;
      try {
        const res = await fetch(`/api/pegawai/estimasi-gaji?nik=${targetNik}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success && result.data) setEstimasiGaji(result.data);
        }
      } catch (error) {
        console.error("Gagal memuat estimasi gaji", error);
      } finally {
        setIsLoadingGaji(false);
      }
    };

    if (profile || session) fetchEstimasiGaji();
    if (currentView === "status-pemasukan") fetchPerkiraanPemasukan();
  }, [profile, currentView, session]);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/pegawai/profile");
        const result = await res.json();
        if (result.success) setProfile(result.data);
      } catch (error) {
        console.error("Gagal memuat profil", error);
      } finally {
        setIsLoading(false);
      }
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
      } catch (error) {
        console.error("Gagal memuat notifikasi", error);
      }
    };

    if (profile || session) {
      fetchNotifikasi();
      const interval = setInterval(fetchNotifikasi, 30000);
      return () => clearInterval(interval);
    }
  }, [profile, session]);

  const handleReadNotif = (notif: any) => {
    setNotifikasi(
      notifikasi.map((n) => (n.id === notif.id ? { ...n, is_read: 1 } : n))
    );
    setSelectedPengumuman(notif);

    const jenis = (
      notif.jenis_pengumuman ||
      notif.tipe_pesan ||
      ""
    ).toUpperCase();

    if (jenis.includes("PRODUK") || jenis.includes("INFORMASI")) {
      setCurrentView("pengumuman-produk");
    } else if (jenis.includes("PRIBADI") || jenis.includes("BALASAN")) {
      setCurrentView("pengumuman-pribadi");
    } else {
      setCurrentView("pengumuman-umum");
    }

    setIsPengumumanOpen(true);
    setShowNotif(false);

    fetch("/api/notifikasi/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notif.id }),
    }).catch((e) => console.error("Gagal update status read:", e));
  };

  const unreadCount = notifikasi.filter((n) => !n.is_read).length;

  if (status === "loading" || isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-gray-100 text-gray-600 font-medium">
        Memuat Dashboard Pegawai...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center flex-col gap-4 bg-gray-100 p-4">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a
          href="/api/auth/signin"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Login Sekarang
        </a>
      </div>
    );
  }

  const getSubMenuClass = (viewName: string) =>
    `block px-4 py-2 text-sm rounded transition-colors ${
      currentView === viewName
        ? "text-white font-bold bg-gray-800"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;

  const handleSubmitLaporan = async (e: FormEvent) => {
    e.preventDefault();
    setLaporanMsg({ type: "", text: "" });

    if (!laporanPesan.trim()) {
      setLaporanMsg({
        type: "error",
        text: "Keterangan laporan atau aduan tidak boleh kosong!",
      });
      return;
    }

    setIsSubmittingLaporan(true);
    try {
      const formData = new FormData();
      // Fronting otomatis ditujukan ke Leader & Superadmin sekaligus
      formData.append(
        "target",
        isNonFronting ? "admin_mo_spv" : "leader_superadmin"
      );
      formData.append("pesan", laporanPesan);
      formData.append("nik", profile?.nik || session?.user?.name || "");
      formData.append("nama", profile?.nama || "");
      formData.append("nama_leader", profile?.leader || profile?.jabatan || "");
      formData.append("nik_leader", profile?.leader_nik || "");
      formData.append("area", profile?.area || "");
      formData.append("penempatan", profile?.penempatan || "");

      if (laporanFoto) formData.append("foto", laporanFoto);

      const res = isNonFronting
        ? await fetch("/api/pegawai/laporan-aduan-non-fronting", {
            method: "POST",
            body: formData,
          })
        : await fetch("/api/pegawai/laporan-aduan", {
            method: "POST",
            body: formData,
          });

      const data = await res.json();
      if (data.success) {
        setLaporanMsg({
          type: "success",
          text: isNonFronting
            ? "Pelaporan ke Supervisor & Admin MO berhasil dikirim!"
            : "Laporan/Aduan berhasil dikirim! Notifikasi telah diteruskan ke Leader Area dan Super Admin.",
        });
        setLaporanPesan("");
        setLaporanFoto(null);
        const fileInput = document.getElementById(
          "foto-laporan"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        setLaporanMsg({
          type: "error",
          text: data.message || "Gagal mengirim laporan.",
        });
      }
    } catch (error) {
      setLaporanMsg({
        type: "error",
        text: "Terjadi kesalahan saat menghubungi server.",
      });
    } finally {
      setIsSubmittingLaporan(false);
    }
  };

  const userPhoto = profile?.idcard_file || profile?.pas_foto;
  const userPhotoFolder = isNonFronting ? "pas_foto" : "";

  const viewTitleMap: Record<string, string> = {
    dashboard: "Dashboard Utama Pegawai",
    "id-card": isNonFronting ? "Pas Foto / ID Pegawai" : "ID Card Pegawai",
    "surat-tugas": "Surat Tugas (ST)",
    qna: "Pusat Bantuan & QnA",
    "laporan-aduan": isNonFronting
      ? "Pelaporan ke Supervisor & Admin MO"
      : "Laporan Kegiatan & Aduan",
    "pengajuan-izin": "Pengajuan Izin & Cuti Pegawai",
    "status-pemasukan": isNonFronting
      ? "Status Gaji Bulanan"
      : "Status Perkiraan Pemasukan",
    "riwayat-pesan": "Riwayat Pesan & Balasan",
    "ganti-password": "Pengaturan Akun & Password",
  };

  const activePageTitle = currentView.includes("pengumuman")
    ? "Pengumuman Sistem"
    : viewTitleMap[currentView] || "Dashboard Pegawai";

  // Komponen tombol & dropdown notifikasi (digunakan bersama di header mobile & desktop)
  const renderNotificationBell = () => (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setShowNotif(!showNotif)}
        aria-label="Notifikasi"
        className="p-2 text-gray-600 hover:bg-gray-200 rounded-full relative transition focus:outline-none"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full border-2 border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotif && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-sm bg-white border border-gray-200 shadow-2xl rounded-xl z-50 overflow-hidden">
          <div className="bg-indigo-600 px-4 py-3 text-white font-bold flex justify-between items-center text-sm">
            <span>Notifikasi Baru</span>
            {unreadCount > 0 && (
              <span className="text-xs bg-indigo-800 px-2 py-1 rounded-full">
                {unreadCount} Belum Dibaca
              </span>
            )}
          </div>
          <div className="max-h-80 sm:max-h-96 overflow-y-auto">
            {notifikasi.length > 0 ? (
              notifikasi.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleReadNotif(notif)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                    !notif.is_read ? "bg-blue-50/40" : "bg-white"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    {renderJenisBadge(
                      notif.jenis_pengumuman || notif.tipe_pesan
                    )}
                    {!notif.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 shadow-sm"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 mt-2 font-medium line-clamp-3">
                    {notif.konten || notif.judul}
                  </p>
                  <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
                    <span>Oleh: {notif.pengirim_role || "Admin"}</span>
                    {notif.file_lampiran && (
                      <span className="flex items-center text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                        📎 Lampiran
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 flex flex-col items-center justify-center text-gray-500 text-sm">
                <span className="text-4xl mb-2">📭</span>
                Belum ada pesan / pengumuman.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Isi Sidebar (digunakan otomatis oleh RoleSidebarLayout untuk desktop & mobile drawer)
  const sidebarContent = (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <div className="p-5 text-lg lg:text-xl font-bold border-b border-gray-700 text-center tracking-wider">
        {isNonFronting ? "PEGAWAI TLM" : "PEGAWAI AREA"}
      </div>

      <div className="p-4 flex-grow overflow-y-auto space-y-1">
        <button
          type="button"
          onClick={() => setCurrentView("dashboard")}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
            currentView === "dashboard"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          📊 DASHBOARD
        </button>

        <div>
          <button
            type="button"
            data-no-close="true"
            aria-expanded={isIdStOpen}
            onClick={() => setIsIdStOpen(!isIdStOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <span>🪪 ID / ST</span>
            <span>{isIdStOpen ? "▾" : "◀"}</span>
          </button>
          {isIdStOpen && (
            <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentView("id-card")}
                  className={`w-full text-left ${getSubMenuClass("id-card")}`}
                >
                  - ID Card / Foto
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setCurrentView("surat-tugas")}
                  className={`w-full text-left ${getSubMenuClass(
                    "surat-tugas"
                  )}`}
                >
                  - Surat Tugas (ST)
                </button>
              </li>
            </ul>
          )}
        </div>

        {!isNonFronting && (
          <button
            type="button"
            onClick={() => setCurrentView("qna")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
              currentView === "qna"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            ❓ QnA
          </button>
        )}

        <button
          type="button"
          onClick={() => setCurrentView("laporan-aduan")}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
            currentView === "laporan-aduan"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          📝{" "}
          {isNonFronting ? "PELAPORAN KE SUPERVISOR" : "LAPORAN & ADUAN"}
        </button>

        {isNonFronting && (
          <button
            type="button"
            onClick={() => setCurrentView("pengajuan-izin")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
              currentView === "pengajuan-izin"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            🏖️ PENGAJUAN IZIN / CUTI
          </button>
        )}

        <button
          type="button"
          onClick={() => setCurrentView("status-pemasukan")}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
            currentView === "status-pemasukan"
              ? "bg-gray-800 text-white font-bold"
              : "text-gray-300 hover:text-white hover:bg-gray-800"
          }`}
        >
          💰{" "}
          {isNonFronting
            ? "STATUS GAJI BULANAN"
            : "STATUS PERKIRAAN PEMASUKAN"}
        </button>

        {isNonFronting && (
          <button
            type="button"
            onClick={() => setCurrentView("riwayat-pesan")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
              currentView === "riwayat-pesan"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            💬 PESAN & BALASAN
          </button>
        )}

        <div>
          <button
            type="button"
            data-no-close="true"
            aria-expanded={isPengumumanOpen}
            onClick={() => setIsPengumumanOpen(!isPengumumanOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <span>📢 PENGUMUMAN</span>
            <span>{isPengumumanOpen ? "▾" : "◀"}</span>
          </button>
          {isPengumumanOpen && (
            <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView("pengumuman-produk");
                    setSelectedPengumuman(null);
                  }}
                  className={`w-full text-left ${getSubMenuClass(
                    "pengumuman-produk"
                  )}`}
                >
                  - Produk / Informasi
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView("pengumuman-umum");
                    setSelectedPengumuman(null);
                  }}
                  className={`w-full text-left ${getSubMenuClass(
                    "pengumuman-umum"
                  )}`}
                >
                  - Umum
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentView("pengumuman-pribadi");
                    setSelectedPengumuman(null);
                  }}
                  className={`w-full text-left ${getSubMenuClass(
                    "pengumuman-pribadi"
                  )}`}
                >
                  - Pribadi
                </button>
              </li>
            </ul>
          )}
        </div>

        {isNonFronting && (
          <div className="pt-4 pb-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleAbsenMasuk}
              disabled={sudahMasuk}
              className={`w-full py-3 px-4 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-xs ${
                sudahMasuk
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              🕒 {sudahMasuk ? "SUDAH ABSEN MASUK" : "KLIK ABSEN MASUK"}
            </button>

            <button
              type="button"
              onClick={handleAbsenPulang}
              disabled={!sudahMasuk || sudahPulang}
              className={`w-full py-3 px-4 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-xs ${
                !sudahMasuk || sudahPulang
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              🏃 {sudahPulang ? "SUDAH ABSEN PULANG" : "KLIK ABSEN PULANG"}
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCurrentView("ganti-password")}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
            currentView === "ganti-password"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          🔑 RESET / GANTI PASS AKUN
        </button>
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
          type="button"
        >
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <RoleSidebarLayout
      title={activePageTitle}
      subtitle={
        isNonFronting
          ? `📍 ${tagLokasi}`
          : `Login: ${profile?.nama || session?.user?.name || "Pegawai"}`
      }
      headerRight={renderNotificationBell()}
      sidebarContent={sidebarContent}
    >
      {/* HEADER KHUSUS DESKTOP (lg ke atas, karena mobile memakai sticky header RoleSidebarLayout) */}
      <div className="hidden lg:flex mb-8 border-b pb-4 justify-between items-center relative z-20">
        <h1 className="text-2xl font-bold text-gray-800 uppercase">
          {activePageTitle}
        </h1>

        <div className="flex items-center gap-6">
          {isNonFronting && (
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3.5 py-1.5 rounded-full text-xs font-bold border border-blue-200 shadow-sm">
                <span className="animate-pulse">📍</span>
                <span className="truncate max-w-[220px]" title={tagLokasi}>
                  {tagLokasi}
                </span>
              </div>
              {lastLoginText && (
                <span className="text-[10px] text-gray-600 mt-1">
                  Login: {lastLoginText}
                </span>
              )}
            </div>
          )}

          {renderNotificationBell()}

          <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
            Login sebagai:{" "}
            <b className="text-indigo-600">
              {profile?.nama || session?.user?.name}
            </b>
          </span>
        </div>
      </div>

      {/* BANNER LOKASI & LOGIN RINGKAS DI MOBILE UNTUK NON-FRONTING */}
      {isNonFronting && lastLoginText && (
        <div className="lg:hidden mb-4 flex items-center justify-between gap-2 rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800">
          <span className="truncate font-semibold">📍 {tagLokasi}</span>
          <span className="shrink-0 text-[11px] text-blue-600">
            {lastLoginText}
          </span>
        </div>
      )}

      {/* 1. TAMPILAN UTAMA DASHBOARD */}
      {currentView === "dashboard" && (
        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
              <div className="w-full h-48 sm:h-56 bg-gray-50 rounded-lg border border-dashed border-gray-300 overflow-hidden flex flex-col items-center justify-center p-2 mb-3 relative group">
                {userPhoto ? (
                  <img
                    src={getFileUrl(userPhoto, userPhotoFolder)}
                    alt="Foto/ID Card Pegawai"
                    className="w-full h-full object-contain rounded-md"
                  />
                ) : (
                  <div className="text-gray-400 text-xs">
                    Foto/ID belum tersedia
                  </div>
                )}
              </div>
              {userPhoto && (
                <a
                  href={getFileUrl(userPhoto, userPhotoFolder)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline font-semibold"
                >
                  🔍 Lihat Ukuran Penuh
                </a>
              )}
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 border-b pb-2">
                  Informasi Penugasan
                </h3>
                {isNonFronting ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 block">
                        UNIT KERJA:
                      </span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.unit_kerja || "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">
                        JABATAN:
                      </span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.jabatan || "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">
                        AREA PENEMPATAN:
                      </span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.area_penempatan || "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">
                        ALAMAT AREA:
                      </span>
                      <strong
                        className="text-gray-800 text-sm sm:text-base line-clamp-2"
                        title={profile?.alamat_area_penempatan}
                      >
                        {profile?.alamat_area_penempatan || "-"}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 text-sm">
                    <div>
                      <span className="text-xs text-gray-500 block">
                        KANWIL:
                      </span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.kanwil || "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">AREA:</span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.area || "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">
                        PENEMPATAN (CP):
                      </span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.penempatan || "-"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 block">
                        LEADER:
                      </span>
                      <strong className="text-gray-800 text-sm sm:text-base">
                        {profile?.leader || "-"}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <span className="text-xs text-gray-500">
                  Dokumen Surat Tugas resmi tersedia:
                </span>
                {profile?.st_file || profile?.surat_tugas ? (
                  <button
                    onClick={() => {
                      setIsIdStOpen(true);
                      setCurrentView("surat-tugas");
                    }}
                    className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-lg shadow transition-colors flex items-center gap-2"
                  >
                    🔍 Lihat Semua Surat Tugas
                  </button>
                ) : (
                  <span className="text-xs text-red-500 font-medium">
                    File Surat Tugas belum tersedia
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-2">
              PERKIRAAN JUMLAH PENDAPATAN
            </h3>

            {isLoadingGaji ? (
              <div className="flex items-center justify-center p-6 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-500 animate-pulse">
                  Memuat data estimasi...
                </span>
              </div>
            ) : estimasiGaji && estimasiGaji.estimasi_shared === 1 ? (
              <div className="p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase">
                    {isNonFronting
                      ? "Total Gaji Bulan Ini"
                      : "Total Estimasi Fee Bulan Ini"}
                  </p>
                  <h4 className="text-xl sm:text-2xl font-bold text-blue-700 mt-1">
                    Rp{" "}
                    {Number(
                      estimasiGaji.estimasi || estimasiGaji.total_gaji || 0
                    ).toLocaleString("id-ID")}
                  </h4>
                </div>

                <div className="flex flex-col items-start md:items-end gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 shadow-sm border border-green-200">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                    Divalidasi Keuangan
                  </span>
                  {estimasiGaji.slip_sent === 1 && estimasiGaji.slip_name && (
                    <a
                      href={getFileUrl(estimasiGaji.slip_name, "slips")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto justify-center mt-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      📄 Unduh Slip PDF
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 sm:p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-center">
                <span className="text-3xl mb-2">⏳</span>
                <p className="text-xs sm:text-sm text-gray-500 font-medium max-w-sm">
                  Estimasi pendapatan bulan ini belum tersedia atau masih dalam
                  tahap validasi oleh tim Keuangan.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TAMPILAN ID CARD / FOTO */}
      {currentView === "id-card" && (
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 text-center max-w-lg mx-auto">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">
            {isNonFronting ? "Pas Foto Digital" : "ID Card Digital Pegawai"}
          </h3>
          <div className="bg-gray-50 p-4 rounded-xl border flex flex-col items-center justify-center">
            {userPhoto ? (
              <img
                src={getFileUrl(userPhoto, userPhotoFolder)}
                alt="ID/Foto"
                className="max-h-80 sm:max-h-96 object-contain rounded-lg shadow"
              />
            ) : (
              <p className="text-gray-500 text-sm">
                Tidak ada ID/Foto yang diunggah.
              </p>
            )}
          </div>
          {userPhoto && (
            <a
              href={getFileUrl(userPhoto, userPhotoFolder)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block w-full sm:w-auto bg-blue-600 text-white text-xs px-5 py-2.5 rounded-lg hover:bg-blue-700 font-semibold"
            >
              Buka Gambar di Tab Baru
            </a>
          )}
        </div>
      )}

      {/* 3. TAMPILAN SURAT TUGAS */}
      {currentView === "surat-tugas" && (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 max-w-xl mx-auto border border-gray-100">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-1">
            Surat Tugas (ST)
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 mb-5">
            Berikut adalah daftar file surat tugas Anda.
          </p>

          {(() => {
            const rawString = profile?.st_file || profile?.surat_tugas || "";
            const allFiles = rawString
              ? rawString.split(",").map((f: string) => f.trim())
              : [];
            const displayFiles = allFiles.slice(0, 3);
            const stFolder = isNonFronting ? "surat_tugas" : "";

            if (
              displayFiles.length === 0 ||
              (displayFiles.length === 1 && displayFiles[0] === "")
            ) {
              return (
                <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                  <p className="text-sm text-gray-400">
                    Belum ada Surat Tugas yang diunggah.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {displayFiles.map((fileName: string, index: number) => (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0">
                      <span className="text-2xl shrink-0">📄</span>
                      <div className="truncate min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          Surat Tugas {index + 1}
                        </p>
                        <p
                          className="text-[11px] text-gray-400 truncate"
                          title={fileName}
                        >
                          {fileName}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto shrink-0">
                      <a
                        href={getFileUrl(fileName, stFolder)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial text-center bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3.5 py-2 rounded-md transition-colors"
                      >
                        Lihat
                      </a>
                      <a
                        href={getFileUrl(fileName, stFolder)}
                        download
                        className="flex-1 sm:flex-initial text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-md transition-colors shadow-sm"
                      >
                        Unduh
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* 4. TAMPILAN QnA */}
      {currentView === "qna" && <QnaView />}

      {/* 5. TAMPILAN PELAPORAN KE SUPERVISOR & ADMIN MO */}
      {/* 5. TAMPILAN PELAPORAN KE SUPERVISOR & ADMIN MO */}
      {currentView === "laporan-aduan" && (
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <div className="flex items-start gap-3 mb-4 border-b border-gray-100 pb-4">
            <span className="text-2xl sm:text-3xl shrink-0">📝</span>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                {isNonFronting
                  ? "Pelaporan Pegawai ke Supervisor & Admin MO"
                  : "Laporan Kegiatan & Aduan"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {isNonFronting
                  ? "Kirimkan laporan kegiatan lapangan beserta dokumentasi foto kepada Supervisor dan Admin MO."
                  : "Kirimkan dokumentasi kegiatan atau laporan permasalahan."}
              </p>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3.5 sm:p-4 mb-6 rounded-r-lg shadow-sm">
            <div className="flex">
              <div className="shrink-0">
                <svg
                  className="h-5 w-5 text-yellow-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-xs sm:text-sm text-yellow-700 font-bold uppercase">
                  Pemberitahuan Sistem
                </p>
                <p className="text-xs sm:text-sm text-yellow-700 mt-1">
                  {isNonFronting
                    ? "Laporan yang dikirim akan otomatis diteruskan kepada pihak Admin MO dan Supervisor (SPV)."
                    : "Laporan/Aduan Anda akan tersimpan di database sistem (QnA) dan otomatis mengirimkan notifikasi ke Leader Area serta Super Admin."}
                </p>
              </div>
            </div>
          </div>

          {laporanMsg.text && (
            <div
              className={`p-3.5 rounded-lg mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                laporanMsg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {laporanMsg.type === "success" ? "✅" : "⚠️"} {laporanMsg.text}
            </div>
          )}

          <form onSubmit={handleSubmitLaporan} className="space-y-5">
            {isNonFronting ? (
              <div className="p-3.5 sm:p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center gap-3">
                <span className="text-2xl shrink-0">👥</span>
                <div>
                  <p className="text-[11px] text-indigo-500 font-bold uppercase tracking-wider">
                    Tujuan Penerima Laporan
                  </p>
                  <p className="text-sm font-bold text-indigo-900">
                    Admin MO & Supervisor (SPV)
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                <span className="text-2xl shrink-0">🔔</span>
                <div>
                  <p className="text-[11px] text-blue-600 font-bold uppercase tracking-wider">
                    Tujuan Penerima & Notifikasi Otomatis
                  </p>
                  <p className="text-sm font-bold text-blue-900">
                    Leader Area ({profile?.leader || "Leader"}) & Super Admin
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Upload Foto Kegiatan / Bukti{" "}
                <span className="text-xs text-gray-400 font-normal">
                  (Opsional)
                </span>
              </label>
              <input
                type="file"
                id="foto-laporan"
                accept="image/*"
                onChange={(e) =>
                  setLaporanFoto(e.target.files ? e.target.files[0] : null)
                }
                className="w-full border border-gray-300 rounded-lg p-2 text-xs sm:text-sm text-gray-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-md file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Keterangan / Detail Laporan{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={laporanPesan}
                onChange={(e) => setLaporanPesan(e.target.value)}
                placeholder="Tuliskan keterangan laporan, kegiatan, atau kendala di sini..."
                className="w-full border border-gray-300 rounded-lg p-3 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors resize-y"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingLaporan || !laporanPesan.trim()}
                className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
              >
                {isSubmittingLaporan ? "Mengirim..." : "Kirim Pelaporan ➤"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. TAMPILAN PENGAJUAN IZIN / CUTI (PEGAWAI NON-FRONTING) */}
      {currentView === "pengajuan-izin" && (
        <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
            <div className="flex items-start gap-3 mb-4 border-b border-gray-100 pb-4">
              <span className="text-2xl sm:text-3xl shrink-0">🏖️</span>
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                  Form Pengajuan Izin & Cuti
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Permohonan izin atau cuti ini akan langsung diteruskan ke
                  Supervisor untuk proses approval.
                </p>
              </div>
            </div>

            {izinMsg.text && (
              <div
                className={`p-3.5 rounded-lg mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                  izinMsg.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {izinMsg.type === "success" ? "✅" : "⚠️"} {izinMsg.text}
              </div>
            )}

            <form onSubmit={handleSubmitIzin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Jenis Perizinan <span className="text-red-500">*</span>
                </label>
                <select
                  value={jenisIzin}
                  onChange={(e) => setJenisIzin(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-base md:text-sm bg-white text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                >
                  <option value="Sakit">Sakit</option>
                  <option value="Izin Keperluan Pribadi">
                    Izin Keperluan Pribadi
                  </option>
                  <option value="Cuti Tahunan">Cuti Tahunan</option>
                  <option value="Cuti Khusus">Cuti Khusus</option>
                  <option value="Dinas Luar">Dinas Luar</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Tanggal Mulai <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd-MM-yyyy"
                      maxLength={10}
                      value={tanggalMulai}
                      onChange={(e) =>
                        applyTanggalMulai(maskDDMMYYYY(e.target.value))
                      }
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker(mulaiPickerRef)}
                      title="Pilih Tanggal Mulai dari Kalender"
                      className="absolute right-3 text-gray-500 hover:text-emerald-600 text-base cursor-pointer"
                    >
                      📅
                    </button>
                    <input
                      ref={mulaiPickerRef}
                      type="date"
                      tabIndex={-1}
                      value={formatToISO(tanggalMulai)}
                      min={todayISO}
                      onChange={(e) =>
                        applyTanggalMulai(formatToDDMMYYYY(e.target.value))
                      }
                      className="sr-only"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    Tanggal Selesai <span className="text-red-500">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd-MM-yyyy"
                      maxLength={10}
                      value={tanggalSelesai}
                      onChange={(e) =>
                        applyTanggalSelesai(maskDDMMYYYY(e.target.value))
                      }
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => openDatePicker(selesaiPickerRef)}
                      title="Pilih Tanggal Selesai dari Kalender"
                      className="absolute right-3 text-gray-500 hover:text-emerald-600 text-base cursor-pointer"
                    >
                      📅
                    </button>
                    <input
                      ref={selesaiPickerRef}
                      type="date"
                      tabIndex={-1}
                      value={formatToISO(tanggalSelesai)}
                      min={
                        isValidDDMMYYYY(tanggalMulai)
                          ? formatToISO(tanggalMulai)
                          : todayISO
                      }
                      onChange={(e) =>
                        applyTanggalSelesai(formatToDDMMYYYY(e.target.value))
                      }
                      className="sr-only"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  Alasan / Keterangan <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Tuliskan keterangan izin atau diagnosa sakit secara jelas..."
                  className="w-full border border-gray-300 rounded-xl p-3 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  Lampiran File Bukti{" "}
                  <span className="text-gray-400 font-normal lowercase">
                    (opsional / surat dokter)
                  </span>
                </label>

                <div className="mb-2.5 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2.5">
                  <span className="text-base leading-none mt-0.5">⚠️</span>
                  <div>
                    <p className="font-bold">Perhatian Format File Bukti:</p>
                    <p className="mt-0.5 leading-relaxed">
                      Sistem{" "}
                      <strong>
                        hanya menerima file bukti berupa gambar berformat .JPG
                        atau .JPEG
                      </strong>{" "}
                      (maksimal 5MB). File format{" "}
                      <strong>PDF, PNG, atau lainnya tidak dapat diproses</strong>
                      .
                    </p>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,image/jpeg"
                  onChange={handleFileBuktiChange}
                  className="w-full border border-gray-300 rounded-xl p-2 text-xs text-gray-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />

                {fileError && (
                  <p className="mt-1.5 text-xs font-semibold text-red-600 flex items-center gap-1">
                    <span>❌</span> {fileError}
                  </p>
                )}

                {fileBukti && filePreviewUrl && !fileError && (
                  <div className="mt-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs text-emerald-900">
                      <span className="truncate font-semibold">
                        ✅ {fileBukti.name}
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="text-red-600 font-bold hover:underline ml-2 shrink-0"
                      >
                        Hapus
                      </button>
                    </div>
                    <img
                      src={filePreviewUrl}
                      alt="Preview Bukti"
                      className="w-full max-h-44 object-contain rounded-lg border border-emerald-200 bg-white"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-xl text-sm shadow-sm transition-colors cursor-pointer"
              >
                {isSubmitting ? "Mengirim Pengajuan..." : "Kirim Pengajuan Izin"}
              </button>
            </form>
          </div>

          {/* Tabel Riwayat Pengajuan Izin */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                  Riwayat & Status Approval Izin
                </h3>
                <p className="text-xs sm:text-sm text-gray-500">
                  Pantau persetujuan permohonan izin dari Supervisor Anda.
                </p>
              </div>
              <button
                onClick={fetchRiwayatIzin}
                className="w-full sm:w-auto bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"
              >
                🔄 Refresh
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                    <th className="px-4 sm:px-6 py-3.5 font-bold">Jenis Izin</th>
                    <th className="px-4 sm:px-6 py-3.5 font-bold">
                      Periode Tanggal
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 font-bold">
                      Alasan / Keterangan
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 font-bold">File Bukti</th>
                    <th className="px-4 sm:px-6 py-3.5 font-bold text-center">
                      Status Approval
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingIzin ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-gray-400 text-sm animate-pulse"
                      >
                        Memuat riwayat permohonan...
                      </td>
                    </tr>
                  ) : riwayatIzin.length > 0 ? (
                    riwayatIzin.map((item, idx) => {
                      const statusUpper = String(
                        item.status || ""
                      ).toUpperCase();
                      const statusBadge =
                        statusUpper === "DISETUJUI"
                          ? "bg-green-100 text-green-700 border-green-200"
                          : statusUpper === "DITOLAK"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : "bg-amber-100 text-amber-700 border-amber-200";

                      const alasanText = item.alasan || item.keterangan || "-";
                      const buktiRaw =
                        item.file_bukti || item.file_lampiran || "";
                      const buktiHref = buktiRaw
                        ? buktiRaw.startsWith("http://") ||
                          buktiRaw.startsWith("https://") ||
                          buktiRaw.startsWith("/")
                          ? buktiRaw
                          : getFileUrl(buktiRaw, "izin")
                        : "";

                      return (
                        <tr
                          key={item.id || idx}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">
                            {item.jenis_izin}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                            {item.tanggal_mulai
                              ? formatToDDMMYYYY(item.tanggal_mulai)
                              : "-"}{" "}
                            s/d{" "}
                            {item.tanggal_selesai
                              ? formatToDDMMYYYY(item.tanggal_selesai)
                              : "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 min-w-[200px] max-w-xs">
                            <p className="truncate" title={alasanText}>
                              {alasanText}
                            </p>
                            {item.catatan_spv && (
                              <p className="text-xs text-blue-700 mt-1 font-medium">
                                Catatan SPV: {item.catatan_spv}
                              </p>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">
                            {buktiHref ? (
                              <a
                                href={buktiHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline font-semibold text-xs inline-flex items-center gap-1"
                              >
                                🖼️ Lihat Bukti
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center whitespace-nowrap">
                            <span
                              className={`text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide border ${statusBadge}`}
                            >
                              {item.status || "PENDING"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-gray-500 text-sm"
                      >
                        Belum ada riwayat pengajuan izin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. STATUS PERKIRAAN PEMASUKAN / GAJI BULANAN */}
      {currentView === "status-pemasukan" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800">
                {isNonFronting
                  ? "Rekap Histori Gaji Bulanan"
                  : "Daftar Status Perkiraan Pemasukan"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Memantau status pencairan dana Anda.
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
                className="w-full md:w-64 p-2.5 border border-gray-300 text-base md:text-sm font-bold text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                onClick={fetchPerkiraanPemasukan}
                className="w-full sm:w-auto whitespace-nowrap bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors"
              >
                🔄 Muat Ulang
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                  {isNonFronting ? (
                    <>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Periode / Tanggal
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Unit Kerja
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Gaji Pokok
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Total Diterima
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold text-center">
                        Status
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">Tanggal</th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Nama Fronting
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Nama Nasabah
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">
                        Nama Produk
                      </th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">Area</th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold">Nominal</th>
                      <th className="px-4 sm:px-6 py-3.5 font-bold text-center">
                        Status
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoadingPerkiraan ? (
                  <tr>
                    <td
                      colSpan={isNonFronting ? 5 : 7}
                      className="px-6 py-8 text-center text-gray-400 text-sm animate-pulse"
                    >
                      Memuat data...
                    </td>
                  </tr>
                ) : currentPerkiraanList.length > 0 ? (
                  currentPerkiraanList.map((item, idx) => (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      {isNonFronting ? (
                        <>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-700">
                            {item.periode ||
                              (item.created_at
                                ? new Date(item.created_at).toLocaleDateString(
                                    "id-ID"
                                  )
                                : "-")}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-900">
                            {item.unit_kerja || "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-600">
                            Rp{" "}
                            {Number(item.gaji_pokok || 0).toLocaleString(
                              "id-ID"
                            )}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                            Rp{" "}
                            {Number(
                              item.total_gaji || item.up_pengajuan || 0
                            ).toLocaleString("id-ID")}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                                item.status === "Disetujui" ||
                                item.status === "Selesai"
                                  ? "bg-green-100 text-green-700"
                                  : item.status === "Ditolak"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {item.status || "Pending"}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 sm:px-6 py-4 text-sm text-gray-700">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString(
                                  "id-ID"
                                )
                              : "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-900">
                            {item.nama_fronting || "-"}
                          </td>
                          <td
                            className="px-4 sm:px-6 py-4 text-sm text-gray-600 max-w-xs truncate"
                            title={item.nama_nasabah}
                          >
                            {item.nama_nasabah || "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-900">
                            {item.produk || "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm font-semibold text-gray-900">
                            {item.area || "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                            {item.up_pengajuan
                              ? `Rp ${Number(item.up_pengajuan).toLocaleString(
                                  "id-ID"
                                )}`
                              : "-"}
                          </td>
                          <td className="px-4 sm:px-6 py-4 text-center">
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
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={isNonFronting ? 5 : 7}
                      className="px-6 py-10 text-center text-gray-500 text-sm"
                    >
                      Tidak ada data pembayaran/pemasukan.
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

      {/* TAMPILAN MENU PESAN & BALASAN */}
      {currentView === "riwayat-pesan" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-4xl mx-auto">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-800">
                Riwayat Pesan & Balasan
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Daftar tanggapan atau informasi dari Supervisor dan Admin MO.
              </p>
            </div>
            <button
              onClick={fetchRiwayatPesan}
              className="w-full sm:w-auto shrink-0 whitespace-nowrap bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
            >
              🔄 Muat Ulang
            </button>
          </div>

          <div className="max-h-[65dvh] overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4">
            {riwayatPesan.length > 0 ? (
              riwayatPesan.map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 hover:border-blue-300 transition-all"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-700 rounded uppercase">
                        {item.pengirim_role || "Sistem"}
                      </span>
                      {renderJenisBadge(
                        item.jenis_pengumuman || item.tipe_pesan
                      )}
                    </div>
                    <p className="text-sm text-gray-800 font-medium line-clamp-2">
                      {item.konten}
                    </p>
                    <span className="text-xs text-gray-400 block">
                      {new Date(item.created_at).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  <button
                    onClick={() => setSelectedPesanku(item)}
                    className="w-full sm:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    Buka Detail &rarr;
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl block mb-2">📭</span>
                <p className="text-sm font-medium">
                  Belum ada riwayat pesan atau balasan.
                </p>
              </div>
            )}
          </div>

          {selectedPesanku && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90dvh]">
                <div className="bg-blue-600 text-white p-4 sm:p-5 flex justify-between items-start gap-3 shrink-0">
                  <div className="min-w-0">
                    <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {selectedPesanku.tipe_pesan}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold mt-1 break-words">
                      Detail Percakapan dengan: {selectedPesanku.pengirim_role}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedPesanku(null)}
                    className="text-white hover:bg-blue-700 w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto space-y-4 bg-gray-50 flex-1">
                  <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 text-xs text-gray-400 border-b pb-2">
                      <span className="font-bold text-indigo-600 uppercase">
                        Pengirim: {selectedPesanku.pengirim_role}
                      </span>
                      <span>
                        {new Date(selectedPesanku.created_at).toLocaleString(
                          "id-ID",
                          { dateStyle: "medium", timeStyle: "short" }
                        )}
                      </span>
                    </div>

                    <div className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium break-words">
                      {selectedPesanku.konten}
                    </div>

                    {selectedPesanku.file_lampiran && (
                      <div className="pt-3 border-t border-gray-100">
                        <a
                          href={getFileUrl(
                            selectedPesanku.file_lampiran,
                            "non-fronting"
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 font-semibold bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors border border-indigo-100 break-all"
                        >
                          📎 Lihat Lampiran File (
                          {selectedPesanku.file_lampiran})
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-100 px-4 sm:px-6 py-3.5 border-t border-gray-200 flex justify-end shrink-0">
                  <button
                    onClick={() => setSelectedPesanku(null)}
                    className="w-full sm:w-auto bg-gray-600 hover:bg-gray-700 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors shadow-sm"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. TAMPILAN MENU PENGUMUMAN (UMUM, PRODUK, PRIBADI) */}
      {currentView.includes("pengumuman") && (
        <div className="max-w-4xl mx-auto">
          {selectedPengumuman ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
              <div className="space-y-5">
                <div className="border-b border-gray-100 pb-4 flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {renderJenisBadge(
                        selectedPengumuman.jenis_pengumuman ||
                          selectedPengumuman.tipe_pesan
                      )}
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 mt-3 break-words">
                      {selectedPengumuman.judul ||
                        selectedPengumuman.tipe_pesan ||
                        "Detail Informasi"}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedPengumuman(null)}
                    className="text-sm text-gray-500 hover:text-indigo-600 underline font-medium self-start"
                  >
                    &larr; Kembali ke Daftar
                  </button>
                </div>

                <div className="bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-200">
                  <p className="text-sm sm:text-base text-gray-800 whitespace-pre-line leading-relaxed break-words">
                    {selectedPengumuman.konten || selectedPengumuman.isi}
                  </p>
                </div>

                {selectedPengumuman.file_lampiran &&
                  selectedPengumuman.file_lampiran !== "NULL" && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50 border border-indigo-100 p-4 rounded-xl mt-4">
                      <div className="flex items-center gap-3 overflow-hidden min-w-0">
                        <span className="text-2xl shrink-0">📁</span>
                        <div className="flex-1 truncate min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-indigo-900 truncate">
                            {selectedPengumuman.file_lampiran}
                          </p>
                        </div>
                      </div>
                      <a
                        href={getFileUrl(
                          selectedPengumuman.file_lampiran,
                          "super-admin/pengumuman"
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto text-center bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm transition-colors whitespace-nowrap"
                      >
                        Buka Dokumen
                      </a>
                    </div>
                  )}

                {currentView === "pengumuman-pribadi" &&
                  selectedPengumuman.tipe_pesan
                    ?.toLowerCase()
                    .includes("surat perintah tugas") && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">✍️</span>
                        <h3 className="text-base sm:text-lg font-bold text-gray-800">
                          Balas Surat Tugas
                        </h3>
                      </div>

                      <form
                        onSubmit={handleKirimBalasan}
                        className="space-y-4 bg-blue-50/50 p-4 sm:p-5 rounded-xl border border-blue-100"
                      >
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Pesan Balasan{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            required
                            rows={3}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Tuliskan konfirmasi atau laporan terkait surat tugas ini..."
                            className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 text-base md:text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors bg-white resize-y"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">
                            Lampiran Dokumen / Bukti{" "}
                            <span className="text-xs text-gray-500 font-normal">
                              (Opsional)
                            </span>
                          </label>
                          <input
                            type="file"
                            ref={fileReplyRef}
                            accept=".pdf, image/jpeg, image/png, image/jpg"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                setReplyFile(e.target.files[0]);
                              } else {
                                setReplyFile(null);
                              }
                            }}
                            className="w-full text-xs sm:text-sm text-gray-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition cursor-pointer bg-white border border-gray-200 rounded-lg p-1.5"
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={isSubmittingReply || !replyText.trim()}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                          >
                            {isSubmittingReply
                              ? "Mengirim..."
                              : "Kirim Balasan ➤"}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
              </div>
            </div>
          ) : currentView === "pengumuman-umum" ? (
            <PengumumanKategoriView
              isNonFronting={isNonFronting}
              kategoriFilter="UMUM"
              title="📢 Pengumuman Umum"
              subtitle="Informasi dan pengumuman penting terbaru dari manajemen pusat."
              onSelectPengumuman={(item) => setSelectedPengumuman(item)}
            />
          ) : currentView === "pengumuman-produk" ? (
            <PengumumanKategoriView
              isNonFronting={isNonFronting}
              kategoriFilter="PRODUK_INFORMASI"
              title="📦 Pengumuman Produk & Informasi"
              subtitle="Kumpulan informasi terbaru mengenai produk, layanan, dan promo perusahaan."
              onSelectPengumuman={(item) => setSelectedPengumuman(item)}
            />
          ) : currentView === "pengumuman-pribadi" ? (
            <PengumumanKategoriView
              isNonFronting={isNonFronting}
              kategoriFilter="PRIBADI"
              title="🔒 Pesan & Pengumuman Pribadi"
              subtitle="Pesan, instruksi tugas, dan peringatan khusus yang ditujukan langsung kepada Anda."
              onSelectPengumuman={(item) => setSelectedPengumuman(item)}
              userNik={profile?.nik || session?.user?.name || ""}
              notifikasiList={notifikasi}
            />
          ) : null}
        </div>
      )}

      {/* 9. GANTI PASSWORD */}
      {currentView === "ganti-password" && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <div className="flex items-start gap-3 mb-6 border-b border-gray-100 pb-4">
            <span className="text-2xl sm:text-3xl shrink-0">🔑</span>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                Ganti Password Akun
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Pastikan Anda menggunakan password yang kuat dan mudah diingat.
              </p>
            </div>
          </div>
          {passwordMsg.text && (
            <div
              className={`p-3.5 rounded-lg mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
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
                  className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
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
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
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
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 font-medium outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isSubmittingPassword ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL ABSENSI REALTIME --- */}
      {showAbsenModal && (
        <div className="fixed inset-0 bg-black/75 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92dvh]">
            <div
              className={`p-4 text-white font-bold flex justify-between items-center shrink-0 ${
                absenType === "Masuk" ? "bg-indigo-600" : "bg-emerald-600"
              }`}
            >
              <h3 className="text-base sm:text-lg">
                📸 Konfirmasi Absen {absenType}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-white hover:text-gray-200 w-8 h-8 flex items-center justify-center rounded-full text-xl"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={submitAbsenRealtime}
              className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1"
            >
              {/* Bagian Lokasi */}
              <div className="bg-gray-50 p-3.5 sm:p-4 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 font-bold mb-1.5 uppercase">
                  📍 Lokasi Saat Ini
                </p>
                {isLocating ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <span className="animate-spin text-xl">⏳</span> Sedang
                    mencari sinyal GPS...
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm font-medium text-gray-800 break-words">
                    <p>{absenLocation.address || "Alamat tidak ditemukan"}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Lat: {absenLocation.lat} | Lng: {absenLocation.lng}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={getGeoLocation}
                  className="mt-2.5 text-xs bg-white border border-gray-300 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-100 transition"
                >
                  🔄 Refresh Lokasi
                </button>
              </div>

              {/* Bagian Foto dengan Live Camera */}
              <div>
                <p className="text-xs text-gray-500 font-bold mb-2 uppercase">
                  📸 Foto Selfie Absen
                </p>

                {absenPhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-300">
                    <img
                      src={absenPhotoPreview}
                      alt="Preview Absen"
                      className="w-full h-48 sm:h-52 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAbsenPhoto(null);
                        setAbsenPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-md font-bold shadow transition-colors"
                    >
                      🗑️ Hapus & Ulangi
                    </button>
                  </div>
                ) : isCameraOpen ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-indigo-300 bg-black flex flex-col items-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-52 sm:h-56 object-cover transform scale-x-[-1]"
                    ></video>

                    <div className="absolute bottom-2 flex gap-2 w-full px-3 justify-center">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="bg-red-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow hover:bg-red-600 flex-1"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-indigo-600 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow hover:bg-indigo-700 flex items-center justify-center gap-1 flex-1"
                      >
                        📸 Jepret Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center w-full h-44 sm:h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition group"
                  >
                    <span className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                      🤳
                    </span>
                    <span className="text-sm font-semibold text-gray-600 group-hover:text-indigo-600">
                      Ketuk untuk Buka Kamera
                    </span>
                  </button>
                )}

                <canvas ref={canvasRef} className="hidden"></canvas>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLocating || !absenPhoto || isSubmittingAbsen}
                  className={`w-full text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm ${
                    absenType === "Masuk"
                      ? "bg-indigo-600 hover:bg-indigo-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isSubmittingAbsen
                    ? "Memproses..."
                    : `Kirim Absen ${absenType} Sekarang ➤`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleSidebarLayout>
  );
}

export default function PegawaiDashboard() {
  return <PegawaiDashboardContent />;
}