
const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const dropZone = $("dropZone");
const analyzeBtn = $("analyzeBtn");

let selectedFile = null;
let selectedImage = null;
let previewURL = null;
let toastTimer;
const historyItems = [];

function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resetAI() {
    $("aiEmpty").classList.remove("hidden");
    $("aiLoading").classList.add("hidden");
    $("aiResult").classList.add("hidden");
    $("aiError").textContent = "";
    $("aiStatus").textContent = "Awaiting image analysis request...";
}

function resetStats() {
    $("widthValue").innerHTML = '—<small> PX</small>';
    $("heightValue").innerHTML = '—<small> PX</small>';
    $("channelsValue").innerHTML = '—<small> CH</small>';
    $("averageValue").textContent = "—";
    $("previewDimensions").textContent = "— × —";
    $("previewColorMode").textContent = "—";
    $("previewSize").textContent = "—";
    $("previewBadge").textContent = "AWAITING INPUT";
    $("sampleCount").textContent = "—";
    $("rgbHex").textContent = "#------";
    $("colorSwatch").style.background = "#131a2a";

    ["red", "green", "blue"].forEach((c) => {
        $(`${c}Value`).textContent = "— / 255";
        $(`${c}Bar`).style.width = "0%";
    });
}

function clearImage() {
    if (previewURL) URL.revokeObjectURL(previewURL);

    previewURL = null;
    selectedFile = null;
    selectedImage = null;
    fileInput.value = "";

    $("thumbnail").removeAttribute("src");
    $("previewImage").removeAttribute("src");
    $("fileDetails").classList.add("hidden");
    $("dropZone").classList.remove("hidden");
    $("previewImage").classList.add("hidden");
    $("previewOverlay").classList.add("hidden");
    $("emptyPreview").classList.remove("hidden");
    $("uploadError").textContent = "";
    analyzeBtn.disabled = true;

    resetStats();
    resetAI();
    toast("Image removed.");
}

function loadImage(file) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        $("uploadError").textContent = "Upload a JPG, PNG or WEBP image.";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        $("uploadError").textContent = "Maximum image size is 10 MB.";
        return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        if (previewURL) URL.revokeObjectURL(previewURL);

        previewURL = url;
        selectedFile = file;
        selectedImage = img;

        $("thumbnail").src = url;
        $("previewImage").src = url;
        $("fileName").textContent = file.name;
        $("fileMeta").textContent = `${formatSize(file.size)} · IMAGE FILE`;

        $("fileDetails").classList.remove("hidden");
        $("dropZone").classList.add("hidden");
        $("previewImage").classList.remove("hidden");
        $("previewOverlay").classList.remove("hidden");
        $("emptyPreview").classList.add("hidden");

        $("previewBadge").textContent = "FEED ACTIVE";
        $("previewDimensions").textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
        $("previewColorMode").textContent = "RGB";
        $("previewSize").textContent = formatSize(file.size);

        $("widthValue").innerHTML = `${img.naturalWidth.toLocaleString()}<small> PX</small>`;
        $("heightValue").innerHTML = `${img.naturalHeight.toLocaleString()}<small> PX</small>`;
        $("channelsValue").innerHTML = '3<small> CH</small>';

        $("uploadError").textContent = "";
        analyzeBtn.disabled = false;

        calculateRGB(img);
        resetAI();
        toast("Image acquisition complete.");
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
        $("uploadError").textContent = "Unable to decode this image.";
    };

    img.src = url;
}

function calculateRGB(img) {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 800 / img.naturalWidth, 800 / img.naturalHeight);

    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let r = 0, g = 0, b = 0;
    let min = 255, max = 0, count = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        r += pixels[i];
        g += pixels[i + 1];
        b += pixels[i + 2];

        min = Math.min(min, pixels[i], pixels[i + 1], pixels[i + 2]);
        max = Math.max(max, pixels[i], pixels[i + 1], pixels[i + 2]);
        count++;
    }

    const rgb = [
        r / count,
        g / count,
        b / count
    ];

    const average = (r + g + b) / (count * 3);
    $("averageValue").textContent = average.toFixed(2);
    $("sampleCount").textContent = count.toLocaleString();

    ["red", "green", "blue"].forEach((color, i) => {
        $( `${color}Value` ).textContent = `${rgb[i].toFixed(2)} / 255`;
        $(`${color}Bar`).style.width = `${rgb[i] / 255 * 100}%`;
    });

    const hex = rgb.map(v =>
        Math.round(v).toString(16).padStart(2, "0")
    ).join("").toUpperCase();

    $("rgbHex").textContent = `#${hex}`;
    $("colorSwatch").style.background = `#${hex}`;

    console.log("Image statistics:", {
        width: img.naturalWidth,
        height: img.naturalHeight,
        minPixel: min,
        maxPixel: max,
        averagePixel: average
    });
}

