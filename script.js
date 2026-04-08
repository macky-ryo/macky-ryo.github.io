const FALLBACK_TEXT = "詳しくは面談時にお問合せください。";
const HEADING_CANDIDATES = [
  "事業所名", "職種", "雇用形態", "契約期間", "応募資格", "仕事内容", "仕事内容の変更の範囲",
  "給与", "勤務時間", "時間外労働", "休日", "休日・休暇", "待遇", "試用期間", "受動喫煙対策",
];

const FIELD_DEFINITIONS = [
  { key: "officeName", label: "事業所名", headings: ["事業所名", "会社名", "法人名"] },
  { key: "workplaceChange", label: "就業場所の変更範囲", headings: ["就業場所の変更範囲"] },
  { key: "catchCopy", label: "キャッチコピー" },
  { key: "feature1", label: "この求人の特長はココ①" },
  { key: "feature2", label: "この求人の特長はココ②" },
  { key: "feature3", label: "この求人の特長はココ③" },
  { key: "body", label: "本文" },
  { key: "jobType", label: "職種", headings: ["職種"] },
  { key: "employmentType", label: "雇用形態", headings: ["雇用形態"] },
  { key: "contractPeriod", label: "契約期間", headings: ["契約期間"] },
  { key: "requirements", label: "応募資格", headings: ["応募資格", "必要資格", "求める人物像"] },
  { key: "jobDescription", label: "仕事内容", headings: ["仕事内容", "業務内容"] },
  { key: "jobChangeScope", label: "仕事内容の変更の範囲", headings: ["仕事内容の変更の範囲"] },
  { key: "salary", label: "給与" },
  { key: "workHours", label: "勤務時間", headings: ["勤務時間", "就業時間"] },
  { key: "overtime", label: "時間外労働", headings: ["時間外労働", "残業"] },
  { key: "holidays", label: "休日・休暇", headings: ["休日", "休暇", "休日・休暇"] },
  { key: "benefits", label: "待遇", headings: ["待遇", "待遇・福利厚生", "福利厚生"] },
  { key: "smoking", label: "受動喫煙対策について", headings: ["受動喫煙対策", "受動喫煙対策について"] },
  { key: "trialPeriod", label: "試用期間", headings: ["試用期間"] },
  { key: "trialOther", label: "試用期間の待遇・その他", headings: ["試用期間の待遇・その他", "試用期間中の条件"] },
];

const tabs = [...document.querySelectorAll(".tab")];
const panes = [...document.querySelectorAll(".pane")];
const jobText = document.getElementById("jobText");
const pdfFile = document.getElementById("pdfFile");
const jobUrl = document.getElementById("jobUrl");
const errorArea = document.getElementById("errorArea");
const resultArea = document.getElementById("resultArea");
const rawTextPreview = document.getElementById("rawTextPreview");
const cleanTextPreview = document.getElementById("cleanTextPreview");

const extractButton = document.getElementById("extractButton");
const copyButton = document.getElementById("copyButton");
const loadSampleButton = document.getElementById("loadSampleButton");

let activeTab = "text";
let latestResult = null;

renderResult(Object.fromEntries(FIELD_DEFINITIONS.map((f) => [f.key, FALLBACK_TEXT])));

tabs.forEach((tab) => tab.addEventListener("click", () => switchTab(tab.dataset.tab)));

extractButton.addEventListener("click", async () => {
  setError("");
  const { text: raw, sourceType } = await collectInputText();
  if (!raw) {
    setError("入力データが見つかりません。テキスト貼り付け、PDF、URLのいずれかを入力してください。");
    return;
  }

  const preprocessed = preprocessText(raw, sourceType);
  updateDebugPreview(raw, preprocessed);

  const data = buildExtractedData(preprocessed);
  latestResult = data;
  renderResult(data);
});

copyButton.addEventListener("click", async () => {
  if (!latestResult) {
    setError("先に抽出を実行してください。");
    return;
  }
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
    setError("sample.txt の読み込みに失敗しました。ファイルを直接開いて貼り付けてください。");
  }
});

function switchTab(tabName) {
  activeTab = tabName;
  tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === tabName));
  panes.forEach((pane) => pane.classList.toggle("active", pane.id === `pane-${tabName}`));
}

