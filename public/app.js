/* =========================================================
   FEthink — AI Ethics Automarker (Level 1)
   - Access code gate -> signed httpOnly cookie session
   - Marking rules:
       <50 words: "Please add..." only; no score; no extras; no model answer
       >=50 words: score + strengths + tags + grid + improvement notes
       + optional Learn more framework tabs (collapsed by default)
       + model answer (collapsed) shown only when server returns it
   - Target length shown: 100–250 words
   ========================================================= */

const gateEl = document.getElementById("gate");
const codeInput = document.getElementById("codeInput");
const unlockBtn = document.getElementById("unlockBtn");
const gateMsg = document.getElementById("gateMsg");

const backToCourse = document.getElementById("backToCourse");
const nextLesson = document.getElementById("nextLesson");

const questionTextEl = document.getElementById("questionText");
const targetWordsEl = document.getElementById("targetWords");
const minGateEl = document.getElementById("minGate");

const insertTemplateBtn = document.getElementById("insertTemplateBtn");
const clearBtn = document.getElementById("clearBtn");
const answerTextEl = document.getElementById("answerText");

const submitBtn = document.getElementById("submitBtn");
const wordCountBox = document.getElementById("wordCountBox");

const scoreBig = document.getElementById("scoreBig");
const wordCountBig = document.getElementById("wordCountBig");
const feedbackBox = document.getElementById("feedbackBox");

// NEW: Strengths / Tags / Grid
const strengthsWrap = document.getElementById("strengthsWrap");
const strengthsList = document.getElementById("strengthsList");

const tagsWrap = document.getElementById("tagsWrap");
const tagsRow = document.getElementById("tagsRow");

const gridWrap = document.getElementById("gridWrap");
const gEthical = document.getElementById("gEthical");
const gImpact = document.getElementById("gImpact");
const gLegal = document.getElementById("gLegal");
const gRecs = document.getElementById("gRecs");
const gStructure = document.getElementById("gStructure");

// NEW: Learn more panel + tabs
const learnMoreWrap = document.getElementById("learnMoreWrap");
const learnMoreBtn = document.getElementById("learnMoreBtn");
const frameworkPanel = document.getElementById("frameworkPanel");
const tabButtons = Array.from(document.querySelectorAll(".tabBtn"));

const gdprExpectation = document.getElementById("gdprExpectation");
const gdprCase = document.getElementById("gdprCase");
const unescoExpectation = document.getElementById("unescoExpectation");
const unescoCase = document.getElementById("unescoCase");
const ofstedExpectation = document.getElementById("ofstedExpectation");
const ofstedCase = document.getElementById("ofstedCase");
const jiscExpectation = document.getElementById("jiscExpectation");
const jiscCase = document.getElementById("jiscCase");

// Model answer
const modelWrap = document.getElementById("modelWrap");
const modelAnswerEl = document.getElementById("modelAnswer");

/* ---------------- Local state ---------------- */
let TEMPLATE_TEXT = "";
let MIN_GATE = 50;

