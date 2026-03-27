// --- STORAGE & UI ---
function saveDraft() {
    const workspace = document.getElementById('novelWorkspace');
    const data = {
        title: document.getElementById('novelTitle').value,
        genre: document.getElementById('genre').value,
        style: document.getElementById('style').value,
        idea: document.getElementById('storyIdea').value,
        workspaceVisible: !workspace.classList.contains('hidden'),
        chapters: []
    };
    
    // Ambil data dari setiap kartu bab
    document.querySelectorAll('.chapter-card').forEach((card, i) => {
        data.chapters.push({
            label: card.querySelector('.ch-label').innerText,
            judul: card.querySelector('.ch-title-input').value,
            summary: card.querySelector('.ch-summary-input').value,
            content: card.querySelector('.ch-content-input').value
        });
    });
    localStorage.setItem('tebe_v15_repair', JSON.stringify(data));
}

function loadDraft() {
    const saved = localStorage.getItem('tebe_v15_repair');
    if (!saved) return;
    const data = JSON.parse(saved);
    document.getElementById('novelTitle').value = data.title || "";
    document.getElementById('genre').value = data.genre || "";
    document.getElementById('style').value = data.style || "";
    document.getElementById('storyIdea').value = data.idea || "";
    if (data.workspaceVisible && data.chapters.length > 0) {
        renderWorkspace(data.chapters, data.title);
    }
}

function showPopup(msg) {
    document.getElementById('aiPopup').classList.remove('hidden');
    document.getElementById('popupStatus').innerText = msg;
}

function hidePopup() { 
    document.getElementById('aiPopup').classList.add('hidden'); 
}

// --- ENGINE API ---
async function checkAndSaveApi() {
    const key = document.getElementById('apiKey').value;
    if (!key) return alert("Masukkan API Key terlebih dahulu!");
    
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            localStorage.setItem('tebe_key_v15', key);
            document.getElementById('savedTag').classList.remove('hidden');
            const select = document.getElementById('modelSelect');
            
            // Filter hanya model yang mendukung generateContent
            const filteredModels = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            select.innerHTML = filteredModels.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            
            document.getElementById('engineWrapper').classList.remove('hidden');
            document.getElementById('btnCheck').innerText = "ENGINE READY ✓";
            document.getElementById('btnCheck').className = "w-full py-2 bg-green-900 text-white text-xs font-bold rounded";
        } else {
            alert("API Key tidak valid.");
        }
    } catch (e) { 
        alert("Gagal terhubung ke Engine. Periksa koneksi internet."); 
    }
}