async function collectInputText() {
  if (activeTab === "text") return { text: jobText.value.trim(), sourceType: "text" };
  if (activeTab === "pdf") {
    if (!pdfFile.files[0]) return { text: "", sourceType: "pdf" };
    return { text: await extractTextFromPdf(pdfFile.files[0]), sourceType: "pdf" };
  }
  if (activeTab === "url") {
    const url = jobUrl.value.trim();
    if (!url) return { text: "", sourceType: "url" };
    return { text: await fetchTextFromUrl(url), sourceType: "url" };
  }
  return { text: "", sourceType: "text" };
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
    setError("PDFの読み取りに失敗しました。画像PDFや保護PDFの場合、本文を貼り付けてください。");
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
    setError("URLから本文を取得できませんでした。取得制限があるサイトのため、本文を貼り付けてください。");
    return "";
  }
}

function preprocessText(text, sourceType) {
  let normalized = (text || "").replace(/\r\n/g, "\n");
  normalized = normalized.replace(/<br\s*\/?\s*>/gi, "\n");

  if (sourceType === "url") {
    normalized = normalized
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&");
  }

  const noisePatterns = [
    /^title\s*[:：]/i,
    /^id\s*[:：]/i,
    /投稿日[:：]?/,
    /更新日[:：]?/,
    /copyright/i,
    /^https?:\/\//i,
    /^<[^>]+>$/,
    /^\s*[-_=]{3,}\s*$/,
  ];

  normalized = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !noisePatterns.some((pattern) => pattern.test(line)))
    .join("\n");

  normalized = insertBreakBeforeHeadings(normalized);

  if (sourceType === "pdf") {
    normalized = normalized.replace(/[ \t]{2,}/g, " ");
  }

  normalized = normalized
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[\u3000\t]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  return normalized;
}

