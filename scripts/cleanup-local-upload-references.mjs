import { loadEnvConfig } from "@next/env";
import mysql from "mysql2/promise";

loadEnvConfig(process.cwd());

if (process.env.NODE_ENV !== "production") {
  throw new Error("This cleanup can run only with NODE_ENV=production");
}

const applyChanges = process.argv.includes("--apply");
const scalarFields = [
  { table: "data_leader", column: "idcard_file" },
  { table: "data_non_fronting", column: "pas_foto" },
  { table: "data_non_fronting", column: "surat_tugas" },
  { table: "master_pegawai", column: "idcard_file" },
  { table: "laporan_aduan", column: "foto" },
  { table: "pesan_notifikasi", column: "file_lampiran" },
  { table: "pengumuman", column: "file_lampiran" },
  { table: "produk_promo", column: "gambar_file" },
  { table: "qna_materi", column: "file_name" },
  { table: "survey_kunjungan", column: "foto" },
  { table: "transaksi_gaji", column: "slip_name" },
];
const csvField = { table: "master_pegawai", column: "st_file", idColumn: "id" };
const businessTables = [
  "data_leader",
  "data_non_fronting",
  "laporan_aduan",
  "master_pegawai",
  "pesan_notifikasi",
  "pengumuman",
  "produk_promo",
  "qna_materi",
  "survey_kunjungan",
  "transaksi_gaji",
];

function quoteIdentifier(value) {
  return `\`${value.replaceAll("`", "``")}\``;
}

function isRemoteReference(value) {
  return /^https?:\/\//i.test(value);
}

function isLocalReference(value) {
  return value.toUpperCase() !== "NULL" && !isRemoteReference(value);
}

function localEntries(value) {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean).filter(isLocalReference);
}

async function getColumnNullability(connection, table, column) {
  const [rows] = await connection.execute(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  if (rows.length !== 1) throw new Error(`Expected ${table}.${column} in the current database`);
  return rows[0].is_nullable === "YES";
}

async function getBusinessCounts(connection) {
  const counts = {};
  for (const table of businessTables) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)}`);
    counts[table] = Number(rows[0].row_count);
  }
  return counts;
}

async function countLocalScalarReferences(connection, { table, column }) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS row_count FROM ${quoteIdentifier(table)}
     WHERE ${quoteIdentifier(column)} IS NOT NULL
       AND TRIM(${quoteIdentifier(column)}) <> ''
       AND UPPER(TRIM(${quoteIdentifier(column)})) <> 'NULL'
       AND TRIM(${quoteIdentifier(column)}) NOT REGEXP '^https?://'`,
  );
  return Number(rows[0].row_count);
}

async function countLocalCsvReferences(connection) {
  const [rows] = await connection.query(
    `SELECT ${quoteIdentifier(csvField.column)} AS file_references
     FROM ${quoteIdentifier(csvField.table)}
     WHERE ${quoteIdentifier(csvField.column)} IS NOT NULL
       AND TRIM(${quoteIdentifier(csvField.column)}) <> ''`,
  );
  let records = 0;
  let entries = 0;
  for (const row of rows) {
    const local = localEntries(row.file_references);
    if (local.length) records += 1;
    entries += local.length;
  }
  return { records, entries };
}

async function cleanScalarField(connection, field, nullable) {
  const localCount = await countLocalScalarReferences(connection, field);
  if (!localCount) return { records: 0, entries: 0 };

  const replacement = nullable ? null : "";
  const [result] = await connection.execute(
    `UPDATE ${quoteIdentifier(field.table)}
     SET ${quoteIdentifier(field.column)} = ?
     WHERE ${quoteIdentifier(field.column)} IS NOT NULL
       AND TRIM(${quoteIdentifier(field.column)}) <> ''
       AND UPPER(TRIM(${quoteIdentifier(field.column)})) <> 'NULL'
       AND TRIM(${quoteIdentifier(field.column)}) NOT REGEXP '^https?://'`,
    [replacement],
  );
  return { records: result.affectedRows, entries: result.affectedRows };
}

async function cleanCsvField(connection, nullable) {
  const [rows] = await connection.query(
    `SELECT ${quoteIdentifier(csvField.idColumn)} AS record_id
     FROM ${quoteIdentifier(csvField.table)}
     WHERE ${quoteIdentifier(csvField.column)} IS NOT NULL
       AND TRIM(${quoteIdentifier(csvField.column)}) <> ''`,
  );
  let changedRecords = 0;
  let removedEntries = 0;

  for (const row of rows) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [currentRows] = await connection.execute(
        `SELECT ${quoteIdentifier(csvField.column)} AS file_references
         FROM ${quoteIdentifier(csvField.table)} WHERE ${quoteIdentifier(csvField.idColumn)} = ? LIMIT 1`,
        [row.record_id],
      );
      const current = currentRows[0]?.file_references;
      if (typeof current !== "string") break;

      const entries = current.split(",").map((entry) => entry.trim()).filter(Boolean);
      const keptEntries = entries.filter((entry) => !isLocalReference(entry));
      const removed = entries.length - keptEntries.length;
      if (!removed) break;

      const replacement = keptEntries.length ? keptEntries.join(",") : nullable ? null : "";
      const [result] = await connection.execute(
        `UPDATE ${quoteIdentifier(csvField.table)}
         SET ${quoteIdentifier(csvField.column)} = ?
         WHERE ${quoteIdentifier(csvField.idColumn)} = ?
           AND BINARY ${quoteIdentifier(csvField.column)} = BINARY ?`,
        [replacement, row.record_id, current],
      );
      if (result.affectedRows === 1) {
        changedRecords += 1;
        removedEntries += removed;
        break;
      }
    }
  }

  return { records: changedRecords, entries: removedEntries };
}

const requiredEnv = ["DB_USER", "DB_NAME"];
for (const name of requiredEnv) {
  if (!process.env[name]) throw new Error(`${name} is required`);
}

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

try {
  const businessCountsBefore = await getBusinessCounts(connection);
  const nullability = new Map();
  for (const field of [...scalarFields, csvField]) {
    nullability.set(`${field.table}.${field.column}`, await getColumnNullability(connection, field.table, field.column));
  }

  const preview = {};
  for (const field of scalarFields) {
    const records = await countLocalScalarReferences(connection, field);
    preview[`${field.table}.${field.column}`] = { records, entries: records };
  }
  preview[`${csvField.table}.${csvField.column}`] = await countLocalCsvReferences(connection);

  const applied = {};
  if (applyChanges) {
    for (const field of scalarFields) {
      applied[`${field.table}.${field.column}`] = await cleanScalarField(
        connection,
        field,
        nullability.get(`${field.table}.${field.column}`),
      );
    }
    applied[`${csvField.table}.${csvField.column}`] = await cleanCsvField(
      connection,
      nullability.get(`${csvField.table}.${csvField.column}`),
    );
  }

  const businessCountsAfter = await getBusinessCounts(connection);
  process.stdout.write(`${JSON.stringify({
    mode: applyChanges ? "applied" : "dry-run",
    affectedCounts: applyChanges ? applied : preview,
    businessRowCounts: { before: businessCountsBefore, after: businessCountsAfter },
    rerunSafe: true,
  }, null, 2)}\n`);
} finally {
  await connection.end();
}