/* ---------------- Helpers ---------------- */
function wc(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function showGate(message = "") {
  gateEl.style.display = "flex";
  gateMsg.textContent = message;
  codeInput.focus();
}

function hideGate() {
  gateEl.style.display = "none";
}

function resetExtras() {
  // Strengths
  strengthsWrap.style.display = "none";
  strengthsList.innerHTML = "";

  // Tags
  tagsWrap.style.display = "none";
  tagsRow.innerHTML = "";

  // Grid
  gridWrap.style.display = "none";
  gEthical.textContent = "—";
  gImpact.textContent = "—";
  gLegal.textContent = "—";
  gRecs.textContent = "—";
  gStructure.textContent = "—";

  // Learn more panel
  learnMoreWrap.style.display = "none";
  frameworkPanel.style.display = "none";
  frameworkPanel.setAttribute("aria-hidden", "true");
  learnMoreBtn.setAttribute("aria-expanded", "false");

  // Model answer
  modelWrap.style.display = "none";
  modelAnswerEl.textContent = "";
}

function resetFeedback() {
  scoreBig.textContent = "—";
  wordCountBig.textContent = "—";
  feedbackBox.textContent = "";
  resetExtras();
}

/* ---------------- Config load ---------------- */
async function loadConfig() {
  try {
    const res = await fetch("/api/config", { credentials: "include" });
    const data = await res.json();
    if (!data?.ok) return;

    questionTextEl.textContent = data.questionText || "Task loaded.";
    targetWordsEl.textContent = data.targetWords || "100–250";
    MIN_GATE = data.minWordsGate ?? 50;
    minGateEl.textContent = String(MIN_GATE);

    TEMPLATE_TEXT = data.templateText || "";

    if (data.courseBackUrl) {
      backToCourse.href = data.courseBackUrl;
      backToCourse.style.display = "inline-block";
    }
    if (data.nextLessonUrl) {
      nextLesson.href = data.nextLessonUrl;
      nextLesson.style.display = "inline-block";
    }
  } catch {
    // silent
  }
}

/* ---------------- Gate unlock ---------------- */
async function unlock() {
  const code = codeInput.value.trim();
  if (!code) {
    gateMsg.textContent = "Please enter the access code from your lesson.";
    return;
  }

  unlockBtn.disabled = true;
  gateMsg.textContent = "Checking…";

  try {
    const res = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (!res.ok || !data?.ok) {
      gateMsg.textContent = "That code didn’t work. Check it and try again.";
      return;
    }

    hideGate();
    await loadConfig();
  } catch {
    gateMsg.textContent = "Network issue. Please try again.";
  } finally {
    unlockBtn.disabled = false;
  }
}

unlockBtn.addEventListener("click", unlock);
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlock();
});

/* ---------------- Word count live ---------------- */
function updateWordCount() {
  const n = wc(answerTextEl.value);
  wordCountBox.textContent = `Words: ${n}`;
}
answerTextEl.addEventListener("input", updateWordCount);
updateWordCount();

/* ---------------- Template + clear ---------------- */
insertTemplateBtn.addEventListener("click", () => {
  if (!TEMPLATE_TEXT) return;
  const existing = answerTextEl.value.trim();
  if (!existing) {
    answerTextEl.value = TEMPLATE_TEXT;
  } else {
    answerTextEl.value = `${TEMPLATE_TEXT}\n\n---\n\n${existing}`;
  }
  answerTextEl.focus();
  updateWordCount();
});

clearBtn.addEventListener("click", () => {
  answerTextEl.value = "";
  updateWordCount();
  resetFeedback();
});

/* ---------------- Learn more toggle + tabs ---------------- */
function setActiveTab(tabKey) {
  // buttons
  tabButtons.forEach(btn => {
    const isActive = btn.dataset.tab === tabKey;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // panes
  const panes = ["gdpr", "unesco", "ofsted", "jisc"];
  panes.forEach(k => {
    const pane = document.getElementById(`tab-${k}`);
    if (pane) pane.classList.toggle("active", k === tabKey);
  });
}

learnMoreBtn?.addEventListener("click", () => {
  const isOpen = frameworkPanel.style.display === "block";
  if (isOpen) {
    frameworkPanel.style.display = "none";
    frameworkPanel.setAttribute("aria-hidden", "true");
    learnMoreBtn.setAttribute("aria-expanded", "false");
  } else {
    frameworkPanel.style.display = "block";
    frameworkPanel.setAttribute("aria-hidden", "false");
    learnMoreBtn.setAttribute("aria-expanded", "true");
  }
});

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
});

/* ---------------- Render helpers ---------------- */
function renderStrengths(strengths) {
  if (!Array.isArray(strengths) || strengths.length === 0) {
    strengthsWrap.style.display = "none";
    strengthsList.innerHTML = "";
    return;
  }
  strengthsList.innerHTML = strengths.slice(0, 3).map(s => `<li>${escapeHtml(s)}</li>`).join("");
  strengthsWrap.style.display = "block";
}

function tagBadge(name, status) {
  // status: "ok" | "mid" | "bad"
  const symbol = status === "ok" ? "✔" : status === "mid" ? "◐" : "✗";
  const cls = status === "ok" ? "tag ok" : status === "mid" ? "tag mid" : "tag bad";
  return `<span class="${cls}"><span class="tagStatus">${symbol}</span>${escapeHtml(name)}</span>`;
}