// Upload and drag/drop
fileInput.addEventListener("change", e => loadImage(e.target.files[0]));
$("removeBtn").addEventListener("click", clearImage);

dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    loadImage(e.dataTransfer.files[0]);
});

// Safely render API data as text, never HTML
function showResult(data) {
    const fields = [
        ["descriptionResult", data.description],
        ["objectsResult", data.objects],
        ["colorsResult", data.colors],
        ["summaryResult", data.summary]
    ];

    fields.forEach(([id, value]) => {
        $(id).textContent = Array.isArray(value)
            ? value.join(", ")
            : String(value ?? "No information returned.");
    });

    $("aiEmpty").classList.add("hidden");
    $("aiLoading").classList.add("hidden");
    $("aiResult").classList.remove("hidden");
    $("aiError").textContent = "";
    $("aiStatus").textContent = "Neural analysis complete";
}

analyzeBtn.addEventListener("click", async () => {
    if (!selectedFile) {
        toast("Upload an image first.");
        return;
    }

    $("aiEmpty").classList.add("hidden");
    $("aiResult").classList.add("hidden");
    $("aiError").textContent = "";
    $("aiLoading").classList.remove("hidden");
    $("aiStatus").textContent = "Processing visual data...";
    analyzeBtn.disabled = true;

    try {
        const form = new FormData();
        form.append("image", selectedFile);

        const response = await fetch("http://127.0.0.1:8000/api/analyze", {
            method: "POST",
            body: form
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `HTTP ${response.status}`);
        }

        showResult(data);

        historyItems.unshift({
            name: selectedFile.name,
            size: formatSize(selectedFile.size),
            preview: previewURL,
            summary: String(data.summary || data.description || "Analysis complete"),
            time: new Date().toLocaleTimeString()
        });

        renderHistory();
        toast("Neural analysis complete.");

    } catch (error) {
        $("aiLoading").classList.add("hidden");
        $("aiEmpty").classList.remove("hidden");
        $("aiStatus").textContent = "Analysis interrupted";
        $("aiError").textContent =
            `Unable to complete scan: ${error.message}. Check that FastAPI is running on port 8000.`;
        toast("Connection or AI request failed.");
    } finally {
        analyzeBtn.disabled = !selectedFile;
    }
});

// Navigation
function setView(view) {
    const history = view === "history";

    $("analyzerView").classList.toggle("hidden", history);
    $("historyView").classList.toggle("hidden", !history);
    $("breadcrumb").textContent = history ? "SCAN HISTORY" : "IMAGE INTELLIGENCE";

    document.querySelectorAll(".nav-link").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.view === view);
    });
}

document.querySelectorAll(".nav-link").forEach(btn => {
    btn.addEventListener("click", () => setView(btn.dataset.view));
});
$("backToAnalyzer").addEventListener("click", () => setView("analyzer"));

// Session history
function renderHistory() {
    const list = $("historyList");
    list.replaceChildren();

    $("historyEmpty").classList.toggle("hidden", historyItems.length > 0);

    historyItems.forEach(item => {
        const row = document.createElement("div");
        row.className = "history-item";

        const img = document.createElement("img");
        img.src = item.preview;
        img.alt = "Analyzed image";

        const info = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;

        const summary = document.createElement("small");
        summary.textContent = `${item.size} · ${item.time} · ${item.summary}`;

        info.append(name, summary);
        row.append(img, info);
        list.append(row);
    });
}

// Theme toggle
$("themeBtn").addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    toast(
        document.body.classList.contains("light-theme")
            ? "Light theme enabled."
            : "Futuristic dark theme enabled."
    );
});

resetStats();
resetAI();
renderHistory();
