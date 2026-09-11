/* Class and chapter registrations use the existing Google Apps Script endpoints. */

const WIZ_ENDPOINT_CHAPTER =
  "https://script.google.com/macros/s/AKfycbwUqIX8Vozgys0jgzWcNH-PfrLB3U7ZmeFz0d_oxm63D0kY6vWz8AR3KTFeWVgeUDPDIA/exec";
const WIZ_ENDPOINT_CLASS =
  "https://script.google.com/macros/s/AKfycbwKtXNbiBFW8d3QjMT8pNhtQmACy8ddlT0_ZiKN-0fWFw4-zygpWPdEa0iKlm5rkRSqiQ/exec";

let wizMode = null; // null (chooser) | 'chapter' | 'class'
let wizIdx = 0;
let wizDone = false;
let wizReturnFocus = null;
let wizSession = 0;
let wizSubmission = null;
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );

const chapterState = {
  path: null,
  schoolName: "",
  location: "",
  yourRole: "",
  grades: "",
  teamSize: "",
  advisor: "",
  clubName: "",
  clubSize: "",
  meets: "",
  topics: [],
  format: "",
  delivery: "",
  start: "",
  first: "",
  last: "",
  email: "",
  phone: "",
  message: "",
};
const classState = {
  studentFirst: "",
  studentLast: "",
  studentEmail: "",
  studentPhone: "",
  guardianFirst: "",
  guardianLast: "",
  guardianEmail: "",
  guardianPhone: "",
  country: "",
  state_: "",
  heard: "",
  experience: "",
  schedule: "",
  other: "",
};

/* the nine courses DevFintech actually teaches */
const WIZ_TOPICS = [
  ["Personal Finance", "Budgeting, saving, and managing money"],
  ["Behavioral Finance", "The psychology behind spending and investing"],
  ["Banking", "Account types, income, and expenses"],
  ["Investing", "Ways to invest money and grow wealth"],
  ["Coding", "Python and HTML fundamentals"],
  ["Economics", "Offered to students 11 and older"],
  ["Digital Currencies", "Crypto, blockchain, and staying safe online"],
  ["Loans", "Loan types, what they're used for, and their terms"],
  ["Debt", "Kinds of debt, and how to manage and reduce it"],
];
const WIZ_ROLES = [
  "Student",
  "Club officer",
  "Teacher",
  "Counselor or administrator",
  "Parent",
  "Other",
];
const WIZ_GRADES = [
  "Elementary (K–5)",
  "Middle school (6–8)",
  "High school (9–12)",
  "Mixed ages",
];
const WIZ_SIZES = ["Under 10", "10 to 25", "25 to 50", "More than 50"];
const WIZ_CADENCE = ["Weekly", "Every other week", "Monthly", "Now and then"];
const WIZ_FORMATS = [
  "Weekly sessions across a semester",
  "A short workshop series",
  "A one-time workshop or assembly",
  "Not sure yet",
];
const WIZ_DELIVER = ["Video calls", "In person", "Either works"];
const WIZ_START = [
  "This semester",
  "Next semester",
  "Next school year",
  "Still deciding",
];
const WIZ_HEARD = [
  "A friend or classmate",
  "School or teacher",
  "Instagram or social media",
  "Search engine",
  "A DevFintech event or hackathon",
  "Other",
];
const WIZ_SCHEDULE = [
  ["mon", "Monday", "4:30PM to 5:30PM PST"],
  ["tue", "Tuesday", "5:00PM to 6:00PM PST"],
  ["other", "Other", "Tell us your time zone, day, and time"],
];

/* ---------- step lists ---------- */
function chapterSteps() {
  const s = ["path"];
  if (chapterState.path) s.push("school");
  if (chapterState.path === "chapter") s.push("team");
  if (chapterState.path === "existing") s.push("club");
  if (chapterState.path)
    s.push("topics", "format", "contact", "message", "review");
  return s;
}
const CHAPTER_PROJECTED = [
  "path",
  "school",
  "team",
  "topics",
  "format",
  "contact",
  "message",
  "review",
];
function chapterPlanned() {
  return chapterState.path ? chapterSteps() : CHAPTER_PROJECTED;
}

function classSteps() {
  const s = ["student", "guardian", "location", "background", "schedule"];
  if (classState.schedule === "other") s.push("other");
  s.push("review");
  return s;
}
const CLASS_PROJECTED = [
  "student",
  "guardian",
  "location",
  "background",
  "schedule",
  "other",
  "review",
];
function classPlanned() {
  return classState.schedule ? classSteps() : CLASS_PROJECTED;
}

function currentSteps() {
  return wizMode === "chapter"
    ? chapterSteps()
    : wizMode === "class"
      ? classSteps()
      : ["entry"];
}
function plannedSteps() {
  return wizMode === "chapter"
    ? chapterPlanned()
    : wizMode === "class"
      ? classPlanned()
      : ["entry"];
}

