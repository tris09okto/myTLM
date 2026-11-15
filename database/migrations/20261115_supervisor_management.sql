-- Definitions from db_mytlm _new.sql, supplied 2026-11-15.
-- Schema only; existing records and accounts are preserved. Safe to rerun.
CREATE TABLE IF NOT EXISTS `mitra` (
  `id` int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `kode_mitra` varchar(50) NOT NULL,
  `nama_mitra` varchar(255) NOT NULL,
  `username` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `no_telp` varchar(50) NOT NULL,
  `alamat_mitra` text NOT NULL,
  `status` enum('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  UNIQUE KEY `kode_mitra` (`kode_mitra`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET @supervisor_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'data_non_fronting' AND column_name = 'id_mitra'),
  'SELECT 1',
  'ALTER TABLE data_non_fronting ADD COLUMN `id_mitra` INT DEFAULT NULL'
);
PREPARE supervisor_schema_stmt FROM @supervisor_schema_sql;
EXECUTE supervisor_schema_stmt;
DEALLOCATE PREPARE supervisor_schema_stmt;

SET @supervisor_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'data_non_fronting' AND column_name = 'tag_lokasi'),
  'SELECT 1',
  'ALTER TABLE data_non_fronting ADD COLUMN `tag_lokasi` TEXT DEFAULT NULL'
);
PREPARE supervisor_schema_stmt FROM @supervisor_schema_sql;
EXECUTE supervisor_schema_stmt;
DEALLOCATE PREPARE supervisor_schema_stmt;

SET @supervisor_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'data_non_fronting' AND column_name = 'last_login_at'),
  'SELECT 1',
  'ALTER TABLE data_non_fronting ADD COLUMN `last_login_at` DATETIME DEFAULT NULL'
);
PREPARE supervisor_schema_stmt FROM @supervisor_schema_sql;
EXECUTE supervisor_schema_stmt;
DEALLOCATE PREPARE supervisor_schema_stmt;

SET @supervisor_schema_sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'data_non_fronting' AND column_name = 'status'),
  'SELECT 1',
  'ALTER TABLE data_non_fronting ADD COLUMN `status` ENUM(''AKTIF'',''NON-AKTIF'') NOT NULL DEFAULT ''AKTIF'''
);
PREPARE supervisor_schema_stmt FROM @supervisor_schema_sql;
EXECUTE supervisor_schema_stmt;
DEALLOCATE PREPARE supervisor_schema_stmt;

