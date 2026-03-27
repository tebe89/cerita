// --- SISTEM GLOBAL ---
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
    getEl('engineStatus').innerText = "Engine: Normal...";
    getEl('engineStatus').className = "text-green-500 text-[10px] font-bold";
};

window.hidePopup = () => {
    getEl('aiPopup').classList.add('hidden');
    clearInterval(timerInterval);
};

window.cancelProcess = () => {
    if (abortController) { abortController.abort(); window.hidePopup(); alert("Proses Dibatalkan."); }
};

// --- ENGINE & API ---
window.checkAndSaveApi = async () => {
    const key = getEl('apiKey').value.trim();
    if(!key) return alert("Masukkan API Key!");
    window.showPopup("Menghubungkan...");
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            localStorage.setItem('tebe_key_v15', key);
            getEl('savedTag').classList.remove('hidden');
            const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
            getEl('modelSelect').innerHTML = models.map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            getEl('engineWrapper').classList.remove('hidden');
            getEl('btnCheck').innerText = "ENGINE READY ✓";
            getEl('btnCheck').style.backgroundColor = "#064e3b";
        } else { throw new Error(); }
    } catch (e) { 
        getEl('engineStatus').innerText = "Engine: Gagal!"; 
        getEl('engineStatus').className = "text-red-500 text-[10px] font-bold";
        alert("Kunci Salah atau Koneksi Bermasalah."); 
    } finally { setTimeout(window.hidePopup, 800); }
};

async function callAI(prompt) {
    const key = getEl('apiKey').value;
    const model = getEl('modelSelect').value;
    abortController = new AbortController();
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.8 } })
    });
    const data = await res.json();
    if (!data.candidates) throw new Error("AI Error");
    let text = data.candidates[0].content.parts[0].text;
    // Bersihkan sapaan, jaga koma & spasi
    return text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
}

// --- CORE FUNCTIONS ---
window.planNovel = async () => {
    const idea = getEl('storyIdea').value;
    if(!idea) return alert("Isi Ide Utama!");
    window.showPopup("Merancang Alur...");
    try {
        const count = getEl('chapterCount').value || 3;
        const prompt = `Bertindak sebagai arsitek alur. Buat alur novel dalam format JSON murni: [{"label":"Bab 1","judul":"...","ringkasan":"..."}]. Buat sebanyak ${count} bab. Ide: ${idea}`;
        const raw = await callAI(prompt);
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        window.renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Gagal merancang alur."); }
    finally { window.hidePopup(); }
};

window.writeChapter = async (i) => {
    window.showPopup(`Menulis Bab ${i+1}...`);
    const titles = document.querySelectorAll('.ch-title-input');
    const summaries = document.querySelectorAll('.ch-summary-input');
    const prompt = `Tulis naskah UNTUK BAB INI SAJA: "${titles[i].value}". 
    Alur: ${summaries[i].value}.
    Genre: ${getEl('genre').value}. Gaya: ${getEl('style').value}.
    WAJIB: Tulis minimal 1500 kata. JANGAN tulis bab selanjutnya. Gunakan koma (,), titik (.), dan spasi dengan benar. Tanpa salam pembuka.`;
    try {
        const res = await callAI(prompt);
        document.querySelectorAll('.ch-content-input')[i].value = res;
        window.saveDraft();
    } catch (e) { if(e.name !== 'AbortError') alert("Gagal menulis bab."); }
    finally { window.hidePopup(); }
};

window.renderWorkspace = (plan, title) => {
    getEl('mainPlaceholder').classList.add('hidden');
    getEl('displayTitle').innerText = title || "Karya Tebe";
    getEl('novelWorkspace').classList.remove('hidden');
    getEl('chaptersArea').innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 mb-8">
            <div class="flex justify-between border-b border-gray-800 pb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none text-white" value="${item.judul}" oninput="window.saveDraft()">
                    <textarea class="ch-summary-input summary-box mt-2" rows="3" oninput="window.saveDraft()">${item.ringkasan}</textarea>
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500">TULIS</button>
            </div>
            <textarea class="ch-content-input content-box mt-4" rows="15" oninput="window.saveDraft()">${item.content || ""}</textarea>
            <div class="flex justify-end gap-2 mt-2">
                <button onclick="downloadSingle(${i}, 'txt')" class="text-[9px] bg-gray-800 px-3 py-1 rounded text-gray-400">UNDUH .TXT</button>
                <button onclick="downloadSingle(${i}, 'html')" class="text-[9px] border border-gray-800 px-3 py-1 rounded text-gray-400">UNDUH .HTML</button>
            </div>
        </div>
    `).join('');
};

window.saveDraft = () => {
    const data = {
        title: getEl('novelTitle').value,
        genre: getEl('genre').value,
        style: getEl('style').value,
        idea: getEl('storyIdea').value,
        workspaceVisible: !getEl('novelWorkspace').classList.contains('hidden'),
        chapters: []
    };
    document.querySelectorAll('.chapter-card').forEach((card) => {
        data.chapters.push({
            label: card.querySelector('.ch-label').innerText,
            judul: card.querySelector('.ch-title-input').value,
            summary: card.querySelector('.ch-summary-input').value,
            content: card.querySelector('.ch-content-input').value
        });
    });
    localStorage.setItem('tebe_v15_master', JSON.stringify(data));
};

window.loadDraft = () => {
    const saved = localStorage.getItem('tebe_v15_master');
    if (!saved) return;
    const data = JSON.parse(saved);
    getEl('novelTitle').value = data.title;
    getEl('genre').value = data.genre;
    getEl('style').value = data.style;
    getEl('storyIdea').value = data.idea;
    if (data.workspaceVisible) window.renderWorkspace(data.chapters, data.title);
};

window.downloadSingle = (i, format) => {
    const card = document.querySelectorAll('.chapter-card')[i];
    const t = card.querySelector('.ch-title-input').value;
    const c = card.querySelector('.ch-content-input').value;
    let res = format === 'html' ? `<html><body style="background:#917e5d; font-family:serif; padding:40px; line-height:1.6; text-align:justify;"><h2>${t}</h2><p>${c.replace(/\n/g, '</p><p>')}</p></body></html>` : `[ ${t} ]\n\n${c}`;
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${t}.${format}`; a.click();
};

window.downloadFull = (format) => {
    const title = getEl('novelTitle').value || 'Novel';
    let res = "";
    document.querySelectorAll('.chapter-card').forEach(card => {
        const t = card.querySelector('.ch-title-input').value;
        const c = card.querySelector('.ch-content-input').value;
        res += (format === 'html') ? `<h2>${t}</h2><p>${c.replace(/\n/g, '</p><p>')}</p>` : `\n\n--- ${t} ---\n\n${c}`;
    });
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${title}_Full.${format}`; a.click();
};

window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.removeItem('tebe_v15_master'); location.reload(); } };

window.onload = () => {
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) { getEl('apiKey').value = savedKey; window.checkAndSaveApi(); }
    window.loadDraft();
};
