// ======================== TEBE STORY MAKER v15 ========================
// Perbaikan deteksi model & fallback manual

// State utama
let chapters = [];
let currentApiKey = "";
let availableModels = [];
let selectedModel = "";
let novelConcept = { title: "", genre: "", style: "", idea: "" };
let isGenerating = false;

// DOM Elements
const apiKeyInput = document.getElementById("apiKeyInput");
const connectBtn = document.getElementById("connectModelsBtn");
const modelSelect = document.getElementById("modelSelect");
const newChapterBtn = document.getElementById("newChapterBtn");
const chaptersContainer = document.getElementById("chaptersContainer");
const chapterCountBadge = document.getElementById("chapterCountBadge");
const exportFullTxt = document.getElementById("exportFullTxtBtn");
const exportFullHtml = document.getElementById("exportFullHtmlBtn");

const novelTitleInput = document.getElementById("novelTitle");
const novelGenreInput = document.getElementById("novelGenre");
const novelStyleInput = document.getElementById("novelStyle");
const novelIdeaInput = document.getElementById("novelIdea");

// ======================== UTILITIES ========================
function cleanRawText(raw) {
  if (!raw) return "";
  let cleaned = raw.replace(/^(Berikut (adalah )?ceritanya[:]?|Inilah (cerita|narasi)nya[:]?|Tentu,? (berikut|ini) (cerita|narasi)nya[:]?|Baiklah,? (berikut|ini) (cerita|narasi)nya[:]?|Sebagai AI,? )\s*/i, "");
  cleaned = cleaned.replace(/^\s*["']?(Cerita|Narasi|Bab)\s*\d*[:]\s*/i, "");
  cleaned = cleaned.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\//g, "/").replace(/\\\\/g, "\\");
  return cleaned.trim();
}

function buildContextSummary() {
  if (chapters.length === 0) return "Belum ada bab sebelumnya.";
  let summary = "RINGKASAN CERITA SEBELUMNYA:\n";
  chapters.forEach((ch, idx) => {
    summary += `Bab ${idx+1}: ${ch.title}\nRingkasan: ${ch.summary || "Tidak ada ringkasan"}\n\n`;
  });
  return summary;
}

function buildNewChapterPrompt() {
  const concept = novelConcept;
  const context = buildContextSummary();
  const nextChapterNum = chapters.length + 1;
  let prompt = `Anda adalah penulis novel profesional. Tulis bab ${nextChapterNum} dari novel berjudul "${concept.title || 'Tanpa Judul'}".\n`;
  prompt += `Genre: ${concept.genre || 'Bebas'}. Gaya: ${concept.style || 'Naratif epik'}.\n`;
  prompt += `Ide awal: ${concept.idea || 'Kembangkan cerita dengan imajinasi tinggi'}.\n`;
  prompt += `Konteks: ${context}\n`;
  prompt += `Instruksi: Tulis bab ini dengan narasi yang mendalam, deskriptif, dan berkelanjutan. Jangan sertakan sapaan seperti "Berikut ceritanya" atau komentar meta. Berikan judul bab yang menarik, lalu isi cerita. Pisahkan judul dan isi dengan baris baru. Format: JUDUL: ...\\n\\nISI CERITA: ...\n`;
  prompt += `Pastikan tanda baca tetap utuh, gunakan bahasa Indonesia yang baik.`;
  return prompt;
}

async function streamGenerateChapter(prompt, apiKey, modelName) {
  // Pastikan modelName tidak mengandung "models/" lagi
  const cleanModel = modelName.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 2048 },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API Error: ${response.status} - ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6);
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const chunk = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (chunk) fullText += chunk;
        } catch (e) { /* abaikan */ }
      }
    }
  }
  return fullText;
}

function parseChapterContent(raw) {
  let cleaned = cleanRawText(raw);
  let title = "Bab Baru";
  let content = cleaned;

  const titleMatch = cleaned.match(/^(?:JUDUL\s*:?\s*|Bab\s*\d+\s*:?\s*)(.+?)(?:\n|$)/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
    content = cleaned.replace(titleMatch[0], "").trim();
  } else {
    const firstLineEnd = cleaned.indexOf("\n");
    if (firstLineEnd > 0 && firstLineEnd < 80) {
      title = cleaned.substring(0, firstLineEnd).trim();
      content = cleaned.substring(firstLineEnd).trim();
    }
  }
  if (title.length > 80) title = title.substring(0, 80);
  return { title, content };
}