function renderTags(tags) {
  // tags: [{name, status}] where status is ok/mid/bad
  if (!Array.isArray(tags) || tags.length === 0) {
    tagsWrap.style.display = "none";
    tagsRow.innerHTML = "";
    return;
  }
  tagsRow.innerHTML = tags.map(t => tagBadge(t.name, t.status)).join("");
  tagsWrap.style.display = "block";
}

function renderGrid(grid) {
  // grid: {ethical, impact, legal, recs, structure} -> "Secure" / "Developing" / "Missing"
  if (!grid) {
    gridWrap.style.display = "none";
    return;
  }
  gEthical.textContent = grid.ethical || "—";
  gImpact.textContent = grid.impact || "—";
  gLegal.textContent = grid.legal || "—";
  gRecs.textContent = grid.recs || "—";
  gStructure.textContent = grid.structure || "—";
  gridWrap.style.display = "block";
}

function renderFramework(framework) {
  // framework: {gdpr:{expectation,case}, unesco:{...}, ofsted:{...}, jisc:{...}}
  if (!framework) {
    learnMoreWrap.style.display = "none";
    return;
  }

  gdprExpectation.textContent = framework.gdpr?.expectation || "—";
  gdprCase.textContent = framework.gdpr?.case || "—";

  unescoExpectation.textContent = framework.unesco?.expectation || "—";
  unescoCase.textContent = framework.unesco?.case || "—";

  ofstedExpectation.textContent = framework.ofsted?.expectation || "—";
  ofstedCase.textContent = framework.ofsted?.case || "—";

  jiscExpectation.textContent = framework.jisc?.expectation || "—";
  jiscCase.textContent = framework.jisc?.case || "—";

  // show container (panel still collapsed until button clicked)
  learnMoreWrap.style.display = "block";
  frameworkPanel.style.display = "none";
  frameworkPanel.setAttribute("aria-hidden", "true");
  learnMoreBtn.setAttribute("aria-expanded", "false");

  // default tab
  setActiveTab("gdpr");
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------- Submit for marking ---------------- */
async function mark() {
  resetFeedback();

  const answerText = answerTextEl.value.trim();
  const words = wc(answerText);

  if (words === 0) {
    feedbackBox.textContent = "Write your answer first (aim for 100–250 words).";
    return;
  }

  submitBtn.disabled = true;
  feedbackBox.textContent = "Marking…";
  wordCountBig.textContent = String(words);

  try {
    const res = await fetch("/api/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ answerText })
    });

    if (res.status === 401) {
      showGate("Session expired. Please re-enter the access code from your Payhip lesson.");
      submitBtn.disabled = false;
      return;
    }

    const data = await res.json();
    const result = data?.result;

    if (!data?.ok || !result) {
      feedbackBox.textContent = "Could not mark your answer. Please try again.";
      return;
    }

    wordCountBig.textContent = String(result.wordCount ?? words);

    if (result.gated) {
      // Under 50 words: only show the "Please add..." message, no extras, no model answer.
      scoreBig.textContent = "—";
      feedbackBox.textContent = result.message || "Please add to your answer.";
      resetExtras();
      return;
    }

    // >= 50 words
    scoreBig.textContent = `${result.score}/10`;

    // strengths + tags + grid + notes
    renderStrengths(result.strengths);
    renderTags(result.tags);
    renderGrid(result.grid);

    feedbackBox.textContent = result.feedback || "";

    // Learn more panel only if server provides framework content
    renderFramework(result.framework);

    // Model answer only if server returns it (already respects >=50 words rule)
    if (result.modelAnswer) {
      modelAnswerEl.textContent = result.modelAnswer;
      modelWrap.style.display = "block";
    } else {
      modelWrap.style.display = "none";
    }

  } catch {
    feedbackBox.textContent = "Network issue. Please try again.";
  } finally {
    submitBtn.disabled = false;
  }
}

submitBtn.addEventListener("click", mark);

/* ---------------- Initial load ---------------- */
loadConfig().then(() => {
  showGate();
});
