document.addEventListener('DOMContentLoaded', () => {
    const getEl = id => document.getElementById(id);
    let timerInterval;
    let abortController;

    // --- 1. SISTEM POPUP (Timer & Status) ---
    function showPopup(msg) {
        let seconds = 0;
        getEl('popupTimer').innerText = "0s";
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            seconds++;
            getEl('popupTimer').innerText = seconds + "s";
        }, 1000);

        getEl('aiPopup').classList.remove('hidden');
        getEl('popupStatus').innerText = msg;
        getEl('engineStatus').innerText = "Engine: Normal...";
        getEl('engineStatus').className = "text-green-500 text-[10px] font-bold";
    }

    function hidePopup() {
        getEl('aiPopup').classList.add('hidden');
        clearInterval(timerInterval);
    }

    window.cancelProcess = () => {
        if (abortController) {
            abortController.abort();
            hidePopup();
            alert("Proses Dibatalkan.");
        }
    };

    // --- 2. SISTEM PENYIMPANAN (Local Storage) ---
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

    function loadDraft() {
        const saved = localStorage.getItem('tebe_v15_master');
        if (!saved) return;
        const data = JSON.parse(saved);
        getEl('novelTitle').value = data.title || "";
        getEl('genre').value = data.genre || "";
        getEl('style').value = data.style || "";
        getEl('storyIdea').value = data.idea || "";
        if (data.workspaceVisible) renderWorkspace(data.chapters, data.title);
    }

    // --- 3. ENGINE API GEMINI ---
    window.checkAndSaveApi = async () => {
        const key = getEl('apiKey').value.trim();
        if(!key) return alert("Masukkan API Key!");
        showPopup("Menghubungkan Engine...");
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
            }
        } catch (e) {
            getEl('engineStatus').innerText = "Engine: Gangguan!";
            getEl('engineStatus').className = "text-red-500 text-[10px] font-bold";
            alert("Gagal terhubung ke API.");
        } finally { setTimeout(hidePopup, 800); }
    };

    async function callAI(prompt) {
        const key = getEl('apiKey').value;
        const model = getEl('modelSelect').value;
        abortController = new AbortController();
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortController.signal,
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }], 
                generationConfig: { temperature: 0.8, maxOutputTokens: 8192 } 
            })
        });
        const data = await res.json();
        if (!data.candidates) throw new Error("AI Sibuk.");
        let text = data.candidates[0].content.parts[0].text;
        return text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
    }

    // --- 4. CORE FUNCTIONS (Plan & Write) ---
    window.planNovel = async () => {
        const idea = getEl('storyIdea').value;
        if(!idea) return alert("Isi Ide Utama!");
        showPopup("Merancang Alur...");
        try {
            const count = getEl('chapterCount').value || 3;
            const prompt = `Buat alur novel JSON murni: [{"label":"Bab 1","judul":"...","ringkasan":"..."}]. Buat ${count} bab. Ide: ${idea}`;
            const raw = await callAI(prompt);
            const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
            renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
            saveDraft();
        } catch (e) { if(e.name !== 'AbortError') alert("Gagal merancang."); }
        finally { hidePopup(); }
    };

    window.writeChapter = async (i) => {
        showPopup(`Menulis Bab ${i+1}...`);
        const titles = document.querySelectorAll('.ch-title-input');
        const summaries = document.querySelectorAll('.ch-summary-input');
        
        let pastContext = "";
        for(let j=0; j<i; j++) { pastContext += `Bab ${j+1}: ${summaries[j].value}\n`; }

        const prompt = `Tulis naskah UNTUK BAB INI SAJA: "${titles[i].value}". 
        Alur: ${summaries[i].value}. Konteks: ${pastContext || "Awal."}
        PENTING: Minimal 1500 kata. Gunakan koma, titik, spasi dengan benar. JANGAN tulis bab selanjutnya.`;

        try {
            const res = await callAI(prompt);
            document.querySelectorAll('.ch-content-input')[i].value = res;
            saveDraft();
        } catch (e) { if(e.name !== 'AbortError') alert("Gagal menulis."); }
        finally { hidePopup(); }
    };

    function renderWorkspace(plan, title) {
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
                    <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black">TULIS</button>
                </div>
                <textarea class="ch-content-input content-box mt-4" rows="15" oninput="window.saveDraft()">${item.content || ""}</textarea>
                <div class="flex justify-end gap-2 mt-2">
                    <button onclick="downloadSingle(${i}, 'txt')" class="text-[9px] bg-gray-800 px-3 py-1 rounded text-gray-400">UNDUH .TXT</button>
                    <button onclick="downloadSingle(${i}, 'html')" class="text-[9px] border border-gray-800 px-3 py-1 rounded text-gray-400">UNDUH .HTML</button>
                </div>
            </div>
        `).join('');
    }

    // --- 5. SISTEM UNDUH MEWAH ---
    window.downloadSingle = (i, format) => {
        const card = document.querySelectorAll('.chapter-card')[i];
        const t = card.querySelector('.ch-title-input').value;
        const c = card.querySelector('.ch-content-input').value;
        let res = "";
        if (format === 'html') {
            res = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&family=Cinzel:wght@700&display=swap');body{background:#f4ece0;background-image:url('https://www.transparenttextures.com/patterns/paper-fibers.png');color:#2c2c2c;font-family:'Crimson Pro',serif;line-height:1.8;padding:80px 15%;text-align:justify;}.container{max-width:800px;margin:auto;background:white;padding:60px;box-shadow:0 0 20px rgba(0,0,0,0.1);border-radius:5px;}h2{font-family:'Cinzel',serif;text-align:center;color:#8b6b23;font-size:2.2rem;border-bottom:2px double #8b6b23;padding-bottom:10px;margin-bottom:40px;}p{margin-bottom:1.5rem;text-indent:3rem;font-size:1.25rem;}</style></head><body><div class="container"><h2>${t}</h2>${c.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div></body></html>`;
        } else {
            res = `[ ${t.toUpperCase()} ]\n\n${c}`;
        }
        const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${t}.${format}`; a.click();
    };

    window.downloadFull = (format) => {
        const title = getEl('novelTitle').value || 'Novel';
        let res = "";
        if (format === 'html') {
            res = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>@import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&family=Cinzel:wght@700&display=swap');body{background:#f4ece0;background-image:url('https://www.transparenttextures.com/patterns/paper-fibers.png');color:#2c2c2c;font-family:'Crimson Pro',serif;line-height:1.8;padding:100px 10%;text-align:justify;}.cover{height:80vh;display:flex;flex-direction:column;justify-content:center;align-items:center;border:10px double #8b6b23;margin-bottom:100px;background:white;}.cover h1{font-family:'Cinzel',serif;font-size:4rem;color:#8b6b23;margin:0;}.chapter-box{max-width:850px;margin:0 auto 100px auto;background:white;padding:80px;box-shadow:0 10px 30px rgba(0,0,0,0.05);}h2{font-family:'Cinzel',serif;text-align:center;color:#8b6b23;font-size:2.5rem;margin-bottom:50px;page-break-before:always;}p{margin-bottom:1.5rem;text-indent:3.5rem;font-size:1.3rem;}</style></head><body><div class="cover"><h1>${title}</h1></div>`;
            document.querySelectorAll('.chapter-card').forEach(card => {
                res += `<div class="chapter-box"><h2>${card.querySelector('.ch-title-input').value}</h2>${card.querySelector('.ch-content-input').value.split('\n').filter(p=>p.trim()!="").map(p=>`<p>${p.trim()}</p>`).join('')}</div>`;
            });
            res += "</body></html>";
        } else {
            document.querySelectorAll('.chapter-card').forEach(card => {
                res += `\n\n--- ${card.querySelector('.ch-title-input').value.toUpperCase()} ---\n\n${card.querySelector('.ch-content-input').value}`;
            });
        }
        const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${title}_Full.${format}`; a.click();
    };

    window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.removeItem('tebe_v15_master'); location.reload(); } };

    // --- INITIALIZE ---
    getEl('btnCheck').onclick = checkAndSaveApi;
    getEl('btnPlan').onclick = planNovel;
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) { getEl('apiKey').value = savedKey; checkAndSaveApi(); }
    loadDraft();
});
