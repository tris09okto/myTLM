-- Matches db_mytlm _new.sql. Run against the existing database; preserves existing requests.
CREATE TABLE IF NOT EXISTS pengajuan_izin (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
 nik VARCHAR(50) COLLATE utf8mb4_general_ci NOT NULL,
 jenis_izin VARCHAR(100) COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'IZIN',
 tanggal_mulai DATE NOT NULL,
 tanggal_selesai DATE NOT NULL,
 alasan TEXT COLLATE utf8mb4_general_ci NULL,
 file_bukti VARCHAR(255) COLLATE utf8mb4_general_ci NULL,
 status ENUM('PENDING','DISETUJUI','DITOLAK') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'PENDING',
 catatan_spv TEXT COLLATE utf8mb4_general_ci NULL,
 approved_by VARCHAR(100) COLLATE utf8mb4_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_nik (nik), KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
