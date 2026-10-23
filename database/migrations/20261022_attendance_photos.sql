-- Required by the web and mobile selfie attendance flow.
-- Nullable columns preserve existing attendance records.
ALTER TABLE absensi
  ADD COLUMN foto_masuk TEXT NULL,
  ADD COLUMN foto_keluar TEXT NULL;
