-- Run after confirming existing transaksi_gaji rows have been mapped to their source table.
-- On 2026-09-24 the local development table was empty, so no backfill was needed.
ALTER TABLE transaksi_gaji
  ADD COLUMN employee_kind ENUM('fronting', 'non_fronting', 'leader') NOT NULL AFTER id_pegawai,
  ADD UNIQUE KEY uq_transaksi_gaji_employee_period (employee_kind, id_pegawai, periode);
