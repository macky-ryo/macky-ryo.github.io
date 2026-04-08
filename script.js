const FALLBACK_TEXT = "詳しくは面談時にお問合せください。";

const COMMON_FIELDS = [
  { key: "officeName", label: "事業所名" },
  { key: "workplaceChange", label: "就業場所の変更範囲" },
  { key: "catchCopy", label: "キャッチコピー" },
  { key: "feature1", label: "この求人の特長はココ①" },
  { key: "feature2", label: "この求人の特長はココ②" },
  { key: "feature3", label: "この求人の特長はココ③" },
  { key: "body", label: "本文" },
  { key: "jobType", label: "職種" },
  { key: "employmentType", label: "雇用形態" },
  { key: "contractPeriod", label: "契約期間" },
  { key: "requirements", label: "応募資格" },
  { key: "jobDescription", label: "仕事内容" },
  { key: "jobChangeScope", label: "仕事内容の変更の範囲" },
  { key: "salary", label: "給与" },
  { key: "workHours", label: "勤務時間" },
  { key: "overtime", label: "時間外労働" },
  { key: "holidays", label: "休日・休暇" },
  { key: "benefits", label: "待遇" },
  { key: "smoking", label: "受動喫煙対策について" },
  { key: "trialPeriod", label: "試用期間" },
  { key: "trialOther", label: "試用期間の待遇・その他" },
];

const HELLOWORK_SECTION_TITLES = [
  "1 求人事業所",
  "2 仕事内容",
  "3 賃金・手当",
  "4 労働時間",
  "5 その他の労働条件等",
  "6 会社の情報",
  "7 選考等",
];

const HELLOWORK_HEADINGS = {
  officeName: ["事業所名", "名称"],
  jobType: ["職種"],
  employmentType: ["雇用形態", "正社員以外"],
  contractPeriod: ["雇用期間", "契約期間"],
  requirements: ["必要な経験・知識・技能等", "必要な免許・資格", "応募資格"],
  jobDescription: ["仕事内容"],
  jobChangeScope: ["仕事内容の変更範囲", "変更範囲"],
  workHours: ["就業時間", "勤務時間"],
  overtime: ["時間外労働時間", "時間外労働"],
  holidays: ["休日等", "休日", "休暇"],
  benefits: ["加入保険", "退職金", "待遇"],
  smoking: ["受動喫煙対策"],
  trialPeriod: ["試用期間"],
  trialOther: ["試用期間中の労働条件", "試用期間の待遇"],
  workplaceChange: ["就業場所の変更範囲"],
};

const JOBMEDLEY_HEADINGS = {
  officeName: ["法人・施設名", "施設名", "事業所名"],
  jobType: ["職種", "募集職種"],
  employmentType: ["雇用形態"],
  contractPeriod: ["契約期間", "雇用期間"],
  requirements: ["応募要件", "応募資格"],
  jobDescription: ["仕事内容", "業務内容"],
  workHours: ["勤務時間"],
  holidays: ["休日", "休暇"],
  benefits: ["待遇", "福利厚生"],
};

const tabs = [...document.querySelectorAll(".tab")];
const panes = [...document.querySelectorAll(".pane")];
const jobText = document.getElementById("jobText");
const pdfFile = document.getElementById("pdfFile");
const jobUrl = document.getElementById("jobUrl");
const errorArea = document.getElementById("errorArea");
const resultArea = document.getElementById("resultArea");
const rawTextPreview = document.getElementById("rawTextPreview");
const cleanTextPreview = document.getElementById("cleanTextPreview");
const mediaTypePreview = document.getElementById("mediaTypePreview");
const sectionPreview = document.getElementById("sectionPreview");

const extractButton = document.getElementById("extractButton");
const copyButton = document.getElementById("copyButton");
const loadSampleButton = document.getElementById("loadSampleButton");

let activeTab = "text";
let latestResult = null;

