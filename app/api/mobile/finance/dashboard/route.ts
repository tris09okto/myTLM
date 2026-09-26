import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";

import { pool } from "@/lib/db";
import { getMobilePrincipal } from "@/lib/mobile/auth/service";
import { resolveUploadUrl } from "@/lib/mobile/attachment-path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const principal = await getMobilePrincipal(request);
  if (!principal || !["keuangan", "super_admin"].includes(principal.role)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    const [employees] = await pool.query<RowDataPacket[]>(
      `SELECT person.*, tg.estimasi, tg.estimasi_shared, tg.slip_name, tg.slip_sent
       FROM (
         SELECT id, nik, nama, jenis_pegawai, nama_bank, norek, area, leader,
                'fronting' AS employee_kind FROM master_pegawai
         UNION ALL
         SELECT id, nik, nama, 'Non-Fronting' AS jenis_pegawai, NULL AS nama_bank,
                NULL AS norek, area_penempatan AS area, supervisor AS leader,
                'non_fronting' AS employee_kind FROM data_non_fronting
         UNION ALL
         SELECT id, username AS nik, nama_leader AS nama, 'Leader' AS jenis_pegawai,
                NULL AS nama_bank, NULL AS norek, area, NULL AS leader,
                'leader' AS employee_kind FROM data_leader
       ) person
       LEFT JOIN transaksi_gaji tg ON tg.employee_kind = person.employee_kind
         AND tg.id_pegawai = person.id AND tg.periode = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')
       ORDER BY person.nama`,
    );
    const [income] = await pool.query<RowDataPacket[]>(
      `SELECT id, nik_fronting, nama_fronting, nama_nasabah, produk,
              up_pengajuan, area, status, created_at
       FROM entri_data_perkiraan_pemasukan ORDER BY id DESC`,
    );
    return NextResponse.json({
      employees: await Promise.all(employees.map(async (employee) => ({
        ...employee,
        slip_url: await resolveUploadUrl(employee.slip_name, "slips"),
      }))),
      income,
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to load finance dashboard" },
      { status: 500 },
    );
  }
}
