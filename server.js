import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve frontend
app.use(express.static("public"));

const ACCESS_CODE = process.env.ACCESS_CODE || "FETHINK-ETHICS1";
const COOKIE_SECRET = process.env.COOKIE_SECRET || crypto.randomBytes(32).toString("hex");
const SESSION_MINUTES = parseInt(process.env.SESSION_MINUTES || "120", 10);

const COURSE_BACK_URL = process.env.COURSE_BACK_URL || "";
const NEXT_LESSON_URL = process.env.NEXT_LESSON_URL || "";

app.use(cookieParser(COOKIE_SECRET));

/* ---------------- Session cookie helpers ---------------- */
const COOKIE_NAME = "fethink_ethics_session";

function setSessionCookie(res) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_MINUTES * 60;

  // Minimal payload – avoids “token system” visible to learners.
  // Signed cookie prevents tampering.
  const payload = { exp };

  res.cookie(COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: true,         // Render uses HTTPS
    sameSite: "lax",
    maxAge: SESSION_MINUTES * 60 * 1000,
    signed: true
  });
}

function isSessionValid(req) {
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (!raw) return false;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  return typeof payload?.exp === "number" && now < payload.exp;
}

function requireSession(req, res, next) {
  if (!isSessionValid(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

/* ---------------- Marking helpers ---------------- */
function clampStr(s, max = 6000) {
  return String(s || "").slice(0, max);
}

function wordCount(text) {
  const t = String(text || "").trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function hasAny(text, needles) {
  const t = String(text || "").toLowerCase();
  return needles.some(n => t.includes(n));
}

/* ---------------- Task content ---------------- */
const QUESTION_TEXT =
`Evaluate the SmartTown Council AI system.

In your response, explain:
1) Two ethical or legal failures in how the AI system was designed or used
2) Why these failures mattered for individuals or the public
3) Two actions the council should have taken to use AI more responsibly

Aim for 100–250 words.`;

const TEMPLATE_TEXT =
`1) Key ethical or legal failures
- Failure 1:
- Failure 2:

2) Why these failures mattered
- Impact on individuals:
- Impact on trust or fairness:

3) What should have been done differently
- Action 1:
- Action 2:`;

const MODEL_ANSWER =
`1. Key ethical or legal failures

One major failure was the use of facial recognition without clear public consent or transparency. Residents were not properly informed about how their data would be collected or used. A second failure was the lack of sufficient testing for bias and accuracy before deployment, which increased the risk of misidentification.

2. Why these failures mattered

These failures mattered because facial recognition can directly affect people’s rights and wellbeing. Individuals could be wrongly identified, questioned, or monitored, causing stress and harm. The lack of transparency also damaged public trust, as people felt watched rather than protected. When AI systems are introduced without openness or safeguards, they risk reinforcing unfairness and discrimination, particularly for certain groups.

3. What should have been done differently

First, the council should have completed a Data Protection Impact Assessment (DPIA) and clearly explained the system to the public, including how data would be stored and protected. Second, the system should have been independently tested for bias and accuracy before use, with clear limits on where and when it could operate. These steps would have supported fairer, more responsible use of AI.`;

/* ---------------- Deterministic rubric (10 marks) ----------------
   - <50 words: show only "Please add..." (no rubric, no model answer)
   - >=50 words: score + feedback + show model answer
   - Target range: 100–250 words (feedback note if outside)
--------------------------------------------------------------- */
function markEthicsResponse(answerText) {
  const wc = wordCount(answerText);

  // HARD GATE: under 50 words — no rubric, no model answer
  if (wc < 50) {
    return {
      gated: true,
      wordCount: wc,
      message:
        "Please add to your answer.\n" +
        "This response is too short to demonstrate evaluation.\n" +
        "Aim for 100–250 words and address all parts of the question.",
      score: null,
      bands: null,
      feedback: null,
      modelAnswer: null
    };
  }

  // Apply rubric
  let score = 0;
  const notes = [];

  const t = String(answerText || "").toLowerCase();

  // 1) Identify 2 ethical/legal failures (3 marks)
  // Detect at least two distinct failure themes
  const failureThemes = [
    { key: "consent/transparency", hits: ["consent", "transparent", "transparency", "informed", "notice", "public informed"] },
    { key: "gdpr/lawful basis", hits: ["gdpr", "lawful", "lawful basis", "data protection", "dpa", "privacy"] },
    { key: "bias/fairness", hits: ["bias", "biased", "fair", "fairness", "discrimin", "equal"] },
    { key: "accuracy/misidentification", hits: ["accur", "misidentif", "false positive", "false negative", "wrongly"] },
    { key: "security/storage", hits: ["secure", "security", "stored", "storage", "breach", "access control"] },
    { key: "dPIA/governance", hits: ["dpia", "impact assessment", "governance", "oversight", "audit"] }
  ];

  let themesFound = 0;
  for (const theme of failureThemes) {
    if (hasAny(t, theme.hits)) themesFound += 1;
  }
  if (themesFound >= 2) score += 3;
  else if (themesFound === 1) { score += 1; notes.push("Failures: Identify two clear ethical/legal failures (not just one)."); }
  else { notes.push("Failures: Identify two clear ethical/legal failures."); }

  // 2) Evaluate impact (3 marks)
  const mentionsIndividuals = hasAny(t, ["individual", "people", "resident", "person", "community"]);
  const mentionsHarm = hasAny(t, ["harm", "stress", "wrongly", "misidentif", "discrimin", "unfair", "rights"]);
  const mentionsTrust = hasAny(t, ["trust", "confidence", "public trust", "reputation", "legitimacy"]);

  // scoring: 3 if impact is multi-angle (individual + trust/fairness), 2 if partial, 1 if minimal mention
  if ((mentionsIndividuals && mentionsHarm) && (mentionsTrust || hasAny(t, ["fairness", "discrimin", "unfair"]))) score += 3;
  else if ((mentionsIndividuals && mentionsHarm) || mentionsTrust) score += 2;
  else { score += 1; notes.push("Impact: Explain why the failures mattered (harm to people and/or trust/fairness)."); }

  // 3) Recommendations (2 marks)
  const recThemes = [
    ["dpia", "impact assessment"],
    ["consent", "transparen", "public notice"],
    ["bias", "fairness testing", "independent testing"],
    ["accuracy testing", "pilot", "validate"],
    ["data minim", "retention", "delete"],
    ["security", "access control", "encryption"],
    ["limits", "where", "when", "policy", "governance"]
  ];

  let recHits = 0;
  for (const hits of recThemes) {
    if (hasAny(t, hits)) recHits += 1;
  }

  // also require they offer at least two "actions" in plain language
  const actionMarkers = (answerText.match(/\baction\b|\bshould\b|\bmust\b|\bneed to\b|\brecommend\b/gi) || []).length;

  if (recHits >= 2 && actionMarkers >= 2) score += 2;
  else if (recHits >= 1) { score += 1; notes.push("Recommendations: Give two practical actions the council should take (not vague)."); }
  else { notes.push("Recommendations: Provide two practical actions the council should take."); }

  // 4) Use of ethical/legal language (1 mark)
  const usesTerms = hasAny(t, ["gdpr", "dpia", "data protection", "privacy", "consent", "bias", "fairness", "transparency"]);
  if (usesTerms) score += 1;
  else notes.push("Language: Use at least one key term (e.g., GDPR, consent, bias, transparency, DPIA).");

  // 5) Clarity & structure (1 mark)
  const hasStructure =
    hasAny(t, ["failure 1", "failure 2"]) ||
    hasAny(t, ["1)", "2)", "3)"]) ||
    hasAny(t, ["key ethical", "why these failures", "what should have"]);
  if (hasStructure) score += 1;
  else notes.push("Structure: Use the template headings so your evaluation is easy to follow.");

  // Word-range guidance (not scored)
  if (wc < 100) notes.push("Length: Aim for 100–250 words (yours is a bit short).");
  if (wc > 250) notes.push("Length: Aim for 100–250 words (yours is a bit long).");

  // Clamp
  score = Math.max(0, Math.min(10, score));

  // Build friendly feedback
  const feedback =
    notes.length === 0
      ? "Strong response — you identified key issues, explained impact, and gave practical improvements."
      : "To improve:\n- " + notes.join("\n- ");

  return {
    gated: false,
    wordCount: wc,
    score,
    feedback,
    // model answer shown ONLY after passing the 50-word gate
    modelAnswer: MODEL_ANSWER
  };
}

/* ---------------- Routes ---------------- */
app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    courseBackUrl: COURSE_BACK_URL,
    nextLessonUrl: NEXT_LESSON_URL,
    questionText: QUESTION_TEXT,
    templateText: TEMPLATE_TEXT,
    targetWords: "100–250",
    minWordsGate: 50
  });
});

app.post("/api/unlock", (req, res) => {
  const code = String(req.body?.code || "").trim();
  if (!code) return res.status(400).json({ ok: false, error: "missing_code" });

  // Constant-time compare
  const a = Buffer.from(code);
  const b = Buffer.from(ACCESS_CODE);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: "incorrect_code" });
  }

  setSessionCookie(res);
  res.json({ ok: true });
});

app.post("/api/mark", requireSession, (req, res) => {
  const answerText = clampStr(req.body?.answerText, 6000);
  const result = markEthicsResponse(answerText);
  res.json({ ok: true, result });
});

app.post("/api/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => res.status(200).send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Ethics automarker running on http://localhost:${port}`));