renderResult(buildFallbackData());

tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

extractButton.addEventListener("click", async () => {
  setError("");
  const input = await collectInput();
  if (!input.text) {
    setError("入力データが見つかりません。");
    return;
  }

  const media = detectMediaType(input);
  mediaTypePreview.value = media;

  if (media === "unsupported") {
    updateDebugPreview(input.text, "", "");
    setError("未対応媒体です。現在はハローワークPDFとジョブメドレーURLのみ対応しています。");
    renderResult(buildFallbackData());
    return;
  }

  if (media === "hellowork_pdf") {
    const cleaned = preprocessHelloWorkPdf(input.text);
    const sections = splitHelloWorkSections(cleaned);
    updateDebugPreview(input.text, cleaned, formatSectionDebug(sections));
    latestResult = extractHelloWorkPdf(cleaned, sections);
  } else {
    const cleaned = preprocessJobMedleyUrl(input.text);
    updateDebugPreview(input.text, cleaned, "ジョブメドレーURLはセクション分割対象外");
    latestResult = extractJobMedleyUrl(cleaned);
  }

  renderResult(latestResult);
});

copyButton.addEventListener("click", async () => {
  if (!latestResult) return setError("先に抽出を実行してください。");
  const copied = await copyToClipboard(toCopyText(latestResult));
  setError(copied ? "抽出結果をコピーしました。" : "コピーに失敗しました。手動でコピーしてください。");
});

loadSampleButton.addEventListener("click", async () => {
  try {
    const res = await fetch("sample.txt");
    if (!res.ok) throw new Error();
    jobText.value = await res.text();
    switchTab("text");
  } catch {
    setError("sample.txt の読み込みに失敗しました。");
  }
});

function switchTab(tabName) {
  activeTab = tabName;
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  panes.forEach((pane) => pane.classList.toggle("active", pane.id === `pane-${tabName}`));
}

async function collectInput() {
  if (activeTab === "text") return { type: "text", text: jobText.value.trim(), url: "" };
  if (activeTab === "pdf") {
    if (!pdfFile.files[0]) return { type: "pdf", text: "", url: "" };
    return { type: "pdf", text: await extractTextFromPdf(pdfFile.files[0]), url: "" };
  }
  const url = jobUrl.value.trim();
  if (!url) return { type: "url", text: "", url: "" };
  return { type: "url", text: await fetchTextFromUrl(url), url };
}

function detectMediaType(input) {
  if (input.type === "pdf") return "hellowork_pdf";
  if (input.type === "url" && /job-medley\.com/.test(input.url)) return "jobmedley_url";
  return "unsupported";
}

// ハローワーク「求人票（パートタイム）」向け前処理
function preprocessHelloWorkPdf(text) {
  let t = (text || "").replace(/\r\n/g, "\n").replace(/[\u3000\t]+/g, " ");

  // 縦書き崩れや連結崩れを補正（主要ラベルを強制改行）
  const verticalFixLabels = [
    "事業所名", "仕事内容", "雇用形態", "試用期間", "時間外労働", "休日等", "必要な経験・知識・技能等", "必要な免許・資格",
  ];
  verticalFixLabels.forEach((label) => {
    t = t.replace(new RegExp(`\\s*${escapeRegExp(label)}\\s*`, "g"), `\n${label} `);
  });

  HELLOWORK_SECTION_TITLES.forEach((title) => {
    t = t.replace(new RegExp(`\\s*${escapeRegExp(title)}\\s*`, "g"), `\n${title}\n`);
  });

  t = t.replace(/[ ]{2,}/g, " ");
  t = cleanupNoiseLines(t, false);
  return t;
}

function splitHelloWorkSections(text) {
  const sections = {};
  HELLOWORK_SECTION_TITLES.forEach((title, idx) => {
    const next = HELLOWORK_SECTION_TITLES[idx + 1];
    const start = text.indexOf(title);
    if (start === -1) {
      sections[title] = "";
      return;
    }
    const end = next ? text.indexOf(next, start + title.length) : text.length;
    sections[title] = text.slice(start, end === -1 ? text.length : end).trim();
  });
  return sections;
}

