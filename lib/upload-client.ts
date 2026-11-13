// lib/uploads-client.ts

export const uploadFolders = [
  "admin",
  "balasan_pegawai",
  "direktur",
  "leader/idcard",
  "laporan-direktur",
  "non-fronting",
  "pas_foto",
  "qna",
  "slips",
  "spv-survey-kunjungan",
  "super-admin/pengumuman",
  "super-admin/produk",
  "surat_tugas",
  "",
] as const;

export type UploadFolder = (typeof uploadFolders)[number];

export const getFileUrl = (
  fileRef: string | null | undefined,
  folder: string = "",
  fallbackUrl: string = "/placeholder-image.png"
): string => {
  // Jika data null, undefined, atau string kosong
  if (!fileRef || String(fileRef).trim() === "") {
    return fallbackUrl;
  }

  const cleanRef = String(fileRef).trim();

  // 1. Jika sudah berupa URL publik lengkap (Cloudinary / HTTPS / HTTP)
  if (
    cleanRef.startsWith("http://") ||
    cleanRef.startsWith("https://") ||
    cleanRef.includes("cloudinary.com")
  ) {
    return cleanRef;
  }

  // 2. Jika sudah menyertakan path /uploads/
  if (cleanRef.startsWith("/uploads/")) {
    return cleanRef;
  }

  // 3. Jika hanya berupa nama file lokal (misal: FOTO_1788514110248_nik.jpg)
  return folder ? `/uploads/${folder}/${cleanRef}` : `/uploads/${cleanRef}`;
};