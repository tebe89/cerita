document.addEventListener('DOMContentLoaded', () => {
    const getEl = id => document.getElementById(id);
    let timerInterval;
    let abortController;

    // --- 1. POPUP SYSTEM ---
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

    // --- 2. STORAGE SYSTEM ---
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

    // --- 3. API ENGINE ---
    window.checkAndSaveApi = async () => {
        const key = getEl('apiKey').value.trim();
        if(!key) return;
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
        } catch (e) { console.error("API Error"); }
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
        if (!data.candidates) throw new Error("AI Busy");
        return data.candidates[0].content.parts[0].text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
    }

    // --- 4. CORE ACTIONS ---
    window.planNovel = async () => {
        const idea = getEl('storyIdea').value;
        if(!idea) return alert("Isi Ide Utama!");
        showPopup("Merancang Alur...");
        try {
            const count = getEl('chapterCount').value || 3;
            const prompt = `Buat alur novel JSON murni: [{"label":"Prolog","judul":"...","ringkasan":"..."},{"label":"Bab 1","judul":"...","ringkasan":"..."},{"label":"Epilog","judul":"...","ringkasan":"..."}]. Total bab utama ${count}. Ide: ${idea}`;
            const raw = await callAI(prompt);
            const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
            renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
            saveDraft();
        } catch (e) { if(e.name !== 'AbortError') alert("Gagal merancang."); }
        finally { hidePopup(); }
    };

    window.writeChapter = async (i) => {
        showPopup(`Menulis ${document.querySelectorAll('.ch-label')[i].innerText}...`);
        const titles = document.querySelectorAll('.ch-title-input');
        const summaries = document.querySelectorAll('.ch-summary-input');
        const prompt = `Tulis naskah: "${titles[i].value}". Alur: ${summaries[i].value}. PENTING: Minimal 1500 kata. Pakai koma, titik, spasi dengan benar. JANGAN tulis bab selanjutnya.`;
        try {
            const res = await callAI(prompt);
            document.querySelectorAll('.ch-content-input')[i].value = res;
            saveDraft();
        } catch (e) { if(e.name !== 'AbortError') alert("Gagal."); }
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

    // --- 5. FIXED DOWNLOAD SYSTEM (PORTRAIT OPTIMIZED) ---
    const htmlHeader = (title) => `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;700&family=Cinzel:wght@700&display=swap');
        body { background:#f4ece0; color:#2c2c2c; font-family:'Crimson Pro',serif; line-height:1.7; margin:0; padding:0; text-align:justify; }
        .page { max-width: 90%; margin: 20px auto; background: white; padding: 25px; box-shadow: 0 0 10px rgba(0,0,0,0.05); border-radius: 5px; }
        @media (min-width: 768px) { .page { max-width: 700px; padding: 50px 70px; margin: 40px auto; } }
        h1 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 2.2rem; margin-top: 50px; }
        h2 { font-family:'Cinzel',serif; text-align:center; color:#8b6b23; font-size: 1.6rem; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-top: 40px; }
        p { margin-bottom: 1.2rem; text-indent: 2rem; font-size: 1.15rem; }
        .cover { height: 90vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; border: 5px double #8b6b23; margin: 20px; }
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

    window.clearAllData = () => { if(confirm("Hapus draf?")) { localStorage.removeItem('tebe_v15_master'); location.reload(); } };

    // --- INIT ---
    getEl('btnCheck').onclick = checkAndSaveApi;
    getEl('btnPlan').onclick = planNovel;
    loadDraft();
});
