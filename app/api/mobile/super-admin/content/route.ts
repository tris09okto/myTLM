import { randomUUID } from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";
import type { PoolConnection } from "mysql2/promise";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { cleanupStoredUploads, storeFileUpload, type StoredUpload } from "@/lib/uploads";

export const runtime = "nodejs";

type ContentKind = "announcement" | "product";

function isContentKind(value: FormDataEntryValue | null): value is ContentKind {
  return value === "announcement" || value === "product";
}

async function storeAttachment(file: File | null, kind: ContentKind): Promise<StoredUpload | null> {
  if (!file || file.size === 0) return null;
  if (file.size > 10_000_000) throw new Error("Attachment too large");
  const extension = path.extname(file.name).replace(/[^.a-zA-Z0-9]/g, "").slice(0, 12) || ".bin";
  const name = `${randomUUID()}${extension}`;
  return storeFileUpload({
    file,
    folder: kind === "announcement" ? "super-admin/pengumuman" : "super-admin/produk",
    localFileName: name,
  });
}

function validText(value: FormDataEntryValue | null, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

async function authorize(request: Request) {
  const principal = await getMobilePrincipal(request);
  return principal?.role === "super_admin";
}

async function save(request: Request, editing: boolean) {
  if (!(await authorize(request))) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  const form = await request.formData();
  const kind = form.get("kind");
  const id = Number(form.get("id"));
  const title = form.get("title");
  const body = form.get("body");
  const status = form.get("status");
  const category = form.get("category");
  const target = form.get("target");
  const expiration = form.get("expiration");
  const attachment = form.get("attachment");
  if (!isContentKind(kind) || !validText(title, 255) ||
      typeof body !== "string" || body.length > 10000 ||
      typeof category !== "string" || (status !== "AKTIF" && status !== "TIDAK AKTIF") ||
      (editing && (!Number.isSafeInteger(id) || id <= 0)) ||
      (attachment !== null && !(attachment instanceof File)) ||
      (attachment instanceof File && attachment.size > 10_000_000)) {
    return NextResponse.json({ message: "Konten tidak valid" }, { status: 400 });
  }
  if (kind === "announcement" &&
      (!body.trim() || !["PRODUK_INFORMASI", "UMUM", "PRIBADI"].includes(category) ||
       (target !== "ALL" && target !== "ALL_FRONTING" && target !== "ALL_NON_FRONTING"))) {
    return NextResponse.json({ message: "Target tidak valid" }, { status: 400 });
  }
  if (kind === "product" &&
      (category !== "PRODUK" && category !== "PROMO" ||
       typeof expiration !== "string" ||
       (expiration !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(expiration)))) {
    return NextResponse.json({ message: "Tanggal berlaku tidak valid" }, { status: 400 });
  }

  let upload: StoredUpload | null = null;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  let committed = false;
  try {
    upload = await storeAttachment(attachment instanceof File ? attachment : null, kind);
    const fileName = upload?.reference ?? null;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    if (kind === "announcement") {
      if (editing) {
        if (fileName) {
          await connection.query(
            `UPDATE pengumuman SET judul = ?, isi = ?, status = ?, jenis_pengumuman = ?, target_penerima = ?, file_lampiran = ? WHERE id = ?`,
            [title.trim(), body.trim(), status, category.trim(), target, fileName, id],
          );
        } else {
          await connection.query(
            `UPDATE pengumuman SET judul = ?, isi = ?, status = ?, jenis_pengumuman = ?, target_penerima = ? WHERE id = ?`,
            [title.trim(), body.trim(), status, category.trim(), target, id],
          );
        }
      } else {
        await connection.query(
          `INSERT INTO pengumuman (judul, isi, file_lampiran, status, jenis_pengumuman, target_penerima)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [title.trim(), body.trim(), fileName, status, category.trim(), target],
        );
        if (status === "AKTIF") {
          const normalized = category.trim().toUpperCase();
          const messageType = normalized.includes("UMUM") ? "Pengumuman Umum"
            : normalized.includes("PRODUK") ? "Pengumuman Produk / Informasi" : "Pengumuman Pribadi";
          await connection.query(
            `INSERT INTO pesan_notifikasi (pengirim_role, penerima_nik, tipe_pesan, konten, file_lampiran, is_read)
             VALUES ('super admin', ?, ?, ?, ?, 0)`,
            [target, messageType, `[${title.trim()}]\n\n${body.trim()}`, fileName],
          );
        }
      }
    } else {
      const expiry = typeof expiration === "string" ? expiration.trim() || null : null;
      if (editing) {
        if (fileName) {
          await connection.query(
            `UPDATE produk_promo SET tipe = ?, judul = ?, deskripsi = ?, berlaku_sampai = ?, status = ?, gambar_file = ? WHERE id = ?`,
            [category.trim(), title.trim(), body.trim(), expiry, status, fileName, id],
          );
        } else {
          await connection.query(
            `UPDATE produk_promo SET tipe = ?, judul = ?, deskripsi = ?, berlaku_sampai = ?, status = ? WHERE id = ?`,
            [category.trim(), title.trim(), body.trim(), expiry, status, id],
          );
        }
      } else {
        await connection.query(
          `INSERT INTO produk_promo (tipe, judul, deskripsi, gambar_file, berlaku_sampai, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [category.trim(), title.trim(), body.trim(), fileName, expiry, status],
        );
      }
    }
    await connection.commit();
    committed = true;
    return NextResponse.json({ success: true, message: editing ? "Konten berhasil diperbarui." : "Konten berhasil dibuat." });
  } catch (error) {
    let rolledBack = !transactionStarted;
    if (connection && transactionStarted && !committed) {
      try {
        await connection.rollback();
        rolledBack = true;
      } catch (rollbackError) {
        console.error("Unable to roll back content transaction", rollbackError);
      }
    }
    if (!committed && rolledBack && upload) await cleanupStoredUploads([upload]);
    console.error("Unable to save mobile content", error);
    return NextResponse.json({ message: "Konten gagal disimpan" }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function POST(request: Request) { return save(request, false); }
export async function PUT(request: Request) { return save(request, true); }

export async function DELETE(request: Request) {
  if (!(await authorize(request))) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("kind" in body) || !("id" in body) ||
      (body.kind !== "announcement" && body.kind !== "product") ||
      typeof body.id !== "number" || !Number.isSafeInteger(body.id) || body.id <= 0) {
    return NextResponse.json({ message: "Konten tidak valid" }, { status: 400 });
  }
  try {
    const table = body.kind === "announcement" ? "pengumuman" : "produk_promo";
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [body.id]);
    return NextResponse.json({ success: true, message: "Konten berhasil dihapus." });
  } catch {
    return NextResponse.json({ message: "Konten gagal dihapus" }, { status: 500 });
  }
}
