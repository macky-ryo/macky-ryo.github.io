const FALLBACK_TEXT = "詳しくは面談時にお問合せください。";

const FIELD_DEFINITIONS = [
  { key: "catchCopy", label: "キャッチコピー" },
  { key: "feature1", label: "この求人の特長はココ①" },
  { key: "feature2", label: "この求人の特長はココ②" },
  { key: "feature3", label: "この求人の特長はココ③" },
  { key: "body", label: "本文" },
  { key: "jobType", label: "職種", headings: ["職種"] },
  { key: "employmentType", label: "雇用形態", headings: ["雇用形態", "契約形態"] },
  { key: "jobDescription", label: "仕事内容", headings: ["仕事内容", "業務内容"] },
  { key: "requirements", label: "応募資格", headings: ["応募資格", "必要資格", "求める人物像"] },
  { key: "location", label: "勤務地", headings: ["勤務地", "勤務先"] },
  { key: "access", label: "アクセス", headings: ["アクセス", "最寄り駅", "交通アクセス"] },
  { key: "workHours", label: "勤務時間", headings: ["勤務時間", "就業時間"] },
  { key: "holidays", label: "休日", headings: ["休日", "休暇"] },
  { key: "salary", label: "給与", headings: ["給与", "年収", "月給", "時給"] },
  { key: "benefits", label: "待遇・福利厚生", headings: ["待遇・福利厚生", "福利厚生", "待遇"] },
  { key: "trialPeriod", label: "試用期間", headings: ["試用期間"] },
  { key: "smokingPolicy", label: "受動喫煙対策", headings: ["受動喫煙対策", "喫煙環境"] },
];

const extractButton = document.getElementById("extractButton");
const copyButton = document.getElementById("copyButton");
const resultArea = document.getElementById("resultArea");
const jobText = document.getElementById("jobText");

let latestResult = null;

extractButton.addEventListener("click", () => {
  const input = normalizeText(jobText.value);
  const extracted = buildExtractedData(input);
  latestResult = extracted;
  renderResult(extracted);
});

copyButton.addEventListener("click", async () => {
  if (!latestResult) {
    alert("先に「抽出する」を押してください。");
    return;
  }

  const copyText = toCopyText(latestResult);
  const copied = await copyToClipboard(copyText);
  if (copied) {
    alert("抽出結果をコピーしました。");
  } else {
    alert("コピーに失敗しました。表示されたテキストを手動でコピーしてください。");
  }
});

function buildExtractedData(text) {
  const data = {};

  // 将来拡張メモ:
  // - Python化する場合はこの関数をAPI呼び出しに置き換え、フロント側は結果レンダリングのみ維持しやすい構成。
  // - API連携時は `data` と同じキー構造のJSONを返すよう統一すると移行が簡単。
  // - LLM連携時は、ここでまず見出し抽出を実行し、欠損項目だけLLM補完する段階的処理が現実的。

  data.catchCopy = generateCatchCopy(text);
  const features = generateFeatures(text);
  data.feature1 = features[0] || FALLBACK_TEXT;
  data.feature2 = features[1] || FALLBACK_TEXT;
  data.feature3 = features[2] || FALLBACK_TEXT;
  data.body = generateBodySummary(text);

  FIELD_DEFINITIONS.forEach((field) => {
    if (!field.headings) {
      return;
    }
    data[field.key] = extractByHeadings(text, field.headings) || FALLBACK_TEXT;
  });

  return data;
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

function generateCatchCopy(text) {
  if (!text) {
    return FALLBACK_TEXT;
  }
  const line = firstInformativeLine(text);
  return trimToRange(`注目求人: ${line}`, 20, 120);
}

function generateFeatures(text) {
  if (!text) {
    return [FALLBACK_TEXT, FALLBACK_TEXT, FALLBACK_TEXT];
  }

  const hints = [
    extractByHeadings(text, ["仕事内容", "業務内容"]),
    extractByHeadings(text, ["勤務地", "アクセス"]),
    extractByHeadings(text, ["給与", "待遇・福利厚生", "福利厚生"]),
    firstInformativeLine(text),
  ].filter(Boolean);

  const unique = [...new Set(hints.map((h) => trimToRange(h, 15, 60)))];
  const defaults = [
    "業務内容が明確で、入社後の動きがイメージしやすい募集です。",
    "働く場所や通勤条件に関する情報が整理されています。",
    "報酬や福利厚生に関する基本情報を確認できます。",
  ];

  return [0, 1, 2].map((idx) => unique[idx] || defaults[idx]);
}

function generateBodySummary(text) {
  if (!text) {
    return FALLBACK_TEXT;
  }

  const companyLike = collectCompanyLikeLines(text);
  if (companyLike) {
    return trimToRange(companyLike, 150, 300);
  }

  return trimToRange(text, 150, 300);
}

function collectCompanyLikeLines(text) {
  const keywords = ["当社", "弊社", "事業", "会社", "企業", "理念", "サービス", "運営", "設立"];
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= 10);

  const matched = lines.filter((line) => keywords.some((kw) => line.includes(kw)));
  return matched.join(" ");
}

function firstInformativeLine(text) {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length >= 10);
  return line || text.slice(0, 60);
}

function extractByHeadings(text, headings) {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const heading = headings.find((h) => line.startsWith(h));
    if (!heading) {
      continue;
    }

    const direct = extractInlineValue(line, heading);
    if (direct) {
      return direct;
    }

    const block = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j].trim();
      if (!next) {
        if (block.length > 0) {
          break;
        }
        continue;
      }
      if (isAnyHeadingLine(next)) {
        break;
      }
      block.push(next);
    }

    if (block.length > 0) {
      return block.join(" ");
    }
  }

  return "";
}

function extractInlineValue(line, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^${escaped}[：:\\s-]*`);
  const value = line.replace(regex, "").trim();
  return value;
}

function isAnyHeadingLine(line) {
  const allHeadings = FIELD_DEFINITIONS.flatMap((f) => f.headings || []);
  return allHeadings.some((h) => line.startsWith(h));
}

function trimToRange(text, min, max) {
  if (!text) {
    return FALLBACK_TEXT;
  }

  let normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length > max) {
    normalized = `${normalized.slice(0, max - 1)}…`;
  }

  if (normalized.length < min) {
    return `${normalized} ${FALLBACK_TEXT}`.trim();
  }

  return normalized;
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

    item.appendChild(title);
    item.appendChild(value);
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
  temp.setAttribute("readonly", "");
  temp.style.position = "absolute";
  temp.style.left = "-9999px";
  document.body.appendChild(temp);
  temp.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }

  document.body.removeChild(temp);
  return copied;
}