/* ---------- progress meter ---------- */
const WIZ_CURVE_D = "M4,40 C60,39 108,35 148,27 S222,7 296,3";
function wizMeter() {
  const list = plannedSteps();
  const total = Math.max(1, list.length - 1);
  const done = Math.max(0, wizIdx);
  const p = done / total;
  return `
  <div class="wiz-meter" role="progressbar" aria-label="Registration progress" aria-valuemin="1" aria-valuemax="${list.length}" aria-valuenow="${done + 1}">
    <div class="wiz-curve-wrap">
      <svg class="wiz-curve" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
        <path class="wiz-curve-track" d="${WIZ_CURVE_D}" />
        <path class="wiz-curve-live" id="wizLive" d="${WIZ_CURVE_D}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1 - p}" />
        <circle class="wiz-curve-dot" id="wizDot" r="4.5" cx="0" cy="0" />
      </svg>
    </div>
    <span class="wiz-step-count">Step ${done + 1} of ${list.length}</span>
  </div>`;
}
function wizPlaceDot() {
  const live = document.getElementById("wizLive");
  const dot = document.getElementById("wizDot");
  if (!live || !dot) return;
  const list = plannedSteps();
  const total = Math.max(1, list.length - 1);
  const p = Math.max(0, wizIdx) / total;
  const len = live.getTotalLength();
  const pt = live.getPointAtLength(len * p);
  dot.setAttribute("cx", pt.x);
  dot.setAttribute("cy", pt.y);
  dot.style.opacity = p > 0 ? 1 : 0;
}

/* ---------- small builders ---------- */
const wizOpt = (stateObj, val, key, title, sub, multi) => `
  <button class="wiz-opt" data-key="${key}" data-val="${val}" ${multi ? 'data-multi="1"' : ""} aria-pressed="${multi ? stateObj[key].includes(val) : stateObj[key] === val}">
    <span class="wiz-row">
      <span>${title}${sub ? `<small>${sub}</small>` : ""}</span>
      <span class="wiz-tick"></span>
    </span>
  </button>`;

const wizField = (id, label, html, required = true) => `
  <div class="wiz-field" id="wf-${id}">
    <label for="${id}">${label}${required ? "" : ` <span class="wiz-opt-tag">(optional)</span>`}</label>
    ${html}
    <p class="wiz-err" id="we-${id}"></p>
  </div>`;

const wizSel = (id, list, current, placeholder = "Select one") => `
  <select id="${id}">
    <option value="">${placeholder}</option>
    ${list.map((o) => `<option ${current === o ? "selected" : ""}>${o}</option>`).join("")}
  </select>`;

const wizNav = (primary = "Continue", canBack = true) => `
  <div class="wiz-nav">
    ${canBack ? `<button class="btn btn-outline" id="wizBack" type="button">Back</button>` : ""}
    <span class="wiz-spacer"></span>
    <button class="btn btn-primary" id="wizNext" type="button">${primary}</button>
  </div>`;

/* ---------- entry chooser ---------- */
function entryScreen() {
  return `
  <div class="wiz-screen">
    <p class="wiz-eyebrow">Join DevFintech</p>
    <h1>How do you want<br>to get involved<span class="dot">?</span></h1>
    <p class="wiz-lede">Pick one and we'll take you straight to the right form.</p>
    <div class="wiz-opts">
      <button class="wiz-opt" id="wizPickClass" type="button">
        <span class="wiz-row">
          <span>Sign up for a class<small>Free live sessions, taught by trained student mentors</small></span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M8 7h9v9"/></svg>
        </span>
      </button>
      <button class="wiz-opt" id="wizPickChapter" type="button">
        <span class="wiz-row">
          <span>Join with us<small>Start a chapter, or bring DevFintech into a club or class you already run</small></span>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M7 17 17 7M8 7h9v9"/></svg>
        </span>
      </button>
    </div>
    <p class="wiz-hint" style="margin-bottom:0">Free, always. A person replies within about two days.</p>
  </div>`;
}