function extractHelloWorkPdf(cleaned, sections) {
  const out = buildFallbackData();

  // セクション単位で優先抽出
  const s1 = sections["1 求人事業所"] || cleaned;
  const s2 = sections["2 仕事内容"] || cleaned;
  const s3 = sections["3 賃金・手当"] || cleaned;
  const s4 = sections["4 労働時間"] || cleaned;
  const s5 = sections["5 その他の労働条件等"] || cleaned;
  const s6 = sections["6 会社の情報"] || cleaned;

  out.officeName = extractByHeadings(s1, HELLOWORK_HEADINGS.officeName) || FALLBACK_TEXT;
  out.jobType = extractByHeadings(s2, HELLOWORK_HEADINGS.jobType) || FALLBACK_TEXT;
  out.employmentType = extractByHeadings(s2, HELLOWORK_HEADINGS.employmentType) || FALLBACK_TEXT;
  out.contractPeriod = extractByHeadings(s2, HELLOWORK_HEADINGS.contractPeriod) || FALLBACK_TEXT;
  out.jobDescription = extractByHeadings(s2, HELLOWORK_HEADINGS.jobDescription) || FALLBACK_TEXT;
  out.jobChangeScope = extractByHeadings(s2, HELLOWORK_HEADINGS.jobChangeScope) || FALLBACK_TEXT;
  out.requirements = [
    extractByHeadings(s2, ["必要な経験・知識・技能等"]),
    extractByHeadings(s2, ["必要な免許・資格"]),
  ].filter(Boolean).join(" / ") || FALLBACK_TEXT;

  out.workHours = extractByHeadings(s4, HELLOWORK_HEADINGS.workHours) || FALLBACK_TEXT;
  out.overtime = extractByHeadings(s4, HELLOWORK_HEADINGS.overtime) || FALLBACK_TEXT;
  out.holidays = extractByHeadings(s4, HELLOWORK_HEADINGS.holidays) || FALLBACK_TEXT;

  out.benefits = [
    extractByHeadings(s5, ["加入保険"]),
    extractByHeadings(s5, ["退職金制度"]),
    extractByHeadings(s5, ["求人に関する特記事項"]),
  ].filter(Boolean).join(" / ") || FALLBACK_TEXT;
  out.smoking = extractByHeadings(s5, HELLOWORK_HEADINGS.smoking) || FALLBACK_TEXT;
  out.trialPeriod = extractByHeadings(s5, HELLOWORK_HEADINGS.trialPeriod) || FALLBACK_TEXT;
  out.trialOther = extractByHeadings(s5, HELLOWORK_HEADINGS.trialOther) || FALLBACK_TEXT;
  out.workplaceChange = extractByHeadings(cleaned, HELLOWORK_HEADINGS.workplaceChange) || FALLBACK_TEXT;

  out.salary = formatHelloWorkSalary(s3);

  const seedText = [
    out.jobDescription,
    extractByHeadings(s6, ["会社の特長"]),
    extractByHeadings(s5, ["求人に関する特記事項"]),
  ].filter(Boolean).join(" ");

  out.catchCopy = generateCatchCopy(seedText);
  [out.feature1, out.feature2, out.feature3] = generateFeatures(seedText);
  out.body = generateBodySummary(seedText);

  return fillFallback(out);
}