function persistData() {
  const data = { chapters, novelConcept, currentApiKey, selectedModel, availableModels };
  localStorage.setItem("tebeStoryMaker", JSON.stringify(data));
}

function loadPersistedData() {
  const saved = localStorage.getItem("tebeStoryMaker");
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    chapters = data.chapters || [];
    novelConcept = data.novelConcept || { title: "", genre: "", style: "", idea: "" };
    currentApiKey = data.currentApiKey || "";
    selectedModel = data.selectedModel || "";
    availableModels = data.availableModels || [];
    if (currentApiKey) apiKeyInput.value = currentApiKey;
    novelTitleInput.value = novelConcept.title;
    novelGenreInput.value = novelConcept.genre;
    novelStyleInput.value = novelConcept.style;
    novelIdeaInput.value = novelConcept.idea;
    if (availableModels.length) {
      populateModelDropdown();
      if (selectedModel && availableModels.includes(selectedModel)) modelSelect.value = selectedModel;
    } else {
      // Fallback model default jika tidak ada
      availableModels = ['gemini-1.5-flash', 'gemini-1.5-pro'];
      selectedModel = 'gemini-1.5-flash';
      populateModelDropdown();
    }
    renderChapters();
  } catch(e) { console.warn(e); }
}

function renderChapters() {
  if (!chaptersContainer) return;
  if (chapters.length === 0) {
    chaptersContainer.innerHTML = `<div class="text-center text-gray-500 py-20 italic">Belum ada bab. Klik "TULIS BAB BARU" untuk memulai masterpiece Anda.</div>`;
    chapterCountBadge.innerText = "0 bab";
    return;
  }
  chapterCountBadge.innerText = `${chapters.length} bab`;
  let html = "";
  chapters.forEach((ch, idx) => {
    html += `
      <div class="chapter-card rounded-lg p-5 shadow-md" data-id="${ch.id}">
        <div class="flex justify-between items-start flex-wrap gap-2 mb-2">
          <h3 class="font-cinzel text-xl text-[#c5a059]">Bab ${idx+1}: ${escapeHtml(ch.title)}</h3>
          <div class="flex gap-2">
            <button class="export-chapter-txt text-xs btn-outline-gold px-2 py-1 rounded" data-idx="${idx}"><i class="fas fa-file-alt"></i> TXT</button>
            <button class="export-chapter-html text-xs btn-outline-gold px-2 py-1 rounded" data-idx="${idx}"><i class="fab fa-html5"></i> HTML</button>
          </div>
        </div>
        <div class="mb-3">
          <label class="text-xs text-gray-400 block">📝 Ringkasan (otomatis / edit)</label>
          <textarea class="summary-textarea w-full p-2 rounded text-sm bg-[#1a1a1a] border border-gray-700" rows="2" data-idx="${idx}" data-field="summary">${escapeHtml(ch.summary || "")}</textarea>
        </div>
        <div>
          <label class="text-xs text-gray-400 block">📄 Isi Cerita</label>
          <textarea class="content-textarea w-full p-2 rounded text-sm bg-[#1a1a1a] border border-gray-700 font-crimson" rows="6" data-idx="${idx}" data-field="content">${escapeHtml(ch.content)}</textarea>
        </div>
      </div>
    `;
  });
  chaptersContainer.innerHTML = html;

  document.querySelectorAll(".summary-textarea, .content-textarea").forEach(ta => {
    ta.addEventListener("change", function() {
      const idx = parseInt(this.dataset.idx);
      const field = this.dataset.field;
      if (!isNaN(idx) && chapters[idx]) {
        chapters[idx][field] = this.value;
        persistData();
        renderChapters();
      }
    });
  });

  document.querySelectorAll(".export-chapter-txt").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.dataset.idx);
      exportChapterTxt(idx);
    });
  });
  document.querySelectorAll(".export-chapter-html").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.dataset.idx);
      exportChapterHtml(idx);
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function exportChapterTxt(idx) {
  const ch = chapters[idx];
  const content = `Judul: ${ch.title}\n\n${ch.content}`;
  downloadFile(`bab_${idx+1}_${ch.title.replace(/\s+/g, "_")}.txt`, content, "text/plain");
}