/* ---------- chapter / club screens ---------- */
const chapterScreens = {
  path: () => `
    <div class="wiz-screen">
      <h2>How would DevFintech fit in?</h2>
      <p class="wiz-hint">This changes what we ask next.</p>
      <div class="wiz-opts">
        ${wizOpt(chapterState, "chapter", "path", "Start a chapter at my school", "DevFintech runs as its own club, with you helping lead it")}
        ${wizOpt(chapterState, "existing", "path", "Teach inside a club or class we already have", "We bring the curriculum to a group that already meets")}
      </div>
      ${wizNav("Continue")}
    </div>`,

  school: () => `
    <div class="wiz-screen">
      <h2>Tell us about the school</h2>
      <p class="wiz-hint">We match you with mentors who have taught your age group before.</p>
      ${wizField("schoolName", "School name", `<input type="text" id="schoolName" value="${escapeHtml(chapterState.schoolName)}" placeholder="Streamer High School" autocomplete="organization">`)}
      ${wizField("location", "City and state or country", `<input type="text" id="location" value="${escapeHtml(chapterState.location)}" placeholder="San Jose, CA">`)}
      ${wizField("yourRole", "Your role there", wizSel("yourRole", WIZ_ROLES, chapterState.yourRole))}
      ${wizField("grades", "Who would be in the room", wizSel("grades", WIZ_GRADES, chapterState.grades, "Select an age group"))}
      ${wizNav()}
    </div>`,

  team: () => `
    <div class="wiz-screen">
      <h2>Who is starting it with you?</h2>
      <p class="wiz-hint">Chapters run best with a few students sharing the work. A small team is fine to start.</p>
      ${wizField("teamSize", "Students helping launch the chapter", wizSel("teamSize", ["Just me", "2 to 4 students", "5 to 10 students", "More than 10 students"], chapterState.teamSize, "Select a size"))}
      ${wizField("advisor", "Faculty advisor", wizSel("advisor", ["Yes, we have one", "Not yet, but we can ask", "Not sure if we need one"], chapterState.advisor, "Select an answer"))}
      ${wizNav()}
    </div>`,

  club: () => `
    <div class="wiz-screen">
      <h2>Tell us about the group</h2>
      <p class="wiz-hint">We plan the sessions around how your group already meets.</p>
      ${wizField("clubName", "Club, class, or program name", `<input type="text" id="clubName" value="${escapeHtml(chapterState.clubName)}" placeholder="Finance Club">`)}
      ${wizField("clubSize", "Roughly how many students", wizSel("clubSize", WIZ_SIZES, chapterState.clubSize, "Select a size"))}
      ${wizField("meets", "How often it meets", wizSel("meets", WIZ_CADENCE, chapterState.meets, "Select a schedule"))}
      ${wizNav()}
    </div>`,

  topics: () => `
    <div class="wiz-screen">
      <h2>Which courses do you want?</h2>
      <p class="wiz-hint">Pick as many as you like. We build the schedule from what you choose.</p>
      <div class="wiz-opts">
        ${WIZ_TOPICS.map(([t, s]) => wizOpt(chapterState, t, "topics", t, s, true)).join("")}
      </div>
      <p class="wiz-picked" id="wizCount">${chapterState.topics.length} selected</p>
      ${wizNav()}
    </div>`,

  format: () => `
    <div class="wiz-screen">
      <h2>How should the sessions run?</h2>
      <p class="wiz-hint">Rough answers are fine. We will confirm the details with you before anything is booked.</p>
      ${wizField("format", "Shape of the program", wizSel("format", WIZ_FORMATS, chapterState.format, "Select a format"))}
      ${wizField("delivery", "Where sessions happen", wizSel("delivery", WIZ_DELIVER, chapterState.delivery, "Select an option"))}
      ${wizField("start", "When you want to start", wizSel("start", WIZ_START, chapterState.start, "Select a timeframe"))}
      ${wizNav()}
    </div>`,

  contact: () => `
    <div class="wiz-screen">
      <h2>How do we reach you?</h2>
      <p class="wiz-hint">One confirmation now, then a real reply from a person. Nothing else, ever.</p>
      ${wizField("first", "First name", `<input type="text" id="first" value="${escapeHtml(chapterState.first)}" autocomplete="given-name">`)}
      ${wizField("last", "Last name", `<input type="text" id="last" value="${escapeHtml(chapterState.last)}" autocomplete="family-name">`)}
      ${wizField("email", "Email", `<input type="email" id="email" value="${escapeHtml(chapterState.email)}" placeholder="you@school.edu" autocomplete="email">`)}
      ${wizField("phone", "Phone number", `<input type="tel" id="phone" value="${escapeHtml(chapterState.phone)}" placeholder="(408) 555-0134" autocomplete="tel">`)}
      ${wizNav()}
    </div>`,

  message: () => `
    <div class="wiz-screen">
      <h2>Anything else we should know?</h2>
      <p class="wiz-hint">Optional. Skip it if you'd rather just talk it through later.</p>
      ${wizField("message", "Add a message or tell us more about your school", `<textarea id="message" placeholder="What students are asking for, approvals you still need, days that work">${escapeHtml(chapterState.message)}</textarea>`, false)}
      ${wizNav("Review")}
    </div>`,

  review: () => {
    const rows = [
      [
        "Request",
        chapterState.path === "chapter"
          ? "Start a new chapter"
          : "Teach an existing club or class",
      ],
      ["School", chapterState.schoolName],
      ["Location", chapterState.location],
      ["Your role", chapterState.yourRole],
      ["Students", chapterState.grades],
    ];
    if (chapterState.path === "chapter") {
      rows.push(
        ["Founding team", chapterState.teamSize],
        ["Advisor", chapterState.advisor],
      );
    } else {
      rows.push(
        ["Group", `${chapterState.clubName} · ${chapterState.clubSize}`],
        ["Meets", chapterState.meets],
      );
    }
    rows.push(
      ["Courses", chapterState.topics.join(", ")],
      ["Format", `${chapterState.format} · ${chapterState.delivery}`],
      ["Start", chapterState.start],
      ["Name", `${chapterState.first} ${chapterState.last}`],
      ["Email", chapterState.email],
      ["Phone", chapterState.phone],
      ["Message", chapterState.message ? chapterState.message : "None added"],
    );
    return `
    <div class="wiz-screen">
      <h2>Check this over</h2>
      <p class="wiz-hint">Go back and change anything that looks wrong.</p>
      <div class="wiz-summary">
        ${rows.map(([k, v]) => `<div class="wiz-srow"><span class="wiz-skey">${k}</span><span class="wiz-sval">${escapeHtml(v)}</span></div>`).join("")}
      </div>
      ${wizNav("Send request")}
    </div>`;
  },

  done: () => `
    <div class="wiz-screen">
      <div class="wiz-badge"></div>
      <h2>Request sent.</h2>
      <p class="wiz-lede">We’ll contact you at <strong>${escapeHtml(chapterState.email)}</strong>. Someone from DevFintech will follow up about <strong>${escapeHtml(chapterState.schoolName)}</strong> within a couple of days.</p>
      <div class="wiz-facts">
        <span class="wiz-fact">Request received</span>
        <span class="wiz-fact">No cost</span>
      </div>
    </div>`,
};

