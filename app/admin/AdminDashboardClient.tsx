"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import * as XLSX from "xlsx";
import RoleSidebarLayout from "@/app/components/RoleSidebarLayout";

// --- INTERFACES ---
export interface DataLeader {
  id: number;
  nama_leader: string;
  kanwil: string;
  area: string;
  penempatan: string;
}

export interface MasterPegawai {
  id: number;
  nama: string;
  nik: string;
  kanwil: string;
  area: string;
  penempatan: string;
  leader: string;
  email: string;
  nowa: string;
  jenis_pegawai: string;
  estimasi?: number | string;
}

export interface MasterWilayahItem {
  kanwil: string;
  area: string;
  penempatan: string;
}

export interface PegawaiSingkat {
  nama: string;
  nik: string;
}

// Interface untuk Kotak Masuk Umum (Direktur / HRD / MO)
export interface PesanMasuk {
  id: number;
  pengirim_role: string;
  penerima_nik: string;
  tipe_pesan: string;
  konten: string;
  file_lampiran?: string;
  file_sanggahan?: string;
  tanggapan_direktur?: string;
  created_at: string;
  is_read: number;
}

// Interface untuk Jumlah Non-Fronting
export interface NonFrontingCounts {
  obCs: number;
  security: number;
  driver: number;
  teknisi: number;
  gondola: number;
}

export interface AdminDashboardProps {
  areaList: string[];
  frontingCount: number;
  dataLeaders: DataLeader[];
  masterWilayah: MasterWilayahItem[];
  dataJabatan: string[];
  listPegawai: PegawaiSingkat[];
  loggedInJabatan: string;
  nonFrontingCounts?: NonFrontingCounts;
}

const AnimatedNumber = ({ endValue }: { endValue: number }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1500;
    const increment = endValue / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= endValue) {
        setCount(endValue);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [endValue]);
  return <span>{count}</span>;
};

