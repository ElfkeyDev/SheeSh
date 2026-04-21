let chartInstance = null;

function uploadFile() {
    let fileInput = document.getElementById("fileInput");
    let file = fileInput.files[0];

    if (!file) {
        alert("Please select a CSV file");
        return;
    }

    let formData = new FormData();
    formData.append("file", file);

    document.getElementById("loading").style.display = "block";

    fetch("upload.php", {
        method: "POST",
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        document.getElementById("loading").style.display = "none";

        if (data.error) {
            alert(data.error);
            return;
        }

        // loading effect
        setTimeout(() => {
            processData(data.values);
        }, 400);
    })
    .catch(() => {
        document.getElementById("loading").style.display = "none";
        alert("Error uploading file");
    });
}

function processData(values) {
    if (!values || values.length === 0) return;

    document.getElementById("loading").style.display = "block";

    setTimeout(() => {

        values = values
            .map(v => Number(v))
            .filter(v => !isNaN(v));

        let stats = calculateStats(values);
        let outliers = detectOutliers(values);

        renderStats(stats);
        renderChart(values, outliers);
        document.getElementById("chartPlaceholder").style.display = "none";
        document.getElementById("chart").style.display = "block";
        renderInterpretation(stats, outliers);
        saveReport({ ...stats, outliers });

        document.getElementById("loading").style.display = "none";

    }, 300);
}

/* ==================== STATS ==================== */
function calculateStats(arr) {
    let n = arr.length;

    let sum = arr.reduce((a, b) => a + b, 0);
    let mean = sum / n;

    let sorted = [...arr].sort((a, b) => a - b);

    let median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    let freq = {};
    let maxFreq = 0;
    let mode = null;

    for (let num of arr) {
        freq[num] = (freq[num] || 0) + 1;
        if (freq[num] > maxFreq) {
            maxFreq = freq[num];
            mode = num;
        }
    }

    if (maxFreq === 1) mode = "No Mode";

    let variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
    let std = Math.sqrt(variance);

    return {
        mean,
        median,
        mode,
        max: Math.max(...arr),
        min: Math.min(...arr),
        variance,
        std,
        count: n
    };
}

/* ==================== OUTLIERS ==================== */
function detectOutliers(values) {
    let sorted = [...values].sort((a, b) => a - b);

    function median(arr) {
        let n = arr.length;
        return n % 2 === 0
            ? (arr[n/2 - 1] + arr[n/2]) / 2
            : arr[Math.floor(n/2)];
    }

    let n = sorted.length;
    let mid = Math.floor(n / 2);

    let lowerHalf = sorted.slice(0, mid);
    let upperHalf = sorted.slice(n % 2 === 0 ? mid : mid + 1);

    let q1 = median(lowerHalf);
    let q3 = median(upperHalf);

    let iqr = q3 - q1;

    let lower = q1 - 1.5 * iqr;
    let upper = q3 + 1.5 * iqr;

    return values.filter(v => v < lower || v > upper);
}

/* ==================== RENDER STATS ==================== */
function renderStats(stats) {
    let grid = document.getElementById("statsGrid");
    grid.innerHTML = "";

    for (let key in stats) {
        let box = document.createElement("div");
        box.className = "box";

        let title = document.createElement("h4");
        title.innerText = key.toUpperCase();

        let value = document.createElement("p");
        value.innerText = typeof stats[key] === "number"
            ? stats[key].toFixed(2)
            : stats[key];

        box.appendChild(title);
        box.appendChild(value);
        grid.appendChild(box);
    }
}

