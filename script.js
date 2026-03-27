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
    if (data.workspaceVisible && data.chapters.length > 0) renderWorkspace(data.chapters, data.title);
}

function showPopup(msg) {
    document.getElementById('aiPopup').classList.remove('hidden');
    document.getElementById('popupStatus').innerText = msg;
}

function hidePopup() { document.getElementById('aiPopup').classList.add('hidden'); }

async function checkAndSaveApi() {
    const key = document.getElementById('apiKey').value;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if(data.models) {
            localStorage.setItem('tebe_key_v15', key);
            document.getElementById('savedTag').classList.remove('hidden');
            const select = document.getElementById('modelSelect');
            select.innerHTML = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'))
                .map(m => `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`).join('');
            document.getElementById('engineWrapper').classList.remove('hidden');
            document.getElementById('btnCheck').innerText = "ENGINE READY ✓";
            document.getElementById('btnCheck').className = "w-full py-2 bg-green-900 text-white text-xs font-bold rounded";
        }
    } catch (e) { alert("API Error."); }
}

// --- PERBAIKAN PEMBERSIH TEKS: Menjaga Spasi & Tanda Baca ---
function cleanAIText(text) {
    return text
        .replace(/^.*?(Berikut adalah|Ini adalah|Tentu|Halo|Baiklah).*?(\n|:)/gi, '') // Hapus pembukaan
        .replace(/\\n/g, '\n') // Pastikan baris baru benar
        .replace(/\\"/g, '"') // Pastikan tanda petik benar
        .replace(/[\/\\](?![nrt"'])/g, '') // Hapus garis miring liar KECUALI karakter escape penting
        .trim();
}

async function callAI(prompt) {
    const key = document.getElementById('apiKey').value;
    const model = document.getElementById('modelSelect').value;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 8192, temperature: 0.8 }
        })
    });
    const data = await res.json();
    if (!data.candidates) throw new Error("Gagal respons.");
    return cleanAIText(data.candidates[0].content.parts[0].text);
}

async function planNovel() {
    const idea = document.getElementById('storyIdea').value;
    if(!idea) return alert("Isi ide!");
    showPopup("Merancang Alur...");
    const prompt = `Planner Novel. Ide: ${idea}. Buat alur JSON: [{"label":"Bab 1","judul":"...","ringkasan":"..."}]`;
    try {
        const raw = await callAI(prompt);
        const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
        renderWorkspace(JSON.parse(jsonPart), document.getElementById('novelTitle').value);
        saveDraft();
    } catch (e) { alert("Error: " + e.message); }
    finally { hidePopup(); }
}

async function writeChapter(i) {
    showPopup(`Menulis Bab ${i+1}...`);
    let past = "";
    const sums = document.querySelectorAll('.ch-summary-input');
    for(let j=0; j<i; j++) past += `Bab ${j+1}: ${sums[j].value}\n`;
    
    const prompt = `Ghostwriter Profesional. Genre: ${document.getElementById('genre').value}. Gaya: ${document.getElementById('style').value}.
    Konteks: ${past}
    Bab: ${document.querySelectorAll('.ch-title-input')[i].value}. Alur: ${sums[i].value}.
    WAJIB: Gunakan spasi yang benar antar kata. Gunakan tanda koma (,) dan titik (.) secara tepat. Jangan menggabungkan dua kata menjadi satu. Tulis minimal 1500 kata.`;

    try {
        const res = await callAI(prompt);
        document.getElementById(`content-ch-${i}`).value = res;
        saveDraft();
    } catch (e) { alert("Error: " + e.message); }
    finally { hidePopup(); }
}

function renderWorkspace(plan, title) {
    document.getElementById('mainPlaceholder').classList.add('hidden');
    const area = document.getElementById('chaptersArea');
    document.getElementById('displayTitle').innerText = title;
    document.getElementById('novelWorkspace').classList.remove('hidden');
    area.innerHTML = plan.map((item, i) => `
        <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 space-y-4 mb-8">
            <div class="flex justify-between border-b border-gray-800 pb-4">
                <div class="flex-1">
                    <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                    <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none novel-font" value="${item.judul}" oninput="saveDraft()">
                    <textarea class="ch-summary-input summary-box mt-2" rows="3" oninput="saveDraft()">${item.ringkasan}</textarea>
                </div>
                <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black">TULIS</button>
            </div>
            <textarea id="content-ch-${i}" class="ch-content-input content-box" rows="15" oninput="saveDraft()">${item.content || ""}</textarea>
        </div>
    `).join('');
}

function downloadFull(format) {
    const title = document.getElementById('novelTitle').value || 'Novel';
    let res = format === 'html' ? '<html><body style="background:#917e5d; font-family:serif; padding:50px; line-height:1.6;">' : '';
    document.querySelectorAll('.chapter-card').forEach(card => {
        const t = card.querySelector('.ch-title-input').value;
        const c = card.querySelector('.ch-content-input').value;
        if(format === 'html') res += `<h2>${t}</h2>` + c.split('\n').map(p => `<p>${p}</p>`).join('');
        else res += `\n\n--- ${t} ---\n\n${c}`;
    });
    const blob = new Blob([res], { type: format === 'html' ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${title}_Full.${format}`; a.click();
}

function clearAllData() { if(confirm("Hapus?")) { localStorage.removeItem('tebe_v15_repair'); location.reload(); } }
window.onload = () => {
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) { document.getElementById('apiKey').value = savedKey; checkAndSaveApi(); }
    loadDraft();
};
      
