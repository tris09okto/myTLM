"use client";

import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import * as XLSX from "xlsx";

export default function CreateLeaderView() {
  const [leaders, setLeaders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    namaLeader: "", kanwil: [], area: [], penempatan: [] 
  });
  
  const [kanwilOptions, setKanwilOptions] = useState([]);
  const [areaOptions, setAreaOptions] = useState([]);
  const [penempatanOptions, setPenempatanOptions] = useState([]);
  const fileInputRef = useRef(null);

  const fetchWilayahOptions = async () => {
    try {
      const res = await fetch("/api/get-wilayah"); 
      if (res.ok) {
        const result = await res.json();
        const kanwils = [...new Set(result.data.map((item: any) => item.kanwil))].map(k => ({ label: k, value: k }));
        const areas = [...new Set(result.data.map((item: any) => item.area))].map(a => ({ label: a, value: a }));
        const penempatans = [...new Set(result.data.map((item: any) => item.penempatan))].map(p => ({ label: p, value: p }));
        
        setKanwilOptions(kanwils as any);
        setAreaOptions(areas as any);
        setPenempatanOptions(penempatans as any);
      }
    } catch (error) {
      console.error("Error fetching wilayah options:", error);
    }
  };

  const fetchLeaders = async () => {
    try {
      const res = await fetch("/api/leaders");
      if (res.ok) {
        const data = await res.json();
        setLeaders(data);
      }
    } catch (error) {
      console.error("Error fetching leaders:", error);
    }
  };

  useEffect(() => {
    fetchLeaders();
    fetchWilayahOptions();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.kanwil.length === 0 || formData.area.length === 0 || formData.penempatan.length === 0) {
      alert("Kanwil, Area, dan Penempatan minimal harus dipilih 1!");
      return;
    }
    try {
      const res = await fetch("/api/leaders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        alert("Data leader berhasil ditambahkan!");
        setIsModalOpen(false); 
        setFormData({ namaLeader: "", kanwil: [], area: [], penempatan: [] }); 
        fetchLeaders(); 
      }
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const formattedData = data.map((row: any) => ({
          namaLeader: row["Nama Leader"] || "-",
          kanwil: row["Kanwil"] ? row["Kanwil"].toString().split(",").map((s: string) => s.trim()) : [],
          area: row["Area"] ? row["Area"].toString().split(",").map((s: string) => s.trim()) : [],
          penempatan: row["Penempatan"] ? row["Penempatan"].toString().split(",").map((s: string) => s.trim()) : [],
        }));

        const res = await fetch("/api/leaders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedData),
        });

        if (res.ok) {
          alert("Data Excel berhasil diimport!");
          fetchLeaders();
        }
      } catch (error) {
        alert("Format file Excel tidak sesuai.");
      } finally {
        if (fileInputRef.current) (fileInputRef.current as any).value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-blue-600">Manajemen Data Leader</h2>
          <p className="text-sm text-gray-500">Manajemen data leader beserta penempatannya.</p>
        </div>
        <div className="flex gap-3">
          <div>
            <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" ref={fileInputRef} id="upload-excel" />
            <label htmlFor="upload-excel" className="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow text-sm font-medium transition-colors">
              Upload Excel
            </label>
          </div>
          <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium transition-colors">
            + Add Data Leader
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="px-6 py-4">No</th>
              <th className="px-6 py-4">Nama Leader</th>
              <th className="px-6 py-4">Kanwil</th>
              <th className="px-6 py-4">Area</th>
              <th className="px-6 py-4">Penempatan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
            {leaders.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Belum ada data leader.</td></tr>
            ) : (
              leaders.map((leader: any, index) => {
                const parseJSON = (data: any) => {
                  try { return typeof data === 'string' ? JSON.parse(data) : data; } catch { return []; }
                };
                const kanwilArr = parseJSON(leader.kanwil);
                const areaArr = parseJSON(leader.area);
                const penempatanArr = parseJSON(leader.penempatan);

                return (
                  <tr key={leader.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-center">{index + 1}</td>
                    <td className="px-6 py-4 font-semibold">{leader.nama_leader}</td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{kanwilArr?.map((k: string, i: number) => <span key={i} className="bg-purple-50 text-purple-700 px-2 py-1 rounded text-xs border border-purple-100">{k}</span>)}</div></td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{areaArr?.map((a: string, i: number) => <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">{a}</span>)}</div></td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{penempatanArr?.map((p: string, i: number) => <span key={i} className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs border border-amber-100">{p}</span>)}</div></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-5 bg-gray-50 border-b">
              <h2 className="text-lg font-bold">Add Data Leader</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✖</button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nama Leader</label>
                <input type="text" className="w-full border rounded p-2 text-sm" required value={formData.namaLeader} onChange={(e) => setFormData({ ...formData, namaLeader: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Kanwil</label>
                <Select isMulti options={kanwilOptions} className="text-sm" onChange={(selected: any) => setFormData({ ...formData, kanwil: selected ? selected.map((item: any) => item.value) : [] })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Area</label>
                <Select isMulti options={areaOptions} className="text-sm" onChange={(selected: any) => setFormData({ ...formData, area: selected ? selected.map((item: any) => item.value) : [] })} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Penempatan</label>
                <Select isMulti options={penempatanOptions} className="text-sm" onChange={(selected: any) => setFormData({ ...formData, penempatan: selected ? selected.map((item: any) => item.value) : [] })} />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-sm">Batal</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded text-sm">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}