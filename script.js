/**
 * Smart Health Menu AI — script.js
 * ฟังก์ชันหลัก: คำนวณ BMI/BMR/แคลอรี่ และส่งข้อมูลไปยัง n8n Webhook
 */

// ===== CONFIG =====
// 🔧 เปลี่ยน URL ตรงนี้ให้ตรงกับ n8n Webhook ของคุณ
const N8N_WEBHOOK_URL = "http://localhost:5678/webhook-test/health-ai";

// ===== BMI Status Helper =====
/**
 * คืนค่าสถานะและสี BMI ตามเกณฑ์สากล
 * @param {number} bmi
 * @returns {{ label: string, color: string }}
 */
function getBMIStatus(bmi) {
  if (bmi < 18.5) return { label: "น้ำหนักน้อย",   color: "#5b9ef5" };
  if (bmi < 23)   return { label: "สมส่วน ✓",       color: "#2ecc71" };
  if (bmi < 27.5) return { label: "น้ำหนักเกิน",     color: "#f5a623" };
  return              { label: "อ้วน",              color: "#e05252" };
}

// ===== Calculate Health Metrics =====
/**
 * คำนวณ BMI, BMR และแคลอรี่ที่ควรได้รับต่อวัน
 * @returns {{ bmi, bmr, calories, activityLabel }}
 */
function calculateMetrics(gender, age, weight, height, activity) {
  // BMI = น้ำหนัก / (ส่วนสูงเป็นเมตร)²
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);

  // BMR (Mifflin-St Jeor)
  let bmr;
  if (gender === "Male") {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  // Activity multiplier
  const multipliers = {
    Sedentary: 1.2,
    Light:     1.375,
    Moderate:  1.55,
    Heavy:     1.725,
  };
  const calories = bmr * (multipliers[activity] || 1.2);

  return {
    bmi:      Math.round(bmi * 10) / 10,
    bmr:      Math.round(bmr),
    calories: Math.round(calories),
  };
}

// ===== Display Metrics on Page =====
function showMetrics(bmi, bmr, calories) {
  const section = document.getElementById("metricsSection");
  section.style.display = "block";
  section.style.animation = "none";
  // Trigger reflow for animation restart
  void section.offsetWidth;
  section.style.animation = "";

  document.getElementById("bmiValue").textContent    = bmi;
  document.getElementById("bmrValue").textContent    = bmr.toLocaleString();
  document.getElementById("caloriesValue").textContent = calories.toLocaleString();

  // BMI Status badge
  const status = getBMIStatus(bmi);
  const bmiStatusEl = document.getElementById("bmiStatus");
  bmiStatusEl.textContent = status.label;
  bmiStatusEl.style.background = status.color + "22";
  bmiStatusEl.style.color = status.color;
}

// ===== Parse and Render AI Response =====
/**
 * แปลง response จาก AI ให้เป็น HTML แบบมีหมวดหมู่
 * รองรับทั้ง JSON (structured) และ plain text
 */
function renderAIResult(data) {
  const container = document.getElementById("aiResult");

  // ลอง parse เป็น JSON ก่อน
  let parsed = null;
  if (typeof data === "string") {
    try { parsed = JSON.parse(data); } catch (_) {}
  } else if (typeof data === "object") {
    parsed = data;
  }

  // ฟังก์ชันสร้าง block หนึ่งหมวด
  function makeBlock(icon, title, items, borderColor = "#1aada0") {
    const itemsHTML = Array.isArray(items)
      ? `<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`
      : `<p class="result-raw">${items}</p>`;

    return `
      <div class="result-block" style="border-color:${borderColor}">
        <h3>${icon} ${title}</h3>
        ${itemsHTML}
      </div>`;
  }

  if (parsed) {
    // ถ้า AI ส่ง JSON กลับมา
    let html = "";

    if (parsed.nutrients || parsed.สารอาหาร) {
      const items = parsed.nutrients || parsed.สารอาหาร;
      html += makeBlock("🥦", "สารอาหารที่ควรได้รับ", items, "#2ecc71");
    }
    if (parsed.avoid || parsed.หลีกเลี่ยง) {
      const items = parsed.avoid || parsed.หลีกเลี่ยง;
      html += makeBlock("🚫", "อาหารที่ควรหลีกเลี่ยง", items, "#e05252");
    }
    if (parsed.menu || parsed.เมนู) {
      const items = parsed.menu || parsed.เมนู;
      html += makeBlock("🍽️", "ตัวอย่างเมนูอาหารสุขภาพ", items, "#f5a623");
    }
    if (parsed.notes || parsed.หมายเหตุ) {
      html += makeBlock("📝", "หมายเหตุเพิ่มเติม", parsed.notes || parsed.หมายเหตุ, "#9b59b6");
    }

    // Fallback ถ้า JSON ไม่มี key ที่รู้จัก
    if (!html) {
      html = `<div class="result-block"><p class="result-raw">${JSON.stringify(parsed, null, 2)}</p></div>`;
    }

    container.innerHTML = html;
  } else {
    // Plain text — แสดงดิบๆ
    container.innerHTML = `<div class="result-block"><p class="result-raw">${data}</p></div>`;
  }
}

