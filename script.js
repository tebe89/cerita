const getEl = id => document.getElementById(id);
let timerInterval, abortController;

// --- POPUP ---
window.showPopup = (msg) => {
    let seconds = 0;
    getEl('popupTimer').innerText = "0s";
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { seconds++; getEl('popupTimer').innerText = seconds + "s"; }, 1000);
    getEl('aiPopup').classList.remove('hidden');
    getEl('popupStatus').innerText = msg;
};

window.hidePopup = () => { getEl('aiPopup').classList.add('hidden'); clearInterval(timerInterval); };

window.cancelProcess = () => { if (abortController) { abortController.abort(); window.hidePopup(); alert("Dibatalkan."); } };

// --- STORAGE ---
window.saveDraft = () => {
    const chapters = [];
    document.querySelectorAll('.chapter-card').forEach((card) => {
        chapters.push({
            label: card.querySelector('.ch-label').innerText,
            judul: card.querySelector('.ch-title-input').value,
            summary: card.querySelector('.ch-summary-input').value,
            content: card.querySelector('.ch-content-input').value
        });
    });
    
    const data = {
        apiKey: getEl('apiKey').value,
        model: getEl('modelSelect').value,
        title: getEl('novelTitle').value,
        genre: getEl('genre').value,
        style: getEl('style').value,
        idea: getEl('storyIdea').value,
        chapterCount: getEl('chapterCount').value,
        workspaceVisible: !getEl('novelWorkspace').classList.contains('hidden'),
        chapters: chapters
    };
    localStorage.setItem('tebe_v15_final_ultra', JSON.stringify(data));
};

window.loadDraft = () => {
    const saved = localStorage.getItem('tebe_v15_final_ultra');
    if (!saved) return;
    const data = JSON.parse(saved);
    getEl('apiKey').value = data.apiKey || "";
    getEl('novelTitle').value = data.title || "";
    getEl('genre').value = data.genre || "";
    getEl('style').value = data.style || "";
    getEl('storyIdea').value = data.idea || "";
    getEl('chapterCount').value = data.chapterCount || 3;
    
    if (data.apiKey) window.checkAndSaveApi(true); // Auto-connect
    if (data.workspaceVisible) window.renderWorkspace(data.chapters, data.title);
};

// --- ENGINE ---
window.checkAndSaveApi = async (isSilent = false) => {
    const key = getEl('apiKey').value.trim();
    if(!key) return;
    if(!isSilent) window.showPopup("Menghubungkan Engine...");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            getEl('savedTag').classList.remove('hidden');
            const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            getEl('modelSelect').innerHTML = models.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            
            // Restore model selection if exists
            const savedData = JSON.parse(localStorage.getItem('tebe_v15_final_ultra'));
            if(savedData && savedData.model) getEl('modelSelect').value = savedData.model;
            
            getEl('engineWrapper').classList.remove('hidden');
            getEl('btnCheck').innerText = "ENGINE READY ✓";
            getEl('btnCheck').style.backgroundColor = "#064e3b";
            window.saveDraft();
        }
    } catch (e) { if(!isSilent) alert("Gagal koneksi API."); }
    finally { window.hidePopup(); }
};

async function callAI(prompt) {
    const key = getEl('apiKey').value;
    const model = getEl('modelSelect').value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } })
    });
    const data = await res.json();
    if (!data.candidates) throw new Error("AI Sibuk.");
    let text = data.candidates[0].content.parts[0].text;
    return text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi Ide Utama!");
    window.showPopup("Merancang Alur...");
    try {
        const count = getEl('chapterCount').value || 3;
        const prompt = `Bertindak sebagai arsitek alur. Buat alur novel dalam format JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Pastikan mencakup Prolog, ${count} Bab tengah, dan Epilog. Ide: ${idea}`;
        const raw = await callAI(prompt);
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Gagal merancang."); }
    finally { window.hidePopup(); }
};

