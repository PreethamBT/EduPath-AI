
"use strict";

/* ==========================================
   EDUPATH AI - COMPLETE JAVASCRIPT
========================================== */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const KEYS = {
  users: "edupath-demo-users",
  admin: "edupath-demo-admin",
  session: "edupath-demo-session",
  progress: "edupath-progress",
  activity: "edupath-demo-activity",
  clicks: "edupath-demo-resource-clicks"
};

const ADMIN_ALLOWED_EMAILS = ["preethambt@gmail.com"];

/* ---------- STORAGE ---------- */

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getUsers() {
  const value = readJSON(KEYS.users, []);
  return Array.isArray(value) ? value : [];
}

function getAdmin() {
  return readJSON(KEYS.admin, null);
}

function getSession() {
  return readJSON(KEYS.session, null);
}

function getProgress() {
  return readJSON(KEYS.progress, {});
}

function getActivity() {
  const value = readJSON(KEYS.activity, []);
  return Array.isArray(value) ? value : [];
}

function getResourceClicks() {
  return readJSON(KEYS.clicks, {});
}

function setMessage(message) {
  const element = $("#authMessage");
  if (element) element.textContent = message;
}

function recordActivity(action, email = "") {
  const activity = getActivity();

  activity.unshift({
    action,
    email: normalizeEmail(email),
    time: new Date().toISOString()
  });

  writeJSON(KEYS.activity, activity.slice(0, 300));
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

/* ---------- PASSWORD HASHING ---------- */

async function hashPassword(password) {
  if (!window.crypto?.subtle) {
    throw new Error(
      "Please run the website using VS Code Live Server."
    );
  }

  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/* ---------- AUTH FORMS ---------- */

const AUTH_FORMS = {
  login: "#loginForm",
  register: "#registerForm",
  admin: "#adminLoginForm",
  setup: "#adminSetupForm"
};

function showAuthForm(name) {
  const selected = AUTH_FORMS[name];
  if (!selected) return;

  Object.values(AUTH_FORMS).forEach(selector => {
    const form = $(selector);

    if (form) {
      form.hidden = true;
      form.style.display = "none";
    }
  });

  const activeForm = $(selected);

  if (activeForm) {
    activeForm.hidden = false;
    activeForm.style.display = "block";
  }

  const panel = $("#accountPanel");

  if (panel) {
    panel.hidden = true;
    panel.style.display = "none";
  }

  $$("[data-auth]").forEach(button => {
    const active = button.dataset.auth === name;

    button.classList.toggle("active", active);
    button.classList.toggle("secondary", !active);
    button.setAttribute("aria-pressed", String(active));
  });

  setMessage("");
}

function updateNavigation() {
  const session = getSession();

  $$("[data-admin-link]").forEach(link => {
    link.hidden = session?.role !== "admin";
  });

  $$("[data-login-link]").forEach(link => {
    link.textContent = session ? "My Account" : "Login / Register";
  });
}

function showAccount() {
  const session = getSession();
  const panel = $("#accountPanel");

  if (!session || !panel) return false;

  if (session.role === "admin") {
    const admin = getAdmin();

    if (
      !admin?.email ||
      !admin?.passwordHash ||
      normalizeEmail(admin.email) !== normalizeEmail(session.email)
    ) {
      localStorage.removeItem(KEYS.session);
      return false;
    }
  } else if (session.role === "student") {
    const user = getUsers().find(
      item => normalizeEmail(item.email) === normalizeEmail(session.email)
    );

    if (!user) {
      localStorage.removeItem(KEYS.session);
      return false;
    }
  } else {
    localStorage.removeItem(KEYS.session);
    return false;
  }

  Object.values(AUTH_FORMS).forEach(selector => {
    const form = $(selector);

    if (form) {
      form.hidden = true;
      form.style.display = "none";
    }
  });

  panel.hidden = false;
  panel.style.display = "block";

  const welcome = $("#welcomeMessage");
  const details = $("#accountDetails");
  const stats = $("#adminStats");

  if (welcome) {
    welcome.textContent = session.role === "admin"
      ? "Welcome, Admin!"
      : `Welcome, ${getUsers().find(
          user => normalizeEmail(user.email) === normalizeEmail(session.email)
        )?.name || "Student"}!`;
  }

  if (details) {
    details.textContent = `${session.role === "admin" ? "Admin" : "Student"} account: ${session.email}`;
  }

  if (stats) {
    stats.hidden = session.role !== "admin";

    if (session.role === "admin") {
      stats.textContent = `Registered students: ${getUsers().length}`;
    }
  }

  return true;
}

/* ==========================================
   STUDENT REGISTRATION
========================================== */

async function handleStudentRegistration(event) {
  event.preventDefault();

  const name = $("#registerName")?.value.trim() || "";
  const email = normalizeEmail($("#registerEmail")?.value);
  const password = $("#registerPassword")?.value || "";

  if (!name || !email || password.length < 8) {
    setMessage("Enter your name, valid email, and a password of at least 8 characters.");
    return;
  }

  const users = getUsers();

  if (users.some(user => normalizeEmail(user.email) === email)) {
    setMessage("This student account already exists. Please log in.");
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    users.push({
      name,
      email,
      passwordHash,
      createdAt: new Date().toISOString()
    });

    writeJSON(KEYS.users, users);
    recordActivity("Student registered", email);

    $("#registerForm").reset();
    $("#loginEmail").value = email;

    showAuthForm("login");
    setMessage("Registration successful! Please log in.");
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Registration failed.");
  }
}

/* ==========================================
   STUDENT LOGIN
========================================== */

async function handleStudentLogin(event) {
  event.preventDefault();

  const email = normalizeEmail($("#loginEmail")?.value);
  const password = $("#loginPassword")?.value || "";

  const user = getUsers().find(
    item => normalizeEmail(item.email) === email
  );

  if (!user) {
    setMessage("Student account not found. Please register first.");
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    if (passwordHash !== user.passwordHash) {
      setMessage("Incorrect student email or password.");
      return;
    }

    writeJSON(KEYS.session, {
      role: "student",
      email,
      loginTime: new Date().toISOString()
    });

    recordActivity("Student logged in", email);
    $("#loginForm").reset();

    if ($("#accountPanel")) {
      showAccount();
      setMessage("Student login successful!");
    } else {
      window.location.href = "index.html#account";
    }

    updateNavigation();
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Login failed.");
  }
}

/* ==========================================
   ADMIN SETUP
========================================== */

async function handleAdminSetup(event) {
  event.preventDefault();

  const email = normalizeEmail($("#setupEmail")?.value);
  const password = $("#setupPassword")?.value || "";

  if (!ADMIN_ALLOWED_EMAILS.includes(email)) {
    setMessage("This email is not authorized for admin setup.");
    return;
  }

  if (password.length < 8) {
    setMessage("Admin password must contain at least 8 characters.");
    return;
  }

  const existingAdmin = getAdmin();

  if (existingAdmin?.email && existingAdmin?.passwordHash) {
    setMessage("Admin is already registered. Please use Admin Login.");
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    writeJSON(KEYS.admin, {
      email,
      passwordHash,
      createdAt: new Date().toISOString()
    });

    recordActivity("Admin setup completed", email);

    $("#adminSetupForm").reset();
    $("#adminEmail").value = email;

    showAuthForm("admin");
    setMessage("Admin setup completed! Please log in.");
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Admin setup failed.");
  }
}

/* ==========================================
   ADMIN LOGIN
========================================== */

async function handleAdminLogin(event) {
  event.preventDefault();

  const email = normalizeEmail($("#adminEmail")?.value);
  const password = $("#adminPassword")?.value || "";
  const admin = getAdmin();

  if (!admin?.email || !admin?.passwordHash) {
    setMessage("Admin setup is not completed. Please use Admin Setup first.");
    return;
  }

  if (normalizeEmail(admin.email) !== email) {
    setMessage("Incorrect admin email or password.");
    return;
  }

  try {
    const passwordHash = await hashPassword(password);

    if (passwordHash !== admin.passwordHash) {
      setMessage("Incorrect admin email or password.");
      return;
    }

    writeJSON(KEYS.session, {
      role: "admin",
      email,
      loginTime: new Date().toISOString()
    });

    recordActivity("Admin logged in", email);
    window.location.href = "admin.html";
  } catch (error) {
    console.error(error);
    setMessage(error.message || "Admin login failed.");
  }
}

/* ==========================================
   FIXED LOGOUT
========================================== */

function logout() {
  const session = getSession();

  if (session) {
    recordActivity("Logged out", session.email);
  }

  // Remove only the login session. Keep accounts and progress.
  localStorage.removeItem(KEYS.session);

  // If on another page, return to the homepage.
  const currentPage = window.location.pathname.split("/").pop();

  if (
    currentPage &&
    currentPage !== "index.html" &&
    currentPage !== ""
  ) {
    window.location.replace("index.html#account");
    return;
  }

  // On homepage, hide the account panel.
  const panel = $("#accountPanel");

  if (panel) {
    panel.hidden = true;
    panel.style.display = "none";
  }

  // Show Student Login again.
  showAuthForm("login");

  const loginForm = $("#loginForm");
  if (loginForm) loginForm.reset();

  setMessage("Logged out successfully!");
  updateNavigation();
}

/* ==========================================
   ROADMAP DATA
========================================== */

const plans = {
  web: {
    title: "Web Development",
    milestones: [
      {
        id: "web-html",
        title: "HTML and CSS Basics",
        description: "Learn page structure, styling, and responsive design.",
        resourceId: "web-html"
      },
      {
        id: "web-javascript",
        title: "JavaScript Fundamentals",
        description: "Learn variables, functions, arrays, and DOM.",
        resourceId: "web-javascript"
      },
      {
        id: "web-git",
        title: "Git and GitHub",
        description: "Learn version control.",
        resourceId: "web-git"
      },
      {
        id: "web-project",
        title: "Build a Website",
        description: "Build and publish a website project.",
        resourceId: "web-project"
      }
    ]
  },

  ai: {
    title: "AI and Machine Learning",
    milestones: [
      {
        id: "ai-python",
        title: "Python Fundamentals",
        description: "Learn Python basics.",
        resourceId: "ai-python"
      },
      {
        id: "ai-math",
        title: "Math for AI",
        description: "Study statistics, probability, and linear algebra.",
        resourceId: "ai-math"
      },
      {
        id: "ai-ml",
        title: "Machine Learning Basics",
        description: "Understand training and evaluating models.",
        resourceId: "ai-ml"
      },
      {
        id: "ai-project",
        title: "Build an AI Project",
        description: "Apply your skills in a practical project.",
        resourceId: "ai-project"
      }
    ]
  },

  software: {
    title: "Software Development",
    milestones: [
      {
        id: "software-programming",
        title: "Programming Fundamentals",
        description: "Learn programming and problem-solving.",
        resourceId: "software-programming"
      },
      {
        id: "software-dsa",
        title: "Data Structures and Algorithms",
        description: "Practice data structures and algorithms.",
        resourceId: "software-dsa"
      },
      {
        id: "software-git",
        title: "Git and GitHub",
        description: "Learn version control and collaboration.",
        resourceId: "software-git"
      },
      {
        id: "software-project",
        title: "Build a Software Project",
        description: "Build and test a working application.",
        resourceId: "software-project"
      }
    ]
  },

  data: {
    title: "Data Analytics",
    milestones: [
      {
        id: "data-spreadsheets",
        title: "Spreadsheet Fundamentals",
        description: "Learn data organization and charts.",
        resourceId: "data-spreadsheets"
      },
      {
        id: "data-sql",
        title: "SQL Fundamentals",
        description: "Learn database queries.",
        resourceId: "data-sql"
      },
      {
        id: "data-python",
        title: "Python for Data",
        description: "Learn data analysis with Python.",
        resourceId: "data-python"
      },
      {
        id: "data-dashboard",
        title: "Create a Dashboard",
        description: "Build a data visualization dashboard.",
        resourceId: "data-dashboard"
      }
    ]
  }
};

/* ==========================================
   ROADMAP GENERATION
========================================== */

function isMilestoneComplete(email, milestoneId) {
  if (!email) return false;

  const progress = getProgress();
  const completed = progress[normalizeEmail(email)]?.completed || [];

  return Array.isArray(completed) && completed.includes(milestoneId);
}

function renderRoadmap() {
  const form = $("#roadmapForm");
  const output = $("#roadmapResult");

  if (!form || !output) return;

  form.addEventListener("submit", event => {
    event.preventDefault();

    const career = $("#career")?.value || "web";
    const level = $("#level")?.value || "beginner";
    const hours = Number($("#hours")?.value || 5);
    const plan = plans[career] || plans.web;
    const session = getSession();

    if (session?.role === "student") {
      const progress = getProgress();
      const email = normalizeEmail(session.email);

      progress[email] = progress[email] || {};
      progress[email].goal = plan.title;
      progress[email].level = level;
      progress[email].hours = hours;

      writeJSON(KEYS.progress, progress);
    }

    output.hidden = false;

    output.innerHTML = `
      <h2>${escapeHTML(plan.title)} Roadmap</h2>
      <p>Level: ${escapeHTML(level)} · ${hours} hours per week</p>

      <div class="roadmap-milestones">
        ${plan.milestones.map((item, index) => `
          <article class="card">
            <span class="step-number">${index + 1}</span>
            <h3>${escapeHTML(item.title)}</h3>
            <p>${escapeHTML(item.description)}</p>
            <p>${isMilestoneComplete(session?.email, item.id)
              ? "Completed"
              : "Not completed"}</p>
            <a class="btn" href="resources.html#${encodeURIComponent(item.resourceId)}">
              Open Resource →
            </a>
          </article>
        `).join("")}
      </div>
    `;

    output.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/* ==========================================
   PROGRESS TRACKING
========================================== */

function setMilestoneComplete(email, milestoneId, completed) {
  const normalized = normalizeEmail(email);
  const progress = getProgress();

  progress[normalized] = progress[normalized] || {};
  const student = progress[normalized];

  student.completed = Array.isArray(student.completed)
    ? student.completed
    : [];

  if (completed && !student.completed.includes(milestoneId)) {
    student.completed.push(milestoneId);
  }

  if (!completed) {
    student.completed = student.completed.filter(id => id !== milestoneId);
  }

  student.updatedAt = new Date().toISOString();

  writeJSON(KEYS.progress, progress);
  recordActivity(
    `${completed ? "Completed" : "Reopened"} milestone: ${milestoneId}`,
    normalized
  );
}

function renderProgress() {
  const dashboard = $("#dashboard");
  if (!dashboard) return;

  const session = getSession();

  if (session?.role !== "student") {
    dashboard.innerHTML = `
      <div class="card">
        <h2>Student login required</h2>
        <p>Log in to view your learning progress.</p>
        <a class="btn" href="index.html#account">Student Login →</a>
      </div>
    `;
    return;
  }

  const email = normalizeEmail(session.email);
  const progress = getProgress();
  const student = progress[email] || {};
  const milestones = Object.values(plans).flatMap(plan => plan.milestones);
  const completed = Array.isArray(student.completed) ? student.completed : [];
  const percent = Math.round(completed.length / milestones.length * 100);

  if ($("#completedCount")) $("#completedCount").textContent = completed.length;
  if ($("#percent")) $("#percent").textContent = `${percent}%`;
  if ($("#dashboardBar")) $("#dashboardBar").style.width = `${percent}%`;
  if ($("#lastGoal")) $("#lastGoal").textContent = student.goal || "No goal selected";

  dashboard.innerHTML = `
    <div class="card">
      <h2>Your Learning Progress</h2>
      <p>Goal: ${escapeHTML(student.goal || "Choose a roadmap")}</p>
      <p>${completed.length} of ${milestones.length} milestones completed</p>

      <div class="progress-track">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>

      <p>${percent}% complete</p>

      ${milestones.map(item => `
        <label class="progress-item">
          <input
            type="checkbox"
            data-milestone="${escapeHTML(item.id)}"
            ${completed.includes(item.id) ? "checked" : ""}
          >
          ${escapeHTML(item.title)}
        </label>
        <p><a href="resources.html#${encodeURIComponent(item.resourceId)}">Open Resource →</a></p>
      `).join("")}
    </div>
  `;

  $$("[data-milestone]", dashboard).forEach(input => {
    input.addEventListener("change", () => {
      setMilestoneComplete(email, input.dataset.milestone, input.checked);
      renderProgress();
    });
  });
}

/* ==========================================
   RESOURCE SEARCH AND CLICK COUNTS
========================================== */

function renderResources() {
  const search = $("#resourceSearch");
  const cards = $$(".resource-card");
  const count = $("#resourceCount");
  const empty = $("#noResources");

  function filter() {
    const query = (search?.value || "").trim().toLowerCase();
    let visible = 0;

    cards.forEach(card => {
      const matches = card.textContent.toLowerCase().includes(query);
      card.hidden = !matches;
      if (matches) visible++;
    });

    if (count) count.textContent = `${visible} resources found`;
    if (empty) empty.hidden = visible !== 0;
  }

  search?.addEventListener("input", filter);
  filter();

  cards.forEach(card => {
    $$("a", card).forEach(link => {
      link.addEventListener("click", () => {
        const clicks = getResourceClicks();

        clicks[card.id] = (Number(clicks[card.id]) || 0) + 1;
        writeJSON(KEYS.clicks, clicks);

        recordActivity(`Opened resource: ${card.id}`, getSession()?.email || "");
      });
    });
  });
}

/* ==========================================
   ADMIN DASHBOARD
========================================== */

function renderAdminDashboard() {
  const dashboard = $("#adminDashboard");
  if (!dashboard) return;

  const session = getSession();
  const admin = getAdmin();

  const authorized =
    session?.role === "admin" &&
    admin?.email &&
    admin?.passwordHash &&
    normalizeEmail(session.email) === normalizeEmail(admin.email);

  if (!authorized) {
    dashboard.innerHTML = `
      <div class="card">
        <h2>Admin access required</h2>
        <p>Please log in with your authorized admin account.</p>
        <a class="btn" href="index.html#account">Admin Login →</a>
      </div>
    `;
    return;
  }

  const users = getUsers();
  const progress = getProgress();
  const clicks = getResourceClicks();
  const activity = getActivity();

  const completedTotal = Object.values(progress).reduce(
    (total, item) => total + (
      Array.isArray(item.completed) ? item.completed.length : 0
    ),
    0
  );

  const totalClicks = Object.values(clicks).reduce(
    (total, value) => total + (Number(value) || 0),
    0
  );

  dashboard.innerHTML = `
    <div class="admin-stats grid">
      <article class="card">
        <h3>Registered Students</h3>
        <p class="admin-number">${users.length}</p>
      </article>
      <article class="card">
        <h3>Admin Accounts</h3>
        <p class="admin-number">${admin?.email ? 1 : 0}</p>
      </article>
      <article class="card">
        <h3>Completed Milestones</h3>
        <p class="admin-number">${completedTotal}</p>
      </article>
      <article class="card">
        <h3>Resource Clicks</h3>
        <p class="admin-number">${totalClicks}</p>
      </article>
    </div>

    <section class="card">
      <h2>Student Directory</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Goal</th>
              <th>Completed</th><th>Registered</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => {
              const email = normalizeEmail(user.email);
              const item = progress[email] || {};

              return `
                <tr>
                  <td>${escapeHTML(user.name)}</td>
                  <td>${escapeHTML(email)}</td>
                  <td>${escapeHTML(item.goal || "Not selected")}</td>
                  <td>${Array.isArray(item.completed) ? item.completed.length : 0}</td>
                  <td>${escapeHTML(formatDate(user.createdAt))}</td>
                </tr>
              `;
            }).join("") || '<tr><td colspan="5">No students registered.</td></tr>'}
          </tbody>
        </table>
      </div>
      <button class="btn" id="exportStudents" type="button">Export Students CSV</button>
    </section>

    <section class="card">
      <h2>Resource Clicks</h2>
      <ul>
        ${Object.entries(clicks).map(([id, value]) =>
          `<li>${escapeHTML(id)}: ${Number(value) || 0} clicks</li>`
        ).join("") || "<li>No clicks recorded.</li>"}
      </ul>
    </section>

    <section class="card">
      <h2>Recent Activity</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Action</th><th>Email</th><th>Time</th></tr></thead>
          <tbody>
            ${activity.slice(0, 50).map(item => `
              <tr>
                <td>${escapeHTML(item.action)}</td>
                <td>${escapeHTML(item.email)}</td>
                <td>${escapeHTML(formatDate(item.time))}</td>
              </tr>
            `).join("") || '<tr><td colspan="3">No activity recorded.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;

  $("#exportStudents")?.addEventListener("click", exportStudentsCSV);
}

/* ---------- CSV EXPORT ---------- */

function exportStudentsCSV() {
  const progress = getProgress();

  const rows = [
    ["Name", "Email", "Goal", "Completed Milestones", "Registered At"]
  ];

  getUsers().forEach(user => {
    const email = normalizeEmail(user.email);
    const item = progress[email] || {};

    rows.push([
      user.name || "",
      email,
      item.goal || "",
      Array.isArray(item.completed) ? item.completed.length : 0,
      user.createdAt || ""
    ]);
  });

  const csv = rows.map(row =>
    row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")
  ).join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = "edupath-students.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/* ==========================================
   MOBILE MENU
========================================== */

function setupMobileMenu() {
  const menu = $("#menu");
  const links = $("#links");

  if (!menu || !links) return;

  menu.addEventListener("click", () => {
    links.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(links.classList.contains("open")));
  });
}

/* ==========================================
   RESET PROGRESS
========================================== */

function setupResetProgress() {
  $("#resetProgress")?.addEventListener("click", () => {
    const session = getSession();

    if (session?.role !== "student") {
      alert("Please log in with your student account.");
      return;
    }

    if (!confirm("Are you sure you want to reset your progress?")) return;

    const progress = getProgress();
    const email = normalizeEmail(session.email);

    progress[email] = {
      goal: "",
      completed: [],
      updatedAt: new Date().toISOString()
    };

    writeJSON(KEYS.progress, progress);
    recordActivity("Student reset progress", email);
    renderProgress();
  });
}

/* ==========================================
   INITIALIZE EVERYTHING
========================================== */

document.addEventListener("DOMContentLoaded", () => {
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  // Auth tab switching
  $$("[data-auth]").forEach(button => {
    button.addEventListener("click", () => showAuthForm(button.dataset.auth));
  });

  // Attach each form handler exactly once
  $("#registerForm")?.addEventListener("submit", handleStudentRegistration);
  $("#loginForm")?.addEventListener("submit", handleStudentLogin);
  $("#adminSetupForm")?.addEventListener("submit", handleAdminSetup);
  $("#adminLoginForm")?.addEventListener("submit", handleAdminLogin);

  // IMPORTANT: Logout event handler
  $("#logoutButton")?.addEventListener("click", logout);

  setupMobileMenu();
  renderRoadmap();
  renderProgress();
  renderResources();
  renderAdminDashboard();
  setupResetProgress();
  updateNavigation();

  // Restore a valid session on homepage
  if ($("#accountPanel") && getSession()) {
    if (!showAccount()) showAuthForm("login");
  } else if ($("#loginForm")) {
    showAuthForm("login");
  }
});
localStorage.removeItem("edupath-demo-admin");
localStorage.removeItem("edupath-demo-session");