// --- PEMBERSIH TEKS (ANTI-DEMPET & JAGA KOMA) ---
function cleanAIText(text) {
    if (!text) return "";
    return text
        .replace(/^.*?(Berikut adalah|Ini adalah|Tentu|Halo|Baiklah).*?(\n|:)/gi, '') 
        .replace(/\\n/g, '\n') 
        .replace(/\\"/g, '"') 
        .replace(/[\/](?![nrt"'])/g, '') // Hanya hapus garis miring liar
        .trim();
}

async function callAI(prompt) {
    const key = document.getElementById('apiKey').value;
    const model = document.getElementById('modelSelect').value;
    
    if (!key || !model) {
        throw new Error("API Key atau Model belum siap.");
    }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
                maxOutputTokens: 8192, 
                temperature: 0.8,
                topP: 0.95
            }
        })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    if (!data.candidates || data.candidates.length === 0) throw new Error("AI tidak memberikan jawaban.");
    
    return cleanAIText(data.candidates[0].content.parts[0].text);
}

// --- FUNGSI TOMBOL RANCANG ---
async function planNovel() {
    const idea = document.getElementById('storyIdea').value;
    const title = document.getElementById('novelTitle').value || "Karya Tanpa Judul";
    const count = document.getElementById('chapterCount').value;

    if(!idea) return alert("Silakan isi Ide Utama terlebih dahulu!");
    
    showPopup("Merancang Alur Novel...");
    
    const prompt = `Bertindak sebagai Planner Novel. Judul: ${title}. Ide Utama: ${idea}. Buat alur cerita berantai yang terdiri dari ${count} bab dalam format JSON murni: [{"label":"Bab 1","judul":"Judul Bab","ringkasan":"Ringkasan alur bab ini"}]`;
    
    try {
        const raw = await callAI(prompt);
        // Pastikan hanya mengambil bagian JSON jika AI memberi teks tambahan
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        const parsedPlan = JSON.parse(jsonPart);
        
        renderWorkspace(parsedPlan, title);
        saveDraft();
    } catch (e) { 
        console.error(e);
        alert("Gagal merancang alur. Pastikan API Key benar."); 
    } finally { 
        hidePopup(); 
    }
}

// --- FUNGSI TOMBOL TULIS ---
async function writeChapter(i) {
    const key = document.getElementById('apiKey').value;
    if(!key) return alert("Hubungkan API Key dulu!");

    showPopup(`Sedang Menulis Bab ${i+1}...`);
    
    let pastContext = "";
    const summaries = document.querySelectorAll('.ch-summary-input');
    const titles = document.querySelectorAll('.ch-title-input');
    
    // Mengambil konteks bab-bab sebelumnya
    for(let j=0; j<i; j++) {
        pastContext += `Bab ${j+1} (${titles[j].value}): ${summaries[j].value}\n`;
    }
    
    const prompt = `Tulis sebuah bab novel dengan gaya ${document.getElementById('style').value}.
    Genre: ${document.getElementById('genre').value}.
    Konteks Cerita Sebelumnya: ${pastContext || "Ini adalah awal cerita."}
    Bab yang Harus Ditulis Sekarang: ${titles[i].value}.
    Alur Bab Ini: ${summaries[i].value}.
    
    ATURAN KETAT:
    1. Gunakan spasi yang benar antar kata (JANGAN DEMPET).
    2. Gunakan tanda koma (,) dan titik (.) secara tepat agar enak dibaca.
    3. Tulis minimal 1500 kata dalam bahasa Indonesia yang baku namun mengalir.
    4. Langsung mulai ke cerita, JANGAN ADA SALAM PEMBUKA.`;

    try {
        const resultText = await callAI(prompt);
        document.getElementById(`content-ch-${i}`).value = resultText;
        saveDraft();
    } catch (e) { 
        alert("Terjadi masalah: " + e.message); 
    } finally { 
        hidePopup(); 
    }
}

function renderWorkspace(plan, title) {
    document.getElementById('mainPlaceholder').classList.add('hidden');
    document.getElementById('displayTitle').innerText = title;
    const workspace = document.getElementById('novelWorkspace');
    const area = document.getElementById('chaptersArea');
    
    workspace.classList.remove('hidden');
    
    area.innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 space-y-4 mb-8">
            <div class="flex justify-between border-b border-gray-800 pb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label || 'Bab ' + (i+1)}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none novel-font text-white" value="${item.judul}" oninput="saveDraft()">
                    <textarea class="ch-summary-input summary-box mt-2" rows="3" oninput="saveDraft()">${item.ringkasan}</textarea>
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black hover:bg-gold-500">TULIS BAB</button>
            </div>
            <textarea id="content-ch-${i}" class="ch-content-input content-box" rows="15" placeholder="Hasil tulisan akan muncul di sini..." oninput="saveDraft()">${item.content || ""}</textarea>
        </div>
    `).join('');
}

// --- FUNGSI EKSPOR & CLEAR ---
function downloadFull(format) {
    const title = document.getElementById('novelTitle').value || 'MyNovel';
    let content = "";
    
    if(format === 'html') {
        content = `<html><head><meta charset="UTF-8"><style>body{background:#917e5d; padding:50px; font-family:serif; line-height:1.8; text-align:justify; max-width:800px; margin:auto;} h1{text-align:center;} p{text-indent:30px; margin-bottom:15px;}</style></head><body><h1>${title}</h1>`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const t = card.querySelector('.ch-title-input').value;
            const c = card.querySelector('.ch-content-input').value;
            content += `<h2>${t}</h2>` + c.split('\n').map(p => `<p>${p}</p>`).join('');
        });
        content += "</body></html>";
    } else {
        document.querySelectorAll('.chapter-card').forEach(card => {
            content += `\n\n--- ${card.querySelector('.ch-title-input').value} ---\n\n${card.querySelector('.ch-content-input').value}`;
        });
    }

    const blob = new Blob([content], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.${format}`;
    a.click();
}

function clearAllData() { 
    if(confirm("Apakah Anda yakin ingin menghapus semua draf?")) { 
        localStorage.removeItem('tebe_v15_repair'); 
        location.reload(); 
    } 
}

// Jalankan Load saat halaman dibuka
window.onload = () => {
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) { 
        document.getElementById('apiKey').value = savedKey; 
        checkAndSaveApi(); 
    }
    loadDraft();
};
