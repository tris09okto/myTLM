import { NextResponse } from 'next/server';
import {pool} from '@/lib/db';
import * as xlsx from 'xlsx';

function formatTanggalExcel(dateStr: any) {
  if (!dateStr) return '-';
  const normalizedStr = String(dateStr).replace(/([a-zA-Z]+)\s*(\d+)\s*,\s*(\d+)/, '$1 $2, $3');
  const d = new Date(normalizedStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCleanValue(row: any, expectedHeader: string) {
  for (const key in row) {
    if (key.trim().toLowerCase() === expectedHeader.toLowerCase()) {
      return String(row[key]).trim().toLowerCase();
    }
  }
  return '';
}

// FUNGSI PEMBERSIH EKSTREM: Hanya menyisakan huruf & angka.
// Mengabaikan spasi, enter, titik, koma, dll saat pencocokan data.
const sanitizeMatch = (str: any) => String(str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

// =========================================================================
// FUNGSI BARU: UPDATE TABEL TRANSAKSI GAJI SECARA OTOMATIS
// =========================================================================
async function tambahEstimasiGaji(connection: any, idPegawai: number, periode: string, nilai: number) {
  if (nilai <= 0) return;
  const [gajiExist]: any = await connection.query(
    `SELECT id FROM transaksi_gaji WHERE id_pegawai = ? AND periode = ? LIMIT 1`, 
    [idPegawai, periode]
  );
  if (gajiExist.length > 0) {
    await connection.query(
      `UPDATE transaksi_gaji SET estimasi = estimasi + ? WHERE id_pegawai = ? AND periode = ?`, 
      [nilai, idPegawai, periode]
    );
  } else {
    await connection.query(
      `INSERT INTO transaksi_gaji (id_pegawai, periode, estimasi, estimasi_shared, slip_sent) VALUES (?, ?, ?, 0, 0)`, 
      [idPegawai, periode, nilai]
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filterType = formData.get('filterType'); 
    const filterValue = formData.get('filterValue');

    if (!file) return NextResponse.json({ success: false, message: 'File tidak ditemukan' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0]; 
    const worksheet = workbook.Sheets[sheetName];
    
    const rawData = xlsx.utils.sheet_to_json(worksheet, { raw: false });

    if (rawData.length === 0) {
      return NextResponse.json({ success: false, message: 'File Excel kosong atau format tidak sesuai' }, { status: 400 });
    }

    const targetValue = String(filterValue).trim().toLowerCase();

    const filteredData = rawData.filter((row: any) => {
      if (filterType === 'area') {
        const rowArea = getCleanValue(row, 'area');
        return rowArea === targetValue || rowArea.includes(targetValue.replace('area ', '')) || targetValue.includes(rowArea);
      } 
      else if (filterType === 'pegawai') {
        const rowNamaBpo = getCleanValue(row, 'nama bpo');
        const rowNikBpo = getCleanValue(row, 'nik bpo') || getCleanValue(row, 'nik');
        return rowNamaBpo === targetValue || rowNikBpo === targetValue;
      } 
      else if (filterType === 'leader') {
        const rowLeader = getCleanValue(row, 'leader');
        return rowLeader === targetValue || targetValue.includes(rowLeader) || targetValue === rowLeader;
      }
      return false;
    });

    if (filteredData.length === 0) {
      return NextResponse.json({ success: false, message: `Gagal dicocokkan dengan filter! Target: "${targetValue}".` }, { status: 404 });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const row of filteredData as any[]) {
        let valNikBpo = ''; let valNamaBpo = ''; let valNasabah = ''; let valProduk = '';
        let valTglPengajuan = ''; let valTglExpired = ''; let valUpPengajuan = ''; 
        let valArea = ''; let valStatus = '';

        for (const key in row) {
          const cleanKey = key.trim().toLowerCase();
          if (cleanKey === 'nik bpo' || cleanKey === 'nik') valNikBpo = row[key];
          if (cleanKey === 'nama bpo') valNamaBpo = row[key];
          if (cleanKey === 'nama nasabah') valNasabah = row[key];
          if (cleanKey === 'produk') valProduk = row[key];
          if (cleanKey === 'tgl pengajuan') valTglPengajuan = row[key];
          if (cleanKey === 'tgl expired') valTglExpired = row[key];
          if (cleanKey === 'up pengajuan') valUpPengajuan = row[key];
          if (cleanKey === 'area') valArea = row[key];
          if (cleanKey === 'status') valStatus = row[key];
        }

        if (!valNamaBpo && !valNikBpo) continue;

        const originalUp = valUpPengajuan ? String(valUpPengajuan) : '0';
        const cleanUp = originalUp.replace(/[^0-9]/g, '');
        let finalUpPengajuan = Number(cleanUp);
        if (isNaN(finalUpPengajuan)) finalUpPengajuan = 0;

        const nikFrontingClean = String(valNikBpo || '-').trim();
        const namaFrontingClean = String(valNamaBpo || '-').trim();
        const namaNasabahClean = String(valNasabah || '-').trim();
        const produkClean = String(valProduk || '-').trim();
        const statusClean = String(valStatus || '-').trim();

        // Target yang sudah dihilangkan spasinya untuk dicocokkan
        const targetNasabah = sanitizeMatch(namaNasabahClean);
        const targetProduk = sanitizeMatch(produkClean);

        // Cek apakah Excel yang di-upload membawa status "Close"
        const isExcelClose = (statusClean.toLowerCase() === 'close' || statusClean.toLowerCase() === 'closed');

        // 1. TARIK DATA DARI DATABASE BERDASARKAN NIK ATAU NAMA
        let potentialRows: any[] = [];
        if (nikFrontingClean !== '-') {
          const [rows]: any = await connection.query(
            `SELECT id, status, up_pengajuan, nama_nasabah, produk FROM entri_data_perkiraan_pemasukan WHERE nik_fronting = ?`, 
            [nikFrontingClean]
          );
          potentialRows = rows;
        } else {
          const [rows]: any = await connection.query(
            `SELECT id, status, up_pengajuan, nama_nasabah, produk FROM entri_data_perkiraan_pemasukan WHERE nama_fronting = ?`, 
            [namaFrontingClean]
          );
          potentialRows = rows;
        }

        // 2. LAKUKAN PENCOCOKAN MENGGUNAKAN JAVASCRIPT (Kebal spasi/typo simbol)
        let matchedDbRow = null;
        for (const dbRow of potentialRows) {
          const dbNasabah = sanitizeMatch(dbRow.nama_nasabah);
          const dbProduk = sanitizeMatch(dbRow.produk);
          
          if (dbNasabah === targetNasabah && dbProduk === targetProduk) {
            matchedDbRow = dbRow;
            break; 
          }
        }

        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const periodeSaatIni = `${year}-${month}`;

        let idPegawai: number | null = null;
        if (nikFrontingClean !== '-') {
          const [pegawaiRow]: any = await connection.query(`SELECT id FROM master_pegawai WHERE nik = ? LIMIT 1`, [nikFrontingClean]);
          if (pegawaiRow.length > 0) idPegawai = pegawaiRow[0].id;
        }

        if (matchedDbRow) {
          // DATA DITEMUKAN: Cek Update
          const dbRow = matchedDbRow;
          const dbStatus = String(dbRow.status || '').trim();
          const dbStatusLower = dbStatus.toLowerCase();
          const dbUpPengajuan = Number(dbRow.up_pengajuan || 0);

          // Skip hanya jika di Database statusnya SUDAH "Close" atau "Closed" 
          const isCloseOrClosed = (dbStatusLower === 'close' || dbStatusLower === 'closed');

          if (isCloseOrClosed) {
            skippedCount++;
            continue; 
          }

          // Cek apakah Excel membawa status/nominal yang berbeda
          const isStatusSame = dbStatus.toLowerCase() === statusClean.toLowerCase();
          const isUpSame = dbUpPengajuan === finalUpPengajuan;

          if (!isStatusSame || !isUpSame) {
            let updateFields: string[] = [];
            let updateValues: any[] = [];

            if (!isStatusSame) {
              updateFields.push('status = ?');
              updateValues.push(statusClean);
            }

            if (!isUpSame) {
              updateFields.push('up_pengajuan = ?');
              updateValues.push(finalUpPengajuan);
            }

            updateValues.push(dbRow.id);

            await connection.query(`UPDATE entri_data_perkiraan_pemasukan SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);

            // Jika Nominal UP berbeda, hitung selisihnya ke transaksi_gaji
            if (!isUpSame && idPegawai) {
              const selisihUp = finalUpPengajuan - dbUpPengajuan; 
              const [gajiExist]: any = await connection.query(`SELECT id FROM transaksi_gaji WHERE id_pegawai = ? AND periode = ? LIMIT 1`, [idPegawai, periodeSaatIni]);

              if (gajiExist.length > 0) {
                await connection.query(`UPDATE transaksi_gaji SET estimasi = estimasi + ? WHERE id_pegawai = ? AND periode = ?`, [selisihUp, idPegawai, periodeSaatIni]);
              } else if (finalUpPengajuan > 0) {
                await connection.query(`INSERT INTO transaksi_gaji (id_pegawai, periode, estimasi, estimasi_shared, slip_sent) VALUES (?, ?, ?, 0, 0)`, [idPegawai, periodeSaatIni, finalUpPengajuan]);
              }
            }

            // ====================================================================
            // LOGIKA GAJI SAAT UPDATE: 
            // Tambahkan estimasi ke user HANYA JIKA status dari Excel adalah Close 
            // dan sebelumnya di DB statusnya belum Close.
            // ====================================================================
            if (idPegawai && isExcelClose) {
              await tambahEstimasiGaji(connection, idPegawai, periodeSaatIni, finalUpPengajuan);
            }

            updatedCount++;
          }
        } else {
          // DATA TIDAK DITEMUKAN: Insert Baru
          await connection.query(`
            INSERT INTO entri_data_perkiraan_pemasukan 
            (nik_fronting, nama_fronting, nama_nasabah, produk, tgl_pengajuan, tgl_expired, up_pengajuan, area, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            nikFrontingClean, namaFrontingClean, namaNasabahClean, produkClean,            
            formatTanggalExcel(valTglPengajuan), formatTanggalExcel(valTglExpired), 
            finalUpPengajuan, valArea || '-', statusClean
          ]);

          insertedCount++;

          if (idPegawai && finalUpPengajuan > 0) {
            const [gajiExist]: any = await connection.query(`SELECT id FROM transaksi_gaji WHERE id_pegawai = ? AND periode = ? LIMIT 1`, [idPegawai, periodeSaatIni]);
            if (gajiExist.length > 0) {
              await connection.query(`UPDATE transaksi_gaji SET estimasi = estimasi + ? WHERE id_pegawai = ? AND periode = ?`, [finalUpPengajuan, idPegawai, periodeSaatIni]);
            } else {
              await connection.query(`INSERT INTO transaksi_gaji (id_pegawai, periode, estimasi, estimasi_shared, slip_sent) VALUES (?, ?, ?, 0, 0)`, [idPegawai, periodeSaatIni, finalUpPengajuan]);
            }
          }

          // ====================================================================
          // LOGIKA GAJI SAAT INSERT BARU: 
          // Tambahkan estimasi ke user HANYA JIKA status dari Excel adalah Close.
          // Jika statusnya pending, jangan masukkan ke estimasi gaji.
          // ====================================================================
          if (idPegawai && isExcelClose) {
            await tambahEstimasiGaji(connection, idPegawai, periodeSaatIni, finalUpPengajuan);
          }
        }
      }

      await connection.commit();
      connection.release();
      
      return NextResponse.json({ 
        success: true, 
        message: `Excel Selesai: ${insertedCount} Insert, ${updatedCount} Update, ${skippedCount} Dilewati (karena sudah Close).` 
      });

    } catch (dbError: any) {
      await connection.rollback();
      connection.release();
      throw dbError;
    }

  } catch (error: any) {
    console.error("Gagal memproses Excel:", error);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat memproses file' }, { status: 500 });
  }
}