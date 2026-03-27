// MEMASTIKAN SCRIPT BERJALAN SETELAH HTML DIMUAT
document.addEventListener('DOMContentLoaded', () => {
    const getEl = id => document.getElementById(id);
    let timerInterval;
    let abortController;

    // --- POPUP LOGIC ---
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

    // --- STORAGE ---
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
        localStorage.setItem('tebe_v15_final', JSON.stringify(data));
    };

    function loadDraft() {
        const saved = localStorage.getItem('tebe_v15_final');
        if (!saved) return;
        const data = JSON.parse(saved);
        getEl('novelTitle').value = data.title;
        getEl('genre').value = data.genre;
        getEl('style').value = data.style;
        getEl('storyIdea').value = data.idea;
        if (data.workspaceVisible) renderWorkspace(data.chapters, data.title);
    }

    // --- API CORE ---
    async function checkAndSaveApi() {
        const key = getEl('apiKey').value.trim();
        if(!key) return alert("Masukan API Key!");
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
            } else { throw new Error(); }
        } catch (e) {
            getEl('engineStatus').innerText = "Engine: Gangguan!";
            getEl('engineStatus').className = "text-red-500 text-[10px] font-bold";
            alert("API Key Salah atau Error Jaringan.");
        } finally { setTimeout(hidePopup, 800); }
    }

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
        if (!data.candidates) throw new Error("AI Sibuk.");
        let text = data.candidates[0].content.parts[0].text;
        // PEMBERSIH: Hanya buang salam pembuka, jaga koma & spasi.
        return text.replace(/^.*?(Berikut|Tentu|Halo|Baiklah).*?(\n|:)/gi, '').trim();
    }

    async function planNovel() {
        const idea = getEl('storyIdea').value;
        if(!idea) return alert("Isi Ide!");
        showPopup("Merancang Alur...");
        try {
            const raw = await callAI(`Buat alur novel JSON: [{"label":"Bab 1","judul":"...","ringkasan":"..."}]. Ide: ${idea}`);
            const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
            renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
            saveDraft();
        } catch (e) { if(e.name !== 'AbortError') alert("Gagal Merancang."); }
        finally { hidePopup(); }
    }

    window.writeChapter = async function(i) {
        showPopup(`Menulis Bab ${i+1}...`);
        const titles = document.querySelectorAll('.ch-title-input');
        const summaries = document.querySelectorAll('.ch-summary-input');
        const prompt = `Tulis cerita novel: ${titles[i].value}. Alur: ${summaries[i].value}. 
        PENTING: Gunakan tanda baca koma (,) dan titik (.) dengan benar. Gunakan spasi antar kata. Minimal 1500 kata.`;
        try {
            const res = await callAI(prompt);
            document.querySelectorAll('.ch-content-input')[i].value = res;
            saveDraft();
        } catch (e) { if(e.name !== 'AbortError') alert("Gagal Menulis."); }
        finally { hidePopup(); }
    };

    function renderWorkspace(plan, title) {
        getEl('mainPlaceholder').classList.add('hidden');
        getEl('displayTitle').innerText = title || "Karya Tebe";
        getEl('novelWorkspace').classList.remove('hidden');
        getEl('chaptersArea').innerHTML = plan.map((item, i) => `
            <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 space-y-4 mb-8">
                <div class="flex justify-between border-b border-gray-800 pb-4">
                    <div class="flex-1">
                        <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                        <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none novel-font text-white" value="${item.judul}" oninput="saveDraft()">
                        <textarea class="ch-summary-input summary-box mt-2" rows="3" oninput="saveDraft()">${item.ringkasan}</textarea>
                    </div>
                    <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500">TULIS</button>
                </div>
                <textarea class="ch-content-input content-box" rows="15" oninput="saveDraft()">${item.content || ""}</textarea>
            </div>
        `).join('');
    }

    // --- EVENT BINDING ---
    getEl('btnCheck').onclick = checkAndSaveApi;
    getEl('btnPlan').onclick = planNovel;

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

    window.clearAllData = () => { if(confirm("Hapus?")) { localStorage.removeItem('tebe_v15_final'); location.reload(); } };

    // --- ON LOAD ---
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) { getEl('apiKey').value = savedKey; checkAndSaveApi(); }
    loadDraft();
});