/* ---------- class-signup screens ---------- */
const classScreens = {
  student: () => `
    <div class="wiz-screen">
      <h2>Who's the student?</h2>
      <p class="wiz-hint">Just the basics, we'll get to scheduling in a minute.</p>
      ${wizField("studentFirst", "Student's first name", `<input type="text" id="studentFirst" value="${escapeHtml(classState.studentFirst)}" autocomplete="given-name">`)}
      ${wizField("studentLast", "Student's last name", `<input type="text" id="studentLast" value="${escapeHtml(classState.studentLast)}" autocomplete="family-name">`)}
      ${wizField("studentEmail", "Student's email", `<input type="email" id="studentEmail" value="${escapeHtml(classState.studentEmail)}" placeholder="student@email.com" autocomplete="email">`, false)}
      ${wizField("studentPhone", "Student's phone number", `<input type="tel" id="studentPhone" value="${escapeHtml(classState.studentPhone)}" placeholder="(408) 555-0134" autocomplete="tel">`, false)}
      ${wizNav("Continue")}
    </div>`,

  guardian: () => `
    <div class="wiz-screen">
      <h2>Who's the guardian?</h2>
      <p class="wiz-hint">This is who we'll confirm the class time with and reach if a session changes.</p>
      ${wizField("guardianFirst", "Guardian's first name", `<input type="text" id="guardianFirst" value="${escapeHtml(classState.guardianFirst)}" autocomplete="given-name">`)}
      ${wizField("guardianLast", "Guardian's last name", `<input type="text" id="guardianLast" value="${escapeHtml(classState.guardianLast)}" autocomplete="family-name">`)}
      ${wizField("guardianEmail", "Guardian's email", `<input type="email" id="guardianEmail" value="${escapeHtml(classState.guardianEmail)}" placeholder="you@email.com" autocomplete="email">`)}
      ${wizField("guardianPhone", "Guardian's phone number", `<input type="tel" id="guardianPhone" value="${escapeHtml(classState.guardianPhone)}" placeholder="(408) 555-0134" autocomplete="tel">`)}
      ${wizNav()}
    </div>`,

  location: () => `
    <div class="wiz-screen">
      <h2>Where are you located?</h2>
      <p class="wiz-hint">Sessions run over video, so this just tells us the time zone to plan around.</p>
      ${wizField("country", "Country", `<input type="text" id="country" value="${escapeHtml(classState.country)}" placeholder="United States" autocomplete="country-name">`)}
      ${wizField("state_", "State or province", `<input type="text" id="state_" value="${escapeHtml(classState.state_)}" placeholder="California" autocomplete="address-level1">`)}
      ${wizNav()}
    </div>`,

  background: () => `
    <div class="wiz-screen">
      <h2>A bit of background</h2>
      <p class="wiz-hint">Helps us place the student in the right group and pace the first few sessions.</p>
      ${wizField("heard", "How did you hear about us", wizSel("heard", WIZ_HEARD, classState.heard, "Select an answer"))}
      ${wizField("experience", "Prior experience with these topics, and what you're most interested in", `<textarea id="experience" placeholder="e.g. never budgeted before, curious about investing and coding">${escapeHtml(classState.experience)}</textarea>`)}
      ${wizNav()}
    </div>`,

  schedule: () => `
    <div class="wiz-screen">
      <h2>What days will you attend?</h2>
      <p class="wiz-hint">Pick a slot below, or choose Other and tell us a time that works better, we'll try to accommodate it.</p>
      <div class="wiz-opts">
        ${WIZ_SCHEDULE.map(([v, t, s]) => wizOpt(classState, v, "schedule", t, s)).join("")}
      </div>
      ${wizNav()}
    </div>`,

  other: () => `
    <div class="wiz-screen">
      <h2>What time works for you?</h2>
      <p class="wiz-hint">Include the time zone, the day, and the time you'd like, and we'll see what we can do.</p>
      ${wizField("other", "Time zone, day, and time", `<textarea id="other" placeholder="e.g. GMT+1, Wednesdays, 6:00 to 7:00 PM">${escapeHtml(classState.other)}</textarea>`)}
      ${wizNav()}
    </div>`,

  review: () => {
    const scheduleLine =
      classState.schedule === "other"
        ? `Other · ${classState.other}`
        : (() => {
            const m = WIZ_SCHEDULE.find((s) => s[0] === classState.schedule);
            return m ? `${m[1]} · ${m[2]}` : "";
          })();
    const rows = [
      ["Student", `${classState.studentFirst} ${classState.studentLast}`],
      ["Student email", classState.studentEmail || "Not provided"],
      ["Student phone", classState.studentPhone || "Not provided"],
      ["Guardian", `${classState.guardianFirst} ${classState.guardianLast}`],
      ["Guardian email", classState.guardianEmail],
      ["Guardian phone", classState.guardianPhone],
      ["Location", `${classState.country}, ${classState.state_}`],
      ["Heard about us", classState.heard],
      ["Experience", classState.experience],
      ["Schedule", scheduleLine],
    ];
    return `
    <div class="wiz-screen">
      <h2>Check this over</h2>
      <p class="wiz-hint">Go back and change anything that looks wrong.</p>
      <div class="wiz-summary">
        ${rows.map(([k, v]) => `<div class="wiz-srow"><span class="wiz-skey">${k}</span><span class="wiz-sval">${escapeHtml(v)}</span></div>`).join("")}
      </div>
      ${wizNav("Send registration")}
    </div>`;
  },

  done: () => `
    <div class="wiz-screen">
      <div class="wiz-badge"></div>
      <h2>Registration sent.</h2>
      <p class="wiz-lede">We’ll contact you at <strong>${escapeHtml(classState.guardianEmail)}</strong>. We'll follow up to confirm the class time for <strong>${escapeHtml(classState.studentFirst)}</strong> within a couple of days.</p>
      <div class="wiz-facts">
        <span class="wiz-fact">Registration received</span>
        <span class="wiz-fact">No cost</span>
      </div>
    </div>`,
};