// ===== Validate Form Inputs =====
function validateInputs(age, weight, height) {
  if (!age || age < 1 || age > 120) {
    return "กรุณากรอกอายุที่ถูกต้อง (1-120 ปี)";
  }
  if (!weight || weight < 10 || weight > 300) {
    return "กรุณากรอกน้ำหนักที่ถูกต้อง (10-300 กก.)";
  }
  if (!height || height < 50 || height > 250) {
    return "กรุณากรอกส่วนสูงที่ถูกต้อง (50-250 ซม.)";
  }
  return null;
}

// ===== Show / Hide Error =====
function showError(msg) {
  const section = document.getElementById("errorSection");
  document.getElementById("errorMsg").textContent = msg;
  section.style.display = "block";
  section.scrollIntoView({ behavior: "smooth", block: "center" });
}

function hideError() {
  document.getElementById("errorSection").style.display = "none";
}

// ===== Main: Analyze Health =====
/**
 * ฟังก์ชันหลัก: เรียกเมื่อผู้ใช้กดปุ่ม "วิเคราะห์สุขภาพ"
 */
async function analyzeHealth() {
  hideError();
  document.getElementById("resultSection").style.display = "none";

  // รวบรวมข้อมูลจากฟอร์ม
  const gender   = document.querySelector('input[name="gender"]:checked').value;
  const age      = parseFloat(document.getElementById("age").value);
  const weight   = parseFloat(document.getElementById("weight").value);
  const height   = parseFloat(document.getElementById("height").value);
  const activity = document.getElementById("activity").value;
  const disease  = document.getElementById("disease").value.trim() || "ไม่มี";

  // Validate
  const validationError = validateInputs(age, weight, height);
  if (validationError) {
    showError(validationError);
    return;
  }

  // คำนวณ metrics
  const { bmi, bmr, calories } = calculateMetrics(gender, age, weight, height, activity);

  // แสดงผลการคำนวณบนหน้าเว็บทันที
  showMetrics(bmi, bmr, calories);

  // สร้าง JSON payload เพื่อส่ง API
  const payload = {
    gender,
    age,
    weight,
    height,
    bmi,
    bmr,
    calories,
    activity,
    disease,
  };

  // แสดงสถานะ loading
  const btn    = document.getElementById("analyzeBtn");
  const btnTxt = btn.querySelector(".btn-text");
  const loader = document.getElementById("btnLoader");

  btn.disabled     = true;
  btnTxt.style.display = "none";
  loader.style.display  = "inline";
  loader.classList.add("loading-pulse");

  try {
    // ส่งข้อมูลไปยัง n8n Webhook
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    // รับผลลัพธ์จาก AI
    const resultData = await response.json();

    // แสดงผลลัพธ์ AI
    const resultSection = document.getElementById("resultSection");
    resultSection.style.display = "block";
    renderAIResult(resultData);
    resultSection.scrollIntoView({ behavior: "smooth", block: "start" });

  } catch (err) {
    console.error("API Error:", err);
    showError(
      `ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้\n` +
      `กรุณาตรวจสอบ Webhook URL หรือลองใหม่อีกครั้ง\n` +
      `(${err.message})`
    );
  } finally {
    // คืนสถานะปุ่ม
    btn.disabled          = false;
    btnTxt.style.display  = "inline";
    loader.style.display  = "none";
    loader.classList.remove("loading-pulse");
  }
}