function exportChapterHtml(idx) {
  const ch = chapters[idx];
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bab ${idx+1}: ${ch.title}</title><style>body{background:#917e5d; color:#2c2418; font-family:'Crimson Pro',serif; line-height:1.6; padding:2rem; max-width:800px; margin:0 auto;} p{text-indent:1.5em; margin-bottom:0.75em;}</style></head><body><h1>${escapeHtml(ch.title)}</h1>${ch.content.split("\n").map(p => `<p>${escapeHtml(p)}</p>`).join("")}</body></html>`;
  downloadFile(`bab_${idx+1}_${ch.title.replace(/\s+/g, "_")}.html`, html, "text/html");
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportFullTxtFunc() {
  let full = `NOVEL: ${novelConcept.title || "Tanpa Judul"}\nGenre: ${novelConcept.genre || "-"}\n\n`;
  chapters.forEach((ch, i) => {
    full += `========== BAB ${i+1}: ${ch.title} ==========\n${ch.content}\n\n`;
  });
  downloadFile(`${novelConcept.title || "novel"}_full.txt`, full, "text/plain");
}

function exportFullHtmlFunc() {
  let bodyContent = `<div class="paper-html"><h1>${escapeHtml(novelConcept.title || "Novel")}</h1><p><em>Genre: ${escapeHtml(novelConcept.genre || "-")}</em></p>`;
  chapters.forEach((ch, i) => {
    bodyContent += `<h2>Bab ${i+1}: ${escapeHtml(ch.title)}</h2>${ch.content.split("\n").map(p => `<p>${escapeHtml(p)}</p>`).join("")}`;
  });
  bodyContent += `</div>`;
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${novelConcept.title || "Novel"} - Full</title><style>body{margin:0; background:#3e2e1f; display:flex; justify-content:center;} .paper-html{background:#917e5d; color:#2c2418; line-height:1.6; font-family:'Crimson Pro',serif; padding:2rem; max-width:900px; margin:2rem auto; box-shadow:0 0 20px rgba(0,0,0,0.3);} p{text-indent:1.5em; margin-bottom:0.75em;} h1,h2{font-family:'Cinzel',serif; color:#2c1a0a;}</style></head><body>${bodyContent}</body></html>`;
  downloadFile(`${novelConcept.title || "novel"}_full.html`, fullHtml, "text/html");
}

// ======================== CONNECT & MODEL ========================
async function fetchGeminiModels(apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HTTP ${res.status}: ${error}`);
  }
  const data = await res.json();
  console.log("Raw models response:", data); // Debugging
  
  // Ambil semua model yang namanya mengandung "gemini" dan mendukung generateContent
  let models = data.models.filter(m => 
    m.name.toLowerCase().includes("gemini") && 
    (m.supportedGenerationMethods?.includes("generateContent") || m.supportedGenerationMethods?.includes("streamGenerateContent"))
  );
  
  // Jika tidak ada, ambil semua model yang mengandung "gemini" tanpa syarat
  if (models.length === 0) {
    models = data.models.filter(m => m.name.toLowerCase().includes("gemini"));
  }
  
  // Ekstrak nama model (hilangkan "models/")
  const modelNames = models.map(m => m.name.split('/').pop());
  console.log("Model names found:", modelNames);
  return modelNames;
}

function populateModelDropdown() {
  modelSelect.innerHTML = '<option value="">-- Pilih Model --</option>';
  availableModels.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });
  // Tambahkan opsi input manual jika diperlukan
  const manualOption = document.createElement("option");
  manualOption.value = "__manual__";
  manualOption.textContent = "✏️ Input manual...";
  modelSelect.appendChild(manualOption);
}

connectBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) { alert("Masukkan API Key terlebih dahulu"); return; }
  try {
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat model...';
    const models = await fetchGeminiModels(key);
    if (models.length === 0) {
      // Tidak ada model ditemukan: tawarkan input manual
      alert("Tidak ada model Gemini ditemukan secara otomatis. Anda dapat memasukkan nama model secara manual dari dropdown (pilih 'Input manual...'). Pastikan API Key valid.");
      availableModels = [];
      populateModelDropdown();
      currentApiKey = key;
      persistData();
    } else {
      currentApiKey = key;
      availableModels = models;
      populateModelDropdown();
      selectedModel = models[0];
      modelSelect.value = selectedModel;
      persistData();
      alert(`Berhasil! ${models.length} model ditemukan: ${models.join(', ')}`);
    }
  } catch(err) {
    console.error(err);
    alert("Error: " + err.message);
  } finally {
    connectBtn.disabled = false;
    connectBtn.innerHTML = '<i class="fas fa-plug mr-1"></i> Connect & Ambil Model';
  }
});

modelSelect.addEventListener("change", () => {
  if (modelSelect.value === "__manual__") {
    const manualModel = prompt("Masukkan nama model Gemini (contoh: gemini-1.5-flash, gemini-1.5-pro):", "gemini-1.5-flash");
    if (manualModel && manualModel.trim()) {
      const newModel = manualModel.trim();
      if (!availableModels.includes(newModel)) {
        availableModels.push(newModel);
        populateModelDropdown();
      }
      selectedModel = newModel;
      modelSelect.value = newModel;
      persistData();
    } else {
      // Kembalikan ke model yang sebelumnya dipilih
      if (selectedModel) modelSelect.value = selectedModel;
      else modelSelect.value = "";
    }
  } else {
    selectedModel = modelSelect.value;
    persistData();
  }
});

// ======================== GENERATE BAB BARU ========================
newChapterBtn.addEventListener("click", async () => {
  if (isGenerating) { alert("Sedang membuat bab, harap tunggu..."); return; }
  if (!currentApiKey || !selectedModel) { alert("Hubungkan API Key dan pilih model terlebih dahulu."); return; }
  
  novelConcept = {
    title: novelTitleInput.value,
    genre: novelGenreInput.value,
    style: novelStyleInput.value,
    idea: novelIdeaInput.value
  };
  persistData();
  
  const prompt = buildNewChapterPrompt();
  isGenerating = true;
  newChapterBtn.disabled = true;
  newChapterBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI Menulis...';

  try {
    const rawOutput = await streamGenerateChapter(prompt, currentApiKey, selectedModel);
    const { title, content } = parseChapterContent(rawOutput);
    const newChapter = {
      id: Date.now(),
      title: title || `Bab ${chapters.length+1}`,
      summary: "",
      content: content || "(Konten kosong, coba generate ulang)",
      timestamp: Date.now()
    };
    chapters.push(newChapter);
    renderChapters();
    persistData();
    setTimeout(() => {
      const cards = document.querySelectorAll(".chapter-card");
      if (cards.length) cards[cards.length-1].scrollIntoView({ behavior: "smooth" });
    }, 200);
  } catch (err) {
    console.error(err);
    alert("Gagal generate: " + err.message);
  } finally {
    isGenerating = false;
    newChapterBtn.disabled = false;
    newChapterBtn.innerHTML = '<i class="fas fa-feather-alt mr-2"></i> + TULIS BAB BARU';
  }
});

// Event listeners ekspor
exportFullTxt.addEventListener("click", exportFullTxtFunc);
exportFullHtml.addEventListener("click", exportFullHtmlFunc);

// Auto-save konsep
const conceptInputs = [novelTitleInput, novelGenreInput, novelStyleInput, novelIdeaInput];
conceptInputs.forEach(inp => {
  inp.addEventListener("input", () => {
    novelConcept = {
      title: novelTitleInput.value,
      genre: novelGenreInput.value,
      style: novelStyleInput.value,
      idea: novelIdeaInput.value
    };
    persistData();
  });
});

// Inisialisasi
loadPersistedData();
renderChapters();