/* ---------- validation ---------- */
function wizFail(id, msg) {
  const f = document.getElementById("wf-" + id);
  const e = document.getElementById("we-" + id);
  if (f) f.classList.add("invalid");
  document.getElementById(id)?.setAttribute("aria-invalid", "true");
  if (e) {
    e.textContent = msg;
    e.classList.add("show");
  }
  return false;
}
function wizClearErrors() {
  document
    .querySelectorAll("#wizContent [aria-invalid]")
    .forEach((field) => field.removeAttribute("aria-invalid"));
  document
    .querySelectorAll(".wiz-field")
    .forEach((f) => f.classList.remove("invalid"));
  document
    .querySelectorAll(".wiz-err")
    .forEach((e) => e.classList.remove("show"));
}
const WIZ_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function wizAlertPick(msg) {
  const status = document.getElementById("wizStatus");
  status.textContent = msg;
  status.hidden = false;
  status.scrollIntoView({ block: "nearest" });
  return false;
}
function wizAlertPickClear() {
  const status = document.getElementById("wizStatus");
  status.hidden = true;
  status.textContent = "";
  return true;
}

function validateChapter(step) {
  wizClearErrors();
  const v = (id) => (document.getElementById(id)?.value || "").trim();

  if (step === "path")
    return chapterState.path
      ? wizAlertPickClear()
      : wizAlertPick("Pick one to continue.");
  if (step === "topics")
    return chapterState.topics.length
      ? wizAlertPickClear()
      : wizAlertPick("Pick at least one course. You can add more later.");

  if (step === "school") {
    let ok = true;
    chapterState.schoolName = v("schoolName");
    chapterState.location = v("location");
    chapterState.yourRole = v("yourRole");
    chapterState.grades = v("grades");
    if (!chapterState.schoolName)
      ok = wizFail("schoolName", "Enter the school name.");
    if (!chapterState.location)
      ok = wizFail("location", "Enter the city and state or country.");
    if (!chapterState.yourRole)
      ok = wizFail("yourRole", "Pick your role at the school.");
    if (!chapterState.grades)
      ok = wizFail("grades", "Pick the age group you'd be teaching.");
    return ok;
  }
  if (step === "team") {
    let ok = true;
    chapterState.teamSize = v("teamSize");
    chapterState.advisor = v("advisor");
    if (!chapterState.teamSize)
      ok = wizFail("teamSize", "Pick a rough team size.");
    if (!chapterState.advisor)
      ok = wizFail("advisor", "Let us know where the advisor stands.");
    return ok;
  }
  if (step === "club") {
    let ok = true;
    chapterState.clubName = v("clubName");
    chapterState.clubSize = v("clubSize");
    chapterState.meets = v("meets");
    if (!chapterState.clubName)
      ok = wizFail("clubName", "Enter the club, class, or program name.");
    if (!chapterState.clubSize) ok = wizFail("clubSize", "Pick a rough size.");
    if (!chapterState.meets) ok = wizFail("meets", "Pick how often it meets.");
    return ok;
  }
  if (step === "format") {
    let ok = true;
    chapterState.format = v("format");
    chapterState.delivery = v("delivery");
    chapterState.start = v("start");
    if (!chapterState.format)
      ok = wizFail("format", "Pick a format, you can change it later.");
    if (!chapterState.delivery)
      ok = wizFail("delivery", "Pick where sessions would happen.");
    if (!chapterState.start) ok = wizFail("start", "Pick a rough start time.");
    return ok;
  }
  if (step === "contact") {
    let ok = true;
    chapterState.first = v("first");
    chapterState.last = v("last");
    chapterState.email = v("email");
    chapterState.phone = v("phone");
    if (!chapterState.first) ok = wizFail("first", "Enter your first name.");
    if (!chapterState.last) ok = wizFail("last", "Enter your last name.");
    if (!WIZ_EMAIL_RE.test(chapterState.email))
      ok = wizFail(
        "email",
        chapterState.email
          ? "That email address isn't valid."
          : "Enter your email.",
      );
    if (chapterState.phone.replace(/\D/g, "").length < 7)
      ok = wizFail(
        "phone",
        chapterState.phone
          ? "Add a full phone number."
          : "Enter a phone number.",
      );
    return ok;
  }
  if (step === "message") {
    chapterState.message = v("message").slice(0, 1000);
    return true;
  }
  return true;
}

