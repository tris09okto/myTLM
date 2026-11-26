"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import RoleSidebarLayout from "@/app/components/RoleSidebarLayout";

export const dynamic = "force-dynamic";

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
    <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-3 sm:px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-xl gap-3">
      <span className="text-xs text-gray-500 text-center sm:text-left">
        Menampilkan halaman <b>{currentPage}</b> dari <b>{safeTotalPages}</b>
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          &larr; Prev
        </button>
        {getPageNumbers().map((num) => (
          <button
            type="button"
            key={num}
            onClick={() => onPageChange(num)}
            className={`px-2.5 sm:px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${
              currentPage === num
                ? "bg-green-600 text-white border-green-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {num}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === safeTotalPages}
          className="px-2.5 sm:px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

  // --- STATE PROFIL SUPERVISOR ---
  const [profile, setProfile] = useState<any>(null);

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- STATE NOTIFIKASI ---
  const [notifikasiList, setNotifikasiList] = useState<any[]>([]);
  const [showNotifikasi, setShowNotifikasi] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotifikasi, setSelectedNotifikasi] = useState<any>(null);

  // --- STATE PEKERJAAN & TUGAS TIM ---
  const [searchPekerjaan, setSearchPekerjaan] = useState("");
  const [selectedPegawaiWork, setSelectedPegawaiWork] = useState<any>(null);

  // --- STATE APPROVAL IZIN & CUTI TIM ---
  const [izinList, setIzinList] = useState<any[]>([]);
  const [isLoadingIzin, setIsLoadingIzin] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState<any>(null);
  const [approvalCatatan, setApprovalCatatan] = useState("");
  const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);
  const [approvalMsg, setApprovalMsg] = useState({ type: "", text: "" });
  const [filterStatusIzin, setFilterStatusIzin] = useState("ALL");

  // --- STATE LAPORAN & ADUAN TIM ---
  const [laporanList, setLaporanList] = useState<any[]>([]);
  const [isLoadingLaporan, setIsLoadingLaporan] = useState(false);
  const [selectedLaporan, setSelectedLaporan] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState({ type: "", text: "" });

  // --- STATE SURVEY KUNJUNGAN ---
  const [surveyKeterangan, setSurveyKeterangan] = useState("");
  const [surveyFoto, setSurveyFoto] = useState<File | null>(null);
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [surveyMsg, setSurveyMsg] = useState({ type: "", text: "" });

  // --- STATE STATUS GAJI ---
  const [gajiList] = useState<any[]>([]);
  const [searchGaji] = useState("");
  const [currentPageGaji] = useState(1);
  const itemsPerPage = 10;

  // --- STATE GANTI PASSWORD SPV ---
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });
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

  // State Absensi Supervisor
  const [sudahMasuk, setSudahMasuk] = useState(false);
  const [sudahPulang, setSudahPulang] = useState(false);

  // State Modal & Lokasi
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

  // Ref Kamera Live
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Fetch Profil Supervisor dari API atau fallback ke session
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session) return;
      try {
        const res = await fetch("/api/pegawai/profile");
        const contentType = res.headers.get("content-type");
        if (res.ok && contentType && contentType.includes("application/json")) {
          const result = await res.json();
          if (result.success) {
            setProfile(result.data);
          }
        }
      } catch (err) {
        console.error("Gagal memuat profile supervisor:", err);
      }
    };

    fetchProfile();
  }, [session]);

  // Cek status absen supervisor hari ini
  const cekStatusAbsen = async () => {
    const targetNik = profile?.nik || session?.user?.name;
    if (!targetNik) return;

    try {
      const res = await fetch(
        `/api/pegawai/cek-absen?nik=${encodeURIComponent(targetNik)}`
      );
      const result = await res.json();
      if (result.success) {
        setSudahMasuk(result.sudahMasuk);
        setSudahPulang(result.sudahPulang);
      }
    } catch (e) {
      console.error("Gagal mengecek status absen supervisor:", e);
    }
  };

  useEffect(() => {
    if (profile || session) cekStatusAbsen();
  }, [profile, session]);

  // Geolocation
  const getGeoLocation = () => {
    setIsLocating(true);
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung Geolocation.");
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
            address: `Koordinat: ${lat}, ${lng}`,
          });
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        alert("Gagal mengambil lokasi. Pastikan izin GPS aktif.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Kamera Live
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
      alert("Kamera tidak dapat diakses.");
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
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      if (context) {
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const fileName = `absen_spv_${
                profile?.nik || session?.user?.name || "spv"
              }_${Date.now()}.jpg`;
              const photoFile = new File([blob], fileName, {
                type: "image/jpeg",
              });
              setAbsenPhoto(photoFile);
              setAbsenPhotoPreview(URL.createObjectURL(photoFile));
              stopCamera();
            }
          },
          "image/jpeg",
          0.6
        );
      }
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    setShowAbsenModal(false);
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

    const spvNik = profile?.nik || session?.user?.name;
    if (!spvNik) {
      alert("⚠️ NIK Supervisor tidak ditemukan.");
      return;
    }

    setIsSubmittingAbsen(true);

    try {
      const formData = new FormData();
      formData.append("nik", spvNik);
      formData.append(
        "nama",
        profile?.nama ||
          dashboardData?.spv?.nama_leader ||
          session?.user?.name ||
          ""
      );
      formData.append("unit_kerja", profile?.unit_kerja || "SUPERVISOR");
      formData.append("jenis_absen", absenType);
      formData.append("latitude", absenLocation.lat.toString());
      formData.append("longitude", absenLocation.lng.toString());
      formData.append("lokasi_alamat", absenLocation.address);
      formData.append("foto_absen", absenPhoto);

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
      alert("❌ Terjadi kesalahan saat mengirim absensi.");
    } finally {
      setIsSubmittingAbsen(false);
    }
  };

  const filteredTeamWork =
    dashboardData?.team?.filter((member: any) => {
      if (!searchPekerjaan) return true;
      const kw = searchPekerjaan.toLowerCase();
      return (
        String(member.nama || "").toLowerCase().includes(kw) ||
        String(member.nik || "").toLowerCase().includes(kw) ||
        String(member.unit_kerja || "").toLowerCase().includes(kw) ||
        String(member.jabatan || "").toLowerCase().includes(kw) ||
        String(member.area_penempatan || "").toLowerCase().includes(kw)
      );
    }) || [];

  const filteredIzinList = izinList.filter((item: any) => {
    if (filterStatusIzin === "ALL") return true;
    return String(item.status || "").toUpperCase() === filterStatusIzin;
  });

  const formatArea = (areaData: string) => {
    if (!areaData) return "-";
    try {
      const parsed = JSON.parse(areaData);
      return Array.isArray(parsed) ? parsed.join(", ") : parsed;
    } catch (e) {
      return String(areaData).replace(/[\[\]"]/g, "");
    }
  };

  const parseDeskripsi = (desc: string) => {
    if (!desc) return { pertanyaan: "", jawaban: "", isAnswered: false };
    const parts = desc.split("\n\nJawaban :\n");
    const rawPertanyaan = parts[0]?.replace("Pertanyaan :\n", "") || "";
    const rawJawaban = parts[1] || "";

    return {
      pertanyaan: rawPertanyaan,
      jawaban: rawJawaban.includes("[Menunggu balasan") ? "" : rawJawaban,
      isAnswered:
        !rawJawaban.includes("[Menunggu balasan") && rawJawaban.trim() !== "",
    };
  };

  const fetchNotifikasi = async () => {
    const activeUsername =
      session?.user?.name || (session?.user as any)?.username;
    if (!activeUsername) return;

    try {
      const response = await fetch(
        `/api/spv/notifikasi-absensi?username=${encodeURIComponent(
          activeUsername
        )}`
      );
      const result = await response.json();
      if (result.success) {
        setNotifikasiList(result.data);
        setUnreadCount(
          result.data.filter((n: any) => Number(n.is_read) === 0).length
        );
      }
    } catch (error) {
      console.error("Gagal menarik notifikasi:", error);
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
      const activeUsername =
        session?.user?.name || (session?.user as any)?.username;
      const res = await fetch("/api/spv/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: activeUsername,
          oldPassword,
          newPassword,
        }),
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
    const fetchSpvData = async () => {
      const activeUsername =
        session?.user?.name || (session?.user as any)?.username;
      if (!activeUsername) return;

      try {
        const response = await fetch(
          `/api/spv/dashboard?username=${encodeURIComponent(activeUsername)}`
        );
        const result = await response.json();

        if (!response.ok)
          throw new Error(result.error || "Gagal memuat data dashboard SPV");
        setDashboardData(result);
        setProfile((prev: any) => prev || result.spv);
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
    const fetchIzinList = async () => {
      const activeSpvName =
        dashboardData?.spv?.nama_leader ||
        profile?.nama ||
        session?.user?.name ||
        "";
      const activeUsername =
        session?.user?.name || (session?.user as any)?.username || "";
      const activeNik = profile?.nik || dashboardData?.spv?.nik || "";

      if (!activeSpvName && !activeUsername && !activeNik) return;

      setIsLoadingIzin(true);
      try {
        const params = new URLSearchParams({
          spvName: activeSpvName,
          username: activeUsername,
          nik: activeNik,
        });

        const res = await fetch(
          `/api/spv/approval-izin?${params.toString()}`
        );
        const contentType = res.headers.get("content-type");
        if (
          !res.ok ||
          !contentType ||
          !contentType.includes("application/json")
        ) {
          setIzinList([]);
          return;
        }

        const result = await res.json();
        if (result.success) {
          setIzinList(result.data || []);
        } else {
          setIzinList([]);
        }
      } catch (e) {
        console.error("Gagal menarik data perizinan tim:", e);
        setIzinList([]);
      } finally {
        setIsLoadingIzin(false);
      }
    };

    if (session || dashboardData || profile) {
      fetchIzinList();
    }
  }, [currentView, dashboardData, profile, session]);

  useEffect(() => {
    const fetchLaporan = async () => {
      const activeSpvName =
        dashboardData?.spv?.nama_leader || session?.user?.name;
      if (!activeSpvName || currentView !== "laporan") return;

      setIsLoadingLaporan(true);
      try {
        const res = await fetch(
          `/api/spv/laporan-aduan?spvName=${encodeURIComponent(activeSpvName)}`
        );
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

    if (currentView === "laporan") fetchLaporan();
  }, [currentView, dashboardData, session]);

  const handleOpenNotifikasi = async (item: any) => {
    setSelectedNotifikasi(item);
    setShowNotifikasi(false);

    if (Number(item.is_read) === 0) {
      setNotifikasiList((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch("/api/spv/notifikasi-absensi", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: item.id }),
        });
      } catch (e) {
        console.error("Gagal memperbarui status baca notifikasi");
      }
    }
  };

  const handleTandaiSemuaDibaca = async () => {
    const activeUsername =
      session?.user?.name || (session?.user as any)?.username;
    setUnreadCount(0);
    setNotifikasiList((prev) => prev.map((n) => ({ ...n, is_read: 1 })));

    try {
      await fetch("/api/spv/notifikasi-absensi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: activeUsername }),
      });
    } catch (e) {
      console.error("Gagal update status read");
    }
  };

  const handleProcessApproval = async (
    statusApproval: "DISETUJUI" | "DITOLAK"
  ) => {
    if (!selectedIzin) return;

    setIsSubmittingApproval(true);
    setApprovalMsg({ type: "", text: "" });

    try {
      const res = await fetch("/api/spv/approval-izin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedIzin.id,
          status: statusApproval,
          catatan_spv: approvalCatatan,
          approved_by:
            session?.user?.name || (session?.user as any)?.username,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setApprovalMsg({
          type: "success",
          text: `Izin berhasil di-${
            statusApproval === "DISETUJUI" ? "setujui" : "tolak"
          }!`,
        });

        setIzinList((prev) =>
          prev.map((item) => {
            if (item.id === selectedIzin.id) {
              return {
                ...item,
                status: statusApproval,
                catatan_spv: approvalCatatan,
                approved_by:
                  session?.user?.name || (session?.user as any)?.username,
              };
            }
            return item;
          })
        );

        setTimeout(() => {
          setSelectedIzin(null);
          setApprovalCatatan("");
        }, 1200);
      } else {
        setApprovalMsg({
          type: "error",
          text: result.message || "Gagal memproses approval.",
        });
      }
    } catch (e) {
      setApprovalMsg({
        type: "error",
        text: "Terjadi kesalahan sistem saat memproses approval.",
      });
    } finally {
      setIsSubmittingApproval(false);
    }
  };

  const handleOpenLaporan = (item: any) => {
    setSelectedLaporan(item);
    const parsed = parseDeskripsi(item.deskripsi);
    setReplyText(parsed.jawaban);
    setReplyMsg({ type: "", text: "" });
  };

  const handleSubmitReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    setReplyMsg({ type: "", text: "" });

    try {
      const res = await fetch("/api/spv/laporan-aduan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedLaporan.id,
          answer: replyText,
        }),
      });

      const result = await res.json();
      if (result.success) {
        setReplyMsg({ type: "success", text: "Balasan berhasil dikirim!" });

        setLaporanList((prev) =>
          prev.map((l) => {
            if (l.id === selectedLaporan.id) {
              const parts = l.deskripsi.split("\n\nJawaban :\n");
              return { ...l, deskripsi: `${parts[0]}\n\nJawaban :\n${replyText}` };
            }
            return l;
          })
        );

        setTimeout(() => setSelectedLaporan(null), 1500);
      } else {
        setReplyMsg({
          type: "error",
          text: result.message || "Gagal mengirim balasan.",
        });
      }
    } catch (e) {
      setReplyMsg({ type: "error", text: "Terjadi kesalahan sistem." });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleSubmitSurvey = async (e: FormEvent) => {
    e.preventDefault();
    setSurveyMsg({ type: "", text: "" });
    if (!surveyKeterangan.trim()) {
      setSurveyMsg({
        type: "error",
        text: "Keterangan survey kunjungan tidak boleh kosong!",
      });
      return;
    }

    setIsSubmittingSurvey(true);
    try {
      const formData = new FormData();
      formData.append("keterangan", surveyKeterangan);
      formData.append(
        "spv_username",
        session?.user?.name || (session?.user as any)?.username || ""
      );
      formData.append(
        "spv_nama",
        dashboardData?.spv?.nama_leader || session?.user?.name || ""
      );
      if (surveyFoto) formData.append("foto", surveyFoto);

      const res = await fetch("/api/spv/survey-kunjungan", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (result.success) {
        setSurveyMsg({
          type: "success",
          text: "Survey kunjungan berhasil dikirim dan diteruskan ke MO & HRD!",
        });
        setSurveyKeterangan("");
        setSurveyFoto(null);
        const fileInput = document.getElementById(
          "foto-survey"
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = "";
      } else {
        setSurveyMsg({
          type: "error",
          text: result.message || "Gagal mengirim survey kunjungan.",
        });
      }
    } catch (error) {
      setSurveyMsg({
        type: "error",
        text: "Terjadi kesalahan jaringan saat mengirim data.",
      });
    } finally {
      setIsSubmittingSurvey(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-100 text-gray-700 font-medium px-4 text-center">
        Memuat Dashboard Supervisor (SPV)...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh items-center justify-center flex-col gap-4 bg-gray-100 px-4 text-center">
        <p className="text-red-500 font-semibold">Anda belum login.</p>
        <a
          href="/api/auth/signin"
          className="bg-green-600 text-white px-5 py-2.5 rounded-md hover:bg-green-700 transition-colors text-sm font-semibold"
        >
          Login Sekarang
        </a>
      </div>
    );
  }

  const spvDisplayName =
    dashboardData?.spv?.nama_leader || session?.user?.name || "Supervisor";

  const pendingIzinCount = izinList.filter(
    (i) => String(i.status).toUpperCase() === "PENDING"
  ).length;

  const pageTitleMap: Record<string, string> = {
    dashboard: "Ringkasan Anggota Tim Non-Fronting",
    "pekerjaan-tim": "Daftar Anggota & Detail Pekerjaan Tim",
    "approval-izin": "Approval Perizinan & Cuti Tim",
    laporan: "Laporan & Aduan Anggota Tim",
    "survey-kunjungan": "Form Survey Kunjungan Lapangan",
    "status-gaji": "Status Gaji & Penghasilan Tim",
    pengaturan: "Pengaturan Akun",
  };

  const activePageTitle = pageTitleMap[currentView] || "Dashboard Supervisor";

  // Widget Bell Notifikasi (digunakan bersama di Mobile Top Bar & Desktop Header)
  const notificationBellWidget = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowNotifikasi(!showNotifikasi)}
        className="relative p-2 text-gray-600 hover:text-green-600 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
        title="Pesan Notifikasi"
        aria-label="Pesan Notifikasi"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[10px] font-bold h-4 min-w-[16px] px-1 flex items-center justify-center rounded-full border border-white">
            {unreadCount}
          </span>
        )}
      </button>

      {showNotifikasi && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          <div className="bg-gray-900 text-white p-3.5 sm:p-4 flex justify-between items-center">
            <h4 className="text-sm font-bold flex items-center gap-2">
              🔔 Pesan Notifikasi
            </h4>
            <button
              type="button"
              onClick={() => setShowNotifikasi(false)}
              className="text-gray-400 hover:text-white font-bold text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 flex-1">
            {notifikasiList.length > 0 ? (
              notifikasiList.map((notif: any, idx: number) => {
                const isRead = Number(notif.is_read) === 1;
                return (
                  <div
                    key={idx}
                    onClick={() => handleOpenNotifikasi(notif)}
                    className={`p-3.5 sm:p-4 transition-colors cursor-pointer ${
                      isRead
                        ? "bg-white hover:bg-gray-50"
                        : "bg-green-50/70 hover:bg-green-100"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-bold text-gray-800 text-sm flex gap-1.5 items-center">
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
                        )}
                        {notif.pengirim_role || "Sistem"}
                      </span>
                      <span className="text-[10px] text-gray-500 font-medium shrink-0">
                        {new Date(notif.created_at).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 mt-1">
                      {notif.tipe_pesan}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                      {notif.konten}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center text-gray-500">
                <span className="text-3xl mb-2">📭</span>
                <p className="text-sm font-medium">
                  Belum ada notifikasi baru.
                </p>
              </div>
            )}
          </div>

          {notifikasiList.length > 0 && unreadCount > 0 && (
            <div className="border-t border-gray-100 p-2 bg-gray-50">
              <button
                type="button"
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
  );

  // Konten Sidebar untuk Desktop & Mobile Drawer
  const sidebarContent = (
    <div className="flex h-dvh flex-col justify-between bg-gray-900 text-white">
      <div className="flex flex-col min-h-0">
        <div
          onClick={() => setCurrentView("dashboard")}
          className="p-5 text-lg lg:text-xl font-bold border-b border-gray-700 text-center tracking-wider text-green-400 cursor-pointer hover:bg-gray-800/60 transition shrink-0"
        >
          SUPERVISOR AREA
          <span className="block text-[11px] font-semibold text-gray-400 uppercase mt-0.5 tracking-widest truncate px-2">
            {spvDisplayName}
          </span>
        </div>

        <div className="p-4 flex-grow overflow-y-auto space-y-1.5">
          <button
            type="button"
            onClick={() => setCurrentView("dashboard")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
              currentView === "dashboard"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            📊 DASHBOARD UTAMA
          </button>

          {/* Tombol Absen di Sidebar Dashboard Supervisor */}
          <div className="my-3 flex flex-col gap-2 px-1 py-2 border-y border-gray-800">
            <button
              type="button"
              onClick={handleAbsenMasuk}
              disabled={sudahMasuk}
              className={`w-full py-2.5 px-3 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-xs ${
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
              className={`w-full py-2.5 px-3 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 text-xs ${
                !sudahMasuk || sudahPulang
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              🏃 {sudahPulang ? "SUDAH ABSEN PULANG" : "KLIK ABSEN PULANG"}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setCurrentView("pekerjaan-tim")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
              currentView === "pekerjaan-tim"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            📋 PEKERJAAN & TUGAS TIM
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("approval-izin")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors flex items-center justify-between ${
              currentView === "approval-izin"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span>✉️ APPROVAL IZIN TIM</span>
            {pendingIzinCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0">
                {pendingIzinCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("laporan")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
              currentView === "laporan"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            📝 LAPORAN & ADUAN TIM
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("survey-kunjungan")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
              currentView === "survey-kunjungan"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            🗺️ SURVEY KUNJUNGAN
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("status-gaji")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
              currentView === "status-gaji"
                ? "bg-gray-800 text-white font-bold"
                : "text-gray-300 hover:text-white hover:bg-gray-800"
            }`}
          >
            💰 STATUS GAJI TIM
          </button>

          <button
            type="button"
            onClick={() => setCurrentView("pengaturan")}
            className={`w-full text-left px-4 py-3 rounded-md text-sm transition-colors ${
              currentView === "pengaturan"
                ? "bg-gray-800 font-bold text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            🔑 PENGATURAN AKUN
          </button>
        </div>
      </div>

      <div className="p-3 border-t border-gray-800 shrink-0">
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
      subtitle={`SPV: ${spvDisplayName}`}
      headerRight={notificationBellWidget}
      sidebarContent={sidebarContent}
    >
      {/* QUICK ABSEN BAR KHUSUS MOBILE */}
      <div className="lg:hidden grid grid-cols-2 gap-2.5 mb-4">
        <button
          type="button"
          onClick={handleAbsenMasuk}
          disabled={sudahMasuk}
          className={`py-2.5 px-3 rounded-xl font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 text-xs ${
            sudahMasuk
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 text-white"
          }`}
        >
          🕒 {sudahMasuk ? "Sudah Masuk" : "Absen Masuk"}
        </button>
        <button
          type="button"
          onClick={handleAbsenPulang}
          disabled={!sudahMasuk || sudahPulang}
          className={`py-2.5 px-3 rounded-xl font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 text-xs ${
            !sudahMasuk || sudahPulang
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          🏃 {sudahPulang ? "Sudah Pulang" : "Absen Pulang"}
        </button>
      </div>

      {/* HEADER DESKTOP */}
      <div className="hidden lg:flex mb-8 border-b pb-4 justify-between items-center relative z-20 gap-4">
        <h1 className="text-2xl font-bold text-gray-800 uppercase">
          {activePageTitle}
        </h1>

        <div className="flex items-center gap-6 shrink-0">
          {notificationBellWidget}

          <span className="text-sm text-gray-600 border-l border-gray-300 pl-6">
            Login sebagai SPV:{" "}
            <b className="text-green-600 uppercase">{spvDisplayName}</b>
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 sm:px-6 sm:py-4 rounded-xl mb-6 text-xs sm:text-sm font-semibold">
          ⚠️ {error}
        </div>
      )}

      {/* 1. DASHBOARD UTAMA */}
      {currentView === "dashboard" && !error && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center">
              <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 border-b pb-2">
                Area Penugasan SPV
              </h3>
              {isLoadingData ? (
                <span className="text-gray-400 animate-pulse text-sm">
                  Memuat...
                </span>
              ) : (
                <h4 className="text-lg sm:text-2xl font-bold text-gray-800 mt-1 break-words">
                  {formatArea(dashboardData?.spv?.area)}
                </h4>
              )}
            </div>

            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 sm:p-6 rounded-xl shadow-sm border border-green-100 flex flex-col justify-center">
              <h3 className="text-xs sm:text-sm font-bold text-green-800 uppercase tracking-wider mb-2 border-b border-green-200 pb-2">
                Total Anggota Tim (Non-Fronting)
              </h3>
              {isLoadingData ? (
                <span className="text-green-400 animate-pulse text-sm">
                  Menghitung...
                </span>
              ) : (
                <h4 className="text-2xl sm:text-3xl font-black text-green-700 mt-1">
                  {dashboardData?.team?.length || 0} Orang
                </h4>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-900 p-4 sm:p-5 flex justify-between items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                👥 Daftar Pegawai Under Supervisor
              </h2>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap">
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      No
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Nama Pegawai
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      NIK
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Unit Kerja / Jabatan
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Area Penempatan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800 whitespace-nowrap">
                  {isLoadingData ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-8 text-center text-gray-500 animate-pulse text-sm"
                      >
                        Memuat data tim...
                      </td>
                    </tr>
                  ) : dashboardData?.team?.length > 0 ? (
                    dashboardData.team.map((pegawai: any, index: number) => (
                      <tr
                        key={pegawai.id || index}
                        className="hover:bg-green-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold text-gray-900">
                          {pegawai.nama}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-mono text-gray-700">
                          {pegawai.nik || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-700">
                          <span className="font-semibold text-green-700">
                            {pegawai.unit_kerja || "-"}
                          </span>{" "}
                          <br />
                          <span className="text-[11px] font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-600 mt-1 inline-block">
                            {pegawai.jabatan || "-"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-medium text-gray-800">
                          {pegawai.area_penempatan || "-"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                      >
                        Belum ada anggota tim non-fronting terdaftar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PEKERJAAN & TUGAS TIM */}
      {currentView === "pekerjaan-tim" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-900 p-4 sm:p-5 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  📋 Daftar Anggota & Pekerjaan Penugasan Tim
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  Memantau unit kerja, posisi jabatan, lokasi penempatan, dan
                  dokumen surat tugas pegawai under supervisi.
                </p>
              </div>

              <div className="w-full md:w-auto">
                <input
                  type="text"
                  value={searchPekerjaan}
                  onChange={(e) => setSearchPekerjaan(e.target.value)}
                  placeholder="Cari Nama, NIK, Unit Kerja, Jabatan..."
                  className="w-full md:w-72 px-3.5 py-2 rounded-lg text-base md:text-sm bg-gray-800 text-white placeholder-gray-400 outline-none border border-gray-700 focus:border-green-500"
                />
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider whitespace-nowrap">
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      No
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Pegawai & NIK
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Pekerjaan / Unit Kerja
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Jabatan
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                      Area & Alamat Penempatan
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                      Surat Tugas
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                      Status
                    </th>
                    <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800 whitespace-nowrap">
                  {isLoadingData ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-8 text-center text-gray-500 animate-pulse text-sm"
                      >
                        Memuat rincian pekerjaan tim...
                      </td>
                    </tr>
                  ) : filteredTeamWork.length > 0 ? (
                    filteredTeamWork.map((pegawai: any, index: number) => (
                      <tr
                        key={pegawai.id || index}
                        className="hover:bg-green-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm">
                          <span className="font-bold text-gray-900 block">
                            {pegawai.nama}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            NIK: {pegawai.nik || "-"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-semibold text-green-700">
                          {pegawai.unit_kerja || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-700">
                          <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md text-xs font-semibold">
                            {pegawai.jabatan || "PEGAWAI"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-700">
                          <div className="font-semibold text-gray-800">
                            {pegawai.area_penempatan || "-"}
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {pegawai.alamat_area_penempatan || "-"}
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-center">
                          {pegawai.surat_tugas ? (
                            <a
                              href={
                                pegawai.surat_tugas.startsWith("http")
                                  ? pegawai.surat_tugas
                                  : `/uploads/non-fronting/surat_tugas/${pegawai.surat_tugas}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-green-200"
                            >
                              📄 Unduh PDF
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Tidak ada
                            </span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              pegawai.status === "AKTIF"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {pegawai.status || "AKTIF"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedPegawaiWork(pegawai)}
                            className="bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                          >
                            🔍 Rincian
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                      >
                        <span className="text-3xl block mb-2">📋</span>
                        Tidak ada data pekerjaan pegawai yang sesuai dengan
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

      {/* 3. APPROVAL IZIN & CUTI TIM */}
      {currentView === "approval-izin" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden space-y-4 p-4 sm:p-6">
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 sm:gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                ✉️ Approval Perizinan & Cuti Tim
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Verifikasi pengajuan izin/cuti anggota tim dan tentukan status
                persetujuan.
              </p>
            </div>

            {/* Filter Status */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-xs font-bold text-gray-600 shrink-0">
                Filter Status:
              </span>
              <select
                value={filterStatusIzin}
                onChange={(e) => setFilterStatusIzin(e.target.value)}
                className="w-full sm:w-auto border border-gray-300 rounded-lg text-base md:text-xs font-bold text-gray-800 px-3 py-2 bg-gray-50 outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ALL">SEMUA STATUS</option>
                <option value="PENDING">PENDING (MENUNGGU)</option>
                <option value="DISETUJUI">DISETUJUI</option>
                <option value="DITOLAK">DITOLAK</option>
              </select>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs uppercase tracking-wider whitespace-nowrap">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Tgl. Pengajuan
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Nama Pegawai & NIK
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Jenis Izin
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Tgl. Pelaksanaan
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Alasan / Keterangan
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Lampiran
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Status SPV
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 whitespace-nowrap">
                {isLoadingIzin ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center text-gray-500 animate-pulse text-sm"
                    >
                      Memuat data pengajuan izin...
                    </td>
                  </tr>
                ) : filteredIzinList.length > 0 ? (
                  filteredIzinList.map((item: any) => {
                    const statusUpper = String(
                      item.status || "PENDING"
                    ).toUpperCase();
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-green-50/50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-gray-600">
                          {new Date(
                            item.created_at || item.tanggal_pengajuan
                          ).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-bold text-gray-900">
                          {item.nama} <br />
                          <span className="text-xs text-gray-500 font-mono font-normal">
                            NIK: {item.nik}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs font-semibold">
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100 uppercase">
                            {item.jenis_izin || item.tipe_izin || "IZIN"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-gray-700 font-medium">
                          {item.tanggal_mulai} s.d.{" "}
                          {item.tanggal_selesai || item.tanggal_mulai}
                        </td>
                        <td
                          className="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-gray-700 max-w-xs truncate"
                          title={item.alasan}
                        >
                          {item.alasan || item.keterangan || "-"}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          {item.file_bukti ? (
                            <a
                              href={
                                item.file_bukti.startsWith("http")
                                  ? item.file_bukti
                                  : `/uploads/izin/${item.file_bukti}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 font-bold hover:underline text-xs"
                            >
                              📎 File
                            </a>
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
                              statusUpper === "DISETUJUI"
                                ? "bg-green-100 text-green-700"
                                : statusUpper === "DITOLAK"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {statusUpper}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIzin(item);
                              setApprovalCatatan(item.catatan_spv || "");
                              setApprovalMsg({ type: "", text: "" });
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-sm transition-colors"
                          >
                            {statusUpper === "PENDING"
                              ? "⚡ Process"
                              : "🔍 Review"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                    >
                      <span className="text-3xl block mb-2">✉️</span>
                      Belum ada pengajuan izin/cuti dari anggota tim.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. LAPORAN & ADUAN TIM */}
      {currentView === "laporan" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-900 p-4 sm:p-5 flex justify-between items-center">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              📥 Pesan & Aduan Masuk dari Anggota Tim
            </h2>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap">
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Tgl. Laporan
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Pengirim (Pegawai)
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold">
                    Isi Laporan
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Lampiran
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3.5 sm:py-4 font-bold text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-800 whitespace-nowrap">
                {isLoadingLaporan ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-500 animate-pulse text-sm"
                    >
                      Memuat laporan...
                    </td>
                  </tr>
                ) : laporanList.length > 0 ? (
                  laporanList.map((item: any) => {
                    const { isAnswered } = parseDeskripsi(item.deskripsi);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-600">
                          {new Date(item.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm font-semibold text-gray-900">
                          {item.nama} <br />
                          <span className="text-xs text-gray-500 font-normal">
                            NIK: {item.nik}
                          </span>
                        </td>
                        <td
                          className="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-gray-700 max-w-xs truncate"
                          title={item.deskripsi}
                        >
                          {item.deskripsi}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          {item.file_name ? (
                            <span
                              className="text-xl"
                              title="Ada Lampiran Foto"
                            >
                              📎
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded uppercase tracking-wide ${
                              isAnswered
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {isAnswered ? "Selesai" : "Menunggu"}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-3.5 sm:py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenLaporan(item)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
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
                      colSpan={6}
                      className="px-6 py-10 text-center text-gray-500 text-sm whitespace-normal"
                    >
                      Belum ada laporan atau aduan dari anggota tim.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. FORM SURVEY KUNJUNGAN */}
      {currentView === "survey-kunjungan" && (
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8">
          <div className="flex items-start sm:items-center gap-3 mb-4 border-b border-gray-100 pb-4">
            <span className="text-2xl sm:text-3xl shrink-0">🗺️</span>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                Form Survey Kunjungan Lapangan
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Kirimkan hasil survey kunjungan beserta foto dokumentasi. Data
                akan diteruskan ke Admin MO dan HRD.
              </p>
            </div>
          </div>

          <div className="bg-green-50 border-l-4 border-green-500 p-3.5 sm:p-4 mb-5 sm:mb-6 rounded-r-lg shadow-sm">
            <div className="ml-1 sm:ml-2">
              <p className="text-xs sm:text-sm text-green-800 font-bold uppercase">
                Informasi Sistem
              </p>
              <p className="text-xs sm:text-sm text-green-700 mt-1 leading-relaxed">
                Data survey yang Anda kirim akan otomatis tercatat dan
                mengirimkan notifikasi instan kepada divisi{" "}
                <strong>Admin MO</strong> dan <strong>HRD</strong>.
              </p>
            </div>
          </div>

          {surveyMsg.text && (
            <div
              className={`p-3.5 sm:p-4 rounded-lg mb-5 sm:mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                surveyMsg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {surveyMsg.type === "success" ? "✅" : "⚠️"} {surveyMsg.text}
            </div>
          )}

          <form onSubmit={handleSubmitSurvey} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Upload Foto Dokumentasi Survey{" "}
                <span className="text-xs text-gray-400 font-normal">
                  (Opsional)
                </span>
              </label>
              <input
                type="file"
                id="foto-survey"
                accept="image/*"
                onChange={(e) =>
                  setSurveyFoto(e.target.files ? e.target.files[0] : null)
                }
                className="w-full border border-gray-300 rounded-lg p-1.5 text-xs sm:text-sm text-gray-700 file:mr-3 file:py-2 file:px-3.5 file:rounded-md file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Keterangan / Hasil Survey{" "}
                <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={6}
                value={surveyKeterangan}
                onChange={(e) => setSurveyKeterangan(e.target.value)}
                placeholder="Tuliskan laporan hasil survey kunjungan lapangan secara detail..."
                className="w-full border border-gray-300 rounded-lg p-3 text-base md:text-sm text-gray-900 placeholder:text-gray-400 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors resize-y"
              ></textarea>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSubmittingSurvey || !surveyKeterangan.trim()}
                className="w-full sm:w-auto justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmittingSurvey
                  ? "Mengirim Data..."
                  : "Kirim Survey ke MO & HRD ➤"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. TAMPILAN STATUS GAJI TIM */}
      {currentView === "status-gaji" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <span className="text-4xl sm:text-5xl block">🚧</span>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Status Gaji Tim
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
              Fitur dan halaman rekap status gaji anggota tim saat ini sedang
              dalam tahap pengembangan (<i>on development</i>). Mohon menunggu
              pembaruan selanjutnya.
            </p>
            <div className="pt-2">
              <span className="inline-block bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
                Status: Coming Soon / Under Development
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 7. PENGATURAN AKUN & GANTI PASSWORD */}
      {currentView === "pengaturan" && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 md:p-8 animate-fade-in">
          <div className="flex items-start sm:items-center gap-3 mb-5 sm:mb-6 border-b border-gray-100 pb-4">
            <span className="text-2xl sm:text-3xl shrink-0">🔑</span>
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">
                Ganti Password Akun Supervisor
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Pastikan Anda menggunakan password yang kuat dan aman.
              </p>
            </div>
          </div>

          {passwordMsg.text && (
            <div
              className={`p-3.5 sm:p-4 rounded-lg mb-5 sm:mb-6 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                passwordMsg.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {passwordMsg.type === "success" ? "✅" : "⚠️"} {passwordMsg.text}
            </div>
          )}

          <form
            onSubmit={handleChangePassword}
            className="space-y-4 sm:space-y-5"
          >
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
                  className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 placeholder:text-gray-400 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
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
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 placeholder:text-gray-400 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
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
                    className="w-full border border-gray-300 rounded-lg p-3 pr-12 text-base md:text-sm text-gray-900 placeholder:text-gray-400 font-medium outline-none focus:ring-2 focus:ring-green-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
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
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingPassword ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL APPROVAL IZIN TIM */}
      {selectedIzin && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="bg-gray-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                ✉️ Detail & Approval Pengajuan Izin
              </h3>
              <button
                type="button"
                onClick={() => setSelectedIzin(null)}
                className="text-gray-400 hover:text-white text-xl font-bold transition-colors px-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-sm">
              {approvalMsg.text && (
                <div
                  className={`p-3.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                    approvalMsg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {approvalMsg.type === "success" ? "✅" : "⚠️"}{" "}
                  {approvalMsg.text}
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-gray-900">
                    {selectedIzin.nama}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono">
                    NIK: {selectedIzin.nik}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    String(selectedIzin.status).toUpperCase() === "DISETUJUI"
                      ? "bg-green-600 text-white"
                      : String(selectedIzin.status).toUpperCase() === "DITOLAK"
                      ? "bg-red-600 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {selectedIzin.status || "PENDING"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase block">
                    Jenis Perizinan
                  </span>
                  <span className="font-bold text-green-700 text-sm sm:text-base">
                    {selectedIzin.jenis_izin || selectedIzin.tipe_izin || "IZIN"}
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase block">
                    Tanggal Pelaksanaan
                  </span>
                  <span className="font-bold text-gray-800 text-xs sm:text-sm">
                    {selectedIzin.tanggal_mulai} s.d{" "}
                    {selectedIzin.tanggal_selesai || selectedIzin.tanggal_mulai}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                  Alasan / Keterangan Pengajuan
                </span>
                <div className="bg-gray-50 p-3.5 sm:p-4 rounded-xl border border-gray-200 text-gray-800 text-sm leading-relaxed whitespace-pre-line break-words">
                  {selectedIzin.alasan || selectedIzin.keterangan || "-"}
                </div>
              </div>

              {selectedIzin.file_bukti && (
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                    Dokumen Lampiran Bukti
                  </span>
                  <a
                    href={
                      selectedIzin.file_bukti.startsWith("http")
                        ? selectedIzin.file_bukti
                        : `/uploads/izin/${selectedIzin.file_bukti}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold px-4 py-2 rounded-lg text-xs transition-colors border border-blue-200"
                  >
                    📎 Buka / Unduh Lampiran Bukti
                  </a>
                </div>
              )}

              <div className="border-t pt-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  Catatan Supervisor (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={approvalCatatan}
                  onChange={(e) => setApprovalCatatan(e.target.value)}
                  placeholder="Berikan alasan atau catatan approval untuk pegawai..."
                  className="w-full border border-gray-300 rounded-lg p-3 text-base md:text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 outline-none bg-gray-50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIzin(null)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-bold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                Tutup
              </button>

              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleProcessApproval("DITOLAK")}
                  disabled={isSubmittingApproval}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  ❌ Tolak Izin
                </button>
                <button
                  type="button"
                  onClick={() => handleProcessApproval("DISETUJUI")}
                  disabled={isSubmittingApproval}
                  className="w-full sm:w-auto px-5 py-2.5 sm:py-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 shadow-sm"
                >
                  ✅ Setujui Izin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FULL VIEW DETAIL NOTIFIKASI */}
      {selectedNotifikasi && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="bg-gray-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <h3 className="text-base sm:text-lg font-bold">
                Detail Pesan / Notifikasi
              </h3>
              <button
                type="button"
                onClick={() => setSelectedNotifikasi(null)}
                className="text-gray-400 hover:text-white text-xl font-bold transition-colors px-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500 border-b pb-3">
                <span>
                  Pengirim:{" "}
                  <b className="text-gray-800">
                    {selectedNotifikasi.pengirim_role || "Sistem"}
                  </b>
                </span>
                <span>
                  {new Date(selectedNotifikasi.created_at).toLocaleString(
                    "id-ID",
                    { dateStyle: "medium", timeStyle: "short" }
                  )}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Tipe Pesan
                </h4>
                <p className="text-xs sm:text-sm font-bold text-green-700 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 inline-block">
                  {selectedNotifikasi.tipe_pesan}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Isi Konten
                </h4>
                <div className="bg-gray-50 border border-gray-200 p-3.5 sm:p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed break-words">
                  {selectedNotifikasi.konten}
                </div>
              </div>

              {selectedNotifikasi.file_lampiran && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Lampiran File
                  </h4>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      📎 {selectedNotifikasi.file_lampiran}
                    </span>
                    <a
                      href={`/uploads/${selectedNotifikasi.file_lampiran}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto text-center bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap shrink-0"
                    >
                      Buka / Unduh
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedNotifikasi(null)}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 text-sm font-bold text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL RINCIAN PEKERJAAN ANGGOTA TIM */}
      {selectedPegawaiWork && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="bg-gray-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                👤 Detail Pekerjaan & Penugasan Pegawai
              </h3>
              <button
                type="button"
                onClick={() => setSelectedPegawaiWork(null)}
                className="text-gray-400 hover:text-white text-xl font-bold transition-colors px-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-sm">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-gray-900">
                    {selectedPegawaiWork.nama}
                  </h4>
                  <p className="text-xs text-gray-500 font-mono">
                    NIK: {selectedPegawaiWork.nik || "-"}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    selectedPegawaiWork.status === "AKTIF"
                      ? "bg-green-600 text-white"
                      : "bg-red-600 text-white"
                  }`}
                >
                  {selectedPegawaiWork.status || "AKTIF"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase block">
                    Unit Kerja
                  </span>
                  <span className="font-bold text-green-700 text-sm sm:text-base">
                    {selectedPegawaiWork.unit_kerja || "-"}
                  </span>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="text-xs font-bold text-gray-400 uppercase block">
                    Jabatan
                  </span>
                  <span className="font-bold text-gray-800 text-sm sm:text-base">
                    {selectedPegawaiWork.jabatan || "PEGAWAI"}
                  </span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase block">
                    Area Penempatan
                  </span>
                  <p className="font-semibold text-gray-800">
                    {selectedPegawaiWork.area_penempatan || "-"}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase block">
                    Alamat Detail Lokasi Penempatan
                  </span>
                  <p className="font-medium text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-200 break-words">
                    {selectedPegawaiWork.alamat_area_penempatan || "-"}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase block">
                      Masa Kerja
                    </span>
                    <p className="font-medium text-gray-800">
                      {selectedPegawaiWork.masa_kerja || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase block">
                      Masa Kontrak
                    </span>
                    <p className="font-medium text-gray-800">
                      {selectedPegawaiWork.masa_kontrak || "-"}
                    </p>
                  </div>
                </div>

                {selectedPegawaiWork.surat_tugas && (
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase block mb-1">
                      Dokumen Surat Tugas Penugasan
                    </span>
                    <a
                      href={
                        selectedPegawaiWork.surat_tugas.startsWith("http")
                          ? selectedPegawaiWork.surat_tugas
                          : `/uploads/non-fronting/surat_tugas/${selectedPegawaiWork.surat_tugas}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow-sm"
                    >
                      📄 Lihat File PDF Surat Tugas
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPegawaiWork(null)}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 text-sm font-bold text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Absensi Realtime */}
      {showAbsenModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92dvh] animate-fade-in">
            <div
              className={`p-4 text-white font-bold flex justify-between items-center shrink-0 ${
                absenType === "Masuk" ? "bg-indigo-600" : "bg-emerald-600"
              }`}
            >
              <h3 className="text-base sm:text-lg">
                📸 Absen {absenType} Supervisor
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-white hover:text-gray-200 text-xl px-1"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={submitAbsenRealtime}
              className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1"
            >
              {/* Lokasi GPS */}
              <div className="bg-gray-50 p-3.5 sm:p-4 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 font-bold mb-2 uppercase">
                  📍 Lokasi Saat Ini
                </p>
                {isLocating ? (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <span className="animate-spin text-xl">⏳</span> Sedang
                    mendeteksi GPS...
                  </div>
                ) : (
                  <div className="text-xs sm:text-sm font-medium text-gray-800 break-words">
                    <p>{absenLocation.address || "Alamat tidak ditemukan"}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Lat: {absenLocation.lat} | Lng: {absenLocation.lng}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={getGeoLocation}
                  className="mt-3 text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-gray-100"
                >
                  🔄 Refresh Lokasi
                </button>
              </div>

              {/* Live Camera */}
              <div>
                <p className="text-xs text-gray-500 font-bold mb-2 uppercase">
                  📸 Foto Selfie Absen
                </p>

                {absenPhotoPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-gray-300">
                    <img
                      src={absenPhotoPreview}
                      alt="Preview Absen"
                      className="w-full h-52 sm:h-48 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAbsenPhoto(null);
                        setAbsenPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-md font-bold shadow"
                    >
                      🗑️ Ulangi
                    </button>
                  </div>
                ) : isCameraOpen ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-indigo-300 bg-black flex flex-col items-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-56 sm:h-48 object-cover transform scale-x-[-1]"
                    />
                    <div className="absolute bottom-2 flex gap-2 w-full px-3 justify-center">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex-1"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg flex-1"
                      >
                        📸 Ambil Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="flex flex-col items-center justify-center w-full h-44 sm:h-48 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-indigo-50 transition"
                  >
                    <span className="text-4xl mb-2">🤳</span>
                    <span className="text-sm font-semibold text-gray-600">
                      Buka Kamera Selfie
                    </span>
                  </button>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <button
                type="submit"
                disabled={isLocating || !absenPhoto || isSubmittingAbsen}
                className={`w-full text-white font-bold py-3 px-4 rounded-xl text-sm transition-all disabled:opacity-50 ${
                  absenType === "Masuk"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {isSubmittingAbsen
                  ? "Memproses..."
                  : `Kirim Absen ${absenType} Sekarang ➤`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BACA & BALAS LAPORAN */}
      {selectedLaporan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90dvh]">
            <div className="bg-gray-900 text-white p-4 sm:p-5 flex justify-between items-center shrink-0">
              <h3 className="text-base sm:text-lg font-bold">
                Detail Laporan Anggota Tim
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLaporan(null)}
                className="text-gray-400 hover:text-white text-xl font-bold transition-colors px-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Judul / Identitas
                </h4>
                <p className="text-sm sm:text-base font-bold text-gray-800 break-words">
                  {selectedLaporan.judul}
                </p>
              </div>

              <div className="mb-5 sm:mb-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Isi Pesan / Pertanyaan
                </h4>
                <div className="bg-green-50 border border-green-100 p-3.5 sm:p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed break-words">
                  {parseDeskripsi(selectedLaporan.deskripsi).pertanyaan}
                </div>
              </div>

              {selectedLaporan?.file_name && (
                <div className="mb-5 sm:mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Lampiran Foto Laporan
                  </h4>
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="text-xs sm:text-sm font-medium text-gray-700 truncate">
                      📎 {selectedLaporan?.file_name}
                    </span>
                    <a
                      href={`/uploads/non-fronting/${selectedLaporan?.file_name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto text-center bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap shrink-0"
                    >
                      Buka Foto Penuh
                    </a>
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-5 sm:pt-6">
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  💬 Berikan Balasan / Tanggapan
                </h4>

                {replyMsg.text && (
                  <div
                    className={`p-3 rounded-lg mb-4 text-xs font-bold ${
                      replyMsg.type === "success"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {replyMsg.text}
                  </div>
                )}

                <form onSubmit={handleSubmitReply}>
                  <textarea
                    required
                    rows={4}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Ketik jawaban atau tanggapan Anda di sini..."
                    className="w-full border border-gray-300 rounded-xl p-3.5 sm:p-4 text-gray-900 placeholder:text-gray-400 text-base md:text-sm focus:ring-2 focus:ring-green-500 outline-none bg-gray-50 focus:bg-white transition-colors resize-y mb-4"
                  ></textarea>

                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedLaporan(null)}
                      className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingReply || !replyText.trim()}
                      className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
    </RoleSidebarLayout>
  );
}

export default function SupervisorDashboard() {
  return <SupervisorDashboardContent />;
}