function formatHelloWorkSalary(section3) {
  const jikyu = extractByHeadings(section3, ["時間額（ａ＋ｂ）", "時間額(a+b)", "時間額（a+b）"]);
  if (jikyu) {
    const basic = extractByHeadings(section3, ["基本給（時間換算額）", "基本給"]);
    const memo = extractByHeadings(section3, ["その他手当付記事項"]);
    return [
      `【時給】${extractMoneyFromText(jikyu)}`,
      "",
      "【内訳】",
      `基本給（時間換算額）：${extractMoneyFromText(basic)}`,
      `その他手当付記事項：${memo || FALLBACK_TEXT}`,
    ].join("\n");
  }

  return [
    `【月給】${extractMoneyFromText(extractByHeadings(section3, ["賃金形態等", "賃金", "月額"]))}`,
    "",
    "【内訳】",
    `基本給：${extractMoneyFromText(extractByHeadings(section3, ["基本給"]))}`,
    `資格手当：${extractMoneyFromText(extractByHeadings(section3, ["資格手当"]))}`,
    `変則勤務手当：${extractMoneyFromText(extractByHeadings(section3, ["変則勤務手当"]))}`,
    `処遇改善手当：${extractMoneyFromText(extractByHeadings(section3, ["処遇改善手当"]))}`,
    `夜勤手当：${extractMoneyFromText(extractByHeadings(section3, ["夜勤手当"]))}`,
    `役職手当：${extractMoneyFromText(extractByHeadings(section3, ["役職手当"]))}`,
    `特別資格手当：${extractMoneyFromText(extractByHeadings(section3, ["特別資格手当"]))}`,
    "",
    `昇給あり（前年度実績：${extractByHeadings(section3, ["昇給"]) || FALLBACK_TEXT}）`,
    `賞与年◯回（計${extractByHeadings(section3, ["賞与"]) || FALLBACK_TEXT}）`,
  ].join("\n");
}

function extractMoneyFromText(text) {
  if (!text) return FALLBACK_TEXT;
  const m = text.match(/[0-9,]+\s*円/g);
  if (m?.length >= 2) return `${m[0].replace(/\s+/g, "")}〜${m[1].replace(/\s+/g, "")}`;
  if (m?.length === 1) return m[0].replace(/\s+/g, "");
  return text.trim() || FALLBACK_TEXT;
}

function preprocessJobMedleyUrl(text) {
  return cleanupNoiseLines(
    (text || "")
      .replace(/\r\n/g, "\n")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&"),
    true,
  );
}

function extractJobMedleyUrl(cleaned) {
  const out = buildFallbackData();
  Object.entries(JOBMEDLEY_HEADINGS).forEach(([key, heads]) => {
    out[key] = extractByHeadings(cleaned, heads) || FALLBACK_TEXT;
  });
  out.salary = formatHelloWorkSalary(cleaned);
  out.catchCopy = generateCatchCopy(cleaned);
  [out.feature1, out.feature2, out.feature3] = generateFeatures(cleaned);
  out.body = generateBodySummary(cleaned);
  return fillFallback(out);
}

function cleanupNoiseLines(text, aggressive) {
  const noise = [/^title\s*[:：]/i, /^id\s*[:：]/i, /投稿日[:：]?/, /更新日[:：]?/, /^https?:\/\//i, /^\s*[-_=]{3,}\s*$/, /^\s*\d+\s*$/];
  if (aggressive) noise.push(/<(\/)?[a-z][^>]*>/i, /class=|data-|aria-/i);
  return text
    .split("\n")
    .map((v) => v.replace(/[\u3000\t]+/g, " ").replace(/[ ]{2,}/g, " ").trim())
    .filter((v) => v && !noise.some((r) => r.test(v)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractByHeadings(text, headings = []) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    const n = normalize(raw);
    const h = headings.find((hh) => {
      const k = normalize(hh);
      return n.startsWith(k) || n.includes(`${k}:`);
    });
    if (!h) continue;

    const direct = raw.replace(new RegExp(`^\\s*${escapeRegExp(h)}\\s*[：:]?\\s*`), "").trim();
    if (direct) return direct;

    const block = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next && block.length) break;
      if (isLikelyHeadingLine(next)) break;
      if (next) block.push(next);
    }
    if (block.length) return block.join(" ");
  }
  return "";
}

