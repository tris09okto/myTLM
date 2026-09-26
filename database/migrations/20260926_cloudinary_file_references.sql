DELIMITER $$

DROP PROCEDURE IF EXISTS widen_cloudinary_file_references$$
CREATE PROCEDURE widen_cloudinary_file_references()
BEGIN
  DECLARE finished BOOLEAN DEFAULT FALSE;
  DECLARE target_table VARCHAR(64);
  DECLARE target_column VARCHAR(64);
  DECLARE nullable_value VARCHAR(3);
  DECLARE data_type_value VARCHAR(32);
  DECLARE character_set_value VARCHAR(64);
  DECLARE collation_value VARCHAR(64);
  DECLARE default_value TEXT;
  DECLARE comment_value TEXT;
  DECLARE extra_value VARCHAR(255);
  DECLARE statement_text TEXT;
  DECLARE server_version VARCHAR(128);
  DECLARE server_major INT;
  DECLARE server_minor INT;
  DECLARE server_patch INT;
  DECLARE supports_text_defaults BOOLEAN DEFAULT FALSE;

  DECLARE file_columns CURSOR FOR
    SELECT expected.table_name, expected.column_name, columns_info.is_nullable,
           columns_info.data_type, columns_info.character_set_name,
           columns_info.collation_name, columns_info.column_default,
           columns_info.column_comment, columns_info.extra
    FROM (
      SELECT 'data_leader' AS table_name, 'idcard_file' AS column_name UNION ALL
      SELECT 'data_non_fronting', 'pas_foto' UNION ALL
      SELECT 'data_non_fronting', 'surat_tugas' UNION ALL
      SELECT 'master_pegawai', 'idcard_file' UNION ALL
      SELECT 'master_pegawai', 'st_file' UNION ALL
      SELECT 'laporan_aduan', 'foto' UNION ALL
      SELECT 'pesan_notifikasi', 'file_lampiran' UNION ALL
      SELECT 'pengumuman', 'file_lampiran' UNION ALL
      SELECT 'produk_promo', 'gambar_file' UNION ALL
      SELECT 'qna_materi', 'file_name' UNION ALL
      SELECT 'survey_kunjungan', 'foto' UNION ALL
      SELECT 'transaksi_gaji', 'slip_name'
    ) AS expected
    INNER JOIN information_schema.columns AS columns_info
      ON columns_info.table_schema = DATABASE()
      AND columns_info.table_name = expected.table_name
      AND columns_info.column_name = expected.column_name;

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = TRUE;

  SELECT VERSION() INTO server_version;
  IF LOCATE('MariaDB', server_version) > 0 THEN
    SET supports_text_defaults = TRUE;
  ELSE
    SET server_major = CAST(SUBSTRING_INDEX(server_version, '.', 1) AS UNSIGNED);
    SET server_minor = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(server_version, '.', 2), '.', -1) AS UNSIGNED);
    SET server_patch = CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(server_version, '.', 3), '.', -1) AS UNSIGNED);
    SET supports_text_defaults = server_major > 8
      OR (server_major = 8 AND (server_minor > 0 OR (server_minor = 0 AND server_patch >= 13)));
  END IF;

  -- Check before changing any table: MySQL before 8.0.13 cannot preserve
  -- defaults on TEXT columns. MariaDB supports them.
  OPEN file_columns;

  preflight_loop: LOOP
    FETCH file_columns INTO target_table, target_column, nullable_value,
      data_type_value, character_set_value, collation_value, default_value,
      comment_value, extra_value;
    IF finished THEN
      LEAVE preflight_loop;
    END IF;

    IF data_type_value NOT IN ('text', 'mediumtext', 'longtext')
      AND default_value IS NOT NULL
      AND NOT supports_text_defaults THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Cannot widen file-reference columns: this MySQL version cannot preserve a TEXT default';
    END IF;
  END LOOP;

  CLOSE file_columns;
  SET finished = FALSE;
  OPEN file_columns;

  widen_loop: LOOP
    FETCH file_columns INTO target_table, target_column, nullable_value,
      data_type_value, character_set_value, collation_value, default_value,
      comment_value, extra_value;
    IF finished THEN
      LEAVE widen_loop;
    END IF;

    IF data_type_value NOT IN ('text', 'mediumtext', 'longtext') THEN
      -- MODIFY COLUMN needs the full definition; keep the current attributes and change only the type.
      SET statement_text = CONCAT(
        'ALTER TABLE `', REPLACE(DATABASE(), '`', '``'), '`.`', REPLACE(target_table, '`', '``'), '` ',
        'MODIFY COLUMN `', REPLACE(target_column, '`', '``'), '` TEXT',
        IF(character_set_value IS NULL, '', CONCAT(' CHARACTER SET `', REPLACE(character_set_value, '`', '``'), '`')),
        IF(collation_value IS NULL, '', CONCAT(' COLLATE `', REPLACE(collation_value, '`', '``'), '`')),
        ' ', IF(nullable_value = 'YES', 'NULL', 'NOT NULL'),
        IF(default_value IS NULL, '', CONCAT(
          ' DEFAULT (',
          IF(LOCATE('MariaDB', server_version) > 0 OR LOCATE('DEFAULT_GENERATED', extra_value) > 0,
            default_value, QUOTE(default_value)),
          ')'
        )),
        IF(comment_value = '', '', CONCAT(' COMMENT ', QUOTE(comment_value))),
        IF(LOCATE('INVISIBLE', UPPER(extra_value)) > 0, ' INVISIBLE', '')
      );
      SET @widen_cloudinary_file_reference_sql = statement_text;
      PREPARE widen_statement FROM @widen_cloudinary_file_reference_sql;
      EXECUTE widen_statement;
      DEALLOCATE PREPARE widen_statement;
    END IF;
  END LOOP;

  CLOSE file_columns;
END$$

CALL widen_cloudinary_file_references()$$
DROP PROCEDURE widen_cloudinary_file_references$$

DELIMITER ;