function insertBreakBeforeHeadings(text) {
  let result = text;
  HEADING_CANDIDATES.forEach((heading) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(?!^)(\\s*)(${escaped})(\\s*[：:])`, "g"), "\n$2$3");
  });
  return result;
}

function updateDebugPreview(raw, cleaned) {
  rawTextPreview.value = raw;
  cleanTextPreview.value = cleaned;
}

function buildExtractedData(text) {
  const data = {};
  data.catchCopy = generateCatchCopy(text);
  const features = generateFeatures(text);
  data.feature1 = features[0];
  data.feature2 = features[1];
  data.feature3 = features[2];
  data.body = generateBodySummary(text);

  FIELD_DEFINITIONS.forEach((field) => {
    if (["catchCopy", "feature1", "feature2", "feature3", "body", "salary"].includes(field.key)) return;
    data[field.key] = extractByHeadings(text, field.headings) || FALLBACK_TEXT;
  });

  data.salary = formatSalary(text);
  return data;
}

function generateCatchCopy(text) {
  const seed = extractByHeadings(text, ["仕事内容", "職種", "事業所名"]) || firstInformativeLine(text);
  return trimToRange(`働きやすさと成長を両立できる注目求人: ${seed}`, 20, 120);
}

function generateFeatures(text) {
  const candidates = [
    extractByHeadings(text, ["職種"]),
    extractByHeadings(text, ["勤務時間", "休日", "休日・休暇"]),
    extractByHeadings(text, ["給与", "待遇", "福利厚生"]),
  ].filter(Boolean);
  const uniq = [...new Set(candidates.map((v) => trimToMax(v, 20)))];
  return [uniq[0] || FALLBACK_TEXT, uniq[1] || FALLBACK_TEXT, uniq[2] || FALLBACK_TEXT];
}

function generateBodySummary(text) {
  const companyLike = collectCompanyLikeLines(text) || text;
  return trimToRange(companyLike, 150, 300);
}

function collectCompanyLikeLines(text) {
  const keywords = ["当社", "弊社", "事業", "会社", "企業", "理念", "サービス", "運営", "設立"];
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length >= 10 && keywords.some((kw) => line.includes(kw))).join(" ");
}

function formatSalary(text) {
  if (/時給/.test(text)) {
    return `【時給】${extractMoneyRange(text, ["時給"])}`;
  }
  return [
    `【月給】${extractMoneyRange(text, ["月給", "給与"])}`,
    "",
    "【内訳】",
    `基本給：${extractMoneyRange(text, ["基本給"])}`,
    `資格手当：${extractMoneyRange(text, ["資格手当"])}`,
    `変則勤務手当：${extractMoneyRange(text, ["変則勤務手当"])}`,
    `処遇改善手当：${extractMoneyRange(text, ["処遇改善手当"])}`,
    `夜勤手当：${extractMoneyRange(text, ["夜勤手当"])}`,
    `役職手当：${extractMoneyRange(text, ["役職手当"])}`,
    `特別資格手当：${extractMoneyRange(text, ["特別資格手当"])}`,
    "",
    `昇給あり（前年度実績：${extractTextAround(text, ["昇給"], 30)}）`,
    `賞与年◯回（計${extractTextAround(text, ["賞与"], 30)}）`,
  ].join("\n");
}

function extractMoneyRange(text, heads) {
  const line = extractByHeadings(text, heads) || findLineContains(text, heads);
  if (!line) return FALLBACK_TEXT;
  const matches = line.match(/[0-9,]+\s*円/g);
  if (matches?.length >= 2) return `${normalizeMoney(matches[0])}〜${normalizeMoney(matches[1])}`;
  if (matches?.length === 1) return normalizeMoney(matches[0]);
  return FALLBACK_TEXT;
}

function normalizeMoney(raw) {
  return raw.replace(/\s+/g, "").replace(/円$/, "") + "円";
}

function extractTextAround(text, heads, length) {
  const line = extractByHeadings(text, heads) || findLineContains(text, heads);
  return line ? trimToMax(line, length) : FALLBACK_TEXT;
}

function findLineContains(text, heads) {
  return text.split("\n").map((v) => v.trim()).find((line) => heads.some((h) => line.includes(h))) || "";
}

function extractByHeadings(text, headings = []) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i].trim();
    const line = normalizeLineForMatch(rawLine);
    const heading = headings.find((h) => {
      const hNorm = normalizeLineForMatch(h);
      return line.startsWith(hNorm) || line.includes(`${hNorm}:`) || new RegExp(`(^|\\s)${escapeRegExp(hNorm)}\\s*[:：]`).test(line);
    });

    if (!heading) continue;
    const direct = extractInlineValue(rawLine, heading);
    if (direct) return direct;

    const block = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next && block.length > 0) break;
      if (isAnyHeadingLine(next)) break;
      if (next) block.push(next);
    }
    if (block.length) return block.join(" ");
  }
  return "";
}

function extractInlineValue(line, heading) {
  const h = escapeRegExp(heading);
  const regex = new RegExp(`^\\s*${h}\\s*[：:]?\\s*`);
  return line.replace(regex, "").trim();
}

function isAnyHeadingLine(line) {
  const normalized = normalizeLineForMatch(line);
  const all = FIELD_DEFINITIONS.flatMap((f) => f.headings || []).map((h) => normalizeLineForMatch(h));
  return all.some((h) => normalized.startsWith(h));
}

function normalizeLineForMatch(value) {
  return (value || "").replace(/[\u3000\t]/g, " ").replace(/[：]/g, ":").replace(/\s+/g, "").toLowerCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstInformativeLine(text) {
  return text.split("\n").map((v) => v.trim()).find((v) => v.length >= 10) || FALLBACK_TEXT;
}

function trimToRange(text, min, max) {
  let normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return FALLBACK_TEXT;
  if (normalized.length > max) normalized = `${normalized.slice(0, max - 1)}…`;
  if (normalized.length < min) return `${normalized} ${FALLBACK_TEXT}`.trim();
  return normalized;
}

function trimToMax(text, max) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return FALLBACK_TEXT;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function renderResult(data) {
  const list = document.createElement("div");
  list.className = "result-list";

  FIELD_DEFINITIONS.forEach((field) => {
    const item = document.createElement("article");
    item.className = "result-item";
    const title = document.createElement("h3");
    title.textContent = field.label;
    const value = document.createElement("p");
    value.textContent = data[field.key] || FALLBACK_TEXT;
    item.append(title, value);
    list.appendChild(item);
  });

  resultArea.innerHTML = "";
  resultArea.appendChild(list);
}

function toCopyText(data) {
  return FIELD_DEFINITIONS.map((field) => `${field.label}\n${data[field.key] || FALLBACK_TEXT}`).join("\n\n");
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

function setError(message) {
  errorArea.textContent = message;
}
