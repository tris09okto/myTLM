import { access } from "node:fs/promises";
import path from "node:path";

const folders = [
  "admin",
  "balasan_pegawai",
  "direktur",
  "laporan-direktur",
  "leader/idcard",
  "non-fronting",
  "pas_foto",
  "qna",
  "slips",
  "spv-survey-kunjungan",
  "super-admin/pengumuman",
  "super-admin/produk",
  "surat_tugas",
  "",
];

function publicUploadPath(relativePath: string): string {
  return `/uploads/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}

function isRemoteReference(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export async function resolveAttachmentPath(fileName: string | null): Promise<string | null> {
  if (!fileName || path.basename(fileName) !== fileName || fileName === "." || fileName === "..") return null;
  for (const folder of folders) {
    const absolute = path.join(process.cwd(), "public", "uploads", folder, fileName);
    try {
      await access(absolute);
      return folder ? `${folder}/${fileName}` : fileName;
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveUploadUrl(
  fileReference: unknown,
  preferredFolder?: string,
): Promise<string | null> {
  if (typeof fileReference !== "string") return null;
  const reference = fileReference.trim();
  if (!reference) return null;
  if (isRemoteReference(reference)) return reference;
  if (reference.startsWith("/uploads/")) return reference;

  const normalized = reference.startsWith("uploads/") ? reference.slice("uploads/".length) : reference;
  const parts = normalized.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return null;

  if (parts.length > 1) {
    return publicUploadPath(parts.join("/"));
  }

  const candidates = preferredFolder === undefined
    ? folders
    : [preferredFolder, ...folders.filter((folder) => folder !== preferredFolder)];
  for (const folder of candidates) {
    const relativePath = folder ? `${folder}/${reference}` : reference;
    const absolutePath = path.join(process.cwd(), "public", "uploads", relativePath);
    try {
      await access(absolutePath);
      return publicUploadPath(relativePath);
    } catch {
      continue;
    }
  }

  const fallbackFolder = preferredFolder ?? "";
  return publicUploadPath(fallbackFolder ? `${fallbackFolder}/${reference}` : reference);
}
