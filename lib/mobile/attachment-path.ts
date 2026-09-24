import { access } from "node:fs/promises";
import path from "node:path";

const folders = ["admin", "direktur", "laporan-direktur", "non-fronting", "qna", "slips", "spv-survey-kunjungan", ""];

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
