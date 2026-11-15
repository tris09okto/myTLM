-- Role definition from the supplied db_mytlm _new.sql. Preserves all existing roles.
ALTER TABLE users MODIFY role ENUM('super_admin','admin','pegawai','keuangan','leader','guest','supervisor','mitra') NOT NULL;
