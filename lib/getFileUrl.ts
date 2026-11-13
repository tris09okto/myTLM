// lib/getFileUrl.ts

export function getFileUrl(
  fileRef: string | null | undefined,
  folder: string = ""
): string {
  if (!fileRef || String(fileRef).trim() === "") return "";

  const cleanRef = String(fileRef).trim();

  // 1. Jika sudah berupa URL penuh (Cloudinary / HTTP external), kembalikan langsung
  if (cleanRef.startsWith("http://") || cleanRef.startsWith("https://")) {
    return cleanRef;
  }

  // 2. Jika berupa nama file lokal legacy
  const subFolder = folder ? `${folder}/` : "";
  return `/uploads/${subFolder}${cleanRef}`;
}