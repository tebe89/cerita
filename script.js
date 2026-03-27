// Memastikan semua elemen siap sebelum skrip berjalan
document.addEventListener('DOMContentLoaded', () => {
    
    const getEl = id => document.getElementById(id);

    // --- SISTEM POPUP ---
    function showPopup(msg) {
        getEl('aiPopup').classList.remove('hidden');
        getEl('popupStatus').innerText = msg;
    }
    function hidePopup() { getEl('aiPopup').classList.add('hidden'); }

    // --- SISTEM PENYIMPANAN ---
    function saveDraft() {
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
    }

    // --- KONEKSI API ---
    async function checkAndSaveApi() {
        const key = getEl('apiKey').value.trim();
        if(!key) return alert("Mohon masukkan Gemini API Key Anda!");
        
        showPopup("Menghubungkan ke Google AI...");
        
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            const data = await res.json();
            
            if(data.models) {
                localStorage.setItem('tebe_key_v15', key);
                getEl('savedTag').classList.remove('hidden');
                
                const models = data.models.filter(m => m.supportedGenerationMethods.includes('generateContent'));
                getEl('modelSelect').innerHTML = models.map(m => 
                    `<option value="${m.name}">${m.displayName.replace("Gemini ","")}</option>`
                ).join('');
                
                getEl('engineWrapper').classList.remove('hidden');
                getEl('btnCheck').innerText = "ENGINE READY ✓";
                getEl('btnCheck').style.backgroundColor = "#064e3b"; // Hijau tua
                getEl('btnCheck').style.color = "white";
                console.log("Koneksi Berhasil");
            } else if (data.error) {
                alert("API Error: " + data.error.message);
            }
        } catch (e) {
            alert("Gagal terhubung. Pastikan internet aktif atau coba gunakan browser Chrome/Edge terbaru.");
            console.error(e);
        } finally {
            hidePopup();
        }
    }

    // --- EKSEKUSI AI ---
    async function callAI(prompt) {
        const key = getEl('apiKey').value;
        const model = getEl('modelSelect').value;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.8, topP: 0.95 }
            })
        });
        const data = await res.json();
        if (!data.candidates) throw new Error("AI tidak merespon");
        return data.candidates[0].content.parts[0].text.trim();
    }

    async function planNovel() {
        const idea = getEl('storyIdea').value;
        if(!idea) return alert("Isi ide utamanya dulu, Tamroni.");
        showPopup("Merancang Alur...");
        const prompt = `Buat alur novel dalam JSON murni (tanpa kata pembuka): [{"label":"Bab 1","judul":"...","ringkasan":"..."}]. Ide: ${idea}`;
        try {
            const raw = await callAI(prompt);
            const jsonPart = raw.substring(raw.indexOf('['), raw.lastIndexOf(']') + 1);
            renderWorkspace(JSON.parse(jsonPart), getEl('novelTitle').value);
            saveDraft();
        } catch (e) { alert("Gagal merancang alur."); }
        finally { hidePopup(); }
    }

    window.writeChapter = async function(i) {
        showPopup(`Sedang Menulis Bab ${i+1}...`);
        const titles = document.querySelectorAll('.ch-title-input');
        const summaries = document.querySelectorAll('.ch-summary-input');
        const prompt = `Tulis Bab Novel: ${titles[i].value}. Alur: ${summaries[i].value}. 
        Gaya: ${getEl('style').value}. Genre: ${getEl('genre').value}.
        PENTING: Gunakan bahasa Indonesia yang rapi, pakai koma (,) dan titik (.) dengan benar, pastikan ada spasi antar kata. Minimal 1500 kata.`;
        
        try {
            const res = await callAI(prompt);
            document.querySelectorAll('.ch-content-input')[i].value = res;
            saveDraft();
        } catch (e) { alert("Gagal menulis bab."); }
        finally { hidePopup(); }
    };

    function renderWorkspace(plan, title) {
        getEl('mainPlaceholder').classList.add('hidden');
        getEl('displayTitle').innerText = title || "Karya Tanpa Judul";
        getEl('novelWorkspace').classList.remove('hidden');
        getEl('chaptersArea').innerHTML = plan.map((item, i) => `
            <div class="chapter-card bg-[#111] p-6 rounded-2xl border border-gray-900 space-y-4 mb-8">
                <div class="flex justify-between border-b border-gray-800 pb-4">
                    <div class="flex-1">
                        <span class="ch-label text-[9px] gold-text font-bold uppercase">${item.label}</span>
                        <input type="text" class="ch-title-input w-full text-lg font-bold bg-transparent outline-none novel-font text-white" value="${item.judul}">
                        <textarea class="ch-summary-input summary-box mt-2" rows="3">${item.ringkasan}</textarea>
                    </div>
                    <button onclick="writeChapter(${i})" class="h-fit bg-white text-black px-6 py-2 rounded-full text-[10px] font-black hover:bg-yellow-500">TULIS</button>
                </div>
                <textarea class="ch-content-input content-box" rows="15" placeholder="Hasil akan muncul di sini..."></textarea>
            </div>
        `).join('');
    }

    // --- PENGIKAT TOMBOL ---
    getEl('btnCheck').addEventListener('click', checkAndSaveApi);
    getEl('btnPlan').addEventListener('click', planNovel);
    
    // Auto Load Key
    const savedKey = localStorage.getItem('tebe_key_v15');
    if (savedKey) {
        getEl('apiKey').value = savedKey;
        checkAndSaveApi();
    }
});
