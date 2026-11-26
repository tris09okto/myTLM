"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSession, signOut, SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

// ==========================================
// 1. HELPER COMPONENTS (SearchableSelect & Pagination)
// ==========================================
interface SearchableSelectProps {
  name: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

function SearchableSelect({
  name,
  options,
  value,
  onChange,
  placeholder = "Pilih atau ketik...",
  required = false,
  disabled = false,
}: SearchableSelectProps) {
  const [query, setQuery] = useState(value || "");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setQuery(value || "");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const filteredOptions = options.filter((opt) =>
    opt.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <input
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => !disabled && setIsOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          if (e.target.value === "") {
            onChange("");
          }
        }}
        required={required && !value}
        className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:cursor-not-allowed outline-none focus:ring-2 focus:ring-blue-500"
      />
      {isOpen && !disabled && (
        <ul className="absolute z-30 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg text-sm">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <li
                key={idx}
                onClick={() => {
                  onChange(opt);
                  setQuery(opt);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 cursor-pointer hover:bg-blue-50 ${
                  opt === value
                    ? "bg-blue-100 font-semibold text-blue-700"
                    : "text-gray-800"
                }`}
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-gray-400 italic">
              Data tidak ditemukan
            </li>
          )}
        </ul>
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

  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 text-sm">
      <span className="text-gray-500">
        Halaman <b>{currentPage}</b> dari <b>{totalPages}</b>
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          &larr; Sebelumnya
        </button>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Berikutnya &rarr;
        </button>
      </div>
    </div>
  );
}

// ==========================================
// 2. SUB-VIEWS (Produk, Pengumuman, Leader, Mitra)
// ==========================================
function UploadProdukView() {
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setMsg({ type: "", text: "" });
    const formData = new FormData();
    formData.append("judul", judul);
    formData.append("deskripsi", deskripsi);
    formData.append("file", file);

    try {
      const res = await fetch("/super-admin/upload-produk", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message || "Produk berhasil diunggah!" });
        setJudul("");
        setDeskripsi("");
        setFile(null);
      } else {
        setMsg({ type: "error", text: data.message || "Gagal mengunggah produk." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
      <h2 className="text-lg font-semibold text-blue-600 mb-2">
        Upload Produk / Promo
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Unggah informasi produk atau promo terbaru untuk tim Fronting.
      </p>
      {msg.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Judul Produk / Promo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Deskripsi
          </label>
          <textarea
            rows={3}
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            File Poster / Dokumen <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            required
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Mengunggah..." : "Upload Produk / Promo"}
        </button>
      </form>
    </div>
  );
}

function PengumumanView() {
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch("/super-admin/pengumuman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judul, isi }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message || "Pengumuman diterbitkan!" });
        setJudul("");
        setIsi("");
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menerbitkan pengumuman." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
      <h2 className="text-lg font-semibold text-blue-600 mb-2">
        Buat Pengumuman Baru
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Informasi pengumuman akan ditampilkan di dashboard seluruh pegawai.
      </p>
      {msg.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Judul Pengumuman <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Isi Pengumuman <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={5}
            required
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : "Terbitkan Pengumuman"}
        </button>
      </form>
    </div>
  );
}

function CreateLeaderView() {
  const [namaLeader, setNamaLeader] = useState("");
  const [kanwil, setKanwil] = useState("");
  const [area, setArea] = useState("");
  const [penempatan, setPenempatan] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch("/super-admin/create-leader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_leader: namaLeader,
          kanwil,
          area,
          penempatan,
          username,
          password,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message || "Leader berhasil dibuat!" });
        setNamaLeader("");
        setKanwil("");
        setArea("");
        setPenempatan("");
        setUsername("");
        setPassword("");
      } else {
        setMsg({ type: "error", text: data.message || "Gagal membuat data leader." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
      <h2 className="text-lg font-semibold text-blue-600 mb-2">
        Tambah Data Leader
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Registrasi akun Leader baru untuk pengelolaan tim Fronting.
      </p>
      {msg.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Nama Leader <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={namaLeader}
            onChange={(e) => setNamaLeader(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Kanwil <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={kanwil}
              onChange={(e) => setKanwil(e.target.value)}
              className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Area <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Penempatan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={penempatan}
              onChange={(e) => setPenempatan(e.target.value)}
              className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1 text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : "Simpan Data Leader"}
        </button>
      </form>
    </div>
  );
}

function CreateMitraView() {
  const [kodeMitra, setKodeMitra] = useState("");
  const [namaMitra, setNamaMitra] = useState("");
  const [alamatMitra, setAlamatMitra] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ type: "", text: "" });
    try {
      const res = await fetch("/super-admin/create-mitra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode_mitra: kodeMitra,
          nama_mitra: namaMitra,
          alamat: alamatMitra,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "success", text: data.message || "Data Mitra berhasil ditambahkan!" });
        setKodeMitra("");
        setNamaMitra("");
        setAlamatMitra("");
      } else {
        setMsg({ type: "error", text: data.message || "Gagal menambah data mitra." });
      }
    } catch {
      setMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
      <h2 className="text-lg font-semibold text-blue-600 mb-2">
        Tambah Data Mitra
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Daftarkan mitra perusahaan atau klien penempatan pegawai.
      </p>
      {msg.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Kode Mitra <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Contoh: MTR-001"
            value={kodeMitra}
            onChange={(e) => setKodeMitra(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Nama Mitra <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={namaMitra}
            onChange={(e) => setNamaMitra(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1 text-gray-700">
            Alamat Mitra
          </label>
          <textarea
            rows={3}
            value={alamatMitra}
            onChange={(e) => setAlamatMitra(e.target.value)}
            className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Menyimpan..." : "Simpan Data Mitra"}
        </button>
      </form>
    </div>
  );
}

// ==========================================
// 3. MAIN DASHBOARD CONTENT
// ==========================================
function DashboardContent() {
  const { data: session, status } = useSession();

  // Navigasi & UI States
  const [currentView, setCurrentView] = useState("welcome");
  const [isFrontlineOpen, setIsFrontlineOpen] = useState(true);
  const [isUnitKerjaMenuOpen, setIsUnitKerjaMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Master & Fronting States
  const [wilayahData, setWilayahData] = useState<any[]>([]);
  const [leadersList, setLeadersList] = useState<any[]>([]);
  const [frontlineList, setFrontlineList] = useState<any[]>([]);
  const [selectedData, setSelectedData] = useState<any>(null);

  const [nikValue, setNikValue] = useState("");
  const [selectedKanwil, setSelectedKanwil] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPenempatan, setSelectedPenempatan] = useState("");
  const [selectedLeader, setSelectedLeader] = useState("");
  const [idCardName, setIdCardName] = useState("");
  const [stNames, setStNames] = useState<string[]>([]);
  const [qnaFileName, setQnaFileName] = useState("");

  // Pagination & Search Fronting
  const [searchListAkun, setSearchListAkun] = useState("");
  const [currentPageListAkun, setCurrentPageListAkun] = useState(1);
  const [searchPenutupanAkun, setSearchPenutupanAkun] = useState("");
  const [currentPagePenutupanAkun, setCurrentPagePenutupanAkun] = useState(1);

  // Keuangan / Fee States
  const [feeFilterType, setFeeFilterType] = useState("");
  const [feeFilterValue, setFeeFilterValue] = useState("");
  const [feeExcelFile, setFeeExcelFile] = useState<File | null>(null);
  const [isUploadingFee, setIsUploadingFee] = useState(false);

  // Laporan & Aduan States
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [isLoadingLaporan, setIsLoadingLaporan] = useState(false);
  const [selectedLaporan, setSelectedLaporan] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState({ type: "", text: "" });

  // Non-Fronting & Unit Kerja States
  const [nonFrontingList, setNonFrontingList] = useState<any[]>([]);
  const [unitKerjaOptions, setUnitKerjaOptions] = useState<any[]>([]);
  const [mitraOptions, setMitraOptions] = useState<any[]>([]);
  const [selectedUnitKerja, setSelectedUnitKerja] = useState("");
  const [searchNonFronting, setSearchNonFronting] = useState("");

  // State khusus Form Create Non-Fronting
  const [jabatanNonFronting, setJabatanNonFronting] = useState("");
  const [selectedSupervisorNonFronting, setSelectedSupervisorNonFronting] =
    useState("");
  const [selectedUnitKerjaNonFronting, setSelectedUnitKerjaNonFronting] =
    useState("");
  const [pasFotoName, setPasFotoName] = useState("");
  const [suratTugasName, setSuratTugasName] = useState("");

  // State khusus Form Edit Non-Fronting
  const [editFormData, setEditFormData] = useState<any>(null);
  const [editJabatan, setEditJabatan] = useState("");
  const [editSupervisor, setEditSupervisor] = useState("");

  // Supervisor Management States
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [isLoadingSupervisors, setIsLoadingSupervisors] = useState(false);
  const [searchSupervisor, setSearchSupervisor] = useState("");
  const [editingSpv, setEditingSpv] = useState<any>(null);
  const [deletingSpv, setDeletingSpv] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pasFotoFile, setPasFotoFile] = useState<File | null>(null);
  const [pasFotoPreview, setPasFotoPreview] = useState("");
  const [suratTugasFile, setSuratTugasFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState({
    id: "",
    nama: "",
    nik: "",
    jenis_kelamin: "",
    status_pernikahan: "",
    tempat_lahir: "",
    tanggal_lahir: "",
    golongan_darah: "",
    email: "",
    no_whatsapp: "",
    domisili: "",
    mitra_id: "",
    area_penempatan: "",
    alamat_area_penempatan: "",
    tanggal_mulai_kerja: "",
    masa_kerja: "",
    masa_kontrak: "",
    status: "AKTIF",
    username: "",
    password: "",
    pas_foto: "",
    surat_tugas: "",
  });

  // ==========================================
  // 4. DATA FETCHERS & EFFECTS
  // ==========================================
  const fetchFrontlineData = async () => {
    try {
      const res = await fetch("/api/get-fronting/search");
      const data = await res.json();
      if (data.success) {
        setFrontlineList(data.accounts || []);
        if (data.wilayah) setWilayahData(data.wilayah);
        if (data.leaders) setLeadersList(data.leaders);
      }
    } catch (error) {
      console.error("Error fetching frontline data:", error);
    }
  };

  const fetchLaporanData = async () => {
    setIsLoadingLaporan(true);
    try {
      const res = await fetch("/super-admin/laporan");
      const data = await res.json();
      if (data.success) {
        setLaporanList(data.laporan || []);
      }
    } catch (error) {
      console.error("Error fetching laporan:", error);
    } finally {
      setIsLoadingLaporan(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      fetchFrontlineData();
      fetchUnitKerja();
      fetchNonFrontingData();
      fetchSupervisors();
      fetchLaporanData();
    }
  }, [status]);

  useEffect(() => {
    if (currentView === "form-edit" && selectedData) {
      setNikValue(selectedData.nik || "");
      setSelectedKanwil(selectedData.kanwil || "");
      setSelectedArea(selectedData.area || "");
      setSelectedPenempatan(selectedData.penempatan || "");
      setSelectedLeader(selectedData.leader || "");
      setIdCardName("");
      setStNames([]);
    } else if (currentView === "form-tambah") {
      setNikValue("");
      setSelectedKanwil("");
      setSelectedArea("");
      setSelectedPenempatan("");
      setSelectedLeader("");
      setIdCardName("");
      setStNames([]);
    }
  }, [currentView, selectedData]);

  // ==========================================
  // 5. HANDLERS & DERIVED DATA
  // ==========================================
  const getFileUrl = (file?: string | null, folder?: string): string => {
    if (!file) return "";
    if (
      file.startsWith("http://") ||
      file.startsWith("https://") ||
      file.startsWith("/")
    ) {
      return file;
    }
    return folder ? `/uploads/${folder}/${file}` : `/uploads/${file}`;
  };

  const formatDateForInput = (dateVal?: string | null): string => {
    if (!dateVal) return "";
    if (dateVal.includes("T")) return dateVal.split("T")[0];
    return dateVal;
  };

  // Non-Fronting Create Submit
  const handleNonFrontingSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    try {
      const response = await fetch("/super-admin/create-non-fronting", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(
          result.message || "Akun Non-Fronting berhasil dibuat!"
        );
        formElement.reset();
        setPasFotoName("");
        setSuratTugasName("");
        setJabatanNonFronting("");
        setSelectedSupervisorNonFronting("");
        setSelectedUnitKerjaNonFronting("");
        fetchNonFrontingData();
        fetchSupervisors();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.message || "Gagal membuat akun Non-Fronting.");
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error) {
      console.error("Error create non-fronting:", error);
      setErrorMessage("Terjadi kesalahan sistem saat menyimpan data.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  // Non-Fronting Edit & Delete Handlers
  const handleEditNonFronting = (item: any) => {
    setEditFormData({
      ...item,
      tanggal_lahir: formatDateForInput(item.tanggal_lahir),
      tanggal_mulai_kerja: formatDateForInput(item.tanggal_mulai_kerja),
    });
    setEditJabatan(item.jabatan || "PEGAWAI");
    setEditSupervisor(item.supervisor || "");
    setCurrentView("edit-non-fronting");
  };

  const handleEditJabatanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setEditJabatan(val);
    if (val.toUpperCase() === "SUPERVISOR") {
      setEditSupervisor("");
    }
  };

  const handleEditNonFrontingSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();
    if (!editFormData) return;
    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const formData = new FormData(e.currentTarget);
    formData.append("id", String(editFormData.id));

    try {
      const res = await fetch("/super-admin/edit-non-fronting", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(
          result.message || "Data pegawai non-fronting berhasil diperbarui!"
        );
        await fetchNonFrontingData();
        await fetchSupervisors();
        setTimeout(() => {
          setSuccessMessage("");
          setEditFormData(null);
          setCurrentView("list-unit-kerja");
        }, 1500);
      } else {
        setErrorMessage(result.message || "Gagal memperbarui data pegawai.");
      }
    } catch (error) {
      console.error("Error updating non-fronting:", error);
      setErrorMessage("Terjadi kesalahan sistem.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleNonAktifkanPegawai = async (id: number | string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus data pegawai "${nama}"?`)) return;
    try {
      const res = await fetch("/super-admin/delete-non-fronting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(result.message || "Data pegawai berhasil dihapus.");
        fetchNonFrontingData();
        fetchSupervisors();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.message || "Gagal menghapus data pegawai.");
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch {
      setErrorMessage("Terjadi kesalahan sistem.");
      setTimeout(() => setErrorMessage(""), 5000);
    }
  };

  // Supervisor Modal Handlers
  const handleOpenEdit = (spv: any) => {
    setEditingSpv(spv);
    setPasFotoFile(null);
    setSuratTugasFile(null);
    setPasFotoPreview(getFileUrl(spv.pas_foto, "pas_foto"));
    setEditForm({
      id: String(spv.id || ""),
      nama: spv.nama || "",
      nik: spv.nik || "",
      jenis_kelamin: spv.jenis_kelamin || "",
      status_pernikahan: spv.status_pernikahan || "",
      tempat_lahir: spv.tempat_lahir || "",
      tanggal_lahir: formatDateForInput(spv.tanggal_lahir),
      golongan_darah: spv.golongan_darah || "",
      email: spv.email || "",
      no_whatsapp: spv.no_whatsapp || spv.no_hp || "",
      domisili: spv.domisili || "",
      mitra_id: spv.mitra_id ? String(spv.mitra_id) : "",
      area_penempatan: spv.area_penempatan || "",
      alamat_area_penempatan: spv.alamat_area_penempatan || "",
      tanggal_mulai_kerja: formatDateForInput(spv.tanggal_mulai_kerja),
      masa_kerja: spv.masa_kerja || "",
      masa_kontrak: spv.masa_kontrak || "",
      status: spv.status || "AKTIF",
      username: spv.username || "",
      password: "",
      pas_foto: spv.pas_foto || "",
      surat_tugas: spv.surat_tugas || "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    const formData = new FormData();
    Object.entries(editForm).forEach(([key, value]) => {
      formData.append(key, value ?? "");
    });
    if (pasFotoFile) formData.append("pas_foto_file", pasFotoFile);
    if (suratTugasFile) formData.append("surat_tugas_file", suratTugasFile);

    try {
      const res = await fetch("/super-admin/edit-supervisor", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(
          result.message || "Data supervisor berhasil diperbarui!"
        );
        setEditingSpv(null);
        fetchSupervisors();
        fetchNonFrontingData();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.message || "Gagal memperbarui supervisor.");
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch {
      setErrorMessage("Terjadi kesalahan sistem saat menyimpan supervisor.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSpv) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/super-admin/delete-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingSpv.id }),
      });
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(result.message || "Supervisor berhasil dihapus.");
        setDeletingSpv(null);
        fetchSupervisors();
        fetchNonFrontingData();
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.message || "Gagal menghapus supervisor.");
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch {
      setErrorMessage("Terjadi kesalahan sistem.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Laporan & Aduan Helpers
  const parseDeskripsi = (deskripsi?: string) => {
    if (!deskripsi)
      return { pertanyaan: "-", jawaban: "", isAnswered: false };
    const separator = "\n\n--- BALASAN ADMIN ---\n";
    if (deskripsi.includes(separator)) {
      const [pertanyaan, jawaban] = deskripsi.split(separator);
      return {
        pertanyaan: pertanyaan.trim(),
        jawaban: jawaban.trim(),
        isAnswered: Boolean(jawaban.trim()),
      };
    }
    return { pertanyaan: deskripsi, jawaban: "", isAnswered: false };
  };

  const handleOpenLaporan = (item: any) => {
    setSelectedLaporan(item);
    const { jawaban } = parseDeskripsi(item.deskripsi);
    setReplyText(jawaban || "");
    setReplyMsg({ type: "", text: "" });
  };

  const handleSubmitReply = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLaporan || !replyText.trim()) return;
    setIsSubmittingReply(true);
    setReplyMsg({ type: "", text: "" });

    try {
      const res = await fetch("/super-admin/reply-laporan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedLaporan.id,
          balasan: replyText.trim(),
        }),
      });
      const result = await res.json();
      if (result.success) {
        setReplyMsg({ type: "success", text: "Balasan berhasil disimpan!" });
        fetchLaporanData();
        setTimeout(() => {
          setSelectedLaporan(null);
          setReplyMsg({ type: "", text: "" });
        }, 1200);
      } else {
        setReplyMsg({
          type: "error",
          text: result.message || "Gagal menyimpan balasan.",
        });
      }
    } catch {
      setReplyMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Pagination Fronting Lists
  const itemsPerPage = 10;

  const filteredListAkun = frontlineList.filter((item) => {
    if (!searchListAkun) return true;
    const kw = searchListAkun.toLowerCase();
    return (
      item.nama?.toLowerCase().includes(kw) ||
      item.nik?.toLowerCase().includes(kw) ||
      item.username?.toLowerCase().includes(kw) ||
      item.penempatan?.toLowerCase().includes(kw)
    );
  });
  const totalPagesListAkun = Math.max(
    1,
    Math.ceil(filteredListAkun.length / itemsPerPage)
  );
  const currentListAkun = filteredListAkun.slice(
    (currentPageListAkun - 1) * itemsPerPage,
    currentPageListAkun * itemsPerPage
  );

  const filteredPenutupanAkun = frontlineList.filter((item) => {
    if (!searchPenutupanAkun) return true;
    const kw = searchPenutupanAkun.toLowerCase();
    return (
      item.nama?.toLowerCase().includes(kw) ||
      item.nik?.toLowerCase().includes(kw) ||
      item.username?.toLowerCase().includes(kw) ||
      item.penempatan?.toLowerCase().includes(kw)
    );
  });
  const totalPagesPenutupanAkun = Math.max(
    1,
    Math.ceil(filteredPenutupanAkun.length / itemsPerPage)
  );
  const currentPenutupanAkun = filteredPenutupanAkun.slice(
    (currentPagePenutupanAkun - 1) * itemsPerPage,
    currentPagePenutupanAkun * itemsPerPage
  );

  // Cascading Wilayah & Leader Options
  const kanwilOptions = [
    ...new Set(wilayahData.map((item) => item?.kanwil).filter(Boolean)),
  ] as string[];

  const areaOptions = [
    ...new Set(
      wilayahData
        .filter((item) => item?.kanwil === selectedKanwil)
        .map((item) => item?.area)
        .filter(Boolean)
    ),
  ] as string[];

  const penempatanOptions = [
    ...new Set(
      wilayahData
        .filter(
          (item) =>
            item?.kanwil === selectedKanwil && item?.area === selectedArea
        )
        .map((item) => item?.penempatan)
        .filter(Boolean)
    ),
  ] as string[];

  const filteredLeaders = leadersList.filter((leader) => {
    const kArr = Array.isArray(leader.kanwil)
      ? leader.kanwil
      : leader.kanwil
        ? [leader.kanwil]
        : [];
    const aArr = Array.isArray(leader.area)
      ? leader.area
      : leader.area
        ? [leader.area]
        : [];
    const pArr = Array.isArray(leader.penempatan)
      ? leader.penempatan
      : leader.penempatan
        ? [leader.penempatan]
        : [];
    return (
      kArr.includes(selectedKanwil) &&
      aArr.includes(selectedArea) &&
      pArr.includes(selectedPenempatan)
    );
  });

  const handleEdit = (item: any) => {
    setSelectedData(item);
    setCurrentView("form-edit");
  };

  if (status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-100">
        <p className="text-red-500 font-semibold">
          Sesi Anda telah berakhir. Silakan login kembali.
        </p>
        <a
          href="/login"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          Login Sekarang
        </a>
      </div>
    );
  }

  const handleIdCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!["image/jpeg", "image/jpg", "image/png"].includes(file.type)) {
        alert("Format ID Card harus JPG atau PNG!");
        e.target.value = "";
        setIdCardName("");
        return;
      }
      setIdCardName(file.name);
    }
  };

