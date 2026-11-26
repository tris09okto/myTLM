"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Send,
  Upload,
  CreditCard,
  Loader2,
  UserCircle,
  FileSpreadsheet,
  LogOut,
  Inbox,
  Mail,
  MailOpen,
} from "lucide-react";
import { signOut } from "next-auth/react";
import RoleSidebarLayout from "@/app/components/RoleSidebarLayout";

export interface PegawaiSingkat {
  nama: string;
  nik: string;
}

export interface FinanceDashboardProps {
  listPegawai?: PegawaiSingkat[];
  loggedInJabatan?: string;
}

export default function FinanceDashboardClient({
  listPegawai = [],
  loggedInJabatan = "Keuangan",
}: FinanceDashboardProps) {
  const [userRole, setUserRole] = useState(loggedInJabatan);
  const [activeTab, setActiveTab] = useState("gaji");
  const [employees, setEmployees] = useState<any[]>([]);
  const [perkiraanList, setPerkiraanList] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [filterType, setFilterType] = useState("");
  const [filterValue, setFilterValue] = useState("");

  const [pesanTipe, setPesanTipe] = useState("Laporan ke Direktur");
  const [pesanKonten, setPesanKonten] = useState("");
  const [pesanLampiran, setPesanLampiran] = useState<File | null>(null);
  const [isSendingPesan, setIsSendingPesan] = useState(false);

  const [inboxList, setInboxList] = useState<any[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [balasanText, setBalasanText] = useState("");
  const [balasanLampiran, setBalasanLampiran] = useState<File | null>(null);
  const [isSendingBalasan, setIsSendingBalasan] = useState(false);

  const [tanggapanText, setTanggapanText] = useState("");
  const [fileSanggahan, setFileSanggahan] = useState<File | null>(null);
  const [isSubmittingTanggapan, setIsSubmittingTanggapan] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileBalasRef = useRef<HTMLInputElement>(null);
  const filePesanRef = useRef<HTMLInputElement>(null);
  const fileExcelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUserRole(loggedInJabatan);
  }, [loggedInJabatan]);

  const fetchInbox = async () => {
    try {
      const res = await fetch("/api/kirim-pesan/inbox");
      const data = await res.json();
      if (data.success) {
        setInboxList(data.data);
      }
    } catch (error) {
      console.error("Gagal memuat inbox:", error);
    }
  };

  useEffect(() => {
    fetchInbox();
    const interval = setInterval(fetchInbox, 30000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = inboxList.filter((msg) => !msg.is_read).length;

  const handleOpenMessage = async (msg: any) => {
    setSelectedMessage(msg);
    setIsLoadingHistory(true);

    if (!msg.is_read) {
      try {
        await fetch("/api/kirim-pesan/read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: msg.id }),
        });
        setInboxList(
          inboxList.map((item) =>
            item.id === msg.id ? { ...item, is_read: 1 } : item
          )
        );
      } catch (error) {
        console.error("Gagal menandai pesan dibaca", error);
      }
    }

    try {
      const pihakLain = msg.pengirim_role;
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (activeTab !== "gaji") {
      setSearchQuery("");
      setDebouncedSearch("");
    }
  }, [activeTab]);

  const fetchEmployees = async (keyword = "") => {
    try {
      const res = await fetch(
        `/api/pegawai/get-all-pegawai?search=${encodeURIComponent(keyword)}`
      );
      const pegData = await res.json();

      if (pegData.success) {
        const formattedData = pegData.data.map((emp: any) => ({
          id: emp.id,
          employee_kind: emp.employee_kind,
          nama: emp.nama,
          nik: emp.nik,
          jenis_pegawai: emp.jenis_pegawai,
          nama_bank: emp.nama_bank,
          norek: emp.norek,
          area: emp.area,
          leader: emp.leader,
          estimasi: Number(emp.estimasi) || 0,
          estimasiShared: emp.estimasi_shared === 1,
          slipName: emp.slip_name || null,
          slipSent: emp.slip_sent === 1,
        }));
        setEmployees(formattedData);
      }
    } catch (error) {
      console.error("Gagal mengambil data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(debouncedSearch);
  }, [debouncedSearch]);

  const fetchPerkiraanPemasukan = async () => {
    try {
      const res = await fetch("/api/keuangan/get-perkiraan-pemasukan");
      const data = await res.json();
      if (data.success) {
        setPerkiraanList(data.data);
      }
    } catch (error) {
      console.error("Gagal mengambil data perkiraan pemasukan:", error);
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchPerkiraanPemasukan();

    const fetchUser = async () => {
      try {
        const userRes = await fetch("/api/auth/me");
        const userData = await userRes.json();
        if (userData.success) {
          setCurrentUser(userData.data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUser();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value;
    setSearchQuery(keyword);
    fetchEmployees(keyword);
  };

  const handleUploadSlip = (
    id: number,
    employeeKind: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setEmployees(
        employees.map((emp) =>
          emp.id === id && emp.employee_kind === employeeKind
            ? { ...emp, slipName: file.name, rawFile: file }
            : emp
        )
      );
    }
  };

  const handleSendSlip = async (id: number, employeeKind: string) => {
    const emp = employees.find(
      (e) => e.id === id && e.employee_kind === employeeKind
    );
    if (!emp || !emp.rawFile) {
      alert("Silakan unggah file PDF terlebih dahulu!");
      return;
    }

    setSendingId(emp.id);
    const formData = new FormData();
    formData.append("file", emp.rawFile);
    formData.append("id_pegawai", String(emp.id));
    formData.append("employee_kind", emp.employee_kind);
    formData.append("nik_pegawai", emp.nik);

    try {
      const res = await fetch("/api/keuangan/upload-slip-gaji", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setEmployees(
          employees.map((e) =>
            e.id === id && e.employee_kind === employeeKind
              ? { ...e, slipSent: true, slipName: data.fileName }
              : e
          )
        );

        try {
          const notifForm = new FormData();
          notifForm.append("pengirimRole", loggedInJabatan);
          notifForm.append("nikTujuan", emp.nik);
          notifForm.append("tipe", "Pengumuman Pribadi - Slip Gaji");
          notifForm.append(
            "konten",
            `Halo ${emp.nama},\n\nDokumen Slip Gaji Anda untuk periode ini telah dirilis dan dikirimkan oleh Tim Keuangan.\n\nSilakan unduh dokumen PDF Slip Gaji Anda pada halaman Dashboard Utama. Pastikan untuk menyimpan dokumen tersebut dengan baik. Terima kasih.`
          );

          await fetch("/api/kirim-pesan", { method: "POST", body: notifForm });
        } catch (notifErr) {
          console.error("Gagal mengirim notifikasi:", notifErr);
        }

        alert(
          "Slip gaji berhasil dikirim! Notifikasi telah masuk ke akun pegawai."
        );
      } else {
        alert("Gagal: " + data.message);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSendingId(null);
    }
  };

  const uniqueAreas = [
    ...new Set(employees.map((emp) => emp.area).filter(Boolean)),
  ];
  const uniqueLeaders = [
    ...new Set(employees.map((emp) => emp.leader).filter(Boolean)),
  ];

  useEffect(() => {
    if (activeTab === "slip-gaji") {
      fetchEmployees(debouncedSearch);
    }
  }, [debouncedSearch, activeTab]);

  const handleUploadExcel = async () => {
    if (!filterType || !filterValue || !excelFile) {
      alert("Lengkapi filter dan pilih file Excel!");
      return;
    }

    const labelFilter =
      filterType === "pegawai"
        ? "Pegawai (NIK)"
        : filterType === "area"
        ? "Area"
        : "Leader";
    const isConfirmed = window.confirm(
      `PENTING: Sistem hanya akan menyimpan data pemasukan untuk ${labelFilter} [${filterValue}] dari file Excel ini. Lanjutkan?`
    );

    if (!isConfirmed) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", excelFile);
    formData.append("filterType", filterType);
    formData.append("filterValue", filterValue);

    try {
      const res = await fetch("/api/keuangan/upload-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        alert("Berhasil: " + data.message);

        setExcelFile(null);
        setFilterType("");
        setFilterValue("");
        if (fileExcelRef.current) {
          fileExcelRef.current.value = "";
        }

        fetchEmployees(searchQuery);
        fetchPerkiraanPemasukan();

        setActiveTab("gaji");
      } else {
        alert("Gagal: " + data.message);
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan sistem saat mengunggah file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm("Keluar dari halaman Keuangan?")) {
      await signOut({ callbackUrl: "/login" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-700 font-medium">
          Memuat sistem...
        </span>
      </div>
    );
  }

  const displayUsername = currentUser?.username || "Keuangan";
  const displayJabatan = currentUser?.jabatan || loggedInJabatan;

  const tabTitleMap: Record<string, string> = {
    rekening: "Data Rekening Pegawai",
    gaji: "Distribusi Laporan",
    "slip-gaji": "Distribusi & Pengiriman Slip Gaji",
    inbox: "Kotak Masuk Pesan & Laporan",
    pesan: "Kirim Pesan / Laporan Resmi",
    "upload-perkiraan-pemasukan": "Entri Data Perkiraan Pemasukan",
  };

  const activePageTitle = tabTitleMap[activeTab] || "Dashboard Keuangan";

  const filteredPerkiraanList = perkiraanList.filter((item: any) => {
    if (!searchQuery.trim()) return true;
    const kw = searchQuery.toLowerCase();
    return (
      String(item.nama_fronting || "").toLowerCase().includes(kw) ||
      String(item.nik_fronting || "").toLowerCase().includes(kw) ||
      String(item.nama_nasabah || "").toLowerCase().includes(kw) ||
      String(item.area || "").toLowerCase().includes(kw) ||
      String(item.produk || "").toLowerCase().includes(kw)
    );
  });

  const mobileInboxShortcut = (
    <button
      type="button"
      onClick={() => {
        setSelectedMessage(null);
        setActiveTab("inbox");
      }}
      aria-label="Kotak Masuk"
      className="relative p-2 text-gray-700 hover:bg-gray-100 rounded-full transition"
    >
      <Inbox className="w-5 h-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full border-2 border-white">
          {unreadCount}
        </span>
      )}
    </button>
  );

  const sidebarContent = (
    <div className="flex h-dvh flex-col justify-between bg-white text-gray-800 border-r">
      <div className="flex flex-col min-h-0">
        <div className="p-5 sm:p-6 border-b bg-gray-50 shrink-0">
          <div className="flex items-center space-x-3">
            <UserCircle className="w-9 h-9 text-blue-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-800 leading-tight truncate">
                {displayUsername}
              </h1>
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wider truncate">
                {displayJabatan}
              </p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-1.5 overflow-y-auto flex-1">
          <button
            type="button"
            onClick={() => setActiveTab("rekening")}
            className={`flex items-center w-full p-3 rounded-lg text-sm transition-colors ${
              activeTab === "rekening"
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <CreditCard className="w-5 h-5 mr-3 shrink-0" />
            <span className="truncate">Rekening Pegawai</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("gaji")}
            className={`flex items-center w-full p-3 rounded-lg text-sm transition-colors ${
              activeTab === "gaji"
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FileText className="w-5 h-5 mr-3 shrink-0" />
            <span className="truncate">Distribusi Laporan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("slip-gaji")}
            className={`flex items-center w-full p-3 rounded-lg text-sm transition-colors ${
              activeTab === "slip-gaji"
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Upload className="w-5 h-5 mr-3 shrink-0" />
            <span className="truncate">Distribusi Slip Gaji</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMessage(null);
              setActiveTab("inbox");
            }}
            className={`flex items-center justify-between w-full p-3 rounded-lg text-sm transition-colors ${
              activeTab === "inbox"
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center min-w-0">
              <Inbox className="w-5 h-5 mr-3 shrink-0" />
              <span className="truncate">Kotak Masuk</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse ml-2 shrink-0">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pesan")}
            className={`flex items-center w-full p-3 rounded-lg text-sm transition-colors ${
              activeTab === "pesan"
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Send className="w-5 h-5 mr-3 shrink-0" />
            <span className="truncate">Kirim Pesan / Laporan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload-perkiraan-pemasukan")}
            className={`flex items-center w-full p-3 rounded-lg text-sm transition-colors ${
              activeTab === "upload-perkiraan-pemasukan"
                ? "bg-blue-50 text-blue-600 font-semibold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FileSpreadsheet className="w-5 h-5 mr-3 shrink-0" />
            <span className="truncate">Entri Perkiraan Pemasukan</span>
          </button>
        </nav>
      </div>

      <div className="p-4 border-t bg-white shrink-0">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center w-full p-3 rounded-lg text-sm transition-colors text-red-600 hover:bg-red-50 font-semibold"
        >
          <LogOut className="w-5 h-5 mr-3 shrink-0" /> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <RoleSidebarLayout
      title={activePageTitle}
      subtitle={`${displayUsername} (${displayJabatan})`}
      headerRight={mobileInboxShortcut}
      sidebarContent={sidebarContent}
    >
      {/* ================= TAB: REKENING ================= */}
      {activeTab === "rekening" && (
        <div className="space-y-4 sm:space-y-6">
          <h2 className="hidden lg:block text-2xl font-bold text-gray-800">
            Data Rekening Pegawai
          </h2>

          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari nama atau NIK pegawai..."
            className="w-full sm:w-80 p-2.5 border border-gray-300 rounded-lg text-base md:text-sm bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    <th className="p-3">Nama</th>
                    <th className="p-3">NIK</th>
                    <th className="p-3">Bank</th>
                    <th className="p-3">No. Rekening</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-800 whitespace-nowrap">
                  {employees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-6 text-center text-gray-500 whitespace-normal"
                      >
                        Data pegawai tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <tr
                        key={`${emp.jenis_pegawai}-${emp.id}`}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="p-3 font-medium text-gray-900">
                          {emp.nama}
                        </td>
                        <td className="p-3 text-gray-700">{emp.nik}</td>
                        <td className="p-3 text-gray-700">
                          {emp.nama_bank || "-"}
                        </td>
                        <td className="p-3 font-mono text-blue-600">
                          {emp.norek || "Belum diinput"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: DISTRIBUSI LAPORAN ================= */}
      {activeTab === "gaji" && (
        <div className="space-y-4 sm:space-y-6">
          <h2 className="hidden lg:block text-2xl font-bold text-gray-800">
            Distribusi Laporan
          </h2>

          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari nama, NIK, nasabah, atau area..."
            className="w-full sm:w-80 p-2.5 border border-gray-300 rounded-lg text-base md:text-sm bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    <th className="p-3">ID</th>
                    <th className="p-3">NIK Fronting</th>
                    <th className="p-3">Nama Fronting</th>
                    <th className="p-3">Nama Nasabah</th>
                    <th className="p-3">Produk</th>
                    <th className="p-3">Tgl Pengajuan</th>
                    <th className="p-3">Tgl Expired</th>
                    <th className="p-3">UP Pengajuan</th>
                    <th className="p-3">Area</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created At</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-800 whitespace-nowrap">
                  {filteredPerkiraanList.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="p-6 text-center text-gray-500 whitespace-normal"
                      >
                        Belum ada data perkiraan pemasukan.
                      </td>
                    </tr>
                  ) : (
                    filteredPerkiraanList.map((item: any) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-gray-700">
                          {item.id}
                        </td>
                        <td className="p-3 font-mono text-gray-700">
                          {item.nik_fronting}
                        </td>
                        <td className="p-3 font-medium text-gray-900">
                          {item.nama_fronting}
                        </td>
                        <td className="p-3 text-gray-800">
                          {item.nama_nasabah}
                        </td>
                        <td className="p-3 text-gray-800">{item.produk}</td>
                        <td className="p-3 text-gray-700">
                          {item.tgl_pengajuan}
                        </td>
                        <td className="p-3 text-gray-700">
                          {item.tgl_expired}
                        </td>
                        <td className="p-3 font-mono font-semibold text-green-600">
                          {Number(item.up_pengajuan).toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            minimumFractionDigits: 0,
                          })}
                        </td>
                        <td className="p-3 text-gray-800">{item.area}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded text-xs font-bold inline-block ${
                              item.status?.includes("Pending")
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-xs text-gray-600">
                          {item.created_at}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: DISTRIBUSI SLIP GAJI ================= */}
      {activeTab === "slip-gaji" && (
        <div className="space-y-4 sm:space-y-6">
          <h2 className="hidden lg:block text-2xl font-bold text-gray-800">
            Distribusi & Pengiriman Slip Gaji
          </h2>

          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari nama atau NIK pegawai..."
            className="w-full sm:w-80 p-2.5 border border-gray-300 rounded-lg text-base md:text-sm bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                    <th className="p-3">Pegawai</th>
                    <th className="p-3">Slip PDF</th>
                    <th className="p-3 text-center">Kirim</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-800 whitespace-nowrap">
                  {employees.map((emp) => (
                    <tr
                      key={`${emp.jenis_pegawai}-${emp.id}`}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-gray-900">
                          {emp.nama}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                            {emp.nik}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              emp.jenis_pegawai === "Non-Fronting"
                                ? "bg-emerald-100 text-emerald-700"
                                : emp.jenis_pegawai === "Leader"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {emp.jenis_pegawai || "Fronting"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3">
                        {emp.slipName ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className="text-gray-700 text-xs truncate max-w-[160px] sm:max-w-[220px]"
                              title={emp.slipName}
                            >
                              {emp.slipName.split("/").pop()}
                            </span>
                            <a
                              href={
                                emp.slipName.startsWith("http")
                                  ? emp.slipName
                                  : `/uploads/slips/${emp.slipName}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded hover:bg-blue-200 transition-colors"
                            >
                              Lihat / Unduh PDF
                            </a>
                          </div>
                        ) : (
                          <input
                            type="file"
                            accept=".pdf"
                            onChange={(e) =>
                              handleUploadSlip(emp.id, emp.employee_kind, e)
                            }
                            className="text-xs text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() =>
                            handleSendSlip(emp.id, emp.employee_kind)
                          }
                          disabled={
                            !emp.slipName ||
                            emp.slipSent ||
                            sendingId === emp.id
                          }
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
                        >
                          {sendingId === emp.id
                            ? "Mengirim..."
                            : emp.slipSent
                            ? "Terkirim"
                            : "Kirim"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB: KOTAK MASUK / INBOX ================= */}
      {activeTab === "inbox" && (
        <div className="animate-fade-in max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-4">
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
              📥 Kotak Masuk Pesan & Laporan ({userRole.toUpperCase()})
            </h2>
            <button
              onClick={() => setActiveTab("gaji")}
              className="text-xs sm:text-sm text-gray-600 hover:text-blue-600 underline self-start sm:self-auto"
            >
              &larr; Kembali ke Dashboard
            </button>
          </div>

          {selectedMessage ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 space-y-5 sm:space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-b pb-4">
                <div className="min-w-0">
                  <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-3 py-1 rounded uppercase tracking-wider">
                    {selectedMessage.tipe || selectedMessage.tipe_pesan}
                  </span>
                  <h3 className="text-base sm:text-xl font-bold text-gray-900 mt-2 break-words">
                    Thread Percakapan dengan: {selectedMessage.pengirim_role}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Semua riwayat pesan dan tanggapan ditampilkan secara
                    kronologis.
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="self-start sm:self-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                >
                  ✕ Tutup
                </button>
              </div>

              <div className="space-y-4 max-h-[55dvh] overflow-y-auto p-3 sm:p-4 bg-gray-50 rounded-xl border">
                {isLoadingHistory ? (
                  <div className="text-center py-8 text-gray-500">
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
                              ? "bg-blue-600 text-white rounded-br-none"
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
                            {item.tipe_pesan || item.tipe}
                          </span>
                          <p className="text-sm whitespace-pre-line leading-relaxed">
                            {item.konten}
                          </p>

                          {item.file_lampiran && (
                            <div className="mt-3 pt-2 border-t border-current/15">
                              <a
                                href={
                                  item.file_lampiran.startsWith("http")
                                    ? item.file_lampiran
                                    : `/uploads/${item.file_lampiran}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs font-semibold underline inline-flex items-center gap-1.5 ${
                                  isOurMessage ? "text-white" : "text-blue-600"
                                }`}
                              >
                                📎 Lihat Lampiran
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Belum ada riwayat percakapan.</p>
                  </div>
                )}
              </div>

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
                      formData.append(
                        "nikTujuan",
                        selectedMessage.pengirim_role
                      );
                      formData.append(
                        "tipe",
                        `Balasan: ${
                          selectedMessage.tipe || selectedMessage.tipe_pesan
                        }`
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
                      if (fileBalasRef.current) {
                        fileBalasRef.current.value = "";
                      }

                      const refreshRes = await fetch(
                        `/api/kirim-pesan/history?pihak1=${encodeURIComponent(
                          userRole
                        )}&pihak2=${encodeURIComponent(
                          selectedMessage.pengirim_role
                        )}`
                      );
                      const refreshData = await refreshRes.json();
                      if (refreshData.success) {
                        setConversationHistory(refreshData.data);
                      }

                      fetchInbox();
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
                      className="w-full border border-gray-300 rounded-lg p-3 bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 text-base md:text-sm"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Upload File Lampiran Balasan (Opsional)
                    </label>
                    <input
                      ref={fileBalasRef}
                      type="file"
                      accept=".pdf, .xlsx, .xls, image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          setFileSanggahan(e.target.files[0]);
                        } else {
                          setFileSanggahan(null);
                        }
                      }}
                      className="w-full text-xs sm:text-sm text-gray-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-lg p-1.5"
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMessage(null)}
                      className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTanggapan}
                      className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow transition disabled:opacity-50"
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
              {inboxList.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {inboxList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleOpenMessage(item)}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition ${
                        !item.is_read
                          ? "bg-blue-50/40 font-medium"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        {!item.is_read ? (
                          <Mail className="w-5 h-5 text-blue-600 animate-bounce shrink-0 mt-0.5 sm:mt-0" />
                        ) : (
                          <MailOpen className="w-5 h-5 text-gray-400 shrink-0 mt-0.5 sm:mt-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                              {item.pengirim_role}
                            </span>
                            <span className="text-xs text-blue-600 font-bold">
                              {item.tipe || item.tipe_pesan}
                            </span>
                            {!item.is_read && (
                              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                            )}
                          </div>
                          <p className="text-sm text-gray-800 line-clamp-2 sm:line-clamp-1">
                            {item.konten}
                          </p>
                          <span className="text-[11px] text-gray-500 mt-1 block">
                            {new Date(item.created_at).toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                      <span className="w-full sm:w-auto text-center text-xs text-blue-600 font-bold bg-white border border-blue-200 px-3 py-2 sm:py-1.5 rounded-lg shadow-sm shrink-0">
                        Buka Detail ➔
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 sm:p-12 text-center text-gray-500 text-sm">
                  <span className="text-4xl block mb-2">📭</span>
                  Belum ada pesan atau laporan masuk di kotak masuk Anda.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB: KIRIM PESAN ================= */}
      {activeTab === "pesan" && (
        <div className="animate-fade-in max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 md:p-8">
            <h2 className="hidden lg:block text-2xl font-bold text-gray-800 mb-6">
              Kirim Pesan / Laporan Resmi
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSendingPesan(true);
                try {
                  const formData = new FormData();
                  formData.append("pengirimRole", loggedInJabatan);
                  formData.append(
                    "nikTujuan",
                    pesanTipe.includes("HRD")
                      ? "HRD"
                      : pesanTipe.includes("MO")
                      ? "MO"
                      : "DIREKTUR"
                  );
                  formData.append("tipe", pesanTipe);
                  formData.append("konten", pesanKonten);
                  if (pesanLampiran)
                    formData.append("file_lampiran", pesanLampiran);

                  const res = await fetch("/api/kirim-pesan", {
                    method: "POST",
                    body: formData,
                  });
                  if (!res.ok) throw new Error();
                  alert("Pesan berhasil dikirim!");
                  setPesanKonten("");
                  setPesanLampiran(null);
                  if (filePesanRef.current) {
                    filePesanRef.current.value = "";
                  }
                } catch {
                  alert("Gagal mengirim pesan.");
                } finally {
                  setIsSendingPesan(false);
                }
              }}
              className="space-y-4 sm:space-y-5"
            >
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Tipe Pesan
                </label>
                <select
                  value={pesanTipe}
                  onChange={(e) => setPesanTipe(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-base md:text-sm bg-gray-50 text-gray-900 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Laporan ke Direktur">
                    📈 Laporan ke Direktur
                  </option>
                  <option value="Instruksi ke HRD">📤 Pesan ke HRD</option>
                  <option value="Instruksi ke MO">📤 Pesan ke MO</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Isi Pesan
                </label>
                <textarea
                  required
                  rows={5}
                  value={pesanKonten}
                  onChange={(e) => setPesanKonten(e.target.value)}
                  placeholder="Tulis isi pesan..."
                  className="w-full p-3 border border-gray-300 rounded-lg text-base md:text-sm bg-white text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Lampiran (Opsional)
                </label>
                <input
                  ref={filePesanRef}
                  type="file"
                  onChange={(e) =>
                    setPesanLampiran(
                      e.target.files && e.target.files[0]
                        ? e.target.files[0]
                        : null
                    )
                  }
                  className="w-full text-xs sm:text-sm text-gray-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-lg p-1.5"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSendingPesan}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow transition-colors disabled:opacity-50"
                >
                  {isSendingPesan ? "Mengirim..." : "Kirim Pesan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= TAB: UPLOAD EXCEL ================= */}
      {activeTab === "upload-perkiraan-pemasukan" && (
        <div className="space-y-4 sm:space-y-6 max-w-4xl">
          <h2 className="hidden lg:block text-2xl font-bold text-gray-800">
            Entri Data Perkiraan Pemasukan
          </h2>
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Kategori Filter
                </label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setFilterValue("");
                  }}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-base md:text-sm bg-white text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Kategori Filter --</option>
                  <option value="area">Area Tertentu</option>
                  <option value="pegawai">Per Spesifik Pegawai</option>
                  <option value="leader">Leader Tertentu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Target Data
                </label>
                <select
                  value={filterValue}
                  onChange={(e) => setFilterValue(e.target.value)}
                  disabled={!filterType}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-base md:text-sm bg-white text-gray-900 disabled:bg-gray-100 disabled:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Target --</option>
                  {filterType === "area" &&
                    uniqueAreas.map((a: any, i) => (
                      <option key={i} value={a}>
                        {a}
                      </option>
                    ))}
                  {filterType === "pegawai" &&
                    employees.map((emp) => (
                      <option key={emp.id} value={emp.nik}>
                        {emp.nama} ({emp.nik})
                      </option>
                    ))}
                  {filterType === "leader" &&
                    uniqueLeaders.map((l: any, i) => (
                      <option key={i} value={l}>
                        {l}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                File Spreadsheet (.xlsx / .xls)
              </label>
              <input
                ref={fileExcelRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) =>
                  setExcelFile(
                    e.target.files && e.target.files[0]
                      ? e.target.files[0]
                      : null
                  )
                }
                className="w-full text-xs sm:text-sm text-gray-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 border border-gray-200 rounded-lg p-1.5"
              />
            </div>

            <div className="pt-1">
              <button
                onClick={handleUploadExcel}
                disabled={!excelFile || isUploading}
                className="w-full sm:w-auto px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {isUploading ? "Memproses..." : "Simpan ke Database"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RoleSidebarLayout>
  );
}