function isLikelyHeadingLine(line) {
  const labels = [...Object.values(HELLOWORK_HEADINGS), ...Object.values(JOBMEDLEY_HEADINGS)].flat();
  const n = normalize(line);
  return labels.some((l) => n.startsWith(normalize(l)));
}

function normalize(v) {
  return (v || "").replace(/[\u3000\s]+/g, "").replace(/[：]/g, ":").toLowerCase();
}

function generateCatchCopy(text) {
  const seed = extractByHeadings(text, ["仕事内容", "会社の特長", "求人に関する特記事項", "職種"]) || firstLine(text);
  return trimToRange(`働きやすさと成長を両立できる注目求人: ${seed}`, 20, 120);
}

function generateFeatures(text) {
  const items = [
    extractByHeadings(text, ["仕事内容"]),
    extractByHeadings(text, ["会社の特長"]),
    extractByHeadings(text, ["求人に関する特記事項", "待遇"]),
  ].filter(Boolean);
  return [items[0], items[1], items[2]].map((v) => trimToMax(v || FALLBACK_TEXT, 20));
}

function generateBodySummary(text) {
  return trimToRange((text || "").replace(/\n/g, " "), 150, 300);
}

function firstLine(text) {
  return text.split("\n").map((v) => v.trim()).find((v) => v.length >= 8) || FALLBACK_TEXT;
}

function trimToRange(text, min, max) {
  let t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return FALLBACK_TEXT;
  if (t.length > max) t = `${t.slice(0, max - 1)}…`;
  if (t.length < min) t = `${t} ${FALLBACK_TEXT}`.trim();
  return t;
}

function trimToMax(text, max) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return FALLBACK_TEXT;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function fillFallback(data) {
  const out = { ...buildFallbackData(), ...data };
  Object.keys(out).forEach((k) => {
    if (!out[k]) out[k] = FALLBACK_TEXT;
  });
  return out;
}

function buildFallbackData() {
  return Object.fromEntries(COMMON_FIELDS.map((f) => [f.key, FALLBACK_TEXT]));
}

function formatSectionDebug(sections) {
  return Object.entries(sections).map(([name, body]) => `${name}\n${body || "(empty)"}`).join("\n\n");
}

function updateDebugPreview(raw, cleaned, sectionText) {
  rawTextPreview.value = raw;
  cleanTextPreview.value = cleaned;
  sectionPreview.value = sectionText;
}

function renderResult(data) {
  const list = document.createElement("div");
  list.className = "result-list";
  COMMON_FIELDS.forEach((f) => {
    const item = document.createElement("article");
    item.className = "result-item";
    const h = document.createElement("h3");
    h.textContent = f.label;
    const p = document.createElement("p");
    p.textContent = data[f.key] || FALLBACK_TEXT;
    item.append(h, p);
    list.appendChild(item);
  });
  resultArea.innerHTML = "";
  resultArea.appendChild(list);
}

function toCopyText(data) {
  return COMMON_FIELDS.map((f) => `${f.label}\n${data[f.key] || FALLBACK_TEXT}`).join("\n\n");
}

async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const temp = document.createElement("textarea");
  temp.value = text;
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(temp);
  return ok;
}

async function extractTextFromPdf(file) {
  try {
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += `${content.items.map((item) => item.str).join(" ")}\n`;
    }
    return text;
  } catch {
    setError("PDFの読み取りに失敗しました。");
    return "";
  }
}

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  const mod = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs");
  mod.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs";
  window.pdfjsLib = mod;
  return mod;
}

async function fetchTextFromUrl(url) {
  try {
    const proxy = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error();
    return await res.text();
  } catch {
    setError("URLの取得に失敗しました。");
    return "";
  }
}

function escapeRegExp(v) {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setError(msg) {
  errorArea.textContent = msg;
}