  const getFileNameFromUrl = (url?: string | null): string => {
    if (!url) return "";
    const cleanUrl = url.split("?")[0].split("#")[0];
    const lastSlashIndex = cleanUrl.lastIndexOf("/");
    const rawName =
      lastSlashIndex >= 0 ? cleanUrl.substring(lastSlashIndex + 1) : cleanUrl;

    try {
      return decodeURIComponent(rawName);
    } catch {
      return rawName;
    }
  };

  const handleStChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 3) {
      alert("Maksimal hanya 3 file Surat Tugas yang dapat dipilih!");
      e.target.value = "";
      setStNames([]);
      return;
    }
    for (const file of files) {
      if (file.type !== "application/pdf") {
        alert("Semua file Surat Tugas harus berformat PDF!");
        e.target.value = "";
        setStNames([]);
        return;
      }
    }
    setStNames(files.map((f) => f.name));
  };

  const handleQnaFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "image/jpeg",
        "image/jpg",
        "image/png",
      ];
      if (!allowedTypes.includes(file.type)) {
        alert("Format materi tidak didukung!");
        e.target.value = "";
        setQnaFileName("");
        return;
      }
      setQnaFileName(file.name);
    }
  };

  const safeFetchJson = async (url: string) => {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        `Endpoint ${url} merespons HTTP ${res.status} (bukan JSON).`
      );
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.message || `HTTP Error ${res.status}`);
    }
    return data;
  };

  const fetchNonFrontingData = async () => {
    try {
      const data = await safeFetchJson("/super-admin/get-non-fronting");
      if (data.success) {
        setNonFrontingList(data.pegawai || data.data || []);
        setUnitKerjaOptions(data.unitKerja || data.unit_kerja || []);
        setMitraOptions(data.mitra || []);
      }
    } catch (error: any) {
      console.error("Error fetching non-fronting data:", error);
      setErrorMessage(
        error?.message || "Gagal memuat data pegawai & master unit kerja."
      );
    }
  };

  const fetchUnitKerja = async () => {
    try {
      const result = await safeFetchJson("/super-admin/get-unit-kerja");
      if (result.success) {
        setUnitKerjaOptions(result.data || result.unitKerja || []);
      }
    } catch (error) {
      console.error("Error fetching unit kerja:", error);
    }
  };

  const fetchSupervisors = async () => {
    setIsLoadingSupervisors(true);
    try {
      const data = await safeFetchJson("/api/spv/list-data");
      if (data.success) {
        setSupervisors(data.supervisors || data.data || []);
      }
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    } finally {
      setIsLoadingSupervisors(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    const endpoint =
      currentView === "form-edit"
        ? "/super-admin/edit-account"
        : "/super-admin/create-account";

    if (currentView === "form-edit" && selectedData) {
      formData.append("id", String(selectedData?.id || ""));
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(result.message);
        formElement.reset();
        setIdCardName("");
        setStNames([]);
        setSelectedKanwil("");
        setSelectedArea("");
        setSelectedPenempatan("");
        setSelectedLeader("");
        fetchFrontlineData();
        setTimeout(() => {
          setCurrentView("list-akun");
          setSuccessMessage("");
        }, 1500);
      } else {
        setErrorMessage(result.message);
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error: any) {
      console.error("Error submitting form:", error);
      setErrorMessage("Terjadi kesalahan sistem.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQnaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccessMessage("");
    setErrorMessage("");
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    try {
      const response = await fetch("/super-admin/upload-qna", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage("Materi QnA berhasil diunggah!");
        formElement.reset();
        setQnaFileName("");
        setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.message || "Gagal mengunggah.");
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch {
      setErrorMessage("Kesalahan sistem saat mengunggah.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadFee = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!feeFilterType || !feeFilterValue || !feeExcelFile) {
      setErrorMessage("Lengkapi filter dan pilih file Excel!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsUploadingFee(true);
    const formData = new FormData();
    formData.append("file", feeExcelFile);
    formData.append("filterType", feeFilterType);
    formData.append("filterValue", feeFilterValue);

    try {
      const res = await fetch("/api/keuangan/upload-excel", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMessage("Berhasil: " + data.message);
        setFeeExcelFile(null);
        setFeeFilterType("");
        setFeeFilterValue("");

        const fileInput = document.getElementById(
          "excel-fee-upload"
        ) as HTMLInputElement | null;
        if (fileInput) fileInput.value = "";

        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        setErrorMessage("Gagal: " + data.message);
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMessage("Terjadi kesalahan sistem saat mengunggah file.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsUploadingFee(false);
    }
  };

  const uniqueAreasFinance = [
    ...new Set(wilayahData.map((item) => item?.area).filter(Boolean)),
  ];
  const uniqueLeadersFinance = [
    ...new Set(leadersList.map((item) => item?.nama_leader).filter(Boolean)),
  ];

  const getSubMenuClass = (viewName: string) =>
    `block px-4 py-2 text-sm rounded transition-colors ${currentView === viewName ? "text-white font-bold bg-gray-800" : "text-gray-400 hover:text-white hover:bg-gray-800"}`;

  const filteredNonFrontingByUnit = nonFrontingList.filter((item) => {
    const matchesUnit = selectedUnitKerja
      ? item.unit_kerja === selectedUnitKerja
      : true;
    if (!searchNonFronting) return matchesUnit;
    const kw = searchNonFronting.toLowerCase();
    return (
      matchesUnit &&
      (item.nama?.toLowerCase().includes(kw) ||
        item.nik?.toLowerCase().includes(kw) ||
        item.username?.toLowerCase().includes(kw))
    );
  });

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* SIDEBAR NAVIGATION */}
      <div className="w-72 bg-gray-900 text-white flex flex-col">
        <div
          className="p-6 text-xl font-bold border-b border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors"
          onClick={() => setCurrentView("welcome")}
        >
          <span>SUPER ADMIN</span>
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          <div className="text-xs text-gray-500 font-bold uppercase mb-4 px-2">
            Menu Utama
          </div>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setIsFrontlineOpen(!isFrontlineOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 text-white rounded-md transition-colors"
                type="button"
              >
                <span>Fronting</span>
                <span>{isFrontlineOpen ? "▼" : "◀"}</span>
              </button>
              {isFrontlineOpen && (
                <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
                  <li>
                    <button
                      onClick={() => setCurrentView("upload-produk")}
                      className={`w-full text-left ${getSubMenuClass("upload-produk")}`}
                    >
                      Upload Produk / Promo
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("pengumuman")}
                      className={`w-full text-left ${getSubMenuClass("pengumuman")}`}
                    >
                      Pengumuman
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("upload-qna")}
                      className={`w-full text-left ${getSubMenuClass("upload-qna")}`}
                    >
                      Upload QnA
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("upload-konten")}
                      className={`w-full text-left ${getSubMenuClass("upload-konten")}`}
                    >
                      Upload Konten
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("upload-fee")}
                      className={`w-full text-left ${getSubMenuClass("upload-fee")}`}
                    >
                      Upload Jml Fee Pribadi
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("create-leader")}
                      className={`w-full text-left ${getSubMenuClass("create-leader")}`}
                    >
                      Create Leader
                    </button>
                  </li>
                </ul>
              )}
            </li>
            <li className="mt-2">
              <button
                onClick={() => setCurrentView("list-akun")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === "list-akun" ? "bg-gray-800 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Pembuatan Akun
              </button>
            </li>
            <li>
              <button
                onClick={() => setCurrentView("penutupan-akun")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === "penutupan-akun" ? "bg-gray-800 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Penutupan Akun
              </button>
            </li>

            <li>
              <button
                onClick={() => setCurrentView("laporan-aduan")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === "laporan-aduan" ? "bg-gray-800 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Laporan & Aduan Pegawai
              </button>
            </li>

            <li>
              <button
                onClick={() => setCurrentView("reset-data")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === "reset-data" ? "bg-gray-800 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Manajemen Reset Data
              </button>
            </li>

            <li className="mt-2">
              <button
                onClick={() => setCurrentView("create-non-fronting")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === "create-non-fronting" ? "bg-gray-800 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Pembuatan Akun Non-Fronting
              </button>
            </li>

            <li>
              <button
                onClick={() => setCurrentView("create-mitra")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === "create-mitra" ? "bg-gray-800 text-white font-bold" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}
              >
                Create Mitra
              </button>
            </li>

            <li>
              <button
                onClick={() => setCurrentView("list-supervisor")}
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${
                  currentView === "list-supervisor"
                    ? "bg-gray-800 text-white font-bold"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                List Supervisor
              </button>
            </li>

            <li className="mt-2">
              <button
                onClick={() => setIsUnitKerjaMenuOpen(!isUnitKerjaMenuOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-md transition-colors ${
                  isUnitKerjaMenuOpen
                    ? "bg-gray-800 text-white font-bold"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`}
                type="button"
              >
                <span>Data Pegawai Unit Kerja</span>
                <span className="text-[10px]">
                  {isUnitKerjaMenuOpen ? "▲" : "▼"}
                </span>
              </button>

              {isUnitKerjaMenuOpen && (
                <ul className="mt-1 ml-2 pl-2 border-l border-gray-700 space-y-1">
                    <li>
                    <button
                        type="button"
                        onClick={() => {
                        setSelectedUnitKerja("");
                        setCurrentView("list-unit-kerja");
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                        currentView === "list-unit-kerja" && selectedUnitKerja === ""
                            ? "text-white font-bold bg-blue-600"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                        }`}
                    >
                        Semua Unit Kerja
                    </button>
                    </li>
                    {unitKerjaOptions.map((unit: any) => (
                    <li key={unit.id}>
                        <button
                        type="button"
                        onClick={() => {
                            setSelectedUnitKerja(unit.nama_unit);
                            setCurrentView("list-unit-kerja");
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded transition-colors ${
                            currentView === "list-unit-kerja" &&
                            selectedUnitKerja === unit.nama_unit
                            ? "text-white font-bold bg-blue-600"
                            : "text-gray-400 hover:text-white hover:bg-gray-800"
                        }`}
                        >
                        {unit.nama_unit}
                        </button>
                    </li>
                    ))}
                </ul>
                )}
            </li>
          </ul>
        </div>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm transition-colors"
            type="button"
          >
            Logout
          </button>
        </div>
      </div>

      {/* CONTENT MAIN CONTAINER */}
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8 border-b pb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {currentView === "welcome" && "Dashboard Super Admin"}
            {currentView === "list-akun" && "Manajemen Akun Fronting"}
            {(currentView === "form-tambah" || currentView === "form-edit") &&
              "Form Registrasi / Edit Akun"}
            {currentView === "upload-qna" && "Upload Materi QnA"}
            {currentView === "upload-fee" && "Upload Jumlah Fee Pribadi"}
            {currentView === "upload-konten" && "Upload Konten Edukasi"}
            {currentView === "penutupan-akun" && "Penutupan Akun"}
            {currentView === "create-leader" && "Manajemen Data Leader"}
            {currentView === "laporan-aduan" && "Laporan & Aduan Pegawai"}
            {currentView === "create-non-fronting" &&
              "Pembuatan Akun Non-Fronting"}
            {currentView === "edit-non-fronting" &&
              "Edit Data Pegawai Non-Fronting"}
            {currentView === "create-mitra" && "Manajemen Data Mitra"}
            {currentView === "list-supervisor" && "Manajemen Data Supervisor"}
            {currentView === "list-unit-kerja" &&
              `Data Pegawai - ${selectedUnitKerja || "Unit Kerja"}`}
          </h1>
          <span className="text-sm text-gray-600">
            Login sebagai: <b>{session?.user?.name || "Super Admin"}</b>
          </span>
        </div>

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 font-medium rounded-lg text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage("")}
              className="text-green-600 hover:text-green-800 font-bold"
            >
              ✕
            </button>
          </div>
        )}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 font-medium rounded-lg text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage("")}
              className="text-red-600 hover:text-red-800 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {currentView === "welcome" && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="max-w-xl mx-auto py-8">
              <div className="text-blue-600 text-6xl mb-4">🚀</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">
                Selamat datang di halaman dashboard super admin
              </h2>
              <p className="text-gray-600">
                Silakan pilih menu navigasi di sebelah kiri untuk mengelola akun
                fronting, non-fronting, mitra, pengumuman, dan data operasional.
              </p>
            </div>
          </div>
        )}

        {currentView === "upload-produk" && <UploadProdukView />}

        {currentView === "pengumuman" && <PengumumanView />}

        {currentView === "create-leader" && <CreateLeaderView />}

        {currentView === "create-mitra" && <CreateMitraView />}

        {currentView === "list-supervisor" && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-600">
                  Daftar Supervisor Terdaftar
                </h2>
                <p className="text-sm text-gray-500">
                  Kelola akun supervisor, penempatan mitra, dan unit kerja.
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input
                  type="text"
                  value={searchSupervisor}
                  onChange={(e) => setSearchSupervisor(e.target.value)}
                  placeholder="Cari nama, username, email, unit..."
                  className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={fetchSupervisors}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                >
                  🔄 Muat Ulang
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-6 py-4 text-center">No</th>
                    <th className="px-6 py-4">Nama Supervisor</th>
                    <th className="px-6 py-4">Username / Email</th>
                    <th className="px-6 py-4">No. HP</th>
                    <th className="px-6 py-4">Mitra</th>
                    <th className="px-6 py-4">Unit Kerja</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                  {isLoadingSupervisors ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-10 text-center text-gray-400 animate-pulse"
                      >
                        Memuat data supervisor...
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const filteredSpv = supervisors.filter((spv) => {
                        if (!searchSupervisor) return true;
                        const kw = searchSupervisor.toLowerCase();
                        return (
                          spv.nama?.toLowerCase().includes(kw) ||
                          spv.username?.toLowerCase().includes(kw) ||
                          spv.email?.toLowerCase().includes(kw) ||
                          spv.unit_kerja?.toLowerCase().includes(kw)
                        );
                      });

                      if (filteredSpv.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-6 py-12 text-center text-gray-500"
                            >
                              Belum ada data supervisor terdaftar.
                            </td>
                          </tr>
                        );
                      }

                      return filteredSpv.map((spv, index) => {
                        const mitraObj = mitraOptions.find(
                          (m) => String(m.id) === String(spv.mitra_id)
                        );

                        return (
                          <tr
                            key={spv.id || index}
                            className="hover:bg-blue-50/30 transition-colors"
                          >
                            <td className="px-6 py-4 text-center font-medium">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-900">
                              {spv.nama || "-"}
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              <div className="font-mono text-xs font-semibold text-blue-600">
                                {spv.username ? `@${spv.username}` : "-"}
                              </div>
                              <div className="text-xs text-gray-400">
                                {spv.email || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              {spv.no_hp || "-"}
                            </td>
                            <td className="px-6 py-4 text-gray-700">
                              {mitraObj ? mitraObj.nama_mitra : "-"}
                            </td>
                            <td className="px-6 py-4">
                              {spv.unit_kerja ? (
                                <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md text-xs font-medium border border-indigo-100">
                                  {spv.unit_kerja}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(spv)}
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs mr-2"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingSpv(spv)}
                                className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL EDIT SUPERVISOR */}
        {editingSpv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
              <div className="flex justify-between items-center p-5 bg-gray-50 border-b shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Edit Data Supervisor
                  </h2>
                  <p className="text-xs text-gray-500">
                    Jabatan:{" "}
                    <span className="font-semibold text-blue-600">
                      SUPERVISOR
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSpv(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSaveEdit}
                className="p-6 space-y-6 overflow-y-auto flex-1"
                autoComplete="off"
              >
                {/* BAGIAN 1: DATA PRIBADI */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b pb-2 mb-4">
                    1. Data Pribadi & Kontak
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.nama}
                        onChange={(e) =>
                          setEditForm({ ...editForm, nama: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        NIK (16 Digit) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={16}
                        value={editForm.nik}
                        onChange={(e) =>
                          setEditForm({ ...editForm, nik: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Jenis Kelamin <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={editForm.jenis_kelamin}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            jenis_kelamin: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Jenis Kelamin --</option>
                        <option value="LAKI - LAKI">LAKI - LAKI</option>
                        <option value="PEREMPUAN">PEREMPUAN</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Status Pernikahan{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={editForm.status_pernikahan}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            status_pernikahan: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Status Pernikahan --</option>
                        <option value="LAJANG">LAJANG</option>
                        <option value="NIKAH">NIKAH</option>
                        <option value="CERAI">CERAI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Tempat Lahir <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.tempat_lahir}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            tempat_lahir: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                          Tanggal Lahir <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editForm.tanggal_lahir}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              tanggal_lahir: e.target.value,
                            })
                          }
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                          Gol. Darah
                        </label>
                        <select
                          value={editForm.golongan_darah}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              golongan_darah: e.target.value,
                            })
                          }
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Pilih --</option>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="AB">AB</option>
                          <option value="O">O</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        No. WhatsApp <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.no_whatsapp}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            no_whatsapp: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Alamat Domisili <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={editForm.domisili}
                        onChange={(e) =>
                          setEditForm({ ...editForm, domisili: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* BAGIAN 2: PENEMPATAN & KONTRAK */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b pb-2 mb-4">
                    2. Penempatan & Masa Kerja
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Mitra
                      </label>
                      <select
                        value={editForm.mitra_id}
                        onChange={(e) =>
                          setEditForm({ ...editForm, mitra_id: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Mitra --</option>
                        {mitraOptions.map((m: any) => (
                          <option key={m.id} value={String(m.id)}>
                            {m.nama_mitra}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Area Penempatan <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.area_penempatan}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            area_penempatan: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Alamat Area Penempatan{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={editForm.alamat_area_penempatan}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            alamat_area_penempatan: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Tanggal Mulai Kerja
                      </label>
                      <input
                        type="date"
                        value={editForm.tanggal_mulai_kerja}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            tanggal_mulai_kerja: e.target.value,
                          })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                          Masa Kerja <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: 8 tahun"
                          value={editForm.masa_kerja}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              masa_kerja: e.target.value,
                            })
                          }
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                          Masa Kontrak
                        </label>
                        <input
                          type="text"
                          placeholder="Contoh: 2 tahun"
                          value={editForm.masa_kontrak}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              masa_kontrak: e.target.value,
                            })
                          }
                          className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Status Akun
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="NON-AKTIF">NON-AKTIF</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* BAGIAN 3: AKUN LOGIN & DOKUMEN */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 border-b pb-2 mb-4">
                    3. Kredensial Login & Dokumen Terlampir
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Username <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.username}
                        onChange={(e) =>
                          setEditForm({ ...editForm, username: e.target.value })
                        }
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                        Password Baru
                        <span className="text-[11px] text-gray-400 font-normal ml-2">
                          (Kosongkan jika tidak diubah)
                        </span>
                      </label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={editForm.password}
                        onChange={(e) =>
                          setEditForm({ ...editForm, password: e.target.value })
                        }
                        placeholder="********"
                        className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Upload & Preview Pas Foto */}
                    <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-gray-800">
                          Pas Foto
                        </label>
                        {pasFotoFile ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            Foto baru dipilih
                          </span>
                        ) : editForm.pas_foto ? (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Foto tersimpan
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">
                            Belum ada foto
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3.5">
                        {pasFotoPreview ? (
                          <a
                            href={pasFotoPreview}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Klik untuk melihat ukuran penuh"
                            className="shrink-0 group relative"
                          >
                            <img
                              src={pasFotoPreview}
                              alt="Pas Foto Supervisor"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src =
                                  "https://ui-avatars.com/api/?name=" +
                                  encodeURIComponent(editForm.nama || "SPV") +
                                  "&background=E5E7EB&color=374151";
                              }}
                              className="w-16 h-16 rounded-lg object-cover border border-gray-300 bg-white group-hover:opacity-90"
                            />
                          </a>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-white border border-dashed border-gray-300 flex items-center justify-center text-[11px] text-gray-400 shrink-0 text-center px-1">
                            Tidak ada foto
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setPasFotoFile(file);
                              if (file) {
                                setPasFotoPreview(URL.createObjectURL(file));
                              } else {
                                setPasFotoPreview(
                                  getFileUrl(editForm.pas_foto, "pas_foto")
                                );
                              }
                            }}
                            className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          <div className="mt-1.5 flex items-center gap-3">
                            {editForm.pas_foto && !pasFotoFile && (
                              <a
                                href={getFileUrl(editForm.pas_foto, "pas_foto")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] font-medium text-blue-600 hover:underline"
                              >
                                Buka foto tersimpan
                              </a>
                            )}
                            {pasFotoFile && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPasFotoFile(null);
                                  setPasFotoPreview(
                                    getFileUrl(editForm.pas_foto, "pas_foto")
                                  );
                                }}
                                className="text-[11px] font-medium text-red-600 hover:underline"
                              >
                                Batalkan perubahan foto
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bagian Surat Tugas */}
                <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-gray-800">
                      Surat Tugas
                    </label>
                    {suratTugasFile ? (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        Dokumen baru dipilih
                      </span>
                    ) : editForm.surat_tugas ? (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Dokumen tersimpan
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-400">
                        Belum ada dokumen
                      </span>
                    )}
                  </div>

                  {editForm.surat_tugas && (
                    <div className="mb-2.5 flex items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-gray-200">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">
                          {getFileNameFromUrl(editForm.surat_tugas) ||
                            "Surat_Tugas_Supervisor"}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          File saat ini tersimpan di server
                        </p>
                      </div>
                      <a
                        href={getFileUrl(editForm.surat_tugas, "surat_tugas")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                      >
                        Lihat File
                      </a>
                    </div>
                  )}

                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSuratTugasFile(file);
                    }}
                    className="w-full text-xs text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />

                  {suratTugasFile && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-emerald-700 font-medium truncate">
                        Pengganti: {suratTugasFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSuratTugasFile(null)}
                        className="text-red-600 font-medium hover:underline shrink-0 ml-2"
                      >
                        Batal ganti
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                  <button
                    type="button"
                    onClick={() => setEditingSpv(null)}
                    disabled={isSubmitting}
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL KONFIRMASI HAPUS SUPERVISOR */}
        {deletingSpv && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Hapus Akun Supervisor
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Apakah Anda yakin ingin menghapus data supervisor{" "}
                <b className="text-gray-900">{deletingSpv.nama}</b> (
                {deletingSpv.email || deletingSpv.username})? Tindakan ini tidak
                dapat dibatalkan.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeletingSpv(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentView === "upload-qna" && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-blue-600 mb-2">
              Upload Materi QnA / Edukasi
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Unggah file dokumen materi QnA (PDF, DOCX, XLSX, JPG, PNG) untuk
              dapat diakses oleh tim.
            </p>

            <form onSubmit={handleQnaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  Judul Materi QnA <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="judul"
                  required
                  placeholder="Masukkan judul materi..."
                  className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  File Dokumen Materi <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  name="file_qna"
                  required
                  accept=".pdf, .doc, .docx, .xls, .xlsx, .jpg, .jpeg, .png"
                  onChange={handleQnaFileChange}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                />
                {qnaFileName && (
                  <p className="mt-1 text-xs text-green-600 font-medium">
                    File terpilih: {qnaFileName}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? "Mengunggah..." : "Unggah Materi QnA"}
              </button>
            </form>
          </div>
        )}

        {currentView === "upload-fee" && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-blue-600 mb-2">
              Upload Jumlah Fee Pribadi (Excel)
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Unggah file Excel perhitungan fee pribadi pegawai berdasarkan
              filter Area atau Leader.
            </p>

            <form onSubmit={handleUploadFee} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Filter Berdasarkan <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={feeFilterType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      setFeeFilterType(e.target.value);
                      setFeeFilterValue("");
                    }}
                    required
                    className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Filter --</option>
                    <option value="AREA">Area</option>
                    <option value="LEADER">Leader</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1 text-gray-700">
                    Nilai Filter <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={feeFilterValue}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setFeeFilterValue(e.target.value)
                    }
                    disabled={!feeFilterType}
                    required
                    className="w-full p-2.5 bg-white text-gray-900 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  >
                    <option value="">-- Pilih Nilai --</option>
                    {feeFilterType === "AREA" &&
                      uniqueAreasFinance.map((area: any, idx: number) => (
                        <option key={idx} value={area}>
                          {area}
                        </option>
                      ))}
                    {feeFilterType === "LEADER" &&
                      uniqueLeadersFinance.map((ldr: any, idx: number) => (
                        <option key={idx} value={ldr}>
                          {ldr}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1 text-gray-700">
                  File Excel (.xlsx / .xls){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  id="excel-fee-upload"
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFeeExcelFile(e.target.files?.[0] || null)
                  }
                  required
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200"
                />
              </div>

              <button
                type="submit"
                disabled={isUploadingFee}
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
              >
                {isUploadingFee ? "Mengunggah..." : "Upload File Fee Excel"}
              </button>
            </form>
          </div>
        )}

        {currentView === "upload-konten" && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-blue-600 mb-2">
              Upload Konten Edukasi / Media
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Kelola dan unggah materi konten media pendukung operasional.
            </p>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              Modul Upload Konten siap dihubungkan dengan repositori media.
            </div>
          </div>
        )}

        {currentView === "list-akun" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-blue-600">
                Daftar Akun Fronting
              </h2>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input
                  type="text"
                  value={searchListAkun}
                  onChange={(e) => {
                    setSearchListAkun(e.target.value);
                    setCurrentPageListAkun(1);
                  }}
                  placeholder="Cari nama, NIK, atau username..."
                  className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    setSelectedData(null);
                    setCurrentView("form-tambah");
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                >
                  + Tambah Data Fronting
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nama
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Kanwil / Area
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Penempatan
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentListAkun.length > 0 ? (
                    currentListAkun.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.nama}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.kanwil} / {item.area}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.penempatan}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button
                            onClick={() => handleEdit(item)}
                            className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        Belum ada data fronting yang terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPageListAkun}
              totalPages={totalPagesListAkun}
              onPageChange={(page) => setCurrentPageListAkun(page)}
            />
          </div>
        )}

        {(currentView === "form-tambah" || currentView === "form-edit") && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-blue-600">
                {currentView === "form-edit"
                  ? "Edit Data Akun Fronting"
                  : "Form Registrasi Akun Fronting"}
              </h2>
              <button
                onClick={() => setCurrentView("list-akun")}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                &larr; Kembali ke Daftar
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
              autoComplete="off"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    name="nama"
                    defaultValue={selectedData?.nama || ""}
                    required
                    className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                    placeholder="Nama Lengkap"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NIK
                  </label>
                  <input
                    type="text"
                    name="nik"
                    value={nikValue}
                    onChange={(e) => setNikValue(e.target.value)}
                    required
                    className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                    placeholder="NIK (Contoh : TLM0001)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kanwil
                    </label>
                    <SearchableSelect
                      name="kanwil"
                      options={kanwilOptions}
                      value={selectedKanwil}
                      onChange={(val: any) => {
                        setSelectedKanwil(val);
                        setSelectedArea("");
                        setSelectedPenempatan("");
                        setSelectedLeader("");
                      }}
                      placeholder="Pilih/ketik Kanwil..."
                      required={true}
                      disabled={false}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Area
                    </label>
                    <SearchableSelect
                      name="area"
                      options={areaOptions}
                      value={selectedArea}
                      onChange={(val: any) => {
                        setSelectedArea(val);
                        setSelectedPenempatan("");
                        setSelectedLeader("");
                      }}
                      placeholder={
                        selectedKanwil
                          ? "Pilih/ketik Area..."
                          : "Pilih Kanwil dulu"
                      }
                      required={true}
                      disabled={!selectedKanwil}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Penempatan
                    </label>
                    <SearchableSelect
                      name="penempatan"
                      options={penempatanOptions}
                      value={selectedPenempatan}
                      onChange={(val: any) => {
                        setSelectedPenempatan(val);
                        setSelectedLeader("");
                      }}
                      placeholder={
                        selectedArea
                          ? "Pilih/ketik Lokasi..."
                          : "Pilih Area dulu"
                      }
                      required={true}
                      disabled={!selectedArea}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leader
                    </label>
                    <select
                      name="leader"
                      value={selectedLeader}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                        setSelectedLeader(e.target.value)
                      }
                      required
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md disabled:bg-gray-100"
                      disabled={!selectedPenempatan}
                    >
                      <option value="">
                        {!selectedPenempatan
                          ? "Pilih Penempatan dulu..."
                          : filteredLeaders.length === 0 && !selectedLeader
                            ? "Tidak ada leader di lokasi ini"
                            : "Pilih Leader..."}
                      </option>
                      {filteredLeaders.map((leader, idx) => (
                        <option key={idx} value={leader.nama_leader}>
                          {leader.nama_leader}
                        </option>
                      ))}
                      {selectedLeader &&
                        !filteredLeaders.some(
                          (l) => l.nama_leader === selectedLeader
                        ) && (
                          <option value={selectedLeader}>
                            {selectedLeader}
                          </option>
                        )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alamat Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={selectedData?.email || ""}
                    required
                    className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="nowa"
                    defaultValue={selectedData?.nowa || ""}
                    required
                    className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                    placeholder="08..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nama Bank
                    </label>
                    <input
                      type="text"
                      name="nama_bank"
                      defaultValue={selectedData?.nama_bank || ""}
                      required
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                      placeholder="Contoh: BCA / Mandiri"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      No. Rekening
                    </label>
                    <input
                      type="text"
                      name="norek"
                      defaultValue={selectedData?.norek || ""}
                      required
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                      placeholder="Nomor Rekening"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload ID Card (JPG/PNG)
                  </label>
                  <input
                    type="file"
                    name="idcard_file"
                    accept=".jpg, .jpeg, .png"
                    onChange={handleIdCardChange}
                    {...(currentView === "form-tambah"
                      ? { required: true }
                      : {})}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  />
                  {idCardName && (
                    <p className="mt-1 text-sm text-green-600 font-medium">
                      File baru: {idCardName}
                    </p>
                  )}
                  {currentView === "form-edit" &&
                    !idCardName &&
                    selectedData?.idcard_file && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                        File saat ini: {selectedData.idcard_file}
                      </div>
                    )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Surat Tugas (PDF - Maksimal 3 File)
                  </label>
                  <input
                    type="file"
                    name="st_file"
                    accept=".pdf"
                    multiple
                    onChange={handleStChange}
                    {...(currentView === "form-tambah"
                      ? { required: true }
                      : {})}
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900"
                  />
                  {stNames.length > 0 && (
                    <div className="mt-1 text-sm text-green-600 font-medium">
                      File baru terpilih ({stNames.length}/3):
                      <ul className="list-disc list-inside text-xs">
                        {stNames.map((name, i) => (
                          <li key={i}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentView === "form-edit" &&
                    stNames.length === 0 &&
                    selectedData?.st_file && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                        File saat ini: {selectedData.st_file}
                      </div>
                    )}
                </div>

                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username Akun
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={nikValue}
                      readOnly
                      required
                      className="w-full p-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-md cursor-not-allowed font-mono"
                      placeholder="Username otomatis NIK"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Akun
                      {currentView === "form-edit" && (
                        <span className="text-[10px] text-gray-400 ml-2">
                          (Kosongkan jika tidak ubah)
                        </span>
                      )}
                    </label>
                    <input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute("readOnly")}
                      required={currentView === "form-tambah"}
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                      placeholder={
                        currentView === "form-edit"
                          ? "********"
                          : "Masukkan password baru"
                      }
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-blue-300"
                >
                  {isLoading
                    ? "Memproses..."
                    : currentView === "form-edit"
                      ? "Simpan Perubahan"
                      : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        )}

        {currentView === "penutupan-akun" && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-red-600">
                  Penutupan Akun Fronting
                </h2>
                <p className="text-sm text-gray-500">
                  Pilih akun yang ingin ditutup atau dihapus.
                </p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input
                  type="text"
                  value={searchPenutupanAkun}
                  onChange={(e) => {
                    setSearchPenutupanAkun(e.target.value);
                    setCurrentPagePenutupanAkun(1);
                  }}
                  placeholder="Cari nama, NIK, atau username..."
                  className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={fetchFrontlineData}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
                >
                  🔄 Muat Ulang
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nama
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Username
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Penempatan
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Aksi Penutupan
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentPenutupanAkun.length > 0 ? (
                    currentPenutupanAkun.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.nama}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {item.penempatan}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  `Yakin ingin menutup/menghapus akun "${item.nama}"?`
                                )
                              ) {
                                try {
                                  const res = await fetch(
                                    "/super-admin/close-account",
                                    {
                                      method: "POST",
                                      headers: {
                                        "Content-Type": "application/json",
                                      },
                                      body: JSON.stringify({ id: item.id }),
                                    }
                                  );
                                  const result = await res.json();
                                  if (result.success) {
                                    alert(result.message);
                                    fetchFrontlineData();
                                  } else {
                                    alert(
                                      result.message || "Gagal menutup akun."
                                    );
                                  }
                                } catch {
                                  alert("Terjadi kesalahan sistem.");
                                }
                              }
                            }}
                            className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold px-3 py-1 rounded transition-colors text-xs"
                          >
                            Tutup Akun
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-sm text-gray-500"
                      >
                        Tidak ada data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPagePenutupanAkun}
              totalPages={totalPagesPenutupanAkun}
              onPageChange={(page) => setCurrentPagePenutupanAkun(page)}
            />
          </div>
        )}

        {currentView === "laporan-aduan" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📥 Kotak Masuk Aduan & Laporan Sistem
              </h2>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold">Tgl. Laporan</th>
                    <th className="px-6 py-4 font-bold">Judul / Pengirim</th>
                    <th className="px-6 py-4 font-bold text-center">
                      Lampiran
                    </th>
                    <th className="px-6 py-4 font-bold text-center">Status</th>
                    <th className="px-6 py-4 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingLaporan ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-gray-400 animate-pulse"
                      >
                        Memuat laporan...
                      </td>
                    </tr>
                  ) : laporanList.length > 0 ? (
                    laporanList.map((item) => {
                      const { isAnswered } = parseDeskripsi(item.deskripsi);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(item.created_at).toLocaleDateString(
                              "id-ID",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            {item.judul}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.file_name ? (
                              <span className="text-xl" title="Ada Lampiran">
                                📎
                              </span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${isAnswered ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {isAnswered ? "Dijawab" : "Menunggu"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
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
                        className="px-6 py-10 text-center text-gray-500"
                      >
                        <span className="text-3xl block mb-2">📬</span>
                        Belum ada laporan atau aduan yang ditujukan untuk Super
                        Admin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === "reset-data" && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-red-600 mb-2">
              Reset Data Mingguan
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Menu ini digunakan untuk mengosongkan seluruh data pada tabel{" "}
              <b>entri_data_perkiraan_pemasukan</b> dan <b>transaksi_gaji</b>{" "}
              serta mereset nomor ID kembali ke awal.
            </p>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-sm text-red-800">
              ⚠️ <b>Peringatan:</b> Tindakan ini bersifat permanen dan data yang
              sudah dihapus tidak dapat dikembalikan.
            </div>

            <button
              onClick={async () => {
                if (
                  confirm(
                    "Apakah Anda yakin ingin mengosongkan data perkiraan pemasukan dan transaksi gaji sekarang?"
                  )
                ) {
                  try {
                    const res = await fetch("/super-admin/reset-table", {
                      method: "POST",
                    });
                    const result = await res.json();
                    if (result.success) {
                      setSuccessMessage(result.message);
                      setTimeout(() => setSuccessMessage(""), 4000);
                    } else {
                      setErrorMessage(result.message || "Gagal mereset data.");
                      setTimeout(() => setErrorMessage(""), 5000);
                    }
                  } catch {
                    setErrorMessage("Terjadi kesalahan sistem.");
                    setTimeout(() => setErrorMessage(""), 5000);
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-lg transition-colors text-sm shadow-sm"
            >
              🗑️ Kosongkan Kedua Tabel Sekarang
            </button>
          </div>
        )}

        {selectedLaporan && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold">Detail Aduan / Kendala</h3>
                <button
                  onClick={() => setSelectedLaporan(null)}
                  className="text-gray-400 hover:text-white text-xl font-bold transition-colors focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Judul / Identitas
                  </h4>
                  <p className="text-base font-bold text-gray-800">
                    {selectedLaporan.judul}
                  </p>
                </div>

                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Isi Pesan / Pertanyaan
                  </h4>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed">
                    {parseDeskripsi(selectedLaporan.deskripsi).pertanyaan}
                  </div>
                </div>

                {selectedLaporan.file_name && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      Lampiran Foto
                    </h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 truncate mr-4">
                        📎 {selectedLaporan.file_name}
                      </span>
                      <a
                        href={`/uploads/qna/${selectedLaporan.file_name}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap"
                      >
                        Buka Lampiran
                      </a>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    💬 Berikan Balasan (Tindak Lanjut Sistem)
                  </h4>

                  {replyMsg.text && (
                    <div
                      className={`p-3 rounded-lg mb-4 text-xs font-bold ${replyMsg.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                    >
                      {replyMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleSubmitReply}>
                    <textarea
                      required
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ketik jawaban atau solusi sistem di sini..."
                      className="w-full border border-gray-300 rounded-xl p-4 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors resize-y mb-4"
                    ></textarea>

                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedLaporan(null)}
                        className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingReply || !replyText.trim()}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* CREATE NON-FRONTING: SUPERVISOR & UNIT KERJA HANYA TAMPIL JIKA JABATAN = PEGAWAI */}
        {currentView === "create-non-fronting" && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-5xl mx-auto border border-gray-100">
            <div className="mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">
                DATA PEGAWAI NON-FRONTING
              </h2>
              <p className="text-sm text-gray-500">
                Registrasi akun Non-Fronting Terpusat
              </p>
            </div>

            <form
              onSubmit={handleNonFrontingSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
              autoComplete="off"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    NAMA LENGKAP PEGAWAI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama"
                    required
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    NIK KTP <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[10px] text-gray-500 mb-1 italic">
                    Nomor Induk Kependudukan (16 digit)
                  </p>
                  <input
                    type="text"
                    name="nik"
                    required
                    minLength={16}
                    maxLength={16}
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    JENIS KELAMIN <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="jenis_kelamin"
                    required
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Jenis Kelamin --</option>
                    <option value="LAKI - LAKI">LAKI - LAKI</option>
                    <option value="PEREMPUAN">PEREMPUAN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    AREA PENEMPATAN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="area_penempatan"
                    required
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ALAMAT AREA PENEMPATAN{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="alamat_area_penempatan"
                    required
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      STATUS PERNIKAHAN <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="status_pernikahan"
                      required
                      className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Pilih...</option>
                      <option value="LAJANG">LAJANG</option>
                      <option value="NIKAH">NIKAH</option>
                      <option value="CERAI MATI">CERAI MATI</option>
                      <option value="JANDA">JANDA</option>
                      <option value="DUDA">DUDA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      GOLONGAN DARAH
                    </label>
                    <select
                      name="golongan_darah"
                      className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">-- Pilih Gol --</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="AB">AB</option>
                      <option value="O">O</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    JABATAN <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="jabatan"
                    required
                    value={jabatanNonFronting}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const val = e.target.value;
                      setJabatanNonFronting(val);
                      if (val.toUpperCase() !== "PEGAWAI") {
                        setSelectedSupervisorNonFronting("");
                        setSelectedUnitKerjaNonFronting("");
                      }
                    }}
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Jabatan --</option>
                    <option value="SPV">SPV</option>
                    <option value="PEGAWAI">PEGAWAI</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {jabatanNonFronting.toUpperCase() === "PEGAWAI" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        SUPERVISOR <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="supervisor"
                        required
                        value={selectedSupervisorNonFronting}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setSelectedSupervisorNonFronting(e.target.value)
                        }
                        className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Supervisor --</option>
                        {(() => {
                          const spvList = nonFrontingList.filter(
                            (item: any) => {
                              const jab = (item.jabatan || "")
                                .trim()
                                .toLowerCase();
                              return jab === "supervisor" || jab === "spv";
                            }
                          );

                          if (spvList.length === 0) {
                            return (
                              <option value="" disabled>
                                ⚠ Belum ada data Supervisor di database
                              </option>
                            );
                          }

                          return spvList.map((spv: any) => (
                            <option key={spv.id} value={spv.nama}>
                              {spv.nama} -{" "}
                              {spv.area_penempatan || spv.unit_kerja}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        UNIT KERJA <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="unit_kerja"
                        required
                        value={selectedUnitKerjaNonFronting}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                          setSelectedUnitKerjaNonFronting(e.target.value)
                        }
                        className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Unit Kerja --</option>
                        {unitKerjaOptions.map((unit: any) => (
                          <option key={unit.id} value={unit.nama_unit}>
                            {unit.nama_unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      TANGGAL LAHIR <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="tanggal_lahir"
                      required
                      className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      TGL MULAI KERJA <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="tanggal_mulai_kerja"
                      required
                      className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    UPLOAD PAS FOTO (JPG/PNG){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="pas_foto"
                    accept=".jpg, .jpeg, .png"
                    required
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files && e.target.files[0])
                        setPasFotoName(e.target.files[0].name);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700"
                  />
                  {pasFotoName && (
                    <p className="text-xs text-green-600 mt-1">
                      File: {pasFotoName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    UPLOAD SURAT TUGAS (PDF/JPG/PNG){" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="surat_tugas"
                    accept=".pdf, .jpg, .jpeg, .png"
                    required
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.files && e.target.files[0])
                        setSuratTugasName(e.target.files[0].name);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-100 file:text-blue-700"
                  />
                  {suratTugasName && (
                    <p className="text-xs text-green-600 mt-1">
                      File: {suratTugasName}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      USERNAME AKUN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="username"
                      required
                      placeholder="Username..."
                      className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      PASSWORD AKUN <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      placeholder="Password..."
                      className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50"
                  >
                    {isLoading
                      ? "Menyimpan Data..."
                      : "Simpan Data Non-Fronting"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {currentView === "list-unit-kerja" && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-blue-600">
                  Data Pegawai Unit Kerja: {selectedUnitKerja || "Semua"}
                </h2>
                <p className="text-sm text-gray-500">
                  Daftar akun pegawai non-fronting terdaftar pada unit kerja
                  ini.
                </p>
              </div>
              <input
                type="text"
                value={searchNonFronting}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchNonFronting(e.target.value)
                }
                placeholder="Cari nama, NIK, atau username..."
                className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
                  <tr>
                    <th className="px-6 py-4">No</th>
                    <th className="px-6 py-4">Nama / NIK</th>
                    <th className="px-6 py-4">Jabatan</th>
                    <th className="px-6 py-4">Penempatan</th>
                    <th className="px-6 py-4">Berkas</th>
                    <th className="px-6 py-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                  {filteredNonFrontingByUnit.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-10 text-center text-gray-500"
                      >
                        Belum ada data pegawai untuk unit kerja ini.
                      </td>
                    </tr>
                  ) : (
                    filteredNonFrontingByUnit.map(
                      (item: any, index: number) => (
                        <tr
                          key={item.id || index}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="px-6 py-4 text-center font-medium">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 font-semibold text-gray-900">
                            <div>{item.nama}</div>
                            <div className="text-xs text-gray-400 font-mono">
                              {item.nik}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-xs">
                            <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md">
                              {item.jabatan || "PEGAWAI"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            <div>{item.area_penempatan || "-"}</div>
                            <div className="text-xs text-gray-400">
                              {item.alamat_area_penempatan || "-"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {item.pas_foto && (
                              <a
                                href={getFileUrl(item.pas_foto, "pas_foto")}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-600 hover:underline block"
                              >
                                📷 Pas Foto
                              </a>
                            )}
                            {item.surat_tugas && (
                              <a
                                href={getFileUrl(
                                  item.surat_tugas,
                                  "surat_tugas"
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="text-purple-600 hover:underline block mt-0.5"
                              >
                                📄 Surat Tugas
                              </a>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleEditNonFronting(item)}
                              className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs mr-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                handleNonAktifkanPegawai(item.id, item.nama)
                              }
                              className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === "edit-non-fronting" && editFormData && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
              <div>
                <h2 className="text-xl font-bold text-blue-600">
                  Edit Data Pegawai: {editFormData.nama || "-"}
                </h2>
                <p className="text-sm text-gray-500">
                  NIK: <b>{editFormData.nik || "-"}</b> | Username:{" "}
                  <b>{editFormData.username || "-"}</b>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedData(null);
                  setEditFormData(null);
                  setCurrentView("list-unit-kerja");
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors"
              >
                ← Kembali ke Daftar Pegawai
              </button>
            </div>

            <form onSubmit={handleEditNonFrontingSubmit} className="space-y-4">
              {/* BARIS 1: NAMA, NIK, USERNAME */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    NAMA LENGKAP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama"
                    required
                    value={editFormData.nama || ""}
                    onChange={(e: any) =>
                      setEditFormData({ ...editFormData, nama: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    NIK <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nik"
                    required
                    value={editFormData.nik || ""}
                    onChange={(e: any) =>
                      setEditFormData({ ...editFormData, nik: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    USERNAME LOGIN
                  </label>
                  <input
                    type="text"
                    name="username"
                    readOnly
                    value={editFormData.username || ""}
                    className="w-full p-2.5 bg-gray-200 text-gray-600 border border-gray-300 rounded-md text-sm font-mono cursor-not-allowed"
                  />
                </div>
              </div>

              {/* BARIS 2: MITRA, JABATAN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    MITRA TERDAFTAR
                  </label>
                  <select
                    name="id_mitra"
                    value={editFormData.id_mitra || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        id_mitra: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Mitra Terdaftar --</option>
                    {mitraOptions.map((mitra: any) => (
                      <option key={mitra.id} value={mitra.id}>
                        {mitra.kode_mitra} - {mitra.nama_mitra}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    JABATAN <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="jabatan"
                    required
                    value={editJabatan}
                    onChange={handleEditJabatanChange}
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PEGAWAI">PEGAWAI</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                  </select>
                </div>
              </div>

              {/* BARIS 3: JENIS KELAMIN, TEMPAT LAHIR, TANGGAL LAHIR */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    JENIS KELAMIN <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="jenis_kelamin"
                    required
                    value={editFormData.jenis_kelamin || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        jenis_kelamin: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Jenis Kelamin --</option>
                    <option value="LAKI - LAKI">LAKI - LAKI</option>
                    <option value="PEREMPUAN">PEREMPUAN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    TEMPAT LAHIR <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="tempat_lahir"
                    required
                    value={editFormData.tempat_lahir || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        tempat_lahir: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    TANGGAL LAHIR <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="tanggal_lahir"
                    required
                    value={editFormData.tanggal_lahir || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        tanggal_lahir: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* BARIS 4: EMAIL, NO WHATSAPP, DOMISILI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    EMAIL <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={editFormData.email || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        email: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    NO. WHATSAPP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="no_whatsapp"
                    required
                    value={editFormData.no_whatsapp || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        no_whatsapp: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    DOMISILI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="domisili"
                    required
                    value={editFormData.domisili || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        domisili: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* BARIS 5: STATUS PERNIKAHAN, GOLONGAN DARAH, SUPERVISOR, UNIT KERJA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    STATUS PERNIKAHAN <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="status_pernikahan"
                    required
                    value={editFormData.status_pernikahan || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        status_pernikahan: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Status --</option>
                    <option value="LAJANG">LAJANG</option>
                    <option value="NIKAH">NIKAH</option>
                    <option value="CERAI">CERAI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    GOLONGAN DARAH
                  </label>
                  <select
                    name="golongan_darah"
                    value={editFormData.golongan_darah || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        golongan_darah: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Gol. Darah --</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                  </select>
                </div>

                {editJabatan.toUpperCase() !== "SUPERVISOR" && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        SUPERVISOR <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="supervisor"
                        required={editJabatan.toUpperCase() !== "SUPERVISOR"}
                        value={editSupervisor}
                        onChange={(e) => setEditSupervisor(e.target.value)}
                        className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Supervisor --</option>
                        {(() => {
                          const spvList = nonFrontingList.filter(
                            (item: any) => {
                              const jab = (item.jabatan || "")
                                .trim()
                                .toLowerCase();
                              return jab === "supervisor" || jab === "spv";
                            }
                          );

                          if (spvList.length === 0) {
                            return (
                              <option value="" disabled>
                                ⚠ Belum ada data Supervisor di database
                              </option>
                            );
                          }

                          return spvList.map((spv: any) => (
                            <option key={spv.id} value={spv.nama}>
                              {spv.nama} -{" "}
                              {spv.area_penempatan || spv.unit_kerja}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        UNIT KERJA <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="unit_kerja"
                        required={editJabatan.toUpperCase() !== "SUPERVISOR"}
                        defaultValue={editFormData?.unit_kerja || ""}
                        className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Unit Kerja --</option>
                        {unitKerjaOptions.map((unit: any) => (
                          <option key={unit.id} value={unit.nama_unit}>
                            {unit.nama_unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* BARIS 6: AREA PENEMPATAN & ALAMAT AREA PENEMPATAN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    AREA PENEMPATAN <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="area_penempatan"
                    required
                    value={editFormData.area_penempatan || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        area_penempatan: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    ALAMAT AREA PENEMPATAN{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="alamat_area_penempatan"
                    required
                    value={editFormData.alamat_area_penempatan || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        alamat_area_penempatan: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* BARIS 7: MASA KERJA, TANGGAL MULAI KERJA, MASA KONTRAK */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    MASA KERJA <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="masa_kerja"
                    required
                    value={editFormData.masa_kerja || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        masa_kerja: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    TANGGAL MULAI KERJA
                  </label>
                  <input
                    type="date"
                    name="tanggal_mulai_kerja"
                    value={editFormData.tanggal_mulai_kerja || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        tanggal_mulai_kerja: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    MASA KONTRAK
                  </label>
                  <input
                    type="text"
                    name="masa_kontrak"
                    value={editFormData.masa_kontrak || ""}
                    onChange={(e: any) =>
                      setEditFormData({
                        ...editFormData,
                        masa_kontrak: e.target.value,
                      })
                    }
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* SECTION DOKUMEN & KREDENSIAL */}
              <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 mt-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    📂 Dokumen Pegawai & Kredensial
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    - Kosongkan input file / password jika tidak ingin
                    merubahnya
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* 1. PAS FOTO */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      PAS FOTO PEGAWAI
                    </label>

                    {editFormData.pas_foto ? (
                      <div className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-lg">
                        <img
                          src={getFileUrl(editFormData.pas_foto, "pas_foto")}
                          alt="Pas Foto Pegawai"
                          className="w-12 h-14 object-cover rounded-md border border-gray-300 shadow-sm"
                        />
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-semibold text-gray-700 truncate">
                            Foto Saat Ini
                          </p>
                          <a
                            href={getFileUrl(editFormData.pas_foto, "pas_foto")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-600 hover:underline font-medium"
                          >
                            🔍 Lihat Foto Ukuran Penuh
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Belum ada foto
                      </p>
                    )}

                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">
                        Ganti Pas Foto (JPG/PNG):
                      </label>
                      <input
                        type="file"
                        name="pas_foto"
                        accept="image/*"
                        className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                      />
                    </div>
                  </div>

                  {/* 2. SURAT TUGAS (PDF) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      SURAT TUGAS (PDF)
                    </label>

                    {editFormData.surat_tugas ? (
                      <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-xl">📄</span>
                          <div className="overflow-hidden">
                            <p className="text-[11px] font-semibold text-gray-800 truncate">
                              Dokumen Surat Tugas
                            </p>
                            <span className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">
                              PDF Terunggah
                            </span>
                          </div>
                        </div>
                        <a
                          href={getFileUrl(
                            editFormData.surat_tugas,
                            "surat_tugas"
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[11px] font-bold rounded transition-colors whitespace-nowrap"
                        >
                          Buka PDF ↗
                        </a>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">
                        Belum ada dokumen PDF
                      </p>
                    )}

                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">
                        Ganti Surat Tugas (PDF):
                      </label>
                      <input
                        type="file"
                        name="surat_tugas"
                        accept=".pdf"
                        className="w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-colors"
                      />
                    </div>
                  </div>

                  {/* 3. UBAH PASSWORD */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-700">
                      KREDENSIAL LOGIN
                    </label>
                    <div className="p-3 bg-white border border-gray-200 rounded-lg space-y-2">
                      <label className="block text-[11px] font-medium text-gray-600">
                        Ubah Password (Opsional):
                      </label>
                      <input
                        type="password"
                        name="password"
                        placeholder="Biarkan kosong jika tidak diubah"
                        className="w-full p-2 bg-gray-50 text-gray-900 border border-gray-300 rounded-md text-xs outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TOMBOL SIMPAN & BATAL */}
              <div className="pt-4 flex justify-end gap-3 border-t mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedData(null);
                    setEditFormData(null);
                    setCurrentView("list-unit-kerja");
                  }}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading
                    ? "Menyimpan Perubahan..."
                    : "Simpan Perubahan Pegawai"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 6. CLIENT WRAPPER WITH PRE-HYDRATED SESSION
// ==========================================
export default function SuperAdminClient({ session }: { session: Session }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <DashboardContent />
    </SessionProvider>
  );
}