export default function AdminDashboardClient({
  areaList = [],
  frontingCount = 0,
  dataLeaders = [],
  masterWilayah = [],
  dataJabatan = [],
  listPegawai = [],
  loggedInJabatan = "admin",
  nonFrontingCounts = {
    obCs: 0,
    security: 0,
    driver: 0,
    teknisi: 0,
    gondola: 0,
  },
}: AdminDashboardProps) {
  const [userRole, setUserRole] = useState(loggedInJabatan);

  useEffect(() => {
    setUserRole(loggedInJabatan);
  }, [loggedInJabatan]);

  const [openDropdown, setOpenDropdown] = useState<string | null>("fronting");
  const [activeView, setActiveView] = useState<
    | "dashboard"
    | "search-leader"
    | "search-fronting"
    | "search-kanwil-garapan"
    | "pesan"
    | "kotak-masuk"
    | "rekap-absen"
  >("dashboard");

  // State Pencarian Leader
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeader, setSelectedLeader] = useState<DataLeader | null>(null);
  const [frontingResults, setFrontingResults] = useState<
    MasterPegawai[] | null
  >(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // State Multi-Filter
  const [searchKanwil, setSearchKanwil] = useState("");
  const [searchArea, setSearchArea] = useState("");
  const [searchPenempatan, setSearchPenempatan] = useState("");
  const [multiFilterResults, setMultiFilterResults] = useState<
    MasterPegawai[] | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  // Sub-Menu Kanwil Garapan
  const [selectedKanwilGarapan, setSelectedKanwilGarapan] = useState("");
  const [leaderResults, setLeaderResults] = useState<DataLeader[] | null>(null);

  // --- STATE UNTUK MENU PESAN ---
  const [pesanTujuan, setPesanTujuan] = useState("");
  const [pesanTipe, setPesanTipe] = useState("Pesan Umum");
  const [pesanKonten, setPesanKonten] = useState("");
  const [pesanLampiran, setPesanLampiran] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Ref untuk mengontrol elemen file input kirim pesan & balas pesan
  const fileKirimPesanRef = useRef<HTMLInputElement>(null);
  const fileBalasPesanRef = useRef<HTMLInputElement>(null);

  // --- STATE KOTAK MASUK (UNTUK DIREKTUR, HRD, MO, DLL) ---
  const [listPesanMasuk, setListPesanMasuk] = useState<PesanMasuk[]>([]);
  const [selectedPesan, setSelectedPesan] = useState<PesanMasuk | null>(null);
  const [tanggapanText, setTanggapanText] = useState("");
  const [fileSanggahan, setFileSanggahan] = useState<File | null>(null);
  const [isSubmittingTanggapan, setIsSubmittingTanggapan] = useState(false);

  const [absenBulan, setAbsenBulan] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [isExportingAbsen, setIsExportingAbsen] = useState(false);

  // --- STATE TAMBAHAN UNTUK THREAD HISTORY KOTAK MASUK ---
  const [conversationHistory, setConversationHistory] = useState<PesanMasuk[]>(
    []
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleDownloadAbsen = async () => {
    if (!absenBulan) return;
    setIsExportingAbsen(true);

    try {
      const res = await fetch(`/api/pegawai/absen-export?bulan=${absenBulan}`);
      const result = await res.json();

      if (result.success && result.data.length > 0) {
        const ws = XLSX.utils.json_to_sheet(result.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");

        XLSX.writeFile(wb, `Rekap_Absensi_${absenBulan}.xlsx`);
      } else {
        alert("Tidak ada data absensi pada bulan tersebut.");
      }
    } catch (error) {
      alert("Gagal mengunduh file.");
    } finally {
      setIsExportingAbsen(false);
    }
  };

  const handleOpenPesan = async (pesan: PesanMasuk) => {
    setSelectedPesan(pesan);
    setIsLoadingHistory(true);

    if (pesan.is_read === 0) {
      try {
        await fetch("/api/kirim-pesan/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: pesan.id }),
        });
        setListPesanMasuk(
          listPesanMasuk.map((item) =>
            item.id === pesan.id ? { ...item, is_read: 1 } : item
          )
        );
      } catch (error) {
        console.error("Gagal menandai pesan dibaca", error);
      }
    }

    try {
      const pihakLain = pesan.pengirim_role;
      const res = await fetch(
        `/api/kirim-pesan/history?pihak1=${encodeURIComponent(
          userRole
        )}&pihak2=${encodeURIComponent(pihakLain)}`
      );
      const data = await res.json();
      if (data.success) {
        setConversationHistory(data.data);
      }
    } catch (error) {
      console.error("Gagal memuat history percakapan", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fungsi untuk pindah menu sekaligus membersihkan seluruh state pencarian/filter
  const handleViewChange = (
    newView:
      | "dashboard"
      | "search-leader"
      | "search-fronting"
      | "search-kanwil-garapan"
      | "pesan"
      | "kotak-masuk"
      | "rekap-absen"
  ) => {
    setSearchQuery("");
    setSelectedLeader(null);
    setFrontingResults(null);
    setShowAutocomplete(false);
    setSearchKanwil("");
    setSearchArea("");
    setSearchPenempatan("");
    setMultiFilterResults(null);
    setSelectedKanwilGarapan("");
    setLeaderResults(null);
    setSelectedPesan(null);
    setTanggapanText("");
    setFileSanggahan(null);

    setActiveView(newView);
  };

  // Fetch Kotak Masuk otomatis berdasarkan role yang sedang aktif
  useEffect(() => {
    fetchKotakMasuk();
  }, [userRole]);

  const fetchKotakMasuk = async () => {
    try {
      const res = await fetch("/api/kirim-pesan/inbox");
      const data = await res.json();
      if (data.success) {
        setListPesanMasuk(data.data);
      }
    } catch (error) {
      console.error("Gagal mengambil kotak masuk", error);
    }
  };

  // --- LOGIKA CASCADING DROPDOWN ---
  const listKanwil = Array.from(
    new Set(masterWilayah.map((item) => item.kanwil))
  );

  const listArea = Array.from(
    new Set(
      masterWilayah
        .filter((item) => !searchKanwil || item.kanwil === searchKanwil)
        .map((item) => item.area)
    )
  );

  const listPenempatan = Array.from(
    new Set(
      masterWilayah
        .filter(
          (item) =>
            (!searchKanwil || item.kanwil === searchKanwil) &&
            (!searchArea || item.area === searchArea)
        )
        .map((item) => item.penempatan)
    )
  );

  const parseJsonString = (str: any): string[] => {
    if (!str) return [];
    if (typeof str !== "string") {
      try {
        return [String(str)];
      } catch (e) {
        return [];
      }
    }
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
      return [str];
    } catch (e) {
      return [str.replace(/[\[\]"]/g, "").trim()];
    }
  };

  const listKanwilGarapan = Array.from(
    new Set(dataLeaders.flatMap((leader) => parseJsonString(leader.kanwil)))
  )
    .filter(Boolean)
    .sort();

  const mitraList = ["PT. TRAYA LANGGENG MANDIRI", "PT PEGADAIAN"];

  const pegawaiData = [
    {
      divisi: "Fronting",
      jumlah: frontingCount,
      max: frontingCount > 200 ? frontingCount + 50 : 200,
      color: "bg-blue-500",
    },
    {
      divisi: "OB / CS",
      jumlah: nonFrontingCounts.obCs,
      max: nonFrontingCounts.obCs > 200 ? nonFrontingCounts.obCs + 50 : 200,
      color: "bg-green-500",
    },
    {
      divisi: "Security",
      jumlah: nonFrontingCounts.security,
      max:
        nonFrontingCounts.security > 200
          ? nonFrontingCounts.security + 50
          : 200,
      color: "bg-yellow-500",
    },
    {
      divisi: "Driver",
      jumlah: nonFrontingCounts.driver,
      max: nonFrontingCounts.driver > 200 ? nonFrontingCounts.driver + 50 : 200,
      color: "bg-purple-500",
    },
    {
      divisi: "Teknisi Gedung",
      jumlah: nonFrontingCounts.teknisi,
      max:
        nonFrontingCounts.teknisi > 200 ? nonFrontingCounts.teknisi + 50 : 200,
      color: "bg-red-500",
    },
    {
      divisi: "Tim Gondola",
      jumlah: nonFrontingCounts.gondola,
      max:
        nonFrontingCounts.gondola > 200 ? nonFrontingCounts.gondola + 50 : 200,
      color: "bg-indigo-500",
    },
  ];

  const toggleDropdown = (menuName: string) => {
    setOpenDropdown(openDropdown === menuName ? null : menuName);
  };

  const filteredLeaders = dataLeaders.filter((leader) =>
    leader.nama_leader.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchByLeader = async () => {
    if (!selectedLeader) {
      alert("Silahkan pilih leader terlebih dahulu!");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/get-fronting?leaderName=${encodeURIComponent(
          selectedLeader.nama_leader
        )}`
      );
      if (!response.ok) throw new Error("Gagal mengambil data");
      const data: MasterPegawai[] = await response.json();
      setFrontingResults(data);
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat mengambil data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMultiFilterSearch = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchKanwil) params.append("kanwil", searchKanwil);
      if (searchArea) params.append("area", searchArea);
      if (searchPenempatan) params.append("penempatan", searchPenempatan);

      const response = await fetch(
        `/api/get-fronting/search?${params.toString()}`
      );
      if (!response.ok) throw new Error("Gagal mengambil data");
      const data: MasterPegawai[] = await response.json();
      setMultiFilterResults(data);
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat mencari data fronting.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchLeaderByKanwil = () => {
    if (!selectedKanwilGarapan) {
      alert("Silahkan pilih Kanwil terlebih dahulu!");
      return;
    }
    const results = dataLeaders.filter((leader) => {
      const parsedKanwilArray = parseJsonString(leader.kanwil).map((k) =>
        k.toLowerCase()
      );
      return parsedKanwilArray.includes(selectedKanwilGarapan.toLowerCase());
    });
    setLeaderResults(results);
  };

  const unreadCount = listPesanMasuk.filter((l) => l.is_read === 0).length;

  const viewTitleMap: Record<typeof activeView, string> = {
    dashboard: "Admin Dashboard",
    "search-leader": "Pencarian Data Leader",
    "search-fronting": "Filter Data Fronting",
    "search-kanwil-garapan": "Kanwil Garapan",
    pesan: "Kirim Pesan & Instruksi",
    "kotak-masuk": "Kotak Masuk",
    "rekap-absen": "Rekap Absensi Pegawai",
  };

  const activePageTitle = viewTitleMap[activeView];

  const getSubMenuClass = (viewName: typeof activeView) =>
    `block w-full text-left px-4 py-2 text-sm rounded transition-colors ${
      activeView === viewName
        ? "text-white font-bold bg-gray-800"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;

  // Shortcut tombol kotak masuk di header mobile
  const mobileInboxShortcut = (
    <button
      type="button"
      onClick={() => handleViewChange("kotak-masuk")}
      aria-label="Kotak Masuk"
      className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-full transition"
    >
      <span className="text-lg">📥</span>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full border-2 border-white">
          {unreadCount}
        </span>
      )}
    </button>
  );

  // Isi Sidebar untuk Desktop & Mobile Drawer
  const sidebarContent = (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      <div
        onClick={() => handleViewChange("dashboard")}
        className="p-5 text-lg lg:text-xl font-bold border-b border-gray-700 text-center tracking-wider cursor-pointer hover:bg-gray-800/60 transition"
      >
        ADMIN PANEL
        <span className="block text-[11px] font-semibold text-indigo-400 uppercase mt-0.5 tracking-widest">
          {userRole}
        </span>
      </div>

      <div className="p-4 flex-grow overflow-y-auto space-y-1">
        <button
          type="button"
          onClick={() => handleViewChange("dashboard")}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
            activeView === "dashboard"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          📊 DASHBOARD
        </button>

        {/* FRONTING ACCORDION */}
        <div>
          <button
            type="button"
            data-no-close="true"
            aria-expanded={openDropdown === "fronting"}
            onClick={() => toggleDropdown("fronting")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <span>👥 FRONTING</span>
            <span>{openDropdown === "fronting" ? "▾" : "◀"}</span>
          </button>
          {openDropdown === "fronting" && (
            <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => handleViewChange("search-leader")}
                  className={getSubMenuClass("search-leader")}
                >
                  - Nama Leader
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleViewChange("search-fronting")}
                  className={getSubMenuClass("search-fronting")}
                >
                  - Nama Fronting
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleViewChange("search-kanwil-garapan")}
                  className={getSubMenuClass("search-kanwil-garapan")}
                >
                  - Kanwil Garapan
                </button>
              </li>
            </ul>
          )}
        </div>

        {/* SECURITY / DRIVER ACCORDION */}
        <div>
          <button
            type="button"
            data-no-close="true"
            aria-expanded={openDropdown === "security"}
            onClick={() => toggleDropdown("security")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <span>🛡️ SECURITY / DRIVER</span>
            <span>{openDropdown === "security" ? "▾" : "◀"}</span>
          </button>
          {openDropdown === "security" && (
            <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
              <li>
                <Link
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                >
                  - Data Security
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                >
                  - Data Driver
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* OB / CS ACCORDION */}
        <div>
          <button
            type="button"
            data-no-close="true"
            aria-expanded={openDropdown === "obcs"}
            onClick={() => toggleDropdown("obcs")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <span>🧹 OB / CS</span>
            <span>{openDropdown === "obcs" ? "▾" : "◀"}</span>
          </button>
          {openDropdown === "obcs" && (
            <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
              <li>
                <Link
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                >
                  - Data OB / CS
                </Link>
              </li>
            </ul>
          )}
        </div>

        {/* TEKNISI ACCORDION */}
        <div>
          <button
            type="button"
            data-no-close="true"
            aria-expanded={openDropdown === "teknisi"}
            onClick={() => toggleDropdown("teknisi")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 rounded-md transition-colors"
          >
            <span>🔧 TEKNISI</span>
            <span>{openDropdown === "teknisi" ? "▾" : "◀"}</span>
          </button>
          {openDropdown === "teknisi" && (
            <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
              <li>
                <Link
                  href="#"
                  className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                >
                  - Teknisi Gedung
                </Link>
              </li>
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleViewChange("pesan")}
          className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
            activeView === "pesan"
              ? "bg-gray-800 font-bold text-white"
              : "text-gray-300 hover:bg-gray-800 hover:text-white"
          }`}
        >
          ✉️ KIRIM PESAN
        </button>

        <button
          type="button"
          onClick={() => handleViewChange("kotak-masuk")}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-md transition-colors text-sm ${
            activeView === "kotak-masuk"
              ? "bg-red-950/70 font-bold text-red-300 border border-red-800/60"
              : "text-red-300 hover:bg-gray-800 hover:text-red-200"
          }`}
        >
          <span>📥 KOTAK MASUK</span>
          {unreadCount > 0 && (
            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              {unreadCount} Baru
            </span>
          )}
        </button>

        {userRole?.toLowerCase() === "hrd" && (
          <button
            type="button"
            onClick={() => handleViewChange("rekap-absen")}
            className={`w-full text-left px-4 py-3 rounded-md transition-colors text-sm ${
              activeView === "rekap-absen"
                ? "bg-gray-800 text-white font-bold"
                : "text-gray-300 hover:text-white hover:bg-gray-800"
            }`}
          >
            📅 REKAP ABSENSI PEGAWAI
          </button>
        )}
      </div>

      <div className="p-3 border-t border-gray-800">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-colors"
        >
          LOGOUT
        </button>
      </div>
    </div>
  );

  return (
    <RoleSidebarLayout
      title={activePageTitle}
      subtitle={`Jabatan: ${userRole.toUpperCase()}`}
      headerRight={mobileInboxShortcut}
      sidebarContent={sidebarContent}
    >
      {/* HEADER KHUSUS DESKTOP */}
      <div className="hidden lg:flex mb-8 border-b border-gray-200 pb-4 justify-between items-center">
        <div>
          <h1
            onClick={() => handleViewChange("dashboard")}
            className="text-2xl font-bold text-gray-800 uppercase cursor-pointer hover:text-indigo-600 transition"
          >
            {activePageTitle}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Sistem Manajemen Operasional & Kepegawaian
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => handleViewChange("kotak-masuk")}
            className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-red-50 hover:border-red-200 text-gray-700 px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition"
          >
            <span>📥 Kotak Masuk</span>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                {unreadCount} Baru
              </span>
            )}
          </button>

          <span className="text-sm text-gray-600 border-l border-gray-300 pl-4">
            Jabatan:{" "}
            <b className="text-indigo-600 uppercase">{userRole}</b>
          </span>
        </div>
      </div>

      {/* 1. VIEW: DASHBOARD UTAMA */}
      {activeView === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 animate-fade-in">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 uppercase tracking-wide border-b pb-2">
              Jumlah Area
            </h2>
            <ul className="space-y-3 sm:space-y-4">
              {areaList.map((area, index) => (
                <li
                  key={index}
                  className="flex items-center text-sm sm:text-base text-gray-600"
                >
                  <span className="w-2 h-2 bg-gray-300 rounded-full mr-3 shrink-0"></span>
                  <span>{area}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg border border-gray-200">
            <h2 className="text-lg sm:text-xl font-extrabold text-gray-800 mb-5 sm:mb-6 uppercase text-center bg-gray-50 py-3 rounded-lg border">
              Jumlah Pegawai
            </h2>
            <div className="space-y-4 sm:space-y-5">
              {pegawaiData.map((item, index) => (
                <div key={index}>
                  <div className="flex justify-between items-end mb-1">
                    <span className="text-sm font-semibold text-gray-600">
                      {item.divisi}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-gray-800">
                      <AnimatedNumber endValue={item.jumlah} />
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full ${item.color}`}
                      style={{
                        width: `${Math.min(
                          100,
                          (item.jumlah / item.max) * 100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 mb-4 sm:mb-6 uppercase tracking-wide border-b pb-2">
              Mitra
            </h2>
            <ul className="space-y-3 sm:space-y-4">
              {mitraList.map((mitra, index) => (
                <li
                  key={index}
                  className="flex items-center text-sm sm:text-base text-gray-600"
                >
                  <span className="w-2 h-2 bg-gray-300 rounded-full mr-3 shrink-0"></span>
                  <span>{mitra}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2. VIEW: PENCARIAN DATA LEADER */}
      {activeView === "search-leader" && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-5 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 border-l-4 border-blue-500 pl-3">
                Pencarian Data Leader
              </h2>
              <button
                onClick={() => handleViewChange("dashboard")}
                className="text-xs sm:text-sm text-gray-500 hover:text-blue-600 underline self-start sm:self-auto"
              >
                &larr; Kembali ke Dashboard
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-start">
              <div className="relative flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pilih Leader
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowAutocomplete(true);
                    setSelectedLeader(null);
                  }}
                  onFocus={() => setShowAutocomplete(true)}
                  placeholder="Ketik nama leader..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {showAutocomplete && searchQuery && (
                  <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filteredLeaders.length > 0 ? (
                      filteredLeaders.map((leader) => (
                        <li
                          key={leader.id}
                          onClick={() => {
                            setSelectedLeader(leader);
                            setSearchQuery(leader.nama_leader);
                            setShowAutocomplete(false);
                          }}
                          className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 border-b last:border-b-0"
                        >
                          <span className="font-semibold">
                            {leader.nama_leader}
                          </span>{" "}
                          — {leader.area}
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-2.5 text-xs text-gray-400">
                        Leader tidak ditemukan
                      </li>
                    )}
                  </ul>
                )}
              </div>
              <div className="w-full md:w-auto md:pt-6">
                <button
                  onClick={handleSearchByLeader}
                  disabled={isLoading}
                  className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition disabled:opacity-50 text-sm"
                >
                  {isLoading ? "Mencari..." : "Tampilkan Fronting"}
                </button>
              </div>
            </div>
          </div>

          {frontingResults && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">
                Fronting di bawah{" "}
                <span className="text-blue-600">
                  {selectedLeader?.nama_leader}
                </span>
              </h3>
              {frontingResults.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 whitespace-nowrap">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          No
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nama Fronting
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          NIK
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Area / Kanwil
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Penempatan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 whitespace-nowrap">
                      {frontingResults.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm font-medium text-gray-900">
                            {item.nama}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {item.nik}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {item.area} - {item.kanwil}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {item.penempatan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-6 text-sm">
                  Tidak ada data.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. VIEW: CASCADING MULTI-FILTER DROPDOWN */}
      {activeView === "search-fronting" && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-5 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-3">
                Filter Data Fronting
              </h2>
              <button
                onClick={() => handleViewChange("dashboard")}
                className="text-xs sm:text-sm text-gray-500 hover:text-indigo-600 underline self-start sm:self-auto"
              >
                &larr; Kembali ke Dashboard
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kanwil
                </label>
                <input
                  list="kanwil-options"
                  type="text"
                  value={searchKanwil}
                  placeholder="Pilih / ketik Kanwil..."
                  onChange={(e) => {
                    setSearchKanwil(e.target.value);
                    setSearchArea("");
                    setSearchPenempatan("");
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
                <datalist id="kanwil-options">
                  {listKanwil.map((k, i) => (
                    <option key={i} value={k} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Area
                </label>
                <input
                  list="area-options"
                  type="text"
                  value={searchArea}
                  disabled={!searchKanwil}
                  placeholder={
                    searchKanwil
                      ? "Pilih / ketik Area..."
                      : "Pilih Kanwil dahulu"
                  }
                  onChange={(e) => {
                    setSearchArea(e.target.value);
                    setSearchPenempatan("");
                  }}
                  className={`w-full border rounded-lg px-4 py-2.5 text-base md:text-sm outline-none transition-colors ${
                    !searchKanwil
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white border-gray-300 text-gray-800 focus:ring-2 focus:ring-indigo-500"
                  }`}
                />
                <datalist id="area-options">
                  {listArea.map((a, i) => (
                    <option key={i} value={a} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Penempatan
                </label>
                <input
                  list="penempatan-options"
                  type="text"
                  value={searchPenempatan}
                  disabled={!searchArea}
                  placeholder={
                    searchArea
                      ? "Pilih / ketik Penempatan..."
                      : "Pilih Area dahulu"
                  }
                  onChange={(e) => setSearchPenempatan(e.target.value)}
                  className={`w-full border rounded-lg px-4 py-2.5 text-base md:text-sm outline-none transition-colors ${
                    !searchArea
                      ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-white border-gray-300 text-gray-800 focus:ring-2 focus:ring-indigo-500"
                  }`}
                />
                <datalist id="penempatan-options">
                  {listPenempatan.map((p, i) => (
                    <option key={i} value={p} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleMultiFilterSearch}
                disabled={isLoading}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-8 rounded-lg transition shadow-sm disabled:opacity-50 text-sm"
              >
                {isLoading ? "Mencari..." : "Cari Data"}
              </button>
            </div>
          </div>

          {multiFilterResults && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">
                Hasil Pencarian:{" "}
                <span className="text-indigo-600">
                  {multiFilterResults.length} Data Ditemukan
                </span>
              </h3>
              {multiFilterResults.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 whitespace-nowrap">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          No
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nama Fronting
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Kanwil & Area
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Penempatan
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Leader
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Estimasi Pemasukan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 whitespace-nowrap">
                      {multiFilterResults.map((fronting, idx) => (
                        <tr key={fronting.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3.5 text-sm text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-medium text-gray-900">
                            {fronting.nama}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-500">
                            {fronting.kanwil} - {fronting.area}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-gray-500">
                            {fronting.penempatan}
                          </td>
                          <td className="px-4 py-3.5 text-sm text-indigo-600 font-medium">
                            {fronting.leader || "-"}
                          </td>
                          <td className="px-4 py-3.5 text-sm font-bold text-emerald-600 text-right">
                            {fronting.estimasi
                              ? `Rp ${Number(fronting.estimasi).toLocaleString(
                                  "id-ID"
                                )}`
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">
                    Tidak ada data fronting yang sesuai dengan filter pencarian.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. VIEW: KANWIL GARAPAN */}
      {activeView === "search-kanwil-garapan" && (
        <div className="animate-fade-in">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-5 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-3">
                Pencarian Kanwil Garapan
              </h2>
              <button
                onClick={() => handleViewChange("dashboard")}
                className="text-xs sm:text-sm text-gray-500 hover:text-indigo-600 underline self-start sm:self-auto"
              >
                &larr; Kembali ke Dashboard
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 items-stretch md:items-start">
              <div className="relative flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pilih Kanwil
                </label>
                <input
                  list="kanwil-garapan-options"
                  type="text"
                  value={selectedKanwilGarapan}
                  onChange={(e) => {
                    setSelectedKanwilGarapan(e.target.value);
                    setLeaderResults(null);
                  }}
                  placeholder="Ketik / pilih kanwil garapan..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-green-500 outline-none bg-white"
                />
                <datalist id="kanwil-garapan-options">
                  {listKanwilGarapan.map((k, i) => (
                    <option key={i} value={k} />
                  ))}
                </datalist>
              </div>

              <div className="w-full md:w-auto md:pt-6">
                <button
                  onClick={handleSearchLeaderByKanwil}
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-6 rounded-lg transition shadow-sm text-sm"
                >
                  Tampilkan Leader
                </button>
              </div>
            </div>
          </div>

          {leaderResults && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">
                Data Leader di Kanwil:{" "}
                <span className="text-green-600">{selectedKanwilGarapan}</span>
              </h3>
              {leaderResults.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 whitespace-nowrap">
                      <tr>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          No
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Nama Leader
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Area
                        </th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Penempatan
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 whitespace-nowrap">
                      {leaderResults.map((leader, idx) => (
                        <tr key={leader.id} className="hover:bg-gray-50">
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {idx + 1}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm font-bold text-gray-900">
                            {leader.nama_leader}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {parseJsonString(leader.area).join(", ")}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-sm text-gray-500">
                            {parseJsonString(leader.penempatan).join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">
                    Tidak ada data leader untuk Kanwil ini.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. VIEW: KOTAK MASUK UNIVERSAL (DIREKTUR, HRD, MO, KEUANGAN) */}
      {activeView === "kotak-masuk" && (
        <div className="animate-fade-in max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-4">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
              📥 Kotak Masuk Pesan & Laporan ({userRole.toUpperCase()})
            </h2>
            <button
              onClick={() => handleViewChange("dashboard")}
              className="text-xs sm:text-sm text-gray-500 hover:text-indigo-600 underline self-start sm:self-auto"
            >
              &larr; Kembali ke Dashboard
            </button>
          </div>

          {selectedPesan ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b pb-4">
                <div className="min-w-0">
                  <span className="bg-indigo-100 text-indigo-700 text-[11px] font-bold px-3 py-1 rounded uppercase tracking-wider">
                    {selectedPesan.tipe_pesan}
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-gray-900 mt-2 break-words">
                    Thread Percakapan dengan: {selectedPesan.pengirim_role}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Semua riwayat pesan dan tanggapan ditampilkan secara
                    kronologis.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPesan(null)}
                  className="self-start sm:self-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                >
                  ✕ Tutup
                </button>
              </div>

              {/* CONTAINER THREAD HISTORY PERCAKAPAN */}
              <div className="space-y-4 max-h-[55dvh] overflow-y-auto p-3 sm:p-4 bg-gray-50 rounded-xl border">
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm animate-pulse">
                      Memuat riwayat percakapan...
                    </p>
                  </div>
                ) : conversationHistory.length > 0 ? (
                  conversationHistory.map((item, index) => {
                    const isOurMessage =
                      item.pengirim_role.toLowerCase() ===
                      userRole.toLowerCase();

                    return (
                      <div
                        key={index}
                        className={`flex flex-col ${
                          isOurMessage ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 shadow-sm break-words ${
                            isOurMessage
                              ? "bg-indigo-600 text-white rounded-br-none"
                              : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                          }`}
                        >
                          <div className="flex flex-wrap justify-between items-center gap-2 sm:gap-6 mb-1 text-[10px] opacity-80 border-b border-current/15 pb-1">
                            <span className="font-bold uppercase tracking-wider">
                              {item.pengirim_role}
                            </span>
                            <span>
                              {new Date(item.created_at).toLocaleString(
                                "id-ID",
                                { dateStyle: "short", timeStyle: "short" }
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/10 inline-block my-1">
                            {item.tipe_pesan}
                          </span>
                          <p className="text-sm whitespace-pre-line leading-relaxed">
                            {item.konten}
                          </p>

                          {item.file_lampiran && (
                            <div className="mt-3 pt-2 border-t border-current/15">
                              <a
                                href={
                                  item.file_lampiran?.startsWith("http")
                                    ? item.file_lampiran
                                    : `/uploads/admin/${item.file_lampiran}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs font-semibold underline inline-flex items-center gap-1.5 break-all ${
                                  isOurMessage ? "text-white" : "text-blue-600"
                                }`}
                              >
                                📎 Lihat Lampiran ({item.file_lampiran})
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">Belum ada riwayat percakapan.</p>
                  </div>
                )}
              </div>

              {/* FORM BALAS PESAN */}
              <div className="border-t pt-5 sm:pt-6 mt-5 sm:mt-6">
                <h4 className="text-base font-bold text-gray-800 mb-4">
                  Balas Pesan / Kirim Tanggapan
                </h4>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setIsSubmittingTanggapan(true);

                    try {
                      const formData = new FormData();
                      formData.append("pengirimRole", userRole);
                      formData.append("nikTujuan", selectedPesan.pengirim_role);
                      formData.append(
                        "tipe",
                        `Balasan: ${selectedPesan.tipe_pesan}`
                      );
                      formData.append("konten", tanggapanText);

                      if (fileSanggahan) {
                        formData.append("file_lampiran", fileSanggahan);
                      }

                      const res = await fetch("/api/kirim-pesan", {
                        method: "POST",
                        body: formData,
                      });

                      if (!res.ok) throw new Error("Gagal mengirim balasan");

                      alert("Balasan pesan berhasil dikirim!");
                      setTanggapanText("");
                      setFileSanggahan(null);

                      const refreshRes = await fetch(
                        `/api/kirim-pesan/history?pihak1=${encodeURIComponent(
                          userRole
                        )}&pihak2=${encodeURIComponent(
                          selectedPesan.pengirim_role
                        )}`
                      );
                      const refreshData = await refreshRes.json();
                      if (refreshData.success) {
                        setConversationHistory(refreshData.data);
                      }

                      fetchKotakMasuk();

                      if (fileBalasPesanRef.current) {
                        fileBalasPesanRef.current.value = "";
                      }
                    } catch (error) {
                      console.error(error);
                      alert("Terjadi kesalahan saat mengirim balasan.");
                    } finally {
                      setIsSubmittingTanggapan(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Isi Balasan
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={tanggapanText}
                      onChange={(e) => setTanggapanText(e.target.value)}
                      placeholder="Tulis balasan atau tanggapan Anda di sini..."
                      className="w-full border border-gray-300 rounded-lg p-3 text-base md:text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Upload File Lampiran Balasan (Opsional)
                    </label>
                    <input
                      type="file"
                      ref={fileBalasPesanRef}
                      accept=".pdf, .xlsx, .xls, image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setFileSanggahan(e.target.files[0]);
                        } else {
                          setFileSanggahan(null);
                        }
                      }}
                      className="w-full text-xs sm:text-sm text-gray-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-gray-200 rounded-lg p-1.5"
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPesan(null)}
                      className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTanggapan}
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow transition disabled:opacity-50"
                    >
                      {isSubmittingTanggapan
                        ? "Mengirim Balasan..."
                        : "Kirim Balasan Pesan"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {listPesanMasuk.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {listPesanMasuk.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenPesan(item)}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition ${
                        item.is_read === 0
                          ? "bg-indigo-50/40 font-medium"
                          : "bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                            {item.pengirim_role}
                          </span>
                          <span className="text-xs text-indigo-600 font-bold">
                            {item.tipe_pesan}
                          </span>
                          {item.is_read === 0 && (
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 line-clamp-2 sm:line-clamp-1">
                          {item.konten}
                        </p>
                        <span className="text-[11px] text-gray-400 mt-1 block">
                          {new Date(item.created_at).toLocaleString("id-ID")}
                        </span>
                      </div>
                      <span className="w-full sm:w-auto text-center text-xs text-indigo-600 font-bold bg-white border border-indigo-200 px-3 py-2 sm:py-1.5 rounded-lg shadow-sm shrink-0">
                        Buka Detail ➔
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 sm:p-12 text-center text-gray-400 text-sm">
                  <span className="text-4xl block mb-2">📭</span>
                  Belum ada pesan atau laporan masuk di kotak masuk Anda.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 6. VIEW: KIRIM PESAN / LAPORAN */}
      {activeView === "pesan" && (
        <div className="animate-fade-in max-w-4xl mx-auto">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-indigo-800">
                Identitas Pengirim:
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Pesan/Laporan ini dikirim berdasarkan otorisasi jabatan Anda
                saat ini.
              </p>
            </div>
            <div className="bg-white border border-indigo-300 rounded-lg px-4 py-2 text-xs sm:text-sm font-bold text-indigo-700 shadow-sm uppercase self-start sm:self-auto">
              Jabatan: {userRole}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-6 sm:mb-8 border-b pb-4">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-3">
                Kirim Pesan / Surat / Instruksi
              </h2>
              <button
                onClick={() => handleViewChange("dashboard")}
                className="text-xs sm:text-sm text-gray-500 hover:text-indigo-600 underline self-start sm:self-auto"
              >
                &larr; Kembali ke Dashboard
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSending(true);

                try {
                  const formData = new FormData();
                  formData.append("pengirimRole", userRole);

                  let targetNikValue = "ALL";
                  if (
                    pesanTipe === "Pesan Umum" ||
                    pesanTipe === "Instruksi Umum"
                  ) {
                    targetNikValue = "ALL";
                  } else if (pesanTipe === "Broadcast Fronting") {
                    targetNikValue = "ALL_FRONTING";
                  } else if (pesanTipe === "Broadcast Non Fronting") {
                    targetNikValue = "ALL_NON_FRONTING";
                  } else if (pesanTipe === "Laporan ke Direktur") {
                    targetNikValue = "DIREKTUR";
                  } else if (userRole.toLowerCase() === "direktur") {
                    targetNikValue = pesanTujuan;
                  } else {
                    const parts = pesanTujuan.split(" - ");
                    targetNikValue =
                      parts.length > 1 ? parts[1].trim() : pesanTujuan.trim();
                  }

                  formData.append("nikTujuan", targetNikValue);
                  formData.append("tipe", pesanTipe);
                  formData.append("konten", pesanKonten);

                  if (pesanLampiran) {
                    formData.append("file_lampiran", pesanLampiran);
                  }

                  const response = await fetch("/api/kirim-pesan", {
                    method: "POST",
                    body: formData,
                  });

                  if (!response.ok) throw new Error("Gagal mengirim pesan");

                  alert(`Sukses! Pesan/Laporan telah dikirim.`);
                  setPesanTujuan("");
                  setPesanKonten("");
                  setPesanTipe("Pesan Umum");
                  setPesanLampiran(null);

                  if (fileKirimPesanRef.current) {
                    fileKirimPesanRef.current.value = "";
                  }
                } catch (error) {
                  console.error(error);
                  alert("Terjadi kesalahan saat mengirim pesan.");
                } finally {
                  setIsSending(false);
                }
              }}
              className="space-y-5 sm:space-y-6"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipe Pesan / Kategori Tujuan
                </label>
                <select
                  value={pesanTipe}
                  onChange={(e) => {
                    setPesanTipe(e.target.value);
                    if (userRole?.toLowerCase() === "direktur") {
                      if (e.target.value === "Instruksi ke MO")
                        setPesanTujuan("MO");
                      else if (e.target.value === "Instruksi ke HRD")
                        setPesanTujuan("HRD");
                      else if (e.target.value === "Instruksi ke Keuangan")
                        setPesanTujuan("Keuangan");
                      else setPesanTujuan("ALL");
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition"
                >
                  {userRole?.toLowerCase() === "direktur" ? (
                    <>
                      <option value="Instruksi Umum">
                        Instruksi / Pesan Umum ke Semua Divisi
                      </option>
                      <option value="Instruksi ke MO">
                        Instruksi khusus ke Manager Operasional (MO)
                      </option>
                      <option value="Instruksi ke HRD">
                        Instruksi khusus ke HRD
                      </option>
                      <option value="Instruksi ke Keuangan">
                        Instruksi khusus ke Keuangan
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="Pesan Umum">
                        Pesan Umum (Broadcast ke Semua Pegawai)
                      </option>

                      {userRole?.toLowerCase() === "hrd" && (
                        <>
                          <option value="Broadcast Fronting">
                            Pesan Umum (Khusus Pegawai Fronting)
                          </option>
                          <option value="Broadcast Non Fronting">
                            Pesan Umum (Khusus Pegawai Non-Fronting)
                          </option>
                          <option value="Surat Peringatan">
                            Surat Peringatan
                          </option>
                        </>
                      )}

                      {userRole?.toUpperCase() === "MO" && (
                        <option value="Surat Perintah Tugas">
                          Surat Perintah Tugas
                        </option>
                      )}
                      {(userRole?.toUpperCase() === "MO" ||
                        userRole?.toLowerCase() === "hrd" ||
                        userRole?.toLowerCase() === "keuangan") && (
                        <option value="Laporan ke Direktur">
                          📈 Laporan Resmi ke Direktur
                        </option>
                      )}
                    </>
                  )}
                </select>
              </div>

              {pesanTipe !== "Pesan Umum" &&
                pesanTipe !== "Instruksi Umum" &&
                pesanTipe !== "Broadcast Fronting" &&
                pesanTipe !== "Broadcast Non Fronting" &&
                pesanTipe !== "Laporan ke Direktur" &&
                userRole.toLowerCase() !== "direktur" && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Tujuan Pegawai <span className="text-red-500">*</span>
                    </label>
                    <input
                      list="pegawai-tujuan-options"
                      type="text"
                      required
                      value={pesanTujuan}
                      onChange={(e) => setPesanTujuan(e.target.value)}
                      placeholder="Ketik nama atau pilih NIK pegawai..."
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition"
                    />
                    <datalist id="pegawai-tujuan-options">
                      {listPegawai.map((pegawai, idx) => (
                        <option
                          key={idx}
                          value={`${pegawai.nama} - ${pegawai.nik}`}
                        />
                      ))}
                    </datalist>
                  </div>
                )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Isi Pesan / Instruksi
                </label>
                <textarea
                  required
                  rows={5}
                  value={pesanKonten}
                  onChange={(e) => setPesanKonten(e.target.value)}
                  placeholder="Tulis rincian pesan atau instruksi di sini..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base md:text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition resize-y"
                ></textarea>
              </div>

              <div className="bg-gray-50 border border-gray-200 border-dashed rounded-xl p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Upload Lampiran / Dokumen Balasan (Opsional)
                </label>
                <input
                  type="file"
                  ref={fileKirimPesanRef}
                  accept=".pdf, image/jpeg, image/png, image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setPesanLampiran(e.target.files[0]);
                    } else {
                      setPesanLampiran(null);
                    }
                  }}
                  className="w-full text-xs sm:text-sm text-gray-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition cursor-pointer"
                />
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-md transition disabled:opacity-50 text-sm"
                >
                  {isSending ? "Mengirim..." : "Kirim Pesan & Instruksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. VIEW: REKAP ABSENSI (HRD) */}
      {activeView === "rekap-absen" && userRole?.toLowerCase() === "hrd" && (
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 max-w-2xl mx-auto border border-gray-100">
          <h2 className="text-base sm:text-lg font-semibold text-blue-600 mb-2">
            Laporan Absensi (Spreadsheet)
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mb-5 sm:mb-6">
            Pilih bulan untuk mengunduh rekap absensi seluruh pegawai dalam
            format Excel.
          </p>

          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end bg-gray-50 p-4 sm:p-6 rounded-xl border border-gray-200">
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Pilih Bulan & Tahun
              </label>
              <input
                type="month"
                value={absenBulan}
                onChange={(e) => setAbsenBulan(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-md text-base md:text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleDownloadAbsen}
              disabled={isExportingAbsen || !absenBulan}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isExportingAbsen
                ? "Memproses..."
                : "📊 Unduh Spreadsheet (.xlsx)"}
            </button>
          </div>
        </div>
      )}
    </RoleSidebarLayout>
  );
}