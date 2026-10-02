import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";

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
export type UploadResourceType = "image" | "raw";

export interface StoredUpload {
  reference: string;
  cleanup(): Promise<void>;
}

interface StoreUploadOptions {
  bytes: Uint8Array;
  contentType: string;
  folder: UploadFolder;
  localFileName: string;
  resourceType?: UploadResourceType;
}

function safeExtension(fileName: string): string {
  return path
    .extname(fileName)
    .replace(/[^.a-zA-Z0-9]/g, "")
    .slice(0, 12);
}

function cloudinaryUpload(options: {
  bytes: Uint8Array;
  folder: UploadFolder;
  extension: string;
  resourceType: UploadResourceType;
}): Promise<{ secureUrl: string; publicId: string }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials are required in production");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  const id = randomUUID();
  const publicId = `${id}${options.extension}`;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder ? `uploads/${options.folder}` : "uploads",
        public_id: publicId,
        resource_type: options.resourceType,
      },
      (error, result) => {
        if (error) reject(error);
        else if (!result)
          reject(new Error("Cloudinary returned no upload result"));
        else
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
          });
      },
    );
    stream.end(Buffer.from(options.bytes));
  });
}

export async function storeUpload(
  options: StoreUploadOptions,
): Promise<StoredUpload> {
  const localFileName = path.basename(options.localFileName);
  if (!localFileName || localFileName === "." || localFileName === "..") {
    throw new Error("Invalid local upload filename");
  }

  const extension = safeExtension(localFileName);
  const resourceType = options.resourceType ??
  (options.contentType.startsWith("image/") || options.contentType === "application/pdf" ? "image" : "raw");

  const hasCloudinaryCredentials = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
  if (process.env.NODE_ENV === "production" || hasCloudinaryCredentials) {
    const result = await cloudinaryUpload({
      bytes: options.bytes,
      folder: options.folder,
      extension,
      resourceType,
    });
    return {
      reference: result.secureUrl,
      async cleanup() {
        await cloudinary.uploader.destroy(result.publicId, {
          resource_type: resourceType,
        });
      },
    };
  }

  const absolutePath = path.join(
    process.cwd(),
    "public",
    "uploads",
    options.folder,
    localFileName,
  );
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(options.bytes));
  return {
    reference: localFileName,
    async cleanup() {
      await rm(absolutePath, { force: true });
    },
  };
}

export async function storeFileUpload(options: {
  file: File;
  folder: UploadFolder;
  localFileName: string;
  resourceType?: UploadResourceType;
}): Promise<StoredUpload> {
  return storeUpload({
    bytes: new Uint8Array(await options.file.arrayBuffer()),
    contentType: options.file.type,
    folder: options.folder,
    localFileName: options.localFileName,
    resourceType: options.resourceType,
  });
}

export async function storeImageDataUrl(options: {
  dataUrl: string;
  folder: UploadFolder;
  localFileName: string;
}): Promise<StoredUpload> {
  const match =
    /^data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      options.dataUrl,
    );
  if (!match) throw new Error("Invalid image data URL");

  const contentType = match[1];
  const base64 = match[2];
  const bytes = Buffer.from(base64, "base64");
  if (
    !bytes.length ||
    bytes.toString("base64").replace(/=+$/, "") !== base64.replace(/=+$/, "")
  ) {
    throw new Error("Invalid image data URL");
  }

  const subtype = contentType.split("/")[1].split("+")[0];
  const extension =
    subtype === "jpeg" ? "jpg" : subtype.replace(/[^a-zA-Z0-9]/g, "") || "img";
  const localFileName = options.localFileName.includes(".")
    ? options.localFileName
    : `${options.localFileName}.${extension}`;

  return storeUpload({
    bytes,
    contentType,
    folder: options.folder,
    localFileName,
    resourceType: "image",
  });
}

export async function cleanupStoredUploads(
  uploads: readonly StoredUpload[],
): Promise<void> {
  await Promise.all(
    uploads.map(async (upload) => {
      try {
        await upload.cleanup();
      } catch (error) {
        console.error("Unable to clean up a new upload", error);
      }
    }),
  );
}
