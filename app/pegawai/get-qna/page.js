"use client";
import { useState, useEffect, useRef } from "react";

export default function HalamanQnaPegawai() {
  // State untuk List QnA
  const [qnaList, setQnaList] = useState([]);
  const [isLoadingQna, setIsLoadingQna] = useState(true);

  // State untuk Chat Agent
  const [messages, setMessages] = useState([
    { role: "agent", text: "Halo! Saya Asisten QnA. Ada yang ingin Anda tanyakan terkait produk, promo, atau sistem hari ini?" }
  ]);
  const [inputText, setInputText] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Ambil data dokumen QnA
  useEffect(() => {
    fetchQna();
  }, []);

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentTyping]);

  const fetchQna = async () => {
    try {
      const res = await fetch('/api/get-qna');
      const result = await res.json();
      if (result.success) {
        setQnaList(result.data);
      }
    } catch (error) {
      console.error("Gagal mengambil materi QnA", error);
    } finally {
      setIsLoadingQna(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    
    // Tambahkan pesan user ke antarmuka
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInputText("");
    setIsAgentTyping(true);

    try {
      // Panggil API Agent (Bisa dihubungkan ke OpenAI, Gemini, atau sistem Live Chat backend Anda)
      const res = await fetch('/api/chat-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const result = await res.json();
      
      if (result.success) {
        setMessages((prev) => [...prev, { role: "agent", text: result.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: "agent", text: "Maaf, saya sedang mengalami gangguan. Silakan coba beberapa saat lagi." }]);
      }
    } catch (error) {
      console.error("Error chat agent:", error);
      setMessages((prev) => [...prev, { role: "agent", text: "Terjadi kesalahan sistem saat menghubungi agent." }]);
    } finally {
      setIsAgentTyping(false);
    }
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pusat Informasi & QnA</h1>
        <p className="text-gray-500">Jelajahi dokumen materi atau tanyakan langsung pada Agent kami.</p>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        
        {/* BAGIAN KIRI: DAFTAR DOKUMEN QNA */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-700 flex items-center gap-2">
              📄 Dokumen Materi Terkini
            </h2>
          </div>
          
          <div className="p-5 overflow-y-auto flex-1">
            {isLoadingQna ? (
              <div className="text-center text-gray-500 py-10">Memuat dokumen...</div>
            ) : qnaList.length === 0 ? (
              <div className="text-center text-gray-500 py-10 border-2 border-dashed border-gray-200 rounded-xl">
                Belum ada materi QnA yang dibagikan oleh Admin.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qnaList.map((item) => (
                  <div key={item.id} className="border border-gray-200 p-4 rounded-xl hover:shadow-md transition-shadow flex flex-col">
                    <div className="text-xs font-bold text-blue-600 mb-1 uppercase tracking-wider">
                      {item.kategori}
                    </div>
                    <h3 className="text-md font-bold text-gray-900 mb-2 leading-tight">{item.judul}</h3>
                    <p className="text-sm text-gray-600 flex-grow mb-4 line-clamp-2">
                      {item.deskripsi || "Tidak ada deskripsi."}
                    </p>
                    <a 
                      href={`/uploads/qna/${item.file_name}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full text-center bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 font-semibold py-2 px-3 rounded-lg text-sm transition-colors border border-gray-200"
                    >
                      Buka Dokumen
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BAGIAN KANAN: CHAT AGENT */}
        <div className="w-full lg:w-96 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header Chat */}
          <div className="p-4 bg-blue-600 text-white flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-sm">
              🤖
            </div>
            <div>
              <h2 className="font-bold text-sm">Asisten QnA</h2>
              <p className="text-xs text-blue-100 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-400"></span> Online
              </p>
            </div>
          </div>

          {/* Area Pesan */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col gap-3">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            
            {/* Indikator Typing */}
            {isAgentTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Chat */}
          <div className="p-3 bg-white border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ketik pertanyaan Anda..." 
                className="flex-1 p-2 bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm"
                disabled={isAgentTyping}
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isAgentTyping}
                className="bg-blue-600 text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-blue-300 shadow-sm"
              >
                ➤
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}