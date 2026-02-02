/* =========================================================
   FEthink — AI Ethics Automarker (Level 1)
   - Simple access code gate -> signed httpOnly cookie session
   - No URL variables needed (Payhip limitation)
   - Marking rules:
       <50 words: "Please add..." only; no rubric; no model answer
       >=50 words: score + feedback + model answer
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

function resetFeedback() {
  scoreBig.textContent = "—";
  wordCountBig.textContent = "—";
  feedbackBox.textContent = "";
  modelWrap.style.display = "none";
  modelAnswerEl.textContent = "";
}

/* ---------------- Load config ---------------- */
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
    // silent: UI still works
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
    // Insert at top without overwriting
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

/* ---------------- Submit for marking ---------------- */
async function mark() {
  resetFeedback();

  const answerText = answerTextEl.value.trim();
  const words = wc(answerText);

  // immediate client-side hint (server is still source of truth)
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
      // Under 50 words: only show the "Please add..." message, no model answer.
      scoreBig.textContent = "—";
      feedbackBox.textContent = result.message || "Please add to your answer.";
      modelWrap.style.display = "none";
      modelAnswerEl.textContent = "";
      return;
    }

    // >= 50 words: show rubric score + feedback + model answer
    scoreBig.textContent = `${result.score}/10`;
    feedbackBox.textContent = result.feedback || "";

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

/* ---------------- Initial load ----------------
   We don't know if they have a valid session cookie until they try marking.
   We still load config so the page doesn't feel blank.
*/
loadConfig().then(() => {
  // Gate is shown by default; if you want “silent” access when cookie exists,
  // the simplest approach is to try a mark with empty text — not desirable.
  // Instead, we keep the gate until they unlock per session.
  showGate();
});