window.writeChapter = async (i) => {
    window.showPopup(`Menulis ${document.querySelectorAll('.ch-label')[i].innerText}...`);
    const titles = document.querySelectorAll('.ch-title-input');
    const summaries = document.querySelectorAll('.ch-summary-input');
    const prompt = `Tulis naskah novel: ${titles[i].value}. Alur: ${summaries[i].value}. 
    PENTING: Gunakan tanda baca koma (,) dan titik (.) dengan benar. Spasi rapi. Minimal 1500 kata.`;
    try {
        const res = await callAI(prompt);
        document.querySelectorAll('.ch-content-input')[i].value = res;
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Gagal."); }
    finally { window.hidePopup(); }
};

window.renderWorkspace = (plan, title) => {
    getEl('mainPlaceholder').classList.add('hidden');
    getEl('displayTitle').innerText = title || "Karya Tebe";
    getEl('novelWorkspace').classList.remove('hidden');
    getEl('chaptersArea').innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 mb-8 shadow-xl">
            <div class="flex justify-between border-b border-gray-800 pb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none text-white" value="${item.judul}" oninput="window.saveDraft()">
                    <textarea class="ch-summary-input summary-box mt-2" rows="3" oninput="window.saveDraft()">${item.summary || item.ringkasan}</textarea>
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500">TULIS</button>
            </div>
            <textarea class="ch-content-input content-box mt-4" rows="15" oninput="window.saveDraft()">${item.content || ""}</textarea>
            <div class="flex justify-end gap-2 mt-2">
                <button onclick="window.downloadSingle(${i}, 'txt')" class="text-[9px] bg-gray-800 px-3 py-1 rounded text-gray-400">TXT</button>
                <button onclick="window.downloadSingle(${i}, 'html')" class="text-[9px] border border-gray-800 px-3 py-1 rounded text-gray-400">HTML</button>
            </div>
        </div>
    `).join('');
};

// --- DOWNLOAD (PORTRAIT FIXED) ---
const htmlHeader = (title) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&family=Cinzel:wght@700&display=swap');
    body { background:#f4ece0; color:#2c2c2c; font-family:'Crimson Pro',serif; line-height:1.7; margin:0; padding:0; text-align:justify; }
    .page { max-width: 95%; margin: 10px auto; background: white; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.05); border-radius: 5px; }
    @media (min-width: 768px) { .page { max-width: 800px; padding: 60px 80px; margin: 40px auto; } }
    h1 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 2.5rem; margin: 40px 0; }
    h2 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 1.8rem; margin: 40px 0 20px 0; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    p { margin-bottom: 1.2rem; text-indent: 2rem; font-size: 1.2rem; }
    .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 8px double #8b6b23; margin: 10px; background:white;}
</style></head><body>`;

window.downloadSingle = (i, format) => {
    const card = document.querySelectorAll('.chapter-card')[i];
    const t = card.querySelector('.ch-title-input').value;
    const c = card.querySelector('.ch-content-input').value;
    let res = (format === 'html') ? 
        `${htmlHeader(t)}<div class="page"><h2>${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div></body></html>` : 
        `[ ${t} ]\n\n${c}`;
    saveFile(res, `${t}.${format}`, format);
};

window.downloadFull = (format) => {
    const title = getEl('novelTitle').value || 'Novel';
    let res = "";
    if (format === 'html') {
        res = `${htmlHeader(title)}<div class="cover"><h1>${title}</h1><p>Karya Sastra Terpilih</p></div>`;
        document.querySelectorAll('.chapter-card').forEach(card => {
            const t = card.querySelector('.ch-title-input').value;
            const c = card.querySelector('.ch-content-input').value;
            res += `<div class="page"><h2>${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div>`;
        });
        res += "</body></html>";
    } else {
        document.querySelectorAll('.chapter-card').forEach(card => {
            res += `\n\n--- ${card.querySelector('.ch-title-input').value.toUpperCase()} ---\n\n${card.querySelector('.ch-content-input').value}`;
        });
    }
    saveFile(res, `${title}_Lengkap.${format}`, format);
};

function saveFile(str, name, format) {
    const blob = new Blob([str], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name; a.click();
}

window.clearAllData = () => { if(confirm("Hapus semua draf?")) { localStorage.clear(); location.reload(); } };

window.onload = window.loadDraft;
