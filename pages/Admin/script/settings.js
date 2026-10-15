/* ============================================================
   SETTINGS PAGE
   Saves to storeSettings and updates userData for the logged-in admin.
   ============================================================ */

/* ------------------------------------------------------------
   1. STORAGE
   ------------------------------------------------------------ */
const SETTINGS_KEY = "storeSettings";
const USER_KEY = "userData";
const CURRENT_USER_KEY = "currentUser";
const REQUEST_KEY = "stockRequests";

const DEFAULT_SETTINGS = {
  store: {
    name: "Tea Leaves",
    logo: "",
    address: "No. 17-29, Bagayar Road, Sanchaung Township",
    phone: "09-775 330 034, 779 829 159, 973 465 852",
    email: "",
    receiptFooter: "Thank you for visiting! Please come again.",
  },
  business: {
    currency: "MMK",
    timezone: "Asia/Yangon",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "12h",
    minStockDefault: 10,
    taxRate: 7,
    printAutoCut: false,
    printShowLogo: true,
    printShowTax: true,
    printShowCashier: true,
  },
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const parsed = JSON.parse(raw);
    return {
      store: { ...DEFAULT_SETTINGS.store, ...(parsed.store || {}) },
      business: { ...DEFAULT_SETTINGS.business, ...(parsed.business || {}) },
    };
  } catch (e) {
    console.warn("Could not parse storeSettings:", e);
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  settings = next;
  console.log("💾 storeSettings saved:", next);
}

function loadUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveUsers(allUsers) {
  localStorage.setItem(USER_KEY, JSON.stringify(allUsers));
  console.log("💾 userData saved:", allUsers);
}

function loadCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_USER_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCurrentUser(user) {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

function loadRequests() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REQUEST_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

let settings = loadSettings();

/* ------------------------------------------------------------
   2. HELPERS
   ------------------------------------------------------------ */
const esc = (str) =>
  String(str == null ? "" : str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );

const initialsOf = (name) => {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);
};

/* ------------------------------------------------------------
   3. NOTIFICATIONS + SIDEBAR BADGE
   ------------------------------------------------------------ */