function validateClass(step) {
  wizClearErrors();
  const v = (id) => (document.getElementById(id)?.value || "").trim();

  if (step === "student") {
    let ok = true;
    classState.studentFirst = v("studentFirst");
    classState.studentLast = v("studentLast");
    classState.studentEmail = v("studentEmail");
    classState.studentPhone = v("studentPhone");
    if (!classState.studentFirst)
      ok = wizFail("studentFirst", "Enter the student's first name.");
    if (!classState.studentLast)
      ok = wizFail("studentLast", "Enter the student's last name.");
    if (classState.studentEmail && !WIZ_EMAIL_RE.test(classState.studentEmail))
      ok = wizFail("studentEmail", "That email address isn't valid.");
    return ok;
  }
  if (step === "guardian") {
    let ok = true;
    classState.guardianFirst = v("guardianFirst");
    classState.guardianLast = v("guardianLast");
    classState.guardianEmail = v("guardianEmail");
    classState.guardianPhone = v("guardianPhone");
    if (!classState.guardianFirst)
      ok = wizFail("guardianFirst", "Enter the guardian's first name.");
    if (!classState.guardianLast)
      ok = wizFail("guardianLast", "Enter the guardian's last name.");
    if (!WIZ_EMAIL_RE.test(classState.guardianEmail))
      ok = wizFail(
        "guardianEmail",
        classState.guardianEmail
          ? "That email address isn't valid."
          : "Enter the guardian's email.",
      );
    if (classState.guardianPhone.replace(/\D/g, "").length < 7)
      ok = wizFail(
        "guardianPhone",
        classState.guardianPhone
          ? "Add a full phone number."
          : "Enter the guardian's phone number.",
      );
    return ok;
  }
  if (step === "location") {
    let ok = true;
    classState.country = v("country");
    classState.state_ = v("state_");
    if (!classState.country) ok = wizFail("country", "Enter a country.");
    if (!classState.state_)
      ok = wizFail("state_", "Enter a state or province.");
    return ok;
  }
  if (step === "background") {
    let ok = true;
    classState.heard = v("heard");
    classState.experience = v("experience");
    if (!classState.heard)
      ok = wizFail("heard", "Let us know how you heard about us.");
    if (!classState.experience)
      ok = wizFail("experience", "A sentence or two is plenty.");
    return ok;
  }
  if (step === "schedule")
    return classState.schedule
      ? wizAlertPickClear()
      : wizAlertPick("Pick a day, or choose Other to tell us a time.");
  if (step === "other") {
    classState.other = v("other");
    return classState.other
      ? true
      : wizFail("other", "Tell us the time zone, day, and time you'd like.");
  }
  return true;
}

/* ---------- submit ---------- */
async function submitWizard() {
  if (wizSubmission) return;
  const button = document.getElementById("wizNext");
  if (!button) return;
  const session = wizSession;
  const mode = wizMode;
  const controller = new AbortController();
  wizSubmission = controller;
  button.disabled = true;
  button.textContent = "Sending…";
  document.getElementById("wizBack")?.setAttribute("disabled", "");
  document.getElementById("wizContent").setAttribute("aria-busy", "true");
  wizAlertPickClear();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const schedule =
      classState.schedule === "other"
        ? "Other: " + classState.other
        : (() => {
            const slot = WIZ_SCHEDULE.find(
              (slot) => slot[0] === classState.schedule,
            );
            return slot ? slot[1] + " " + slot[2] : "";
          })();
    const payload =
      mode === "chapter"
        ? {
            ...chapterState,
            topics: chapterState.topics.join(", "),
            source: "devfintech-chapter-request",
            submittedAt: new Date().toISOString(),
          }
        : {
            ...classState,
            schedule,
            source: "devfintech-class-registration",
            submittedAt: new Date().toISOString(),
          };
    const response = await fetch(
      mode === "chapter" ? WIZ_ENDPOINT_CHAPTER : WIZ_ENDPOINT_CLASS,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    const body = await response.text();
    if (/^\s*</.test(body)) throw new Error("Unexpected HTML response");
    if (body.trim()) {
      let result;
      try {
        result = JSON.parse(body);
      } catch {
        if (!/^(ok|success)$/i.test(body.trim()))
          throw new Error("Unrecognized response");
      }
      if (
        result &&
        (result.ok === false ||
          result.success === false ||
          result.error ||
          /^(error|failed|failure)$/i.test(
            result.status || result.result || "",
          ))
      )
        throw new Error("Application rejected request");
    }
    if (session !== wizSession) return;
    wizDone = true;
    renderWizard();
  } catch (error) {
    if (session !== wizSession) return;
    button.disabled = false;
    button.textContent =
      mode === "chapter" ? "Send request" : "Send registration";
    document.getElementById("wizBack")?.removeAttribute("disabled");
    wizAlertPick(
      "We couldn’t confirm your submission. Your answers are still here. Try again, or email thedevfintech@gmail.com if you’re unsure whether it arrived.",
    );
  } finally {
    clearTimeout(timeout);
    if (wizSubmission === controller) wizSubmission = null;
    if (session === wizSession)
      document.getElementById("wizContent").removeAttribute("aria-busy");
  }
}