/* ==================== CHART ==================== */
function renderChart(values, outliers) {
    let ctx = document.getElementById("chart").getContext("2d");

    if (chartInstance) {
        chartInstance.destroy();
    }

    let min = Math.min(...values);
    let max = Math.max(...values);

    // FIXED bins (stable)
    let bins = 8;
    let binWidth = (max - min) / bins;

    let counts = new Array(bins).fill(0);
    let labels = [];

    for (let i = 0; i < bins; i++) {
        let start = min + i * binWidth;
        let end = start + binWidth;
        labels.push(start.toFixed(1) + " - " + end.toFixed(1));
    }

    for (let v of values) {
        let index = Math.floor((v - min) / binWidth);
        if (index >= bins) index = bins - 1;
        counts[index]++;
    }

    // Highlight bins
    let colors = counts.map(c =>
        c > 1 ? "#ff2e2e" : "rgba(255,255,255,0.1)"
    );

    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Frequency Distribution",
                data: counts,
                backgroundColor: colors,
                borderColor: "#ff2e2e",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            animation: { duration: 800 },
            plugins: {
                legend: {
                    labels: { color: "#f5f5f5" }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#ccc" },
                    grid: { color: "#333" }
                },
                y: {
                    ticks: { color: "#ccc" },
                    grid: { color: "#333" }
                }
            }
        }
    });
}

/* ==================== INTERPRETATION ==================== */
function renderInterpretation(stats, outliers) {
    let domain = document.getElementById("domain").value;
    let text = "";

    if (domain === "medicine") {
        if (stats.mean > 120) {
            text = "Average blood pressure is high (possible hypertension).";
        } else if (stats.mean < 90) {
            text = "Values are low (possible hypotension).";
        } else {
            text = "Values are within normal healthy range.";
        }
    }

    if (domain === "engineering") {
        if (stats.mean > 80) {
            text = "High stress detected → potential structural risk.";
        } else if (stats.std > 20) {
            text = "High variation → system instability.";
        } else {
            text = "System is stable and within safe limits.";
        }
    }

    if (outliers.length > 0) {
        text += " Outliers: " + outliers.join(", ");
    } else {
        text += " No significant outliers.";
    }

    document.getElementById("interpretationText").innerText = text;
}

/* ==================== STORAGE ==================== */
function saveReport(data) {
    localStorage.setItem("reportData", JSON.stringify(data));
}

/* ==================== MANUAL INPUT ==================== */
function showManualInput() {

    // امسح الملف
    document.getElementById("fileInput").value = "";

    // 👇 رجّع النص للوضع الطبيعي
    document.getElementById("fileName").innerText = "No file chosen";

    // 👇 شيل الحالة لو كنت مغير اللون
    document.querySelector(".file-upload").classList.remove("active");

    // افتح المودال
    document.getElementById("manualModal").style.display = "block";

    // صف أول
    if (document.getElementById("tableBody").children.length === 0) {
        addRow();
    }
}

function closeModal() {
    document.getElementById("manualModal").style.display = "none";
}

function addRow() {
    let table = document.getElementById("tableBody");

    let row = document.createElement("tr");

    let cell1 = document.createElement("td");
    let input = document.createElement("input");
    input.type = "number";
    cell1.appendChild(input);

    let cell2 = document.createElement("td");
    let btn = document.createElement("button");
    btn.innerText = "Delete";
    btn.onclick = () => row.remove();
    cell2.appendChild(btn);

    row.appendChild(cell1);
    row.appendChild(cell2);

    table.appendChild(row);
}

function analyzeManualData() {
    let inputs = document.querySelectorAll("#tableBody input");
    let values = [];

    inputs.forEach(input => {
        let val = parseFloat(input.value);
        if (!isNaN(val)) {
            values.push(val);
        }
    });

    if (values.length === 0) {
        alert("Enter valid numbers");
        return;
    }

    closeModal();
    processData(values);
}
document.getElementById("fileInput").addEventListener("change", function () {

    let fileName = this.files[0]?.name || "No file chosen";

    // 👇 عرض اسم الملف
    document.getElementById("fileName").innerText = fileName;

    // 👇 إضافة حالة active (اختياري للستايل)
    this.parentElement.classList.add("active");

});