"use client";

import React, { useState, useEffect, useRef } from "react";
import { SessionProvider, useSession, signOut } from "next-auth/react";
import Select from "react-select";
import * as XLSX from "xlsx";

function SearchableSelect({ name, options, value, onChange, placeholder, required, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = (options || []).filter((opt) =>
    String(opt).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className={`relative w-full ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      <input type="hidden" name={name} value={value} />
      <div 
        className={`flex items-center w-full p-2 bg-white border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => { if (!disabled) setIsOpen(true); }}
      >
        <input
          type="text"
          className="w-full outline-none text-gray-900 bg-transparent text-sm disabled:cursor-not-allowed"
          placeholder={placeholder}
          value={isOpen ? searchTerm : (value || "")} 
          disabled={disabled}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            onChange(""); 
            setIsOpen(true);
          }}
          onFocus={() => { if (!disabled) setIsOpen(true); }}
          required={required && !value} 
        />
        <span className="ml-2 text-gray-500 text-xs cursor-pointer" onClick={() => { if (!disabled) setIsOpen(!isOpen); }}>▼</span>
      </div>
      {isOpen && !disabled && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <div 
                key={idx} 
                className="p-2 cursor-pointer hover:bg-blue-100 text-gray-900 text-sm border-b border-gray-50 last:border-0"
                onClick={() => { 
                  onChange(opt); 
                  setSearchTerm(""); 
                  setIsOpen(false); 
                }}
              >
                {opt}
              </div>
            ))
          ) : (
            <div className="p-2 text-gray-500 text-sm text-center">Data tidak ditemukan</div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 1. KOMPONEN: CREATE LEADER VIEW
// ==========================================
function CreateLeaderView() {
  const [leaders, setLeaders] = useState([]);
  const [allLeaders, setAllLeaders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeaderId, setEditingLeaderId] = useState(null);
  const [wilayahData, setWilayahData] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({ 
    namaLeader: "", 
    kanwil: [], 
    area: [], 
    penempatan: [], 
    email: "",
    username: "",
    password: "",
    idcard_base64: "", // <-- Tambahkan ini
    idcard_name: ""    // <-- Tambahkan ini
  });

  // State baru untuk ID Card
  const [idCardFile, setIdCardFile] = useState(null);
  const [idCardName, setIdCardName] = useState("");
  const [existingIdCard, setExistingIdCard] = useState("");
  
  const fileInputRef = useRef(null);

  const selectStyles = {
    control: (provided) => ({
      ...provided,
      backgroundColor: '#ffffff',
      borderColor: '#d1d5db',
      borderRadius: '0.5rem',
      padding: '2px',
      boxShadow: 'none',
      '&:hover': { borderColor: '#9ca3af' }
    }),
    input: (provided) => ({ ...provided, color: '#111827' }),
    option: (provided, state) => ({
      ...provided,
      color: '#111827',
      backgroundColor: state.isFocused ? '#eff6ff' : '#ffffff',
    }),
    singleValue: (provided) => ({ ...provided, color: '#111827' }),
    multiValue: (provided) => ({ ...provided, backgroundColor: '#eff6ff', borderRadius: '4px' }),
    multiValueLabel: (provided) => ({ ...provided, color: '#1d4ed8', fontWeight: '500' }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: '#1d4ed8',
      ':hover': { backgroundColor: '#dbeafe', color: '#1e40af' },
    }),
    menuList: (provided) => ({
      ...provided,
      maxHeight: '180px',
    }),
  };

  const fetchWilayahOptions = async () => {
    try {
      const res = await fetch("/api/get-wilayah"); 
      if (res.ok) {
        const result = await res.json();
        const dataWilayah = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        setWilayahData(dataWilayah);
      }
    } catch (error) {
      console.error("Error fetching wilayah options:", error);
    }
  };

  const handleIdCardChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        alert("Format ID Card harus JPG atau PNG!");
        e.target.value = "";
        setIdCardName("");
        setIdCardFile(null);
        return;
      }
      setIdCardName(file.name);
      setIdCardFile(file);
    }
  };

  const fetchLeaders = async (keyword = "") => {
    try {
      const res = await fetch("/api/leaders");
      if (res.ok) {
        const data = await res.json();
        const listData = Array.isArray(data) ? data : [];
        setAllLeaders(listData);

        // Filter data secara lokal berdasarkan nama leader, username, atau email jika ada keyword pencarian
        if (keyword) {
          const lowerKey = keyword.toLowerCase();
          const filtered = listData.filter(item => 
            (item.nama_leader && item.nama_leader.toLowerCase().includes(lowerKey)) ||
            (item.username && item.username.toLowerCase().includes(lowerKey)) ||
            (item.email && item.email.toLowerCase().includes(lowerKey))
          );
          setLeaders(filtered);
        } else {
          setLeaders(listData);
        }
      }
    } catch (error) {
      console.error("Error fetching leaders:", error);
    }
  };

  useEffect(() => {
    fetchLeaders();
    fetchWilayahOptions();
  }, []); // <--- GUNAKAN ARRAY KOSONG AGAR HANYA DIJALANKAN SEKALI SAAT DIMUAT

  /*useEffect(() => {
    // Tambahkan 'upload-fee' agar data frontline ditarik saat menu ini dibuka
    if (currentView === 'list-akun' || currentView === 'penutupan-akun' || currentView === 'upload-fee') {
      fetchFrontlineData();
    }
    // Tambahkan 'upload-fee' agar data wilayah ditarik saat menu ini dibuka
    if (currentView === 'form-tambah' || currentView === 'form-edit' || currentView === 'upload-fee') {
      fetchWilayahData();
      fetchLeadersData();
    }
  }, [currentView]);*/

  const kanwilOptions = Array.from(
    new Set(wilayahData.map(item => item?.kanwil).filter(Boolean))
  ).map(k => ({ label: String(k), value: String(k) }));

  const filteredAreasData = formData.kanwil.length > 0
    ? wilayahData.filter(item => formData.kanwil.includes(item?.kanwil))
    : wilayahData;

  const areaOptions = Array.from(
    new Set(filteredAreasData.map(item => item?.area).filter(Boolean))
  ).map(a => ({ label: String(a), value: String(a) }));

  const filteredPenempatanData = formData.area.length > 0
    ? wilayahData.filter(item => formData.area.includes(item?.area))
    : filteredAreasData;

  const penempatanOptions = Array.from(
    new Set(filteredPenempatanData.map(item => item?.penempatan).filter(Boolean))
  ).map(p => ({ label: String(p), value: String(p) }));

  const handleAddClick = () => {
    setEditingLeaderId(null);
    setFormData({ namaLeader: "", kanwil: [], area: [], penempatan: [], email: "", username: "", password: "" });
    
    // Reset file
    setIdCardFile(null);
    setIdCardName("");
    setExistingIdCard("");
    
    setIsModalOpen(true);
  };

  const handleEditClick = (leader) => {
    const parseJSON = (data) => { 
      try { return typeof data === 'string' ? JSON.parse(data) : (Array.isArray(data) ? data : []); } 
      catch { return []; } 
    };

    setEditingLeaderId(leader.id);
    setFormData({
      namaLeader: leader.nama_leader || "",
      kanwil: parseJSON(leader.kanwil),
      area: parseJSON(leader.area),
      penempatan: parseJSON(leader.penempatan),
      email: leader.email || "",
      username: leader.username || "",
      password: "", 
    });
    
    // Set ID Card existing
    setIdCardFile(null);
    setIdCardName("");
    setExistingIdCard(leader.idcard_file || ""); 
    
    setIsModalOpen(true);
  };

  // Helper mengubah file gambar menjadi string teks Base64
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (formData.kanwil.length === 0 || formData.area.length === 0 || formData.penempatan.length === 0) {
      alert("Kanwil, Area, dan Penempatan minimal harus dipilih 1!");
      return;
    }
    
    try {
      // Gunakan Object Javascript biasa, bukan FormData
      const payload = {
        namaLeader: formData.namaLeader,
        kanwil: formData.kanwil,
        area: formData.area,
        penempatan: formData.penempatan,
        email: formData.email,
        username: formData.username,
        password: formData.password
      };
      
      if (editingLeaderId) payload.id = editingLeaderId;
      
      // Jika ada file ID Card, konversi ke Base64 lalu masukkan ke payload
      if (idCardFile) {
        payload.idcard_file = await fileToBase64(idCardFile);
      }

      const res = await fetch("/api/leaders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json" // Wajib disertakan agar req.json() di backend terbaca
        },
        body: JSON.stringify(payload), // Kirim sebagai string JSON
      });

      if (res.ok) {
        alert(editingLeaderId ? "Data leader berhasil diperbarui!" : "Data leader berhasil ditambahkan!");
        setIsModalOpen(false); 
        setEditingLeaderId(null);
        setFormData({ namaLeader: "", kanwil: [], area: [], penempatan: [], email: "", username: "", password: "" }); 
        
        setIdCardFile(null);
        setIdCardName("");
        setExistingIdCard("");
        
        fetchLeaders(); 
      } else {
        alert("Gagal menyimpan data.");
      }
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const formattedData = data.map((row) => ({
          namaLeader: row["Nama Leader"] ? String(row["Nama Leader"]) : "-",
          kanwil: row["Kanwil"] ? String(row["Kanwil"]).split(",").map((s) => s.trim()) : [],
          area: row["Area"] ? String(row["Area"]).split(",").map((s) => s.trim()) : [],
          penempatan: row["Penempatan"] ? String(row["Penempatan"]).split(",").map((s) => s.trim()) : [],
          email: row["Email"] ? String(row["Email"]) : "",
          username: row["Username"] ? String(row["Username"]) : "",
          password: row["Password"] ? String(row["Password"]) : "",
        }));

        const res = await fetch("/api/leaders/upload-excel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedData),
        });

        if (res.ok) {
          alert("Data Excel berhasil diimport!");
          fetchLeaders();
        } else {
          alert("Gagal mengimport data Excel.");
        }
      } catch (error) {
        alert("Format file Excel tidak sesuai. Pastikan kolom sesuai.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSearchChange = (e) => {
    const keyword = e.target.value;
    setSearchQuery(keyword);
    
    if (keyword.trim() === "") {
      setLeaders(allLeaders);
    } else {
      const lowerKey = keyword.toLowerCase();
      const filtered = allLeaders.filter(item => 
        (item.nama_leader && item.nama_leader.toLowerCase().includes(lowerKey)) ||
        (item.username && item.username.toLowerCase().includes(lowerKey)) ||
        (item.email && item.email.toLowerCase().includes(lowerKey))
      );
      setLeaders(filtered);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-blue-600">Daftar Data Leader</h2>
          <p className="text-sm text-gray-500">Manajemen data leader (Bisa menangani banyak area/penempatan).</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <input 
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Cari nama leader, username, atau email..."
            className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3">
            <div>
              <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" ref={fileInputRef} id="upload-excel-leader" />
              <label htmlFor="upload-excel-leader" className="cursor-pointer flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition-all">
                Upload Excel
              </label>
            </div>
            <button onClick={handleAddClick} className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium transition-all">
              + Add Data Leader
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="px-6 py-4">No</th>
              <th className="px-6 py-4">Nama Leader</th>
              <th className="px-6 py-4">Username / Email</th>
              <th className="px-6 py-4">Kanwil</th>
              <th className="px-6 py-4">Area</th>
              <th className="px-6 py-4">Penempatan</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
            {leaders.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Belum ada data leader.</td></tr>
            ) : (
              leaders.map((leader, index) => {
                const parseJSON = (data) => { 
                  try { return typeof data === 'string' ? JSON.parse(data) : (Array.isArray(data) ? data : []); } 
                  catch { return []; } 
                };
                const kanwilArr = parseJSON(leader.kanwil);
                const areaArr = parseJSON(leader.area);
                const penempatanArr = parseJSON(leader.penempatan);

                return (
                  <tr key={leader.id || index} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-center font-medium">{index + 1}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{leader.nama_leader || "-"}</td>
                    <td className="px-6 py-4 text-gray-600">
                      <div>{leader.username || "-"}</div>
                      <div className="text-xs text-gray-400">{leader.email || "-"}</div>
                    </td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1.5">{kanwilArr?.map((k, i) => <span key={i} className="bg-purple-50 text-purple-700 px-2.5 py-1 rounded-md text-xs border border-purple-100">{k}</span>)}</div></td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1.5">{areaArr?.map((a, i) => <span key={i} className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-xs border border-blue-100">{a}</span>)}</div></td>
                    <td className="px-6 py-4"><div className="flex flex-wrap gap-1.5">{penempatanArr?.map((p, i) => <span key={i} className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-md text-xs border border-amber-100">{p}</span>)}</div></td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleEditClick(leader)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded transition-colors text-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          {/* Kotak Modal dibuat max-h-[90vh] dan flex-col agar header tetap terkunci di atas */}
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-auto">
            
            {/* Header (Tombol Close & Judul dijamin selalu terlihat di atas) */}
            <div className="flex justify-between items-center p-5 bg-gray-50 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                {editingLeaderId ? "Edit Data Leader" : "Add Data Leader"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 p-1 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto flex-1" autoComplete="off">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Nama Leader</label>
                <input 
                  type="text" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                  value={formData.namaLeader} 
                  onChange={(e) => setFormData({ ...formData, namaLeader: e.target.value })} 
                  placeholder="Masukkan nama..." 
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Kanwil</label>
                <Select 
                  isMulti 
                  options={kanwilOptions} 
                  styles={selectStyles}
                  placeholder="Pilih Kanwil..." 
                  value={kanwilOptions.filter(opt => formData.kanwil.includes(opt.value))}
                  onChange={(selected) => {
                    setFormData({ 
                      ...formData, 
                      kanwil: selected ? selected.map(item => item.value) : [],
                      area: [],
                      penempatan: []
                    });
                  }} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Area</label>
                <Select 
                  isMulti 
                  options={areaOptions} 
                  styles={selectStyles}
                  placeholder="Pilih Area..." 
                  value={areaOptions.filter(opt => formData.area.includes(opt.value))}
                  onChange={(selected) => {
                    setFormData({ 
                      ...formData, 
                      area: selected ? selected.map(item => item.value) : [],
                      penempatan: []
                    });
                  }} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Penempatan</label>
                <Select 
                  isMulti 
                  options={penempatanOptions} 
                  styles={selectStyles}
                  placeholder="Pilih Penempatan..." 
                  value={penempatanOptions.filter(opt => formData.penempatan.includes(opt.value))}
                  onChange={(selected) => setFormData({ ...formData, penempatan: selected ? selected.map(item => item.value) : [] })} 
                />
              </div>

              {/* Input ID Card */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                  Upload ID Card (JPG/PNG)
                  {!editingLeaderId && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input 
                  type="file" 
                  name="idcard_file" 
                  accept=".jpg, .jpeg, .png" 
                  onChange={handleIdCardChange} 
                  required={!editingLeaderId} 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                />
                {idCardName && (
                  <p className="mt-1 text-sm text-green-600 font-medium">File baru: {idCardName}</p>
                )}
                {editingLeaderId && !idCardName && existingIdCard && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                    File saat ini: {existingIdCard}
                  </div>
                )}
              </div>

              {/* Input Email */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Alamat Email</label>
                <input 
                  type="email" 
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                  value={formData.email} 
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                  placeholder="name@example.com" 
                />
              </div>

              {/* Input Username */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Username Akun</label>
                <input 
                  type="text" 
                  autoComplete="off"
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  required 
                  value={formData.username} 
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })} 
                  placeholder="Masukkan username..." 
                />
              </div>

              {/* Input Password */}
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                  Password Akun 
                  {editingLeaderId && <span className="text-[10px] text-gray-400 ml-2">(Kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <input 
                  type="password" 
                  autoComplete="new-password"
                  readOnly
                  onFocus={(e) => e.target.removeAttribute('readOnly')}
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" 
                  required={!editingLeaderId} 
                  value={formData.password} 
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                  placeholder={editingLeaderId ? "********" : "Masukkan password baru..."} 
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  {editingLeaderId ? "Simpan Perubahan" : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// KOMPONEN: UPLOAD PRODUK & PROMO VIEW
// ==========================================
function UploadProdukView() {
  const [dataList, setDataList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    tipe: 'PRODUK',
    judul: '',
    deskripsi: '',
    berlaku_sampai: '',
    status: 'AKTIF'
  });
  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState("");
  const [existingImage, setExistingImage] = useState("");

  // 1. READ: Ambil Data dari Database
  const fetchData = async () => {
    try {
      const res = await fetch('/api/produk-promo/create');
      if (res.ok) {
        const result = await res.json();
        // Cek struktur response (mendukung { success: true, data: [...] } atau array langsung)
        if (result.success !== undefined) {
          setDataList(Array.isArray(result.data) ? result.data : []);
        } else {
          setDataList(Array.isArray(result) ? result : []);
        }
      } else {
        console.error("Gagal menarik data dari server, status:", res.status);
      }
    } catch (error) {
      console.error("Error fetching produk/promo data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        tipe: item.tipe || 'PRODUK',
        judul: item.judul || '',
        deskripsi: item.deskripsi || '',
        berlaku_sampai: item.berlaku_sampai ? item.berlaku_sampai.split('T')[0] : '',
        status: item.status || 'AKTIF'
      });
      setExistingImage(item.gambar_file || "");
    } else {
      setEditingId(null);
      setFormData({ tipe: 'PRODUK', judul: '', deskripsi: '', berlaku_sampai: '', status: 'AKTIF' });
      setExistingImage("");
    }
    setImageFile(null);
    setImageName("");
    setIsModalOpen(true);
  };

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        alert("Format gambar harus JPG atau PNG!");
        e.target.value = "";
        setImageName("");
        setImageFile(null);
        return;
      }
      setImageName(file.name);
      setImageFile(file);
    }
  };

  // 2. CREATE & UPDATE: Submit Data ke Database
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    
    if (editingId) submitData.append('id', editingId);
    if (imageFile) submitData.append('gambar_file', imageFile); // File fisik untuk backend

    try {
      const endpoint = editingId ? '/api/produk-promo/update' : '/api/produk-promo/create';
      const res = await fetch(endpoint, {
        method: 'POST', // Menggunakan POST agar kompatibel dengan FormData parsing (multer/formidable) di backend
        body: submitData
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success || res.status === 200) {
          alert(editingId ? "Data berhasil diperbarui!" : "Data berhasil ditambahkan!");
          setIsModalOpen(false);
          fetchData(); // Tarik data terbaru dari DB
        } else {
          alert(result.message || "Gagal menyimpan data ke database.");
        }
      } else {
        alert(`Terjadi kesalahan pada server (Status: ${res.status})`);
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("Terjadi kesalahan jaringan saat menyimpan data.");
    } finally {
      setIsLoading(false);
    }
  };

  // 3. DELETE: Hapus Data dari Database
  const handleDelete = async (id, judul) => {
    if(confirm(`Yakin ingin menghapus ${judul}?`)) {
      try {
        const res = await fetch('/api/produk-promo/delete', {
          method: 'POST', // Bisa disesuaikan menjadi 'DELETE' tergantung routing backend Anda
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        
        if (res.ok) {
          alert("Data berhasil dihapus!");
          fetchData(); // Reload table
        } else {
          alert("Gagal menghapus data dari database.");
        }
      } catch (error) {
        console.error("Delete error:", error);
        alert("Terjadi kesalahan jaringan saat menghapus data.");
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      {/* Header View */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-blue-600">Manajemen Produk & Promo</h2>
          <p className="text-sm text-gray-500">Kelola katalog produk dan informasi promo terkini.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors text-sm"
        >
          + Tambah Data
        </button>
      </div>

      {/* Tabel Data */}
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="px-6 py-4">No</th>
              <th className="px-6 py-4">Tipe</th>
              <th className="px-6 py-4">Judul</th>
              <th className="px-6 py-4">Status & Masa Berlaku</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
            {dataList.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Belum ada data Produk / Promo.</td></tr>
            ) : (
              dataList.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 text-center">{index + 1}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${item.tipe === 'PROMO' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {item.tipe}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 truncate max-w-xs">{item.judul}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded w-max ${item.status === 'AKTIF' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {item.status}
                      </span>
                      {item.tipe === 'PROMO' && item.berlaku_sampai && (
                        <span className="text-xs text-gray-500 font-medium">s.d {new Date(item.berlaku_sampai).toLocaleDateString('id-ID')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleOpenModal(item)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs mr-2">Edit</button>
                    <button onClick={() => handleDelete(item.id, item.judul)} className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 bg-gray-50 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? "Edit Data" : "Tambah Data Baru"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700">Kategori Data <span className="text-red-500">*</span></label>
                  <select 
                    value={formData.tipe} 
                    onChange={(e) => setFormData({...formData, tipe: e.target.value})}
                    required
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PRODUK">Produk</option>
                    <option value="PROMO">Promo / Campaign</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700">Status <span className="text-red-500">*</span></label>
                  <select 
                    value={formData.status} 
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    required
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AKTIF">Aktif (Tampilkan)</option>
                    <option value="TIDAK AKTIF">Tidak Aktif (Sembunyikan)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Judul {formData.tipe} <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.judul}
                  onChange={(e) => setFormData({...formData, judul: e.target.value})}
                  required 
                  placeholder="Masukkan judul menarik..."
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Deskripsi Lengkap <span className="text-red-500">*</span></label>
                <textarea 
                  rows={4}
                  value={formData.deskripsi}
                  onChange={(e) => setFormData({...formData, deskripsi: e.target.value})}
                  required
                  placeholder="Syarat, ketentuan, atau spesifikasi detail..."
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              {/* Input Berlaku Sampai (Hanya wajib untuk PROMO) */}
              {formData.tipe === 'PROMO' && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-gray-700">Berlaku Sampai <span className="text-red-500">*</span></label>
                  <input 
                    type="date" 
                    value={formData.berlaku_sampai}
                    onChange={(e) => setFormData({...formData, berlaku_sampai: e.target.value})}
                    required
                    className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">
                  Upload Gambar {formData.tipe} (JPG/PNG)
                  {!editingId && <span className="text-red-500 ml-1">*</span>}
                </label>
                <input 
                  type="file" 
                  accept=".jpg, .jpeg, .png" 
                  onChange={handleImageChange}
                  required={!editingId}
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                />
                {imageName && <p className="mt-1 text-xs text-green-600 font-medium">File baru: {imageName}</p>}
                {editingId && !imageName && existingImage && (
                  <p className="mt-1 text-xs text-blue-600 font-medium">File saat ini: {existingImage}</p>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isLoading ? "Menyimpan..." : "Simpan Data"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// KOMPONEN: PENGUMUMAN VIEW
// ==========================================
function PengumumanView() {
  const [dataList, setDataList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    judul: '',
    isi: '',
    status: 'AKTIF'
  });
  const [lampiranFile, setLampiranFile] = useState(null);
  const [lampiranName, setLampiranName] = useState("");
  const [existingLampiran, setExistingLampiran] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch('/api/pengumuman');
      if (res.ok) {
        const result = await res.json();
        setDataList(Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []));
      }
    } catch (error) {
      console.error("Gagal menarik data pengumuman:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        judul: item.judul || '',
        isi: item.isi || '',
        status: item.status || 'AKTIF'
      });
      setExistingLampiran(item.file_lampiran || "");
    } else {
      setEditingId(null);
      setFormData({ judul: '', isi: '', status: 'AKTIF' });
      setExistingLampiran("");
    }
    setLampiranFile(null);
    setLampiranName("");
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLampiranName(file.name);
      setLampiranFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const submitData = new FormData();
    Object.keys(formData).forEach(key => submitData.append(key, formData[key]));
    if (editingId) submitData.append('id', editingId);
    if (lampiranFile) submitData.append('file_lampiran', lampiranFile);

    try {
      const endpoint = editingId ? '/api/pengumuman/update' : '/api/pengumuman';
      const res = await fetch(endpoint, {
        method: 'POST',
        body: submitData
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          alert(editingId ? "Pengumuman berhasil diperbarui!" : "Pengumuman berhasil ditambahkan!");
          setIsModalOpen(false);
          fetchData();
        } else {
          alert(result.message || "Gagal menyimpan pengumuman.");
        }
      } else {
        alert("Terjadi kesalahan pada server.");
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id, judul) => {
    if (confirm(`Yakin ingin menghapus pengumuman "${judul}"?`)) {
      try {
        const res = await fetch('/api/pengumuman/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          alert("Pengumuman berhasil dihapus!");
          fetchData();
        } else {
          alert("Gagal menghapus pengumuman.");
        }
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-blue-600">Manajemen Pengumuman</h2>
          <p className="text-sm text-gray-500">Kelola pengumuman penting untuk pegawai fronting.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-sm transition-colors text-sm"
        >
          + Buat Pengumuman
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="px-6 py-4">No</th>
              <th className="px-6 py-4">Judul Pengumuman</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Tanggal</th>
              <th className="px-6 py-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
            {dataList.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-500">Belum ada pengumuman.</td></tr>
            ) : (
              dataList.map((item, index) => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="px-6 py-4 text-center">{index + 1}</td>
                  <td className="px-6 py-4 font-semibold text-gray-900 truncate max-w-xs">{item.judul}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${item.status === 'AKTIF' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleOpenModal(item)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs mr-2">Edit</button>
                    <button onClick={() => handleDelete(item.id, item.judul)} className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold px-3 py-1.5 rounded transition-colors text-xs">Hapus</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 bg-gray-50 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-800">
                {editingId ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Judul Pengumuman <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={formData.judul}
                  onChange={(e) => setFormData({...formData, judul: e.target.value})}
                  required 
                  placeholder="Masukkan judul pengumuman..."
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Status <span className="text-red-500">*</span></label>
                <select 
                  value={formData.status} 
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  required
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AKTIF">Aktif</option>
                  <option value="TIDAK AKTIF">Tidak Aktif</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Isi Pengumuman <span className="text-red-500">*</span></label>
                <textarea 
                  rows={5}
                  value={formData.isi}
                  onChange={(e) => setFormData({...formData, isi: e.target.value})}
                  required
                  placeholder="Tuliskan isi pengumuman secara lengkap..."
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-gray-700">Lampiran File (Opsional - PDF/Gambar)</label>
                <input 
                  type="file" 
                  accept=".pdf, .jpg, .jpeg, .png" 
                  onChange={handleFileChange}
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1.5 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
                />
                {lampiranName && <p className="mt-1 text-xs text-green-600 font-medium">File baru: {lampiranName}</p>}
                {editingId && !lampiranName && existingLampiran && (
                  <p className="mt-1 text-xs text-blue-600 font-medium">File saat ini: {existingLampiran}</p>
                )}
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
                <button type="submit" disabled={isLoading} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {isLoading ? "Menyimpan..." : "Simpan Pengumuman"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 2. KOMPONEN UTAMA: DASHBOARD CONTENT
// ==========================================
function DashboardContent() {
  const { data: session, status } = useSession();
  const [isFrontlineOpen, setIsFrontlineOpen] = useState(false);
  const [currentView, setCurrentView] = useState("welcome");
  
  const [frontlineList, setFrontlineList] = useState([]);
  const [leadersList, setLeadersList] = useState([]);
  const [selectedData, setSelectedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [wilayahData, setWilayahData] = useState([]);
  const [selectedKanwil, setSelectedKanwil] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPenempatan, setSelectedPenempatan] = useState("");
  const [selectedLeader, setSelectedLeader] = useState("");

  const [idCardName, setIdCardName] = useState("");
  const [stNames, setStNames] = useState([]);
  const [qnaFileName, setQnaFileName] = useState("");

  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [isObCsOpen, setIsObCsOpen] = useState(false);
  const [isTeknisiOpen, setIsTeknisiOpen] = useState(false);

  // --- STATE UPLOAD FEE (EXCEL) ---
  const [feeFilterType, setFeeFilterType] = useState("");
  const [feeFilterValue, setFeeFilterValue] = useState("");
  const [feeExcelFile, setFeeExcelFile] = useState(null);
  const [isUploadingFee, setIsUploadingFee] = useState(false);

  // --- STATE LAPORAN & ADUAN (SUPER ADMIN) ---
  const [laporanList, setLaporanList] = useState([]);
  const [isLoadingLaporan, setIsLoadingLaporan] = useState(false);
  const [selectedLaporan, setSelectedLaporan] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replyMsg, setReplyMsg] = useState({ type: '', text: '' });

  // Tambahkan state halaman aktif
  const [currentPageListAkun, setCurrentPageListAkun] = useState(1);
  const [currentPagePenutupanAkun, setCurrentPagePenutupanAkun] = useState(1);
  const itemsPerPage = 10;

  // --- STATE PENCARIAN UNTUK PEMBUATAN & PENUTUPAN AKUN ---
  const [searchListAkun, setSearchListAkun] = useState("");
  const [searchPenutupanAkun, setSearchPenutupanAkun] = useState("");

  // State Baru
  const [nonFrontingList, setNonFrontingList] = useState([]);
  const [searchNonFronting, setSearchNonFronting] = useState("");
  const [pasFotoName, setPasFotoName] = useState("");
  const [suratTugasName, setSuratTugasName] = useState("");
  const [unitKerjaOptions, setUnitKerjaOptions] = useState([]);

  // TAMBAHKAN STATE INI:
  const [jabatanNonFronting, setJabatanNonFronting] = useState("");

  // Fungsi Fetch
  const fetchNonFrontingData = async () => {
    try {
      const res = await fetch('/super-admin/get-non-fronting');
      const result = await res.json();
      if (result.success) {
        setNonFrontingList(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil data non-fronting:", error);
    }
  };

  const fetchUnitKerjaData = async () => {
    try {
      const res = await fetch('/super-admin/get-unit-kerja');
      const result = await res.json();
      if (result.success) {
        setUnitKerjaOptions(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil data unit kerja:", error);
    }
  };

  // Helper untuk memisahkan Pertanyaan & Jawaban
  const parseDeskripsi = (desc) => {
    if (!desc) return { pertanyaan: '', jawaban: '' };
    const parts = desc.split('\n\nJawaban :\n');
    const rawPertanyaan = parts[0]?.replace('Pertanyaan :\n', '') || '';
    const rawJawaban = parts[1] || '';
    
    return {
      pertanyaan: rawPertanyaan,
      jawaban: rawJawaban.includes('[Menunggu balasan') ? '' : rawJawaban,
      isAnswered: !rawJawaban.includes('[Menunggu balasan') && rawJawaban.trim() !== ''
    };
  };

  // --- FILTER & PAGING UNTUK LIST AKUN ---
  const filteredListAkun = frontlineList.filter(item => {
    if (!searchListAkun) return true;
    const keyword = searchListAkun.toLowerCase();
    return (
      (item.nama && item.nama.toLowerCase().includes(keyword)) ||
      (item.username && item.username.toLowerCase().includes(keyword)) ||
      (item.nik && item.nik.toLowerCase().includes(keyword)) ||
      (item.penempatan && item.penempatan.toLowerCase().includes(keyword))
    );
  });

  // --- Paging untuk List Akun ---
  const indexOfLastItemAkun = currentPageListAkun * itemsPerPage;
  const indexOfFirstItemAkun = indexOfLastItemAkun - itemsPerPage;
  const currentListAkun = filteredListAkun.slice(indexOfFirstItemAkun, indexOfLastItemAkun);
  const totalPagesListAkun = Math.ceil(filteredListAkun.length / itemsPerPage);

  // --- FILTER & PAGING UNTUK PENUTUPAN AKUN ---
  const filteredPenutupanAkun = frontlineList.filter(item => {
    if (!searchPenutupanAkun) return true;
    const keyword = searchPenutupanAkun.toLowerCase();
    return (
      (item.nama && item.nama.toLowerCase().includes(keyword)) ||
      (item.username && item.username.toLowerCase().includes(keyword)) ||
      (item.nik && item.nik.toLowerCase().includes(keyword)) ||
      (item.penempatan && item.penempatan.toLowerCase().includes(keyword))
    );
  });

  // --- Paging untuk Penutupan Akun ---
  const indexOfLastItemPenutupan = currentPagePenutupanAkun * itemsPerPage;
  const indexOfFirstItemPenutupan = indexOfLastItemPenutupan - itemsPerPage;
  const currentPenutupanAkun = filteredPenutupanAkun.slice(indexOfFirstItemPenutupan, indexOfLastItemPenutupan);
  const totalPagesPenutupanAkun = Math.ceil(filteredPenutupanAkun.length / itemsPerPage);

  useEffect(() => {
    // Tambahkan 'upload-fee' agar data pegawai ditarik
    if (currentView === 'list-akun' || currentView === 'penutupan-akun' || currentView === 'upload-fee') {
      fetchFrontlineData();
    }
    // Tambahkan 'upload-fee' agar data wilayah dan leader ditarik
    if (currentView === 'form-tambah' || currentView === 'form-edit' || currentView === 'upload-fee') {
      fetchWilayahData();
      fetchLeadersData();
    }
    if (currentView === 'laporan-aduan') {
      fetchLaporanAduan();
    }
    if (['list-security', 'list-obcs', 'list-teknisi', 'create-non-fronting'].includes(currentView)) {
      fetchNonFrontingData();
    }
    // TAMBAHKAN BARIS INI: Tarik master unit kerja saat membuka form
    if (currentView === 'create-non-fronting') {
      fetchUnitKerjaData();
      setJabatanNonFronting(""); // Reset nilai saat masuk halaman
    }
  }, [currentView]);

  const handlePasFotoChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPasFotoName(e.target.files[0].name);
    }
  };
  const handleSuratTugasChangeNonFronting = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSuratTugasName(e.target.files[0].name);
    }
  };

  const handleNonFrontingSubmit = async (e) => {
    e.preventDefault(); 
    setIsLoading(true); 
    setSuccessMessage(""); 
    setErrorMessage("");

    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    try {
      const response = await fetch('/super-admin/create-non-fronting', { 
        method: 'POST', 
        body: formData 
      });
      const result = await response.json();
      
      if (result.success) {
        setSuccessMessage(`Akun berhasil dibuat!`);
        formElement.reset(); 
        setPasFotoName("");
        setSuratTugasName("");
        setTimeout(() => setSuccessMessage(""), 3000);

        // TAMBAHKAN BARIS INI:
        setJabatanNonFronting("");

      } else {
        setErrorMessage(result.message || "Gagal membuat akun."); 
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error) { 
      setErrorMessage("Terjadi kesalahan sistem."); 
      setTimeout(() => setErrorMessage(""), 5000); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
    if (currentView === 'form-edit' && selectedData) {
      setSelectedKanwil(selectedData.kanwil || "");
      setSelectedArea(selectedData.area || "");
      setSelectedPenempatan(selectedData.penempatan || "");
      setSelectedLeader(selectedData.leader || "");
      setStNames([]);
    } else if (currentView === 'form-tambah') {
      setSelectedKanwil("");
      setSelectedArea("");
      setSelectedPenempatan("");
      setSelectedLeader("");
      setStNames([]);
    }
  }, [currentView, selectedData]);

  const fetchLaporanAduan = async () => {
    setIsLoadingLaporan(true);
    try {
      const res = await fetch('/api/super-admin/laporan');
      const result = await res.json();
      if (result.success) {
        setLaporanList(result.data);
      }
    } catch (e) {
      console.error("Gagal menarik data laporan", e);
    } finally {
      setIsLoadingLaporan(false);
    }
  };

  const handleOpenLaporan = (item) => {
    setSelectedLaporan(item);
    const parsed = parseDeskripsi(item.deskripsi);
    setReplyText(parsed.jawaban);
    setReplyMsg({ type: '', text: '' });
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    setReplyMsg({ type: '', text: '' });

    try {
      const res = await fetch('/api/super-admin/laporan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLaporan.id,
          answer: replyText
        })
      });

      const result = await res.json();
      if (result.success) {
        setReplyMsg({ type: 'success', text: 'Balasan berhasil dikirim!' });
        
        setLaporanList(prev => prev.map(l => {
          if (l.id === selectedLaporan.id) {
            const parts = l.deskripsi.split('\n\nJawaban :\n');
            return { ...l, deskripsi: `${parts[0]}\n\nJawaban :\n${replyText}` };
          }
          return l;
        }));

        setTimeout(() => setSelectedLaporan(null), 1500); 
      } else {
        setReplyMsg({ type: 'error', text: result.message || 'Gagal mengirim balasan.' });
      }
    } catch (e) {
      setReplyMsg({ type: 'error', text: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  function Pagination({ currentPage, totalPages, onPageChange }) {
    if (totalPages <= 1) return null;

    // Logika untuk menampilkan maksimal 5 tombol halaman agar tidak terlalu panjang
    const getPageNumbers = () => {
      const pages = [];
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, currentPage + 2);

      if (currentPage <= 3) {
        endPage = Math.min(5, totalPages);
      } else if (currentPage >= totalPages - 2) {
        startPage = Math.max(1, totalPages - 4);
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      return pages;
    };

    return (
      <div className="flex flex-col sm:flex-row justify-between items-center mt-4 px-2 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg gap-3">
        <span className="text-xs text-gray-500">
          Menampilkan halaman <b>{currentPage}</b> dari <b>{totalPages}</b>
        </span>
        <div className="flex items-center gap-1">
          {/* Tombol Sebelumnya */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            &larr; Prev
          </button>

          {/* Tombol Nomor Halaman */}
          {getPageNumbers().map((num) => (
            <button
              key={num}
              onClick={() => onPageChange(num)}
              className={`px-3 py-1.5 border rounded text-xs font-semibold transition-colors ${
                currentPage === num
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              {num}
            </button>
          ))}

          {/* Tombol Selanjutnya */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    );
  }

  const fetchFrontlineData = async () => {
    try {
      const res = await fetch('/api/get-fronting/search');
      
      // Periksa apakah HTTP request berhasil (status 200-299)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const result = await res.json();
      console.log("Data API Frontline:", result); // Cek format data di Console Browser

      // Jika response memiliki struktur { success: true, data: [...] }
      if (result.success !== undefined) {
        if (result.success) {
          setFrontlineList(Array.isArray(result.data) ? result.data : []);
        } else {
          console.error("API gagal:", result.message);
        }
      } 
      // Jika response langsung berupa Array [ {...}, {...} ]
      else if (Array.isArray(result)) {
        setFrontlineList(result);
      } 
      // Jika format tidak dikenali
      else {
        console.warn("Format data tidak sesuai ekspektasi:", result);
        setFrontlineList([]);
      }
    } catch (error) { 
      console.error("Gagal mengambil data fronting:", error); 
    }
  };

  const fetchWilayahData = async () => {
    try {
      const res = await fetch('/api/get-wilayah');
      const result = await res.json();
      if (result.success) setWilayahData(Array.isArray(result.data) ? result.data : []);
    } catch (error) { console.error("Gagal mengambil data wilayah", error); }
  };

  const fetchLeadersData = async () => {
    try {
      const res = await fetch('/api/leaders');
      if (res.ok) {
        const data = await res.json();
        setLeadersList(Array.isArray(data) ? data : []);
      }
    } catch (error) { console.error("Gagal mengambil data leader", error); }
  };

  const kanwilOptions = Array.from(new Set(wilayahData.map(item => item?.kanwil).filter(Boolean)));
  const areaOptions = Array.from(new Set(wilayahData.filter(item => item?.kanwil === selectedKanwil).map(item => item?.area).filter(Boolean)));
  const penempatanOptions = Array.from(new Set(wilayahData.filter(item => item?.kanwil === selectedKanwil && item?.area === selectedArea).map(item => item?.penempatan).filter(Boolean)));

  const parseJSON = (data) => { 
    try { return typeof data === 'string' ? JSON.parse(data) : (Array.isArray(data) ? data : []); } 
    catch { return []; } 
  };

  const filteredLeaders = leadersList.filter(leader => {
    if (!selectedKanwil || !selectedArea || !selectedPenempatan) return false;
    const kArr = parseJSON(leader.kanwil);
    const aArr = parseJSON(leader.area);
    const pArr = parseJSON(leader.penempatan);

    return kArr.includes(selectedKanwil) && aArr.includes(selectedArea) && pArr.includes(selectedPenempatan);
  });

  const handleEdit = (item) => { setSelectedData(item); setCurrentView("form-edit"); };

  if (status === "loading") return <div className="flex h-screen items-center justify-center bg-gray-100 text-gray-600 font-medium">Memuat sesi...</div>;
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-gray-100">
        <p className="text-red-500 font-semibold">Anda belum login sebagai Super Admin.</p>
        <a href="/api/auth/signin" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">Login Sekarang</a>
      </div>
    );
  }

  const handleIdCardChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) { alert("Format ID Card harus JPG atau PNG!"); e.target.value = ""; setIdCardName(""); return; }
      setIdCardName(file.name);
    }
  };

  const handleStChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 3) {
      alert("Maksimal hanya 3 file Surat Tugas yang dapat dipilih!");
      e.target.value = "";
      setStNames([]);
      return;
    }
    for (let file of files) {
      if (file.type !== 'application/pdf') {
        alert("Semua file Surat Tugas harus berformat PDF!");
        e.target.value = "";
        setStNames([]);
        return;
      }
    }
    setStNames(files.map(f => f.name));
  };

  const handleQnaFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) { alert("Format materi tidak didukung!"); e.target.value = ""; setQnaFileName(""); return; }
      setQnaFileName(file.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsLoading(true); setSuccessMessage(""); setErrorMessage("");
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    const endpoint = currentView === 'form-edit' ? '/super-admin/edit-account' : '/super-admin/create-account';
    if (currentView === 'form-edit' && selectedData) formData.append('id', String(selectedData.id));

    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage(result.message);
        formElement.reset(); setIdCardName(""); setStNames([]); setSelectedKanwil(""); setSelectedArea(""); setSelectedPenempatan(""); setSelectedLeader("");
        setTimeout(() => { setCurrentView("list-akun"); setSuccessMessage(""); }, 1500);
      } else {
        setErrorMessage(result.message); setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error) { setErrorMessage("Terjadi kesalahan sistem."); setTimeout(() => setErrorMessage(""), 5000); } finally { setIsLoading(false); }
  };

  const handleQnaSubmit = async (e) => {
    e.preventDefault(); setIsLoading(true); setSuccessMessage(""); setErrorMessage("");
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);
    try {
      const response = await fetch('/super-admin/upload-qna', { method: 'POST', body: formData });
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) throw new Error("Bukan JSON");
      const result = await response.json();
      if (result.success) {
        setSuccessMessage("Materi QnA berhasil diunggah!");
        formElement.reset(); setQnaFileName(""); setTimeout(() => setSuccessMessage(""), 3000);
      } else {
        setErrorMessage(result.message || "Gagal mengunggah."); setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error) { setErrorMessage("Kesalahan sistem saat mengunggah."); setTimeout(() => setErrorMessage(""), 5000); } finally { setIsLoading(false); }
  };

  const handleUploadFee = async (e) => {
    if (e) e.preventDefault();
    if (!feeFilterType || !feeFilterValue || !feeExcelFile) {
      setErrorMessage("Lengkapi filter dan pilih file Excel!");
      setTimeout(() => setErrorMessage(""), 4000);
      return;
    }

    setIsUploadingFee(true);
    const formData = new FormData();
    formData.append('file', feeExcelFile);
    formData.append('filterType', feeFilterType);
    formData.append('filterValue', feeFilterValue);

    try {
      const res = await fetch('/api/keuangan/upload-excel', { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.success) {
        setSuccessMessage("Berhasil: " + data.message);
        
        // Reset form setelah berhasil
        setFeeExcelFile(null);
        setFeeFilterType("");
        setFeeFilterValue("");
        
        // Kosongkan input file secara manual
        const fileInput = document.getElementById('excel-fee-upload');
        if (fileInput) fileInput.value = '';

        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        setErrorMessage("Gagal: " + data.message);
        setTimeout(() => setErrorMessage(""), 5000);
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Terjadi kesalahan sistem saat mengunggah file.");
      setTimeout(() => setErrorMessage(""), 5000);
    } finally {
      setIsUploadingFee(false);
    }
  };

  // --- DATA UNIK UNTUK FILTER UPLOAD FEE (Persis seperti Dashboard Keuangan) ---
  const uniqueAreasFinance = [...new Set(wilayahData.map(item => item?.area).filter(Boolean))];
  const uniqueLeadersFinance = [...new Set(leadersList.map(item => item?.nama_leader).filter(Boolean))];

  const getSubMenuClass = (viewName) => `block px-4 py-2 text-sm rounded transition-colors ${currentView === viewName ? 'text-white font-bold bg-gray-800' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <div className="w-72 bg-gray-900 text-white flex flex-col">
        <div className="p-6 text-xl font-bold border-b border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors" onClick={() => setCurrentView("welcome")}>
          <span>SUPER ADMIN</span>
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          <div className="text-xs text-gray-500 font-bold uppercase mb-4 px-2">Menu</div>
          <ul className="space-y-1">
            <li>
              <button onClick={() => setIsFrontlineOpen(!isFrontlineOpen)} className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 text-white rounded-md transition-colors" type="button">
                <span>Fronting</span><span>{isFrontlineOpen ? '▼' : '◀'}</span>
              </button>
              {isFrontlineOpen && (
                <ul className="mt-1 ml-4 pl-4 border-l border-gray-700 space-y-1">
                  <li><button onClick={() => setCurrentView("upload-produk")} className={`w-full text-left ${getSubMenuClass("upload-produk")}`}>Upload Produk / Promo</button></li>
                  <li><button onClick={() => setCurrentView("pengumuman")} className={`w-full text-left ${getSubMenuClass("pengumuman")}`}>Pengumuman</button></li>
                  <li><button onClick={() => setCurrentView("upload-qna")} className={`w-full text-left ${getSubMenuClass("upload-qna")}`}>Upload QnA</button></li>
                  <li><button onClick={() => setCurrentView("upload-konten")} className={`w-full text-left ${getSubMenuClass("upload-konten")}`}>Upload Konten</button></li>
                  <li><button onClick={() => setCurrentView("upload-fee")} className={`w-full text-left ${getSubMenuClass("upload-fee")}`}>Upload Jml Fee Pribadi</button></li>
                  <li><button onClick={() => setCurrentView("create-leader")} className={`w-full text-left ${getSubMenuClass("create-leader")}`}>Create Leader</button></li>
                </ul>
              )}
            </li>
            <li className="mt-2"><button onClick={() => setCurrentView("list-akun")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'list-akun' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Pembuatan Akun</button></li>
            <li><button onClick={() => setCurrentView("penutupan-akun")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'penutupan-akun' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Penutupan Akun</button></li>

            {/* MENU BARU: LAPORAN & ADUAN PEGAWAI */}
            <li><button onClick={() => setCurrentView("laporan-aduan")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'laporan-aduan' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>Laporan & Aduan Pegawai</button></li>

            <li>
              <button 
                onClick={() => setCurrentView("reset-data")} 
                className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'reset-data' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                Manajemen Reset Data
              </button>
            </li>

            {/* MENU BARU: PEMBUATAN AKUN NON-FRONTING */}
            <li className="mt-2">
              <button onClick={() => setCurrentView("create-non-fronting")} className={`w-full text-left px-4 py-3 rounded-md transition-colors ${currentView === 'create-non-fronting' ? 'bg-gray-800 text-white font-bold' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                Pembuatan Akun Non-Fronting
              </button>
            </li>

            {/* KATEGORI: SECURITY / DRIVER */}
            <li>
              <button onClick={() => setIsSecurityOpen(!isSecurityOpen)} className={`w-full flex items-center justify-between px-6 py-3 transition-colors ${isSecurityOpen ? 'bg-[#1e2532] text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`} type="button">
                <span className="text-sm">Security / Driver</span>
                <span className="text-[10px]">{isSecurityOpen ? '◀' : '▼'}</span>
              </button>
              {isSecurityOpen && (
                <ul className="bg-[#111622] py-1">
                  <li><button onClick={() => setCurrentView("list-security")} className={`w-full text-left pl-10 pr-4 py-2.5 text-xs transition-colors ${currentView === 'list-security' ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}>Data Pegawai</button></li>
                </ul>
              )}
            </li>

            {/* KATEGORI: OB / CS */}
            <li>
              <button onClick={() => setIsObCsOpen(!isObCsOpen)} className={`w-full flex items-center justify-between px-6 py-3 transition-colors ${isObCsOpen ? 'bg-[#1e2532] text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`} type="button">
                <span className="text-sm">OB / CS</span>
                <span className="text-[10px]">{isObCsOpen ? '◀' : '▼'}</span>
              </button>
              {isObCsOpen && (
                <ul className="bg-[#111622] py-1">
                  <li><button onClick={() => setCurrentView("list-obcs")} className={`w-full text-left pl-10 pr-4 py-2.5 text-xs transition-colors ${currentView === 'list-obcs' ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}>Data Pegawai</button></li>
                </ul>
              )}
            </li>

            {/* KATEGORI: TEKNISI */}
            <li>
              <button onClick={() => setIsTeknisiOpen(!isTeknisiOpen)} className={`w-full flex items-center justify-between px-6 py-3 transition-colors ${isTeknisiOpen ? 'bg-[#1e2532] text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`} type="button">
                <span className="text-sm">Teknisi</span>
                <span className="text-[10px]">{isTeknisiOpen ? '◀' : '▼'}</span>
              </button>
              {isTeknisiOpen && (
                <ul className="bg-[#111622] py-1">
                  <li><button onClick={() => setCurrentView("list-teknisi")} className={`w-full text-left pl-10 pr-4 py-2.5 text-xs transition-colors ${currentView === 'list-teknisi' ? 'text-white font-medium' : 'text-gray-400 hover:text-white'}`}>Data Pegawai</button></li>
                </ul>
              )}
            </li>
          </ul>
        </div>
        <div className="p-4 border-t border-gray-700">
          <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md text-sm transition-colors" type="button">Logout</button>
        </div>
      </div>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="mb-8 border-b pb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {currentView === 'welcome' && 'Dashboard Super Admin'}
            {currentView === 'list-akun' && 'Manajemen Akun Fronting'}
            {(currentView === 'form-tambah' || currentView === 'form-edit') && 'Form Registrasi / Edit Akun'}
            {currentView === 'upload-qna' && 'Upload Materi QnA'}
            {currentView === 'penutupan-akun' && 'Penutupan Akun'}
            {currentView === 'create-leader' && 'Manajemen Data Leader'}
            {currentView === 'laporan-aduan' && 'Laporan & Aduan Pegawai'}
            {currentView === 'create-non-fronting' && 'Pembuatan Akun Non-Fronting'}
            {['list-security', 'list-obcs', 'list-teknisi'].includes(currentView) && 'Data Pegawai Non-Fronting'}
            {currentView !== 'welcome' && currentView !== 'list-akun' && currentView !== 'form-tambah' && currentView !== 'form-edit' && currentView !== 'upload-qna' && currentView !== 'penutupan-akun' && currentView !== 'create-leader' && currentView !== 'laporan-aduan' && currentView !== 'create-non-fronting' && !['list-security', 'list-obcs', 'list-teknisi'].includes(currentView) && 'Manajemen Sistem'}
          </h1>
          <span className="text-sm text-gray-600">Login sebagai: <b>{session?.user?.name || 'Super Admin'}</b></span>
        </div>

        {currentView === 'welcome' && (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="max-w-xl mx-auto py-8">
              <div className="text-blue-600 text-6xl mb-4">🚀</div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Selamat datang di halaman dashboard super admin</h2>
              <p className="text-gray-600">Silakan pilih menu <b>Fronting &gt; Pembuatan Akun</b> untuk mengelola data pegawai, atau menu <b>Create Leader</b> untuk data leader.</p>
            </div>
          </div>
        )}

        {currentView === 'upload-produk' && <UploadProdukView />}

        {currentView === 'pengumuman' && <PengumumanView />}

        {currentView === 'create-leader' && <CreateLeaderView />}

        {currentView === 'list-akun' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-blue-600">Daftar Akun Fronting</h2>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input 
                  type="text"
                  value={searchListAkun}
                  onChange={(e) => {
                    setSearchListAkun(e.target.value);
                    setCurrentPageListAkun(1); // Reset ke halaman 1 saat mengetik pencarian
                  }}
                  placeholder="Cari nama, NIK, atau username..."
                  className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={() => { setSelectedData(null); setCurrentView("form-tambah"); }} className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition-colors flex items-center justify-center gap-2">
                  + Tambah Data Fronting
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kanwil / Area</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Penempatan</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentListAkun.length > 0 ? (
                    currentListAkun.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.nama}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.kanwil} / {item.area}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.penempatan}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button onClick={() => handleEdit(item)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1 rounded transition-colors">Edit</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">Belum ada data fronting yang terdaftar.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Paging untuk List Akun */}
            <Pagination 
              currentPage={currentPageListAkun} 
              totalPages={totalPagesListAkun} 
              onPageChange={(page) => setCurrentPageListAkun(page)} 
            />
          </div>
        )}

        {(currentView === 'form-tambah' || currentView === 'form-edit') && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-blue-600">
                {currentView === 'form-edit' ? 'Edit Data Akun Fronting' : 'Form Registrasi Akun Fronting'}
              </h2>
              <button onClick={() => setCurrentView("list-akun")} className="text-sm text-gray-500 hover:text-gray-700 font-medium">&larr; Kembali ke Daftar</button>
            </div>
            
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6" autoComplete="off">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input type="text" name="nama" defaultValue={selectedData?.nama || ""} required className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md" placeholder="Nama Lengkap" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIK</label>
                  <input type="text" name="nik" defaultValue={selectedData?.nik || ""} required className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md" placeholder="NIK" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kanwil</label>
                    <SearchableSelect 
                      name="kanwil" 
                      options={kanwilOptions} 
                      value={selectedKanwil} 
                      onChange={(val) => { 
                        setSelectedKanwil(val); 
                        setSelectedArea(""); 
                        setSelectedPenempatan(""); 
                        setSelectedLeader("");
                      }} 
                      placeholder="Pilih/ketik Kanwil..." 
                      required={true} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                    <SearchableSelect 
                      name="area" 
                      options={areaOptions} 
                      value={selectedArea} 
                      onChange={(val) => { 
                        setSelectedArea(val); 
                        setSelectedPenempatan(""); 
                        setSelectedLeader("");
                      }} 
                      placeholder={selectedKanwil ? "Pilih/ketik Area..." : "Pilih Kanwil dulu"} 
                      required={true} 
                      disabled={!selectedKanwil} 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Penempatan</label>
                    <SearchableSelect 
                      name="penempatan" 
                      options={penempatanOptions} 
                      value={selectedPenempatan} 
                      onChange={(val) => {
                        setSelectedPenempatan(val);
                        setSelectedLeader("");
                      }} 
                      placeholder={selectedArea ? "Pilih/ketik Lokasi..." : "Pilih Area dulu"} 
                      required={true} 
                      disabled={!selectedArea} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leader</label>
                    <select 
                      name="leader" 
                      value={selectedLeader} 
                      onChange={(e) => setSelectedLeader(e.target.value)}
                      required 
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md disabled:bg-gray-100"
                      disabled={!selectedPenempatan}
                    >
                      <option value="">
                        {!selectedPenempatan 
                          ? "Pilih Penempatan dulu..." 
                          : (filteredLeaders.length === 0 && !selectedLeader ? "Tidak ada leader di lokasi ini" : "Pilih Leader...")}
                      </option>
                      {filteredLeaders.map((leader, idx) => (
                        <option key={idx} value={leader.nama_leader}>{leader.nama_leader}</option>
                      ))}
                      {selectedLeader && !filteredLeaders.some(l => l.nama_leader === selectedLeader) && (
                        <option value={selectedLeader}>{selectedLeader}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Email</label>
                  <input type="email" name="email" defaultValue={selectedData?.email || ""} required className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md" placeholder="name@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. WhatsApp</label>
                  <input type="tel" name="nowa" defaultValue={selectedData?.nowa || ""} required className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md" placeholder="08..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                    <input type="text" name="nama_bank" defaultValue={selectedData?.nama_bank || ""} required className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md" placeholder="Contoh: BCA / Mandiri" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Rekening</label>
                    <input type="text" name="norek" defaultValue={selectedData?.norek || ""} required className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md" placeholder="Nomor Rekening" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload ID Card (JPG/PNG)</label>
                  <input type="file" name="idcard_file" accept=".jpg, .jpeg, .png" onChange={handleIdCardChange} {...(currentView === 'form-tambah' ? { required: true } : {})} className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900" />
                  {idCardName && (<p className="mt-1 text-sm text-green-600 font-medium">File baru: {idCardName}</p>)}
                  {currentView === 'form-edit' && !idCardName && selectedData?.idcard_file && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">File saat ini: {selectedData.idcard_file}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Upload Surat Tugas (PDF - Maksimal 3 File)</label>
                  <input 
                    type="file" 
                    name="st_file" 
                    accept=".pdf" 
                    multiple 
                    onChange={handleStChange} 
                     {...(currentView === 'form-tambah' ? { required: true } : {})} 
                    className="w-full p-2 border border-gray-300 rounded-md bg-white text-gray-900" 
                  />
                  {stNames.length > 0 && (
                    <div className="mt-1 text-sm text-green-600 font-medium">
                      File baru terpilih ({stNames.length}/3):
                      <ul className="list-disc list-inside text-xs">
                        {stNames.map((name, i) => <li key={i}>{name}</li>)}
                      </ul>
                    </div>
                  )}
                  {currentView === 'form-edit' && stNames.length === 0 && selectedData?.st_file && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">File saat ini: {selectedData.st_file}</div>
                  )}
                </div>

                {/* --- PENGAMAN AUTOCOMPLETE & BINDING DATA EDIT --- */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username Akun</label>
                    <input
                      type="text"
                      name="username"
                      // Tambahkan defaultValue agar data muncul saat Edit
                      defaultValue={selectedData?.username || ""} 
                      autoComplete="off"
                      required
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                      placeholder="Masukkan username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password Akun 
                      {currentView === 'form-edit' && <span className="text-[10px] text-gray-400 ml-2">(Kosongkan jika tidak ingin mengubah)</span>}
                    </label>
                    <input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      readOnly
                      onFocus={(e) => e.target.removeAttribute('readOnly')}
                      // Tidak perlu defaultValue untuk password saat edit karena password tidak boleh ditampilkan
                      required={currentView === 'form-tambah'} 
                      className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md"
                      placeholder={currentView === 'form-edit' ? "********" : "Masukkan password baru"}
                    />
                  </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:bg-blue-300">
                  {isLoading ? 'Memproses...' : (currentView === 'form-edit' ? 'Simpan Perubahan' : 'Create Account')}
                </button>
              </div>
            </form>
          </div>
        )}

        {currentView === 'penutupan-akun' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-red-600">Penutupan Akun Fronting</h2>
                <p className="text-sm text-gray-500">Pilih akun yang ingin ditutup atau dihapus.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                <input 
                  type="text"
                  value={searchPenutupanAkun}
                  onChange={(e) => {
                    setSearchPenutupanAkun(e.target.value);
                    setCurrentPagePenutupanAkun(1); // Reset ke halaman 1 saat mengetik pencarian
                  }}
                  placeholder="Cari nama, NIK, atau username..."
                  className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button onClick={fetchFrontlineData} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors">🔄 Muat Ulang</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Penempatan</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi Penutupan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentPenutupanAkun.length > 0 ? (
                    currentPenutupanAkun.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.nama}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.penempatan}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <button 
                            onClick={async () => {
                              if (confirm(`Yakin ingin menutup/menghapus akun "${item.nama}"?`)) {
                                try {
                                  const res = await fetch('/super-admin/close-account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
                                  const result = await res.json();
                                  if (result.success) { alert(result.message); fetchFrontlineData(); } else { alert(result.message || "Gagal menutup akun."); }
                                } catch (err) { alert("Terjadi kesalahan sistem."); }
                              }
                            }}
                            className="bg-red-50 text-red-600 hover:bg-red-100 font-semibold px-3 py-1 rounded transition-colors text-xs"
                          >Tutup Akun</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Tidak ada data.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Paging untuk Penutupan Akun */}
            <Pagination 
              currentPage={currentPagePenutupanAkun} 
              totalPages={totalPagesPenutupanAkun} 
              onPageChange={(page) => setCurrentPagePenutupanAkun(page)} 
            />
          </div>
        )}

        {/* TAMPILAN LAPORAN & ADUAN KHUSUS SUPER ADMIN */}
        {currentView === 'laporan-aduan' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-800 p-5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📥 Kotak Masuk Aduan & Laporan Sistem
              </h2>
            </div>
            
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 border-b border-gray-200 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-bold">Tgl. Laporan</th>
                    <th className="px-6 py-4 font-bold">Judul / Pengirim</th>
                    <th className="px-6 py-4 font-bold text-center">Lampiran</th>
                    <th className="px-6 py-4 font-bold text-center">Status</th>
                    <th className="px-6 py-4 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isLoadingLaporan ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400 animate-pulse">Memuat laporan...</td></tr>
                  ) : laporanList.length > 0 ? (
                    laporanList.map((item) => {
                      const { isAnswered } = parseDeskripsi(item.deskripsi);
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                            {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            {item.judul}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {item.file_name ? <span className="text-xl" title="Ada Lampiran">📎</span> : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {isAnswered ? 'Dijawab' : 'Menunggu'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleOpenLaporan(item)}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-colors"
                            >
                              Lihat & Balas
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                        <span className="text-3xl block mb-2">📬</span>
                        Belum ada laporan atau aduan yang ditujukan untuk Super Admin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === 'reset-data' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Reset Data Mingguan</h2>
            <p className="text-sm text-gray-500 mb-6">
              Menu ini digunakan untuk mengosongkan seluruh data pada tabel <b>entri_data_perkiraan_pemasukan</b> dan <b>transaksi_gaji</b> serta mereset nomor ID kembali ke awal.
            </p>

            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 text-sm text-red-800">
              ⚠️ <b>Peringatan:</b> Tindakan ini bersifat permanen dan data yang sudah dihapus tidak dapat dikembalikan.
            </div>

            <button
              onClick={async () => {
                if (confirm("Apakah Anda yakin ingin mengosongkan data perkiraan pemasukan dan transaksi gaji sekarang?")) {
                  try {
                    const res = await fetch('/api/super-admin/reset-tables', { method: 'POST' });
                    const result = await res.json();
                    if (result.success) {
                      setSuccessMessage(result.message);
                      setTimeout(() => setSuccessMessage(""), 4000);
                    } else {
                      setErrorMessage(result.message || "Gagal mereset data.");
                      setTimeout(() => setErrorMessage(""), 5000);
                    }
                  } catch (err) {
                    setErrorMessage("Terjadi kesalahan sistem.");
                    setTimeout(() => setErrorMessage(""), 5000);
                  }
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-lg transition-colors text-sm shadow-sm"
            >
              🗑️ Kosongkan Kedua Tabel Sekarang
            </button>
          </div>
        )}

        {/* MODAL BACA & BALAS LAPORAN */}
        {selectedLaporan && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
              <div className="bg-gray-900 text-white p-5 flex justify-between items-center shrink-0">
                <h3 className="text-lg font-bold">Detail Aduan / Kendala</h3>
                <button 
                  onClick={() => setSelectedLaporan(null)}
                  className="text-gray-400 hover:text-white text-xl font-bold transition-colors focus:outline-none"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Judul / Identitas</h4>
                  <p className="text-base font-bold text-gray-800">{selectedLaporan.judul}</p>
                </div>

                <div className="mb-6">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Isi Pesan / Pertanyaan</h4>
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-gray-800 text-sm whitespace-pre-line leading-relaxed">
                    {parseDeskripsi(selectedLaporan.deskripsi).pertanyaan}
                  </div>
                </div>

                {selectedLaporan.file_name && (
                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lampiran Foto</h4>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 truncate mr-4">📎 {selectedLaporan.file_name}</span>
                      <a 
                        href={`/uploads/qna/${selectedLaporan.file_name}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-4 py-2 rounded shadow transition-colors whitespace-nowrap"
                      >
                        Buka Lampiran
                      </a>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    💬 Berikan Balasan (Tindak Lanjut Sistem)
                  </h4>
                  
                  {replyMsg.text && (
                    <div className={`p-3 rounded-lg mb-4 text-xs font-bold ${replyMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {replyMsg.text}
                    </div>
                  )}

                  <form onSubmit={handleSubmitReply}>
                    <textarea 
                      required
                      rows={5}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Ketik jawaban atau solusi sistem di sini..."
                      className="w-full border border-gray-300 rounded-xl p-4 text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50 focus:bg-white transition-colors resize-y mb-4"
                    ></textarea>
                    
                    <div className="flex justify-end gap-3">
                      <button 
                        type="button" 
                        onClick={() => setSelectedLaporan(null)}
                        className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                      <button 
                        type="submit" 
                        disabled={isSubmittingReply || !replyText.trim()}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmittingReply ? 'Menyimpan...' : 'Simpan Balasan'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: FORM PEMBUATAN AKUN NON-FRONTING KONSOLIDASI */}
        {currentView === 'create-non-fronting' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-5xl mx-auto">
            <div className="mb-6 border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800 uppercase tracking-wide">DATA PEGAWAI PT TRAYA LANGGENG MANDIRI</h2>
              <p className="text-sm text-gray-500">Registrasi akun Non-Fronting Terpusat</p>
            </div>
            
            <form onSubmit={handleNonFrontingSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6" autoComplete="off">
              {/* KOLOM KIRI */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">NAMA LENGKAP PEGAWAI <span className="text-red-500">*</span></label>
                  <input type="text" name="nama" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">NIK KTP <span className="text-red-500">*</span></label>
                  <p className="text-[10px] text-gray-500 mb-1 italic">Harap mengisi dengan 16 digit angka pada nomor induk kependudukan</p>
                  <input type="text" name="nik" required minLength={16} maxLength={16} className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">JENIS KELAMIN <span className="text-red-500">*</span></label>
                  <select name="jenis_kelamin" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">-- Pilih Jenis Kelamin --</option>
                    <option value="LAKI - LAKI">LAKI - LAKI</option>
                    <option value="PEREMPUAN">PEREMPUAN</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">AREA PENEMPATAN <span className="text-red-500">*</span></label>
                  <input type="text" name="area_penempatan" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ALAMAT AREA PENEMPATAN <span className="text-red-500">*</span></label>
                  <input type="text" name="alamat_area_penempatan" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">STATUS PERNIKAHAN <span className="text-red-500">*</span></label>
                    <select name="status_pernikahan" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Pilih...</option>
                      <option value="LAJANG">LAJANG</option>
                      <option value="NIKAH">NIKAH</option>
                      <option value="CERAI MATI">CERAI MATI</option>
                      <option value="JANDA">JANDA</option>
                      <option value="DUDA">DUDA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">GOLONGAN DARAH</label>
                    <input type="text" name="golongan_darah" className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">JABATAN <span className="text-red-500">*</span></label>
                  <select 
                    name="jabatan" 
                    required 
                    value={jabatanNonFronting} 
                    onChange={(e) => setJabatanNonFronting(e.target.value)} 
                    className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Pilih Jabatan --</option>
                    <option value="SPV">SPV</option>
                    <option value="PEGAWAI">PEGAWAI</option>
                  </select>
                </div>

                {/* LOGIKA KONDISIONAL DIMULAI DI SINI */}
                {jabatanNonFronting === 'PEGAWAI' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">SUPERVISOR <span className="text-red-500">*</span></label>
                      <select name="supervisor" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Pilih Supervisor --</option>
                          {(() => {
                            // Filter data secara aman (hapus spasi, ubah ke kapital)
                            const spvList = nonFrontingList.filter(item => {
                              const jab = (item.jabatan || '').trim().toLowerCase();
                              return jab === 'supervisor' || jab === 'spv';
                            });

                            // Jika ternyata belum ada data SPV di database
                            if (spvList.length === 0) {
                              return <option value="" disabled>⚠ Belum ada data Supervisor di database</option>;
                            }

                            // Jika ada, tampilkan listnya
                            return spvList.map(spv => (
                              <option key={spv.id} value={spv.nama}>
                                {spv.nama} - {spv.area_penempatan || spv.unit_kerja}
                              </option>
                            ));
                          })()}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">UNIT KERJA <span className="text-red-500">*</span></label>
                      <select name="unit_kerja" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">-- Pilih Unit Kerja --</option>
                        {unitKerjaOptions.map((unit) => (
                          <option key={unit.id} value={unit.nama_unit}>
                            {unit.nama_unit}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              
              {/* KOLOM KANAN */}
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-700 mb-1">MASA KERJA <span className="text-red-500">*</span></label>
                    <input type="text" name="masa_kerja" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">MASA KONTRAK</label>
                    <input type="text" name="masa_kontrak" className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">TANGGAL MULAI KERJA</label>
                    <input type="date" name="tanggal_mulai_kerja" className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">TANGGAL LAHIR <span className="text-red-500">*</span></label>
                    <input type="date" name="tanggal_lahir" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">TEMPAT LAHIR <span className="text-red-500">*</span></label>
                  <input type="text" name="tempat_lahir" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">DOMISILI SAAT INI <span className="text-red-500">*</span></label>
                  <input type="text" name="domisili" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">NO WHATSAPP <span className="text-red-500">*</span></label>
                    <input type="text" name="no_whatsapp" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">EMAIL <span className="text-red-500">*</span></label>
                    <input type="email" name="email" required className="w-full p-2.5 bg-gray-50 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    <label className="block text-xs font-bold text-gray-700 mb-2">PAS FOTO <span className="text-red-500">*</span></label>
                    <input type="file" name="pas_foto" accept="image/*" onChange={handlePasFotoChange} required className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" />
                    {pasFotoName && <p className="mt-2 text-[10px] text-green-700 font-bold truncate">✓ {pasFotoName}</p>}
                  </div>
                  <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                    <label className="block text-xs font-bold text-gray-700 mb-2">SURAT TUGAS <span className="text-red-500">*</span></label>
                    <p className="text-[9px] text-gray-500 italic mb-2">Harap upload file pdf</p>
                    <input type="file" name="surat_tugas" accept=".pdf" onChange={handleSuratTugasChangeNonFronting} required className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer" />
                    {suratTugasName && <p className="mt-2 text-[10px] text-green-700 font-bold truncate">✓ {suratTugasName}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">USERNAME LOGIN <span className="text-red-500">*</span></label>
                    <input type="text" name="username" autoComplete="off" required className="w-full p-2.5 bg-gray-100 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-gray-400 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">PASSWORD LOGIN <span className="text-red-500">*</span></label>
                    <input type="password" name="password" autoComplete="new-password" required className="w-full p-2.5 bg-gray-100 text-gray-900 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-gray-400 font-medium" />
                  </div>
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoading ? 'Menyimpan...' : 'Submit Form Pegawai'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* VIEW: LIST PEGAWAI NON-FRONTING PER KATEGORI */}
        {['list-security', 'list-obcs', 'list-teknisi'].includes(currentView) && (() => {
          const filteredList = nonFrontingList.filter(item => {
            // Filter Berdasarkan Unit Kerja Menu
            let matchRole = false;
            if (currentView === 'list-security') matchRole = ['SECURITY', 'DRIVER'].includes(item.unit_kerja);
            if (currentView === 'list-obcs') matchRole = ['OFFICE BOY', 'CS ( CLEANING SERVICE)', 'RESEPSIONIS'].includes(item.unit_kerja);
            if (currentView === 'list-teknisi') matchRole = ['TEKNISI'].includes(item.unit_kerja);
            
            // Pencarian Teks
            if (searchNonFronting) {
              const kw = searchNonFronting.toLowerCase();
              return matchRole && (item.nama.toLowerCase().includes(kw) || item.nik.toLowerCase().includes(kw));
            }
            return matchRole;
          });

          return (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-blue-600">
                    Data Pegawai - {currentView === 'list-security' ? 'Security & Driver' : currentView === 'list-obcs' ? 'OB, CS & Resepsionis' : 'Teknisi'}
                  </h2>
                </div>
                <div className="flex gap-3">
                  <input 
                    type="text" value={searchNonFronting} onChange={(e) => setSearchNonFronting(e.target.value)}
                    placeholder="Cari nama atau NIK..."
                    className="w-full md:w-72 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button onClick={fetchNonFrontingData} className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors">🔄 Reload</button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Nama Lengkap</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">NIK</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Unit / Area</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Username Login</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredList.length > 0 ? filteredList.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.nama}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{item.nik}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <span className="font-semibold text-gray-800">{item.unit_kerja}</span><br/>
                          <span className="text-xs text-gray-500">{item.area_penempatan}</span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-blue-600">{item.username}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">Tidak ada data pegawai di unit ini.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {currentView === 'upload-qna' && (
          <div className="bg-white rounded-xl shadow-sm p-6 max-w-2xl border border-gray-100">
            <h2 className="text-lg font-semibold text-blue-600 mb-4">Upload Materi QnA Baru</h2>
            <form onSubmit={handleQnaSubmit} className="space-y-4">
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Judul Materi</label>
                <input 
                  type="text" 
                  name="judul" 
                  required 
                  // Penambahan warna teks dan placeholder
                  className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-50 text-gray-900 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  placeholder="Masukkan judul QnA..." 
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Kategori</label>
                <select 
                  name="kategori" 
                  required 
                  // Penambahan warna teks
                  className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-50 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="" className="text-gray-500">Pilih Kategori...</option>
                  <option value="Produk">Produk</option>
                  <option value="Promo">Promo / Campaign</option>
                  <option value="Sistem">Sistem / Kendala Teknis</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi Tambahan</label>
                <textarea 
                  name="deskripsi" 
                  rows={3} 
                  // Penambahan warna teks dan placeholder
                  className="w-full p-2.5 border border-gray-300 rounded-md bg-gray-50 text-gray-900 placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  placeholder="Catatan tambahan (opsional)..."
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">File Dokumen</label>
                <input 
                  type="file" 
                  name="qna_file" 
                  onChange={handleQnaFileChange} 
                  required 
                  // Penambahan warna agar tombol file-nya terlihat rapi
                  className="w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-900 text-sm file:mr-4 file:py-1 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" 
                />
                {qnaFileName && <p className="mt-1 text-xs text-green-600 font-medium">File terpilih: {qnaFileName}</p>}
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading} 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isLoading ? 'Mengunggah...' : '📤 Upload Materi QnA'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW: UPLOAD JUMLAH FEE PRIBADI */}
        {currentView === 'upload-fee' && (
          <div className="space-y-6 max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-800">Upload Jumlah Fee Pribadi</h2>
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <select 
                  value={feeFilterType} 
                  onChange={e => {
                    setFeeFilterType(e.target.value);
                    setFeeFilterValue(''); // Reset pilihan target jika filter berubah
                  }} 
                  className="p-2 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Pilih Kategori Filter --</option>
                  <option value="area">Area Tertentu</option>
                  <option value="pegawai">Per Spesifik Pegawai</option>
                  <option value="leader">Leader Tertentu</option>
                </select>

                <select 
                  value={feeFilterValue} 
                  onChange={e => setFeeFilterValue(e.target.value)} 
                  disabled={!feeFilterType} 
                  className="p-2 border border-gray-300 rounded text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  <option value="">-- Pilih Target --</option>
                  {feeFilterType === 'area' && uniqueAreasFinance.map((a, i) => (
                    <option key={i} value={a}>{a}</option>
                  ))}
                  {feeFilterType === 'pegawai' && frontlineList.map((emp) => (
                    <option key={emp.id} value={emp.nik}>{emp.nama} ({emp.nik})</option>
                  ))}
                  {feeFilterType === 'leader' && uniqueLeadersFinance.map((l, i) => (
                    <option key={i} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              <input 
                id="excel-fee-upload"
                type="file" 
                accept=".xlsx,.xls" 
                onChange={e => e.target.files && setFeeExcelFile(e.target.files[0])} 
                className="text-sm w-full block cursor-pointer file:cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
              />

              <button 
                onClick={handleUploadFee} 
                disabled={!feeExcelFile || isUploadingFee} 
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingFee ? 'Memproses...' : 'Simpan ke Database'}
              </button>
            </div>
          </div>
        )}

        {currentView !== 'welcome' && currentView !== 'list-akun' && currentView !== 'form-tambah' && currentView !== 'form-edit' && currentView !== 'upload-qna' && currentView !== 'penutupan-akun' && currentView !== 'upload-produk' && currentView !== 'pengumuman' && currentView !== 'create-leader' && currentView !== 'upload-fee' && currentView !== 'laporan-aduan' && currentView !== 'create-non-fronting' && currentView !== 'list-security' && currentView !== 'list-obcs' && currentView !== 'list-teknisi' && (
          <div className="bg-white rounded-xl shadow-sm p-10 text-center">
            <h3 className="text-xl font-bold text-gray-700 mb-2">Halaman Menu: {currentView.replace('-', ' ').toUpperCase()}</h3>
            <p className="text-gray-500 mb-6">Modul untuk menu ini sedang dipersiapkan.</p>
            <button onClick={() => setCurrentView("welcome")} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors text-sm font-semibold">Kembali ke Beranda</button>
          </div>
        )}

        {successMessage && <div className="fixed bottom-5 right-5 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 shadow-lg z-50">✅ {successMessage}</div>}
        {errorMessage && <div className="fixed bottom-5 right-5 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 shadow-lg z-50">❌ {errorMessage}</div>}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  return (
    <SessionProvider>
      <DashboardContent />
    </SessionProvider>
  );
}