function renderNotifications() {
  const requests = loadRequests();
  const pending = requests.filter((r) => r.status === "pending");

  const notifBadge = document.getElementById("notifBadge");
  if (notifBadge) notifBadge.textContent = pending.length;

  const notifHeaderCount = document.getElementById("notifHeaderCount");
  if (notifHeaderCount) notifHeaderCount.textContent = `${pending.length} new`;

  const navBadge = document.getElementById("navRequestsBadge");
  if (navBadge) navBadge.textContent = pending.length;

  const notifList = document.getElementById("notifList");
  if (!notifList) return;

  if (!pending.length) {
    notifList.innerHTML = `
      <li class="emptyState" style="padding: 24px 20px;">
        <div class="emptyIcon">🎉</div>
        <p>All caught up</p>
        <span>No pending requests right now.</span>
      </li>
    `;
    return;
  }

  notifList.innerHTML = pending
    .slice(0, 6)
    .map((r) => {
      const isStock = r.type === "add-stock";
      const kind = isStock ? "info" : "success";
      const icon = isStock ? "📦" : "✨";
      return `
        <li class="notifItem" data-notif-id="${esc(r.id)}">
          <span class="notifIcon ${kind}">${icon}</span>
          <div class="notifBody">
            <div class="notifTitle">${esc(r.id)} — ${esc(r.productName)}</div>
            <div class="notifDesc">${esc(r.cashier || "Cashier")} requested ${Number(r.quantity || 0)}</div>
            <div class="notifTime">Needs review</div>
          </div>
        </li>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   4. TOAST
   ------------------------------------------------------------ */
let toastTimer = null;
function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const toastIcon = document.getElementById("toastIcon");

  toastText.textContent = message;
  toastIcon.textContent = isError ? "!" : "✓";
  toast.classList.toggle("error", isError);
  toast.hidden = false;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

/* ------------------------------------------------------------
   5. STORE INFO
   ------------------------------------------------------------ */
function fillStoreForm() {
  document.getElementById("storeName").value = settings.store.name || "";
  document.getElementById("storeAddress").value = settings.store.address || "";
  document.getElementById("storePhone").value = settings.store.phone || "";
  document.getElementById("storeEmail").value = settings.store.email || "";
  document.getElementById("receiptFooter").value =
    settings.store.receiptFooter || "";

  updateLogoPreview(settings.store.logo);
}

function updateLogoPreview(dataUrl) {
  const preview = document.getElementById("logoPreview");
  if (dataUrl) {
    preview.innerHTML = `<img src="${dataUrl}" alt="Store logo" />`;
  } else {
    preview.textContent = initialsOf(settings.store.name || "TL");
  }
}

function clearStoreErrors() {
  ["storeName", "storeAddress", "storePhone", "storeEmail"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.remove("invalid");
    const err = document.getElementById(`error-${id}`);
    if (err) err.textContent = "";
  });
}

document.getElementById("storeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  clearStoreErrors();

  const name = document.getElementById("storeName").value.trim();
  const address = document.getElementById("storeAddress").value.trim();
  const phone = document.getElementById("storePhone").value.trim();
  const email = document.getElementById("storeEmail").value.trim();

  let ok = true;

  if (!name) {
    document.getElementById("storeName").classList.add("invalid");
    document.getElementById("error-storeName").textContent =
      "Store name is required.";
    ok = false;
  }
  if (!address) {
    document.getElementById("storeAddress").classList.add("invalid");
    document.getElementById("error-storeAddress").textContent =
      "Address is required.";
    ok = false;
  }
  if (!phone) {
    document.getElementById("storePhone").classList.add("invalid");
    document.getElementById("error-storePhone").textContent =
      "Phone number is required.";
    ok = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("storeEmail").classList.add("invalid");
    document.getElementById("error-storeEmail").textContent =
      "Enter a valid email address.";
    ok = false;
  }

  if (!ok) return;

  const next = { ...settings };
  next.store = {
    ...settings.store,
    name,
    address,
    phone,
    email,
    receiptFooter: document.getElementById("receiptFooter").value.trim(),
  };

  saveSettings(next);
  showToast("Store information saved");

  // Update brand name in the sidebar
  const brandNameEl = document.querySelector(".brandName");
  if (brandNameEl) brandNameEl.textContent = name;

  updateLogoPreview(next.store.logo);
});

document.getElementById("resetStoreBtn").addEventListener("click", () => {
  fillStoreForm();
  clearStoreErrors();
  showToast("Changes discarded");
});

/* ---------- logo upload ---------- */
document.getElementById("uploadLogoBtn").addEventListener("click", () => {
  document.getElementById("logoInput").click();
});

document.getElementById("logoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 500 * 1024) {
    showToast("Logo must be smaller than 500 KB", true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const next = { ...settings };
    next.store = { ...settings.store, logo: dataUrl };
    saveSettings(next);
    updateLogoPreview(dataUrl);
    showToast("Logo uploaded");
  };
  reader.readAsDataURL(file);
});

document.getElementById("removeLogoBtn").addEventListener("click", () => {
  const next = { ...settings };
  next.store = { ...settings.store, logo: "" };
  saveSettings(next);
  updateLogoPreview("");
  showToast("Logo removed");
});

/* ------------------------------------------------------------
   6. BUSINESS PREFERENCES
   ------------------------------------------------------------ */
function fillBusinessForm() {
  document.getElementById("currency").value = settings.business.currency;
  document.getElementById("timezone").value = settings.business.timezone;
  document.getElementById("dateFormat").value = settings.business.dateFormat;
  document.getElementById("timeFormat").value = settings.business.timeFormat;
  document.getElementById("minStockDefault").value =
    settings.business.minStockDefault ?? 10;
  document.getElementById("taxRate").value = settings.business.taxRate ?? 7;

  document.getElementById("printAutoCut").checked =
    !!settings.business.printAutoCut;
  document.getElementById("printShowLogo").checked =
    !!settings.business.printShowLogo;
  document.getElementById("printShowTax").checked =
    !!settings.business.printShowTax;
  document.getElementById("printShowCashier").checked =
    !!settings.business.printShowCashier;
}

document.getElementById("businessForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const minStockRaw = document.getElementById("minStockDefault").value;
  const taxRaw = document.getElementById("taxRate").value;

  const minStock = minStockRaw === "" ? 10 : Number(minStockRaw);
  const tax = taxRaw === "" ? 0 : Number(taxRaw);

  if (Number.isNaN(minStock) || minStock < 0) {
    showToast("Minimum stock must be a positive number", true);
    return;
  }
  if (Number.isNaN(tax) || tax < 0 || tax > 100) {
    showToast("Tax rate must be between 0 and 100", true);
    return;
  }

  const next = { ...settings };
  next.business = {
    currency: document.getElementById("currency").value,
    timezone: document.getElementById("timezone").value,
    dateFormat: document.getElementById("dateFormat").value,
    timeFormat: document.getElementById("timeFormat").value,
    minStockDefault: minStock,
    taxRate: tax,
    printAutoCut: document.getElementById("printAutoCut").checked,
    printShowLogo: document.getElementById("printShowLogo").checked,
    printShowTax: document.getElementById("printShowTax").checked,
    printShowCashier: document.getElementById("printShowCashier").checked,
  };

  saveSettings(next);
  showToast("Preferences saved");
});

document.getElementById("resetBusinessBtn").addEventListener("click", () => {
  fillBusinessForm();
  showToast("Changes discarded");
});

/* ------------------------------------------------------------
   7. ACCOUNT — PROFILE
   ------------------------------------------------------------ */
function fillProfileForm() {
  const user = loadCurrentUser();
  const username = user.username || "Admin User";
  const email = user.email || "";

  document.getElementById("accountUsername").value = username;
  document.getElementById("accountEmail").value = email;

  const initials = initialsOf(username);
  document.getElementById("profileAvatarLarge").textContent = initials;
  document.getElementById("profileHeaderName").textContent = username;
  document.getElementById("profileHeaderEmail").textContent = email || "—";

  // Sync the topbar profile and dropdown
  document.querySelectorAll(".avatar").forEach((el) => {
    el.textContent = initials;
  });
  document.querySelectorAll(".profileName").forEach((el) => {
    if (el.closest(".profileMenuHead")) return; // keep the email line
    el.textContent = username;
  });
  const menuEmail = document.querySelector(".profileMenuHead .profileRole");
  if (menuEmail) menuEmail.textContent = email || "—";
}

document.getElementById("profileForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const username = document.getElementById("accountUsername").value.trim();
  const email = document.getElementById("accountEmail").value.trim();

  ["accountUsername", "accountEmail"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.remove("invalid");
    const err = document.getElementById(`error-${id}`);
    if (err) err.textContent = "";
  });

  let ok = true;

  if (!username) {
    document.getElementById("accountUsername").classList.add("invalid");
    document.getElementById("error-accountUsername").textContent =
      "Username is required.";
    ok = false;
  }
  if (!email) {
    document.getElementById("accountEmail").classList.add("invalid");
    document.getElementById("error-accountEmail").textContent =
      "Email is required.";
    ok = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById("accountEmail").classList.add("invalid");
    document.getElementById("error-accountEmail").textContent =
      "Enter a valid email address.";
    ok = false;
  }

  if (!ok) return;

  const current = loadCurrentUser();
  const originalUsername = current.username;

  // Check for username collision in userData (skip the current admin's entry)
  const allUsers = loadUsers();
  const collision = allUsers.some(
    (u) =>
      String(u.username || "").toLowerCase() === username.toLowerCase() &&
      String(u.username || "") !== String(originalUsername || ""),
  );
  if (collision) {
    document.getElementById("accountUsername").classList.add("invalid");
    document.getElementById("error-accountUsername").textContent =
      "This username is already in use.";
    return;
  }

  // Update userData
  const idx = allUsers.findIndex(
    (u) => String(u.username || "") === String(originalUsername || ""),
  );
  if (idx !== -1) {
    allUsers[idx] = { ...allUsers[idx], username, email };
    saveUsers(allUsers);
  }

  // Update currentUser
  const nextCurrent = { ...current, username, email };
  saveCurrentUser(nextCurrent);

  // Refresh UI
  fillProfileForm();
  showToast("Profile updated");
});

document.getElementById("resetProfileBtn").addEventListener("click", () => {
  fillProfileForm();
  showToast("Changes discarded");
});

/* ------------------------------------------------------------
   8. ACCOUNT — PASSWORD
   ------------------------------------------------------------ */
function getStrength(pwd) {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 1) return "weak";
  if (score === 2) return "fair";
  if (score === 3) return "good";
  return "strong";
}

document.getElementById("newPassword").addEventListener("input", (e) => {
  const pwd = e.target.value;
  const wrap = document.getElementById("passwordStrength");
  const label = document.getElementById("strengthLabel");

  if (!pwd) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  const level = getStrength(pwd);
  wrap.className = "passwordStrength " + level;

  const labels = { weak: "Weak", fair: "Fair", good: "Good", strong: "Strong" };
  label.textContent = labels[level];
});

document.querySelectorAll("[data-toggle-for]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetId = btn.dataset.toggleFor;
    const input = document.getElementById(targetId);
    input.type = input.type === "password" ? "text" : "password";
  });
});

document.getElementById("passwordForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const currentPwd = document.getElementById("currentPassword").value;
  const newPwd = document.getElementById("newPassword").value;
  const confirmPwd = document.getElementById("confirmPassword").value;

  ["currentPassword", "newPassword", "confirmPassword"].forEach((id) => {
    const el = document.getElementById(id);
    el.classList.remove("invalid");
    const err = document.getElementById(`error-${id}`);
    if (err) err.textContent = "";
  });

  const user = loadCurrentUser();
  let ok = true;

  if (!currentPwd) {
    document.getElementById("currentPassword").classList.add("invalid");
    document.getElementById("error-currentPassword").textContent =
      "Enter your current password.";
    ok = false;
  } else if (String(user.password || "") !== currentPwd) {
    document.getElementById("currentPassword").classList.add("invalid");
    document.getElementById("error-currentPassword").textContent =
      "Current password is incorrect.";
    ok = false;
  }

  if (!newPwd || newPwd.length < 8) {
    document.getElementById("newPassword").classList.add("invalid");
    document.getElementById("error-newPassword").textContent =
      "New password must be at least 8 characters.";
    ok = false;
  }

  if (newPwd !== confirmPwd) {
    document.getElementById("confirmPassword").classList.add("invalid");
    document.getElementById("error-confirmPassword").textContent =
      "Passwords do not match.";
    ok = false;
  }

  if (!ok) return;

  // Update userData
  const allUsers = loadUsers();
  const idx = allUsers.findIndex(
    (u) => String(u.username || "") === String(user.username || ""),
  );
  if (idx !== -1) {
    allUsers[idx].password = newPwd;
    saveUsers(allUsers);
  }

  // Update currentUser
  saveCurrentUser({ ...user, password: newPwd });

  // Reset form
  document.getElementById("passwordForm").reset();
  document.getElementById("passwordStrength").hidden = true;

  showToast("Password updated");
});

/* ------------------------------------------------------------
   9. TABS
   ------------------------------------------------------------ */
const settingsTabs = document.getElementById("settingsTabs");

settingsTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".settingsTab");
  if (!tab) return;

  settingsTabs
    .querySelectorAll(".settingsTab")
    .forEach((t) => t.classList.toggle("active", t === tab));

  const target = tab.dataset.tab;
  ["store", "business", "account"].forEach((name) => {
    document.getElementById(`panel-${name}`).hidden = name !== target;
  });
});

/* ------------------------------------------------------------
   10. SHARED UI (sidebar, dropdowns, notifications)
   ------------------------------------------------------------ */
document.getElementById("sidebarToggle").addEventListener("click", () => {
  document.body.classList.toggle("sidebarOpen");
});

document.addEventListener("click", (e) => {
  if (
    document.body.classList.contains("sidebarOpen") &&
    !e.target.closest(".sidebar") &&
    !e.target.closest("#sidebarToggle")
  ) {
    document.body.classList.remove("sidebarOpen");
  }
});

function closeAllDropdowns() {
  document
    .querySelectorAll(".dropdown.open")
    .forEach((d) => d.classList.remove("open"));
}

document.querySelectorAll("[data-dropdown-toggle]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const parent = btn.closest(".dropdown");
    const wasOpen = parent.classList.contains("open");
    closeAllDropdowns();
    if (!wasOpen) parent.classList.add("open");
  });
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".dropdown")) closeAllDropdowns();
});

document.addEventListener("click", (e) => {
  const notif = e.target.closest(".notifItem");
  if (!notif) return;
  closeAllDropdowns();
  window.location.href = "./cashierRequests.html";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllDropdowns();
});
function renderUserProfile() {
  const user = JSON.parse(localStorage.getItem("currentUser"));
  const initials = user.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  document.querySelectorAll(".avatar").forEach((el) => {
    el.textContent = initials;
  });

  document.querySelectorAll(".profileName").forEach((el) => {
    el.textContent = user.username;
  });

  document.querySelectorAll(".profileRole").forEach((el) => {
    // Use email for the dropdown, and "Administrator" for the top bar
    if (el.closest(".profileMenuHead")) {
      el.textContent = user.email;
    } else {
      el.textContent = "Administrator";
    }
  });
}
const btnLogout = document.getElementById("logoutBtn");
try {
  btnLogout.addEventListener("click", () => {
    localStorage.removeItem("currentUser");
    window.location.href = "/";
  });
} catch (error) {
  console.log("Logout button no found.");
}
/* ------------------------------------------------------------
   11. INIT
   ------------------------------------------------------------ */
function init() {
  renderUserProfile();
  renderNotifications();

  // Sync brand name in the sidebar with the stored setting
  const brandNameEl = document.querySelector(".brandName");
  if (brandNameEl)
    brandNameEl.textContent = settings.store.name || "Tea Leaves";

  fillStoreForm();
  fillBusinessForm();
  fillProfileForm();

  // If URL hash is #password, jump straight to the Account tab
  if (location.hash === "#password") {
    settingsTabs.querySelector('[data-tab="account"]').click();
    setTimeout(() => {
      const pwd = document.getElementById("password");
      if (pwd) pwd.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
}

init();
