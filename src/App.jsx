import React, { useState, useMemo, useRef } from 'react';

export default function App() {
  // =========================================================================
  // STATE INPUT JARINGAN (KOSONG DARI AWAL - DIINPUTKAN OLEH USER)
  // =========================================================================
  const [perangkat, setPerangkat] = useState({});
  const [koneksi, setKoneksi] = useState([]);

  // State Kontrol Form
  const [namaPerangkatBaru, setNamaPerangkatBaru] = useState('');
  const [tipePerangkatBaru, setTipePerangkatBaru] = useState('Komputer');
  const [dariNode, setDariNode] = useState('');
  const [keNode, setKeNode] = useState('');
  const [bobotInput, setBobotInput] = useState(5);

  // State Pilihan Jalur Evaluasi
  const [titikAwal, setTitikAwal] = useState('');
  const [titikTujuan, setTitikTujuan] = useState('');

  // State untuk Fitur Drag & Drop Simpul
  const [simpulAktif, setSimpulAktif] = useState(null);
  const svgRef = useRef(null);

  const simpulList = useMemo(() => Object.keys(perangkat), [perangkat]);

  // =========================================================================
  // HANDLER INTERAKSI DRAG AND DROP (GESER PERANGKAT)
  // =========================================================================
  const handleMouseDown = (namaSimpul) => {
    setSimpulAktif(namaSimpul);
  };

  const handleMouseMove = (e) => {
    if (!simpulAktif || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xTerbatas = Math.max(30, Math.min(rect.width - 30, mouseX));
    const yTerbatas = Math.max(30, Math.min(rect.height - 50, mouseY));

    setPerangkat(prev => ({
      ...prev,
      [simpulAktif]: { ...prev[simpulAktif], x: Math.round(xTerbatas), y: Math.round(yTerbatas) }
    }));
  };

  const handleMouseUpOrLeave = () => {
    setSimpulAktif(null);
  };

  // =========================================================================
  // HANDLER AKSI INPUT FORM (DENGAN SKEMA KEAMANAN)
  // =========================================================================
  const handleTambahPerangkat = (e) => {
    e.preventDefault();
    const namaBersih = namaPerangkatBaru.trim().replace(/[^a-zA-Z0-9_]/g, '');
    
    if (!namaBersih) {
      alert("Keamanan Input: Nama perangkat tidak boleh kosong atau hanya berisi karakter spesial!");
      return;
    }
    
    if (perangkat[namaBersih]) {
      alert("Validasi: Perangkat dengan nama tersebut sudah terdaftar di jaringan!");
      return;
    }

    setPerangkat(prev => {
      const updated = {
        ...prev,
        [namaBersih]: { tipe: tipePerangkatBaru, x: 250, y: 220 }
      };
      
      // Sinkronisasi otomatis dropdown jika ini adalah perangkat pertama/kedua
      const keys = Object.keys(updated);
      if (keys.length === 1) {
        setDariNode(keys[0]);
        setKeNode(keys[0]);
        setTitikAwal(keys[0]);
        setTitikTujuan(keys[0]);
      } else if (keys.length === 2) {
        setKeNode(keys[1]);
        setTitikTujuan(keys[1]);
      }
      
      return updated;
    });
    setNamaPerangkatBaru('');
  };

  const handleTambahKoneksi = (e) => {
    e.preventDefault();
    if (!dariNode || !keNode) {
      alert("Validasi Jalur: Harap buat perangkat terlebih dahulu sebelum menyambungkan kabel!");
      return;
    }

    if (dariNode === keNode) {
      alert("Validasi Jalur: Perangkat asal dan tujuan tidak boleh sama (Looping Tunggal dilarang)!");
      return;
    }
    
    const bobotAman = Math.round(Number(bobotInput));
    if (isNaN(bobotAman) || bobotAman <= 0) {
      alert("Keamanan Algoritma: Bobot latensi harus berupa angka bulat positif (minimal 1 ms) untuk mencegah galat Dijkstra!");
      return;
    }
    
    const sudahAda = koneksi.some(k => 
      (k.dari === dariNode && k.ke === keNode) || (k.dari === keNode && k.ke === dariNode)
    );
    
    if (sudahAda) {
      alert(`Validasi Graf: Jalur kabel antara ${dariNode} dan ${keNode} sudah terpasang!`);
      return;
    }

    const idBaru = `e_${Date.now()}`;
    setKoneksi(prev => [...prev, { id: idBaru, dari: dariNode, ke: keNode, bobot: bobotAman }]);
  };

  // =========================================================================
  // LOGIKA KOMPUTASI MATEMATIKA DISKRIT
  // =========================================================================
  const daftarKetetanggaan = useMemo(() => {
    const adj = {};
    simpulList.forEach(node => adj[node] = []);
    koneksi.forEach(({ dari, ke, bobot }) => {
      if (adj[dari] && adj[ke]) {
        adj[dari].push({ node: ke, weight: bobot });
        adj[ke].push({ node: dari, weight: bobot });
      }
    });
    return adj;
  }, [simpulList, koneksi]);

  const matriksKetetanggaan = useMemo(() => {
    const matriks = [];
    simpulList.forEach((dari) => {
      const baris = [];
      simpulList.forEach((ke) => {
        if (dari === ke) baris.push(0);
        else {
          const konek = koneksi.find(k => (k.dari === dari && k.ke === ke) || (k.dari === ke && k.ke === dari));
          baris.push(konek ? konek.bobot : '∞');
        }
      });
      matriks.push(baris);
    });
    return matriks;
  }, [simpulList, koneksi]);

  const matriksBersisian = useMemo(() => {
    const matriks = [];
    simpulList.forEach((simpul) => {
      const baris = [];
      koneksi.forEach((sisi) => {
        if (sisi.dari === simpul || sisi.ke === simpul) {
          baris.push(1);
        } else {
          baris.push(0);
        }
      });
      matriks.push(baris);
    });
    return matriks;
  }, [simpulList, koneksi]);

  const derajatSimpul = useMemo(() => {
    const derajat = {};
    simpulList.forEach(node => {
      derajat[node] = daftarKetetanggaan[node] ? daftarKetetanggaan[node].length : 0;
    });
    return derajat;
  }, [simpulList, daftarKetetanggaan]);

  const dijkstra = useMemo(() => {
    if (!titikAwal || !titikTujuan || !perangkat[titikAwal] || !perangkat[titikTujuan] || titikAwal === titikTujuan) {
      return { jalur: [], totalBobot: '∞' };
    }
    let jarak = {};
    let kembali = {};
    let antrean = [];

    simpulList.forEach(node => {
      jarak[node] = Infinity;
      kembali[node] = null;
      antrean.push(node);
    });
    jarak[titikAwal] = 0;

    while (antrean.length > 0) {
      antrean.sort((a, b) => jarak[a] - jarak[b]);
      let nodeTerkecil = antrean.shift();

      if (nodeTerkecil === titikTujuan || jarak[nodeTerkecil] === Infinity) break;

      if (daftarKetetanggaan[nodeTerkecil]) {
        daftarKetetanggaan[nodeTerkecil].forEach(tetangga => {
          let alternatif = jarak[nodeTerkecil] + tetangga.weight;
          if (alternatif < jarak[tetangga.node]) {
            jarak[tetangga.node] = alternatif;
            kembali[tetangga.node] = nodeTerkecil;
          }
        });
      }
    }

    let rute = [];
    let saatIni = titikTujuan;
    while (saatIni !== null) {
      rute.unshift(saatIni);
      saatIni = kembali[saatIni];
    }
    return { jalur: rute, totalBobot: jarak[titikTujuan] === Infinity ? '∞' : jarak[titikTujuan] };
  }, [simpulList, daftarKetetanggaan, titikAwal, titikTujuan, perangkat]);

  const mst = useMemo(() => {
    if (simpulList.length === 0 || koneksi.length === 0) return { sisiMST: [], totalBobotMST: 0 };
    let mstSisi = [];
    let dikunjungi = new Set([simpulList[0]]);
    let totalBobotMST = 0;

    while (dikunjungi.size < simpulList.length) {
      let minimum = { u: null, v: null, weight: Infinity };

      dikunjungi.forEach(u => {
        if (daftarKetetanggaan[u]) {
          daftarKetetanggaan[u].forEach(tetangga => {
            if (!dikunjungi.has(tetangga.node) && tetangga.weight < minimum.weight) {
              minimum = { u: u, v: tetangga.node, weight: tetangga.weight };
            }
          });
        }
      });

      if (minimum.u === null) break;
      mstSisi.push(`${minimum.u}-${minimum.v}`);
      totalBobotMST += minimum.weight;
      dikunjungi.add(minimum.v);
    }
    return { sisiMST: mstSisi, totalBobotMST };
  }, [simpulList, daftarKetetanggaan, koneksi]);

  const jumlahJalurAlternatif = useMemo(() => {
    if (!titikAwal || !titikTujuan || !daftarKetetanggaan[titikAwal] || !daftarKetetanggaan[titikTujuan] || titikAwal === titikTujuan) return 0;
    const hitungJalur = (start, target, visited) => {
      if (start === target) return 1;
      visited.add(start);
      let ruteDitemukan = 0;

      if (daftarKetetanggaan[start]) {
        daftarKetetanggaan[start].forEach(tetangga => {
          if (!visited.has(tetangga.node)) {
            ruteDitemukan += hitungJalur(tetangga.node, target, new Set(visited));
          }
        });
      }
      return ruteDitemukan;
    };
    return hitungJalur(titikAwal, titikTujuan, new Set());
  }, [daftarKetetanggaan, titikAwal, titikTujuan]);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f4f6f9', color: '#333', userSelect: simpulAktif ? 'none' : 'auto' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', backgroundColor: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        
        <h1 style={{ textAlign: 'center', color: '#1a365d', marginBottom: '5px' }}>Simulator & Analisis Graf Jaringan Komputer</h1>

        {/* INPUT CONTROL BAR */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', backgroundColor: '#edf2f7', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
          {/* Form 1: Simpul */}
          <form onSubmit={handleTambahPerangkat} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ fontSize: '14px' }}>1. Tambah Perangkat Baru (Simpul)</strong>
            <input 
              type="text" placeholder="Contoh: Server_Pusat" value={namaPerangkatBaru} 
              onChange={(e) => setNamaPerangkatBaru(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
            />
            <select value={tipePerangkatBaru} onChange={(e) => setTipePerangkatBaru(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
              <option value="Komputer">Komputer</option>
              <option value="Router">Router</option>
              <option value="Server">Server</option>
              <option value="Printer">Printer</option>
            </select>
            <button type="submit" style={{ padding: '6px', backgroundColor: '#3182ce', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Buat Perangkat</button>
          </form>

          {/* Form 2: Sisi & Bobot */}
          <form onSubmit={handleTambahKoneksi} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ fontSize: '14px' }}>2. Sambung Kabel Jaringan (Sisi & Bobot)</strong>
            <div style={{ display: 'flex', gap: '5px' }}>
              <select value={dariNode} onChange={(e) => setDariNode(e.target.value)} style={{ width: '50%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
                {simpulList.length === 0 && <option value="">(Buat Perangkat Dulu)</option>}
                {simpulList.map(node => <option key={node} value={node}>{node}</option>)}
              </select>
              <select value={keNode} onChange={(e) => setKeNode(e.target.value)} style={{ width: '50%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
                {simpulList.length === 0 && <option value="">(Buat Perangkat Dulu)</option>}
                {simpulList.map(node => <option key={node} value={node}>{node}</option>)}
              </select>
            </div>
            <input 
              type="number" min="1" placeholder="Bobot Latensi (ms)" value={bobotInput} 
              onChange={(e) => setBobotInput(e.target.value)}
              style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
            />
            <button type="submit" style={{ padding: '6px', backgroundColor: '#38a169', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+ Hubungkan Kabel</button>
          </form>

          {/* Form 3: Titik Jalur */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <strong style={{ fontSize: '14px' }}>3. Evaluasi Aliran Distribusi</strong>
            <label style={{ fontSize: '12px' }}>Titik Asal:</label>
            <select value={titikAwal} onChange={(e) => setTitikAwal(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
              {simpulList.length === 0 && <option value="">(Belum ada simpul)</option>}
              {simpulList.map(node => <option key={node} value={node}>{node}</option>)}
            </select>
            <label style={{ fontSize: '12px' }}>Titik Tujuan:</label>
            <select value={titikTujuan} onChange={(e) => setTitikTujuan(e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}>
              {simpulList.length === 0 && <option value="">(Belum ada simpul)</option>}
              {simpulList.map(node => <option key={node} value={node}>{node}</option>)}
            </select>
          </div>
        </div>

        {/* OUTPUT DIAGRAM & DATA ANALYSIS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
          
          {/* DIAGRAM VISUAL ELEMEN */}
          <div style={{ flex: '1 1 500px' }}>
            <h3 style={{ color: '#2c5282', marginTop: '0' }}>Output: Kanvas Topologi Graf Interaktif</h3>
            <p style={{ fontSize: '12px', color: '#718096', marginTop: '-10px' }}>
              💡 <em>Petunjuk: Perangkat baru akan muncul di tengah kanvas. Silakan drag lingkaran untuk mengatur posisi graf.</em>
            </p>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', backgroundColor: '#fafafa' }}>
              <svg 
                ref={svgRef}
                width="100%" 
                height="450"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                style={{ cursor: simpulAktif ? 'grabbing' : 'default' }}
              >
                {simpulList.length === 0 && (
                  <text x="50%" y="50%" textAnchor="middle" fill="#a0aec0" fontWeight="bold" fontSize="14">
                    Kanvas Kosong. Silakan tambah perangkat pada form di atas!
                  </text>
                )}

                {/* Gambar Kabel/Sisi */}
                {koneksi.map((k, indeks) => {
                  const p1 = perangkat[k.dari];
                  const p2 = perangkat[k.ke];
                  if (!p1 || !p2) return null;

                  const isMST = mst.sisiMST.includes(`${k.dari}-${k.ke}`) || mst.sisiMST.includes(`${k.ke}-${k.dari}`);
                  const idx1 = dijkstra.jalur.indexOf(k.dari);
                  const idx2 = dijkstra.jalur.indexOf(k.ke);
                  const isDijkstra = idx1 !== -1 && idx2 !== -1 && Math.abs(idx1 - idx2) === 1;

                  return (
                    <g key={k.id || indeks}>
                      <line 
                        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} 
                        stroke={isDijkstra ? '#e53e3e' : isMST ? '#38a169' : '#cbd5e0'} 
                        strokeWidth={isDijkstra ? '5' : isMST ? '4' : '2'}
                        strokeDasharray={isMST && !isDijkstra ? "5,5" : "0"}
                      />
                      <rect x={(p1.x + p2.x)/2 - 12} y={(p1.y + p2.y)/2 - 10} width="24" height="18" fill="#fff" rx="4" stroke="#e2e8f0"/>
                      <text x={(p1.x + p2.x)/2} y={(p1.y + p2.y)/2 + 4} fontSize="11" textAnchor="middle" fontWeight="bold" fill="#4a5568">{k.bobot}</text>
                    </g>
                  );
                })}

                {/* Gambar Bulatan Perangkat/Simpul */}
                {Object.entries(perangkat).map(([nama, pt]) => (
                  <g 
                    key={nama} 
                    onMouseDown={() => handleMouseDown(nama)}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={pt.x} cy={pt.y} r="25" fill={nama === titikAwal ? '#faf089' : nama === titikTujuan ? '#ed8936' : '#ebf8ff'} stroke={simpulAktif === nama ? '#e53e3e' : '#3182ce'} strokeWidth={simpulAktif === nama ? '3' : '2'} />
                    <text x={pt.x} y={pt.y + 4} fontSize="10" textAnchor="middle" fontWeight="bold" fill="#2b6cb0" style={{ pointerEvents: 'none' }}>{pt.tipe}</text>
                    <text x={pt.x} y={pt.y + 38} fontSize="11" textAnchor="middle" fontWeight="bold" fill="#1a202c" style={{ pointerEvents: 'none' }}>{nama}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* MATRIKS DAN EVALUASI MATEMATIKA DISKRIT */}
          <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* TAHAP 2: MATRIKS */}
            <div>
              <h3 style={{ color: '#2c5282', marginTop: '0' }}>Representasi Matriks Hasil Input</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h5 style={{ margin: '0 0 5px 0', color: '#4a5568' }}>Matriks Ketetanggaan (Adjacency)</h5>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5', whiteSpace: 'nowrap', overflowX: 'auto' }}>
                    {simpulList.length === 0 ? '[ Matriks Kosong ]' : matriksKetetanggaan.map((baris, i) => <div key={i}>[ {baris.join(', ')} ]</div>)}
                  </div>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h5 style={{ margin: '0 0 5px 0', color: '#4a5568' }}>Matriks Bersisian (Incidence)</h5>
                  <div style={{ fontFamily: 'monospace', fontSize: '11px', lineHeight: '1.5', whiteSpace: 'nowrap', overflowX: 'auto' }}>
                    {simpulList.length === 0 || koneksi.length === 0 ? '[ Matriks Kosong ]' : matriksBersisian.map((baris, i) => <div key={i}>[ {baris.join(', ')} ]</div>)}
                  </div>
                </div>
              </div>
            </div>

            {/* TABEL SIMPUL & DERAJAT */}
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ color: '#2c5282', margin: '0 0 10px 0' }}>Tabel Simpul & Derajat Jaringan</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e0' }}>
                    <th style={{ padding: '6px' }}>Nama Perangkat</th>
                    <th style={{ padding: '6px' }}>Tipe</th>
                    <th style={{ padding: '6px' }}>Derajat Simpul (Degree)</th>
                  </tr>
                </thead>
                <tbody>
                  {simpulList.length === 0 && (
                    <tr>
                      <td colSpan="3" style={{ padding: '10px', textAlign: 'center', color: '#a0aec0' }}>Belum ada data perangkat.</td>
                    </tr>
                  )}
                  {Object.entries(perangkat).map(([nama, pt]) => (
                    <tr key={nama} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '6px', fontWeight: 'bold' }}>{nama}</td>
                      <td style={{ padding: '6px' }}>{pt.tipe}</td>
                      <td style={{ padding: '6px' }}>{derajatSimpul[nama] || 0} Jalur Aktif</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ANALISIS PROSES */}
            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ color: '#2c5282', margin: '0 0 10px 0' }}>Analisis Relasi Jalur & Efisiensi</h3>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div>Lintasan Terpendek Terpilih (Dijkstra): <strong style={{ color: '#e53e3e' }}>{dijkstra.jalur.length > 1 ? dijkstra.jalur.join(' ➔ ') : 'Tidak Terhubung'}</strong></div>
                <div>Total Latensi Distribusi: <strong>{dijkstra.totalBobot} {dijkstra.totalBobot !== '∞' ? 'ms' : ''}</strong></div>
                <div style={{ borderTop: '1px solid #edf2f7', marginTop: '6px', paddingTop: '6px' }}>Kombinatorika Alternatif Rute (DFS): <strong style={{ color: '#3182ce' }}>{jumlahJalurAlternatif} Jalur Unik</strong></div>
                <div>Total Akumulasi Bobot Pohon (MST): <strong>{mst.totalBobotMST} ms</strong></div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}