/* ---------- render + wiring ---------- */
function wizWireOpts(content, stateObj) {
  content.querySelectorAll(".wiz-opt[data-key]").forEach((b) => {
    b.addEventListener("click", () => {
      const key = b.dataset.key,
        val = b.dataset.val;
      if (b.dataset.multi) {
        const list = stateObj[key];
        const at = list.indexOf(val);
        if (at > -1) list.splice(at, 1);
        else list.push(val);
        b.setAttribute("aria-pressed", list.includes(val));
        const c = document.getElementById("wizCount");
        if (c) c.textContent = `${list.length} selected`;
      } else {
        stateObj[key] = val;
        content
          .querySelectorAll(`.wiz-opt[data-key="${key}"]`)
          .forEach((o) => o.setAttribute("aria-pressed", o === b));
      }
      wizAlertPickClear();
    });
  });
}

function renderWizard() {
  wizAlertPickClear();
  const content = document.getElementById("wizContent");
  if (!content) return;

  if (wizDone) {
    content.innerHTML =
      wizMode === "chapter" ? chapterScreens.done() : classScreens.done();
    prepareWizardScreen();
    return;
  }

  if (wizMode === null) {
    content.innerHTML = entryScreen();
    prepareWizardScreen();
    document.getElementById("wizPickClass").addEventListener("click", () => {
      wizMode = "class";
      wizIdx = 0;
      renderWizard();
    });
    document.getElementById("wizPickChapter").addEventListener("click", () => {
      wizMode = "chapter";
      wizIdx = 0;
      renderWizard();
    });
    return;
  }

  const list = currentSteps();
  const step = list[wizIdx];
  const screensObj = wizMode === "chapter" ? chapterScreens : classScreens;
  const stateObj = wizMode === "chapter" ? chapterState : classState;

  content.innerHTML = wizMeter() + screensObj[step]();
  wizPlaceDot();
  wizWireOpts(content, stateObj);

  document.getElementById("wizNext")?.addEventListener("click", () => {
    if (step === "review") return submitWizard();
    const ok =
      wizMode === "chapter" ? validateChapter(step) : validateClass(step);
    if (!ok) {
      content.querySelector("[aria-invalid='true']")?.focus();
      return;
    }
    wizIdx++;
    renderWizard();
  });
  document.getElementById("wizBack")?.addEventListener("click", () => {
    saveWizardFields();
    if (wizIdx === 0) {
      wizMode = null;
      wizIdx = 0;
      renderWizard();
      return;
    }
    wizIdx = Math.max(0, wizIdx - 1);
    renderWizard();
  });

  prepareWizardScreen();
}

/* ---------- dialog accessibility and navigation ---------- */
function saveWizardFields() {
  const state = wizMode === "chapter" ? chapterState : classState;
  document
    .querySelectorAll(
      "#wizContent input, #wizContent select, #wizContent textarea",
    )
    .forEach((field) => {
      if (Object.hasOwn(state, field.id)) state[field.id] = field.value;
    });
}
function prepareWizardScreen() {
  const content = document.getElementById("wizContent");
  const title = content.querySelector("h1,h2");
  if (title) {
    title.id = "wiz-title";
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  document.querySelector(".wiz-shell").scrollTop = 0;
  content.querySelectorAll(".wiz-field").forEach((wrapper) => {
    const field = wrapper.querySelector("input,select,textarea");
    if (!field) return;
    field.setAttribute("aria-describedby", "we-" + field.id);
    if (!wrapper.querySelector(".wiz-opt-tag"))
      field.setAttribute("aria-required", "true");
    if (field.tagName === "TEXTAREA") field.maxLength = 1000;
    else if (field.tagName === "INPUT") field.maxLength = 254;
    field.addEventListener("input", saveWizardFields);
    field.addEventListener("change", saveWizardFields);
  });
}
function openWizard(mode) {
  const opener = document.activeElement;
  wizReturnFocus =
    mobileMedia.matches && navigation.contains(opener) ? menuButton : opener;
  setMenu(false);
  document.getElementById("wizContent").removeAttribute("aria-busy");
  wizSession++;
  wizMode = mode === "chapter" || mode === "class" ? mode : null;
  wizIdx = 0;
  wizDone = false;
  document.getElementById("wizOverlay").hidden = false;
  document.body.classList.add("wiz-open");
  document
    .querySelectorAll("header,main,footer")
    .forEach((element) => (element.inert = true));
  renderWizard();
}
function closeWizard() {
  saveWizardFields();
  wizSession++;
  wizSubmission?.abort();
  wizSubmission = null;
  document.getElementById("wizOverlay").hidden = true;
  document.body.classList.remove("wiz-open");
  document
    .querySelectorAll("header,main,footer")
    .forEach((element) => (element.inert = false));
  if (wizReturnFocus?.isConnected) wizReturnFocus.focus();
}
document.getElementById("wizClose").addEventListener("click", closeWizard);
document.getElementById("wizOverlay").addEventListener("click", (event) => {
  if (event.target.id === "wizOverlay") closeWizard();
});
document.addEventListener("keydown", (event) => {
  const overlay = document.getElementById("wizOverlay");
  if (overlay.hidden) {
    if (
      event.key === "Escape" &&
      document.querySelector(".menu-btn").getAttribute("aria-expanded") ===
        "true"
    ) {
      setMenu(false);
      document.querySelector(".menu-btn").focus();
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeWizard();
    return;
  }
  if (event.key === "Tab") {
    const focusable = [
      ...overlay.querySelectorAll(
        'button:not([disabled]),a[href],input,select,textarea,[tabindex="0"]',
      ),
    ].filter((element) => !element.hidden && element.getClientRects().length);
    const first = focusable[0],
      last = focusable.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement.id === "wiz-title")
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  if (event.key === "Enter" && event.target.tagName === "INPUT") {
    event.preventDefault();
    document.getElementById("wizNext")?.click();
  }
});
const menuButton = document.querySelector(".menu-btn");
const navigation = document.getElementById("primary-nav");
function setMenu(open) {
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  menuButton.querySelector("span").textContent = open ? "−" : "+";
  navigation.classList.toggle("is-open", open);
}
menuButton.addEventListener("click", () =>
  setMenu(menuButton.getAttribute("aria-expanded") !== "true"),
);
navigation.addEventListener("click", (event) => {
  if (event.target.closest("a,button")) setMenu(false);
});
document.addEventListener("click", (event) => {
  const join = event.target.closest("[data-join]");
  if (join) {
    openWizard(join.dataset.join);
    return;
  }
  if (!event.target.closest("header")) setMenu(false);
});
const mobileMedia = matchMedia("(max-width:960px)");
mobileMedia.addEventListener("change", () => setMenu(false));

/* ---------- actual course browsing, with shareable source links ---------- */
function filterCourses(track) {
  const courses = [...document.querySelectorAll(".catalog-course")];
  courses.forEach(
    (course) =>
      (course.hidden = track !== "all" && course.dataset.track !== track),
  );
  document
    .querySelectorAll("[data-filter]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.filter === track),
      ),
    );
  const count = courses.filter((course) => !course.hidden).length;
  document.querySelector(".catalog-count").textContent =
    track === "all" ? "Showing all 9 courses" : "Showing " + count + " courses";
}
document
  .querySelectorAll("[data-filter]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      filterCourses(button.dataset.filter),
    ),
  );
document.querySelectorAll("[data-track-link]").forEach((link) =>
  link.addEventListener("click", () => {
    document.getElementById("course-catalog").open = true;
    filterCourses(link.dataset.trackLink);
  }),
);
function followSourceRoute() {
  const routes = {
    "/home": "home",
    "/curriculum": "curriculum",
    "/chapters": "chapters",
    "/about": "about",
    "/get-involved": "get-involved",
  };
  const [route, anchor] = location.hash.slice(1).split(":");
  if (route === "/class") {
    openWizard("class");
    return;
  }
  if (route === "/start-a-chapter") {
    openWizard("chapter");
    return;
  }
  if (route === "course-catalog")
    document.getElementById("course-catalog").open = true;
  if (routes[route]) {
    if (route === "/curriculum" && anchor) {
      document.getElementById("course-catalog").open = true;
      filterCourses(
        anchor === "behavioral"
          ? "behavioral"
          : anchor === "fintech"
            ? "coding"
            : "finance",
      );
    }
    document
      .getElementById(routes[route])
      ?.scrollIntoView({ behavior: "instant" });
  }
}
window.addEventListener("hashchange", followSourceRoute);
followSourceRoute();
if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navigation.querySelectorAll('a[href^="#"]').forEach((link) => {
          if (link.hash === "#" + entry.target.id)
            link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        });
      }),
    { rootMargin: "-15% 0px -65% 0px" },
  );
  document
    .querySelectorAll("main>section[id]")
    .forEach((section) => observer.observe(section));
}
