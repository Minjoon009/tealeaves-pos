/* ============================================================
   CASHIER MANAGEMENT PAGE
   Reads/writes userData in localStorage.
   Filters cashiers by role === "cashier".
   ============================================================ */

/* ------------------------------------------------------------
   1. STORAGE
   ------------------------------------------------------------ */
const USER_KEY = "userData";
const ORDER_KEY = "orderData";
const REQUEST_KEY = "stockRequests";

function loadUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse userData:", e);
    return [];
  }
}

function loadOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadRequests() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REQUEST_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveUsers(allUsers) {
  localStorage.setItem(USER_KEY, JSON.stringify(allUsers));
  console.log("💾 userData saved:", allUsers);
}

/** Return only cashiers from userData */
function getCashiers() {
  return loadUsers().filter(
    (u) => String(u.role || "").toLowerCase() === "cashier",
  );
}

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

const money = (v) => Number(v || 0).toLocaleString("en-US") + " MMK";

/** Use username as the unique key */
const getCashierKey = (c) => String(c?.username ?? "");

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

const formatDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return (
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    ", " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
};

function relativeTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

function calcOrderTotal(order) {
  const subtotal = (order.products || []).reduce(
    (sum, p) => sum + (Number(p.qty) || 0) * (Number(p.price) || 0),
    0,
  );
  const discount = Number(order.discount) || 0;
  const taxRate = Number(order.taxRate) || 0;
  const tax = Math.round((subtotal - discount) * taxRate);
  return subtotal - discount + tax;
}

/** Does this order belong to this cashier? */
function orderBelongsToCashier(order, cashier) {
  const orderCashier = String(order.cashier || "").toLowerCase();
  const username = String(cashier.username || "").toLowerCase();
  const email = String(cashier.email || "").toLowerCase();

  if (!orderCashier) return false;
  if (username && orderCashier === username) return true;
  if (email && orderCashier === email) return true;
  if (username && orderCashier.includes(username)) return true;
  return false;
}

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let cashiers = []; // filtered from userData
let currentPage = 1;
let pageSize = 10;
let searchQuery = "";
let statusFilter = "";
let editingCashierKey = null;
let resettingCashierKey = null;
let historyCashierKey = null;

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const tableBody = document.getElementById("cashierTableBody");
const summaryEl = document.getElementById("cashierSummary");
const searchInput = document.getElementById("cashierSearch");
const statusFilterEl = document.getElementById("filterStatus");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const paginationInfo = document.getElementById("paginationInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");

const cashierModal = document.getElementById("cashierModal");
const cashierForm = document.getElementById("cashierForm");
const modalTitle = document.getElementById("modalTitle");
const passwordLabel = document.getElementById("passwordLabel");
const passwordHint = document.getElementById("passwordHint");

const resetModal = document.getElementById("resetModal");
const resetForm = document.getElementById("resetForm");

const confirmModal = document.getElementById("confirmModal");

const historyModal = document.getElementById("historyModal");

/* ------------------------------------------------------------
   5. NOTIFICATIONS + SIDEBAR BADGE
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
   6. FILTERING & PAGINATION
   ------------------------------------------------------------ */
function getFilteredCashiers() {
  return cashiers
    .filter((c) => {
      const status = c.status || "Active";
      if (statusFilter && status !== statusFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = [c.username, c.email]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase());
        if (!fields.some((f) => f.includes(q))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const sa = a.status || "Active";
      const sb = b.status || "Active";
      if (sa !== sb) return sa === "Active" ? -1 : 1;
      return String(a.username || "").localeCompare(String(b.username || ""));
    });
}

function buildPageList(current, total) {
  const pages = [];
  const add = (n) => pages.push(n);
  if (total <= 7) {
    for (let i = 1; i <= total; i++) add(i);
    return pages;
  }
  add(1);
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) add("…");
  for (let i = start; i <= end; i++) add(i);
  if (end < total - 1) add("…");
  add(total);
  return pages;
}

/* ------------------------------------------------------------
   7. RENDER — SUMMARY
   ------------------------------------------------------------ */
function renderSummary() {
  const total = cashiers.length;
  const active = cashiers.filter(
    (c) => (c.status || "Active") === "Active",
  ).length;
  const inactive = total - active;

  const todayCount = cashiers.filter((c) => {
    if (!c.lastLogin) return false;
    const diff = Date.now() - new Date(c.lastLogin).getTime();
    return diff < 24 * 60 * 60 * 1000;
  }).length;

  const cards = [
    {
      label: "Total Cashiers",
      value: String(total),
      sub: "accounts in userData",
      cls: "primary",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    },
    {
      label: "Active",
      value: String(active),
      sub: "accounts enabled",
      cls: "success",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    },
    {
      label: "Inactive",
      value: String(inactive),
      sub: "accounts disabled",
      cls: "warning",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
    },
    {
      label: "Logged In (24h)",
      value: String(todayCount),
      sub: "recent activity",
      cls: "info",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    },
  ];

  summaryEl.innerHTML = cards
    .map(
      (c) => `
        <article class="summaryCard">
          <div class="summaryCardHead">
            <div class="summaryCardIcon ${c.cls}">${c.icon}</div>
          </div>
          <div class="summaryCardLabel">${c.label}</div>
          <div class="summaryCardValue">${c.value}</div>
          <div class="summaryCardSub">${esc(c.sub)}</div>
        </article>
      `,
    )
    .join("");
}

/* ------------------------------------------------------------
   8. RENDER — TABLE
   ------------------------------------------------------------ */
function renderTable() {
  cashiers = getCashiers();

  renderNotifications();
  renderSummary();

  const filtered = getFilteredCashiers();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  const pageItems = filtered.slice(start, end);

  tableBody.innerHTML = "";

  if (!totalItems) {
    tableBody.innerHTML = `<tr><td colspan="7" class="emptyState">No cashiers found matching your filters.</td></tr>`;
    renderPagination(0, 1, 0, 0);
    return;
  }

  pageItems.forEach((c) => {
    const key = getCashierKey(c);
    const initials = initialsOf(c.username);
    const isActive = (c.status || "Active") === "Active";

    const statusBadgeHtml = isActive
      ? `<span class="badge badgeSuccess"><span class="dot"></span>Active</span>`
      : `<span class="badge badgeNeutral"><span class="dot"></span>Inactive</span>`;

    const createdHtml = formatDate(c.createdAt);
    const lastLoginHtml = c.lastLogin
      ? relativeTime(c.lastLogin)
      : `<span style="color:var(--color-text-muted);font-style:italic;">Never</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="cashierCell">
          <span class="cashierAvatar ${isActive ? "" : "inactive"}">${esc(initials)}</span>
          <div class="cashierNameText">
            <strong>${esc(c.username)}</strong>
            <span>${esc(c.role)}</span>
          </div>
        </div>
      </td>
      <td class="usernameCell">${esc(c.username)}</td>
      <td class="emailCell" title="${esc(c.email || "")}">${
        c.email
          ? esc(c.email)
          : `<span style="color:var(--color-text-muted)">—</span>`
      }</td>
      <td>${statusBadgeHtml}</td>
      <td class="dateCell">${createdHtml || "—"}</td>
      <td class="dateCell">${lastLoginHtml}</td>
      <td>
        <div class="actionsCell">
          <button class="actionBtn editBtn" type="button" data-key="${esc(key)}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="actionBtn warn resetBtn" type="button" data-key="${esc(key)}" title="Reset Password">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
          <button class="actionBtn historyBtn" type="button" data-key="${esc(key)}" title="Transaction History">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </button>
          <button class="actionBtn ${isActive ? "danger" : ""} toggleStatusBtn" type="button" data-key="${esc(key)}" title="${
            isActive ? "Deactivate" : "Activate"
          }">
            ${
              isActive
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
            }
          </button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  renderPagination(totalItems, totalPages, start, end);
}

function renderPagination(totalItems, totalPages, start, end) {
  if (!totalItems) {
    paginationInfo.textContent = "Showing 0 of 0";
  } else {
    paginationInfo.innerHTML = `Showing <strong>${start + 1}–${end}</strong> of <strong>${totalItems}</strong>`;
  }

  prevPageBtn.disabled = currentPage <= 1 || !totalItems;
  nextPageBtn.disabled = currentPage >= totalPages || !totalItems;

  if (totalPages <= 1) {
    pageNumbersEl.innerHTML = "";
    return;
  }

  const pageList = buildPageList(currentPage, totalPages);
  pageNumbersEl.innerHTML = pageList
    .map((p) => {
      if (p === "…") return `<span class="pageEllipsis">…</span>`;
      return `<button class="pageNumberBtn${
        p === currentPage ? " active" : ""
      }" type="button" data-page="${p}">${p}</button>`;
    })
    .join("");
}

/* ------------------------------------------------------------
   9. ADD / EDIT CASHIER MODAL
   ------------------------------------------------------------ */
function openCashierModal(cashier = null) {
  editingCashierKey = cashier ? getCashierKey(cashier) : null;
  modalTitle.textContent = cashier ? "Edit Cashier" : "Add Cashier";

  cashierForm.reset();
  document
    .querySelectorAll("#cashierForm .errorText")
    .forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll("#cashierForm .field")
    .forEach((el) => el.classList.remove("invalid"));

  if (cashier) {
    // Editing
    document.getElementById("cashierKey").value = getCashierKey(cashier);
    document.getElementById("cashierUsername").value = cashier.username || "";
    document.getElementById("cashierEmail").value = cashier.email || "";
    document.getElementById("cashierPassword").value = "";
    document.getElementById("cashierStatus").value = cashier.status || "Active";

    // Password becomes optional
    passwordLabel.innerHTML = `New Password <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--color-text-muted);">(leave blank to keep current)</span>`;
    document.getElementById("cashierPassword").required = false;
    passwordHint.textContent =
      "Leave empty to keep the current password unchanged.";
  } else {
    // Creating
    document.getElementById("cashierKey").value = "";
    document.getElementById("cashierStatus").value = "Active";

    passwordLabel.innerHTML = `Password <span class="requiredMark">*</span>`;
    document.getElementById("cashierPassword").required = true;
    passwordHint.textContent =
      "Passwords are stored locally for demo purposes. In production they must be hashed on the server.";
  }

  cashierModal.classList.add("open");
  cashierModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => document.getElementById("cashierUsername").focus(), 60);
}

function closeCashierModal() {
  cashierModal.classList.remove("open");
  cashierModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  editingCashierKey = null;
}

/* ---------- validate ---------- */
function validateCashierForm() {
  let isValid = true;

  const username = document.getElementById("cashierUsername");
  const email = document.getElementById("cashierEmail");
  const password = document.getElementById("cashierPassword");

  [username, email, password].forEach((el) => {
    el.classList.remove("invalid");
    const err = document.getElementById(`error-${el.id}`);
    if (err) err.textContent = "";
  });

  // Username required
  if (!username.value.trim()) {
    username.classList.add("invalid");
    document.getElementById("error-cashierUsername").textContent =
      "Username is required.";
    isValid = false;
  } else {
    // Duplicate check
    const allUsers = loadUsers();
    const exists = allUsers.some(
      (u) =>
        String(u.username || "").toLowerCase() ===
          username.value.trim().toLowerCase() &&
        String(u.username || "") !== String(editingCashierKey || ""),
    );
    if (exists) {
      username.classList.add("invalid");
      document.getElementById("error-cashierUsername").textContent =
        "This username is already in use.";
      isValid = false;
    }
  }

  // Email format (optional, but validate if present)
  if (
    email.value.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())
  ) {
    email.classList.add("invalid");
    document.getElementById("error-cashierEmail").textContent =
      "Enter a valid email address.";
    isValid = false;
  }

  // Password — required only when creating
  if (!editingCashierKey) {
    if (!password.value || password.value.length < 6) {
      password.classList.add("invalid");
      document.getElementById("error-cashierPassword").textContent =
        "Password must be at least 6 characters.";
      isValid = false;
    }
  } else {
    // Optional on edit — but if provided, must be valid
    if (password.value && password.value.length < 6) {
      password.classList.add("invalid");
      document.getElementById("error-cashierPassword").textContent =
        "Password must be at least 6 characters.";
      isValid = false;
    }
  }

  return isValid;
}

/* ---------- submit ---------- */
cashierForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateCashierForm()) return;

  const allUsers = loadUsers();
  const username = document.getElementById("cashierUsername").value.trim();
  const email = document.getElementById("cashierEmail").value.trim();
  const password = document.getElementById("cashierPassword").value;
  const status = document.getElementById("cashierStatus").value;

  if (editingCashierKey) {
    // Update existing cashier
    const idx = allUsers.findIndex(
      (u) =>
        String(u.role || "").toLowerCase() === "cashier" &&
        String(u.username || "") === String(editingCashierKey),
    );
    if (idx !== -1) {
      allUsers[idx] = {
        ...allUsers[idx],
        username,
        email,
        status,
      };
      if (password) allUsers[idx].password = password;
    }
  } else {
    // Create new cashier
    allUsers.push({
      username,
      email,
      password,
      role: "cashier",
      status,
      createdAt: new Date().toISOString(),
    });
  }

  saveUsers(allUsers);
  closeCashierModal();
  renderTable();
});

/* ------------------------------------------------------------
   10. RESET PASSWORD MODAL
   ------------------------------------------------------------ */
function openResetModal(cashier) {
  resettingCashierKey = getCashierKey(cashier);
  document.getElementById("resetCashierName").textContent = cashier.username;
  document.getElementById("resetNewPassword").value = "";
  document.getElementById("error-resetNewPassword").textContent = "";
  document.getElementById("resetNewPassword").classList.remove("invalid");

  resetModal.classList.add("open");
  resetModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => document.getElementById("resetNewPassword").focus(), 60);
}

function closeResetModal() {
  resetModal.classList.remove("open");
  resetModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  resettingCashierKey = null;
}

resetForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("resetNewPassword");
  const pwd = input.value;

  input.classList.remove("invalid");
  document.getElementById("error-resetNewPassword").textContent = "";

  if (!pwd || pwd.length < 6) {
    input.classList.add("invalid");
    document.getElementById("error-resetNewPassword").textContent =
      "Password must be at least 6 characters.";
    return;
  }

  const allUsers = loadUsers();
  const idx = allUsers.findIndex(
    (u) =>
      String(u.role || "").toLowerCase() === "cashier" &&
      String(u.username || "") === String(resettingCashierKey),
  );

  if (idx !== -1) {
    allUsers[idx].password = pwd;
    saveUsers(allUsers);
  }

  closeResetModal();
  renderTable();
});

/* ------------------------------------------------------------
   11. CONFIRM MODAL (for status toggle)
   ------------------------------------------------------------ */
function openConfirmModal(title, text, onConfirm, danger = true) {
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmText").innerHTML = text;

  const btn = document.getElementById("confirmActionBtn");
  btn.className = "btn " + (danger ? "btnDanger" : "btnPrimary");
  btn.onclick = () => {
    onConfirm();
    closeConfirmModal();
  };

  confirmModal.classList.add("open");
  confirmModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeConfirmModal() {
  confirmModal.classList.remove("open");
  confirmModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* ------------------------------------------------------------
   12. TRANSACTION HISTORY MODAL
   ------------------------------------------------------------ */
function openHistoryModal(cashier) {
  historyCashierKey = getCashierKey(cashier);

  document.getElementById("historySubId").textContent = cashier.username;

  const orders = loadOrders();
  const cashierOrders = orders
    .filter((o) => orderBelongsToCashier(o, cashier))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalRevenue = cashierOrders.reduce(
    (sum, o) => sum + calcOrderTotal(o),
    0,
  );
  const avg = cashierOrders.length
    ? Math.round(totalRevenue / cashierOrders.length)
    : 0;

  document.getElementById("historySummary").innerHTML = `
    <div class="historyStat">
      <span class="historyStatLabel">Orders</span>
      <span class="historyStatValue">${cashierOrders.length}</span>
    </div>
    <div class="historyStat">
      <span class="historyStatLabel">Revenue</span>
      <span class="historyStatValue">${money(totalRevenue)}</span>
    </div>
    <div class="historyStat">
      <span class="historyStatLabel">Avg. Order</span>
      <span class="historyStatValue">${money(avg)}</span>
    </div>
  `;

  const tbody = document.getElementById("historyTableBody");

  if (!cashierOrders.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="historyEmpty">No transactions found for this cashier.</td></tr>`;
  } else {
    tbody.innerHTML = cashierOrders
      .slice(0, 100)
      .map((o) => {
        const items = (o.products || []).reduce(
          (s, p) => s + (Number(p.qty) || 0),
          0,
        );
        return `
          <tr>
            <td><span class="historyOrderId">${esc(o.id)}</span></td>
            <td>${formatDateTime(o.date)}</td>
            <td>${items}</td>
            <td>${money(calcOrderTotal(o))}</td>
            <td>${esc(o.payment || "Cash")}</td>
          </tr>
        `;
      })
      .join("");
  }

  historyModal.classList.add("open");
  historyModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  historyModal.classList.remove("open");
  historyModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  historyCashierKey = null;
}

/* ------------------------------------------------------------
   13. EVENT LISTENERS
   ------------------------------------------------------------ */

// Sidebar toggle
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

// Dropdowns
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

// Notification click
document.addEventListener("click", (e) => {
  const notif = e.target.closest(".notifItem");
  if (!notif) return;
  closeAllDropdowns();
  window.location.href = "./cashierRequests.html";
});

// Filters
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  currentPage = 1;
  renderTable();
});

statusFilterEl.addEventListener("change", () => {
  statusFilter = statusFilterEl.value;
  currentPage = 1;
  renderTable();
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  statusFilterEl.value = "";
  searchQuery = "";
  statusFilter = "";
  currentPage = 1;
  renderTable();
});

// Pagination
pageSizeSelect.addEventListener("change", () => {
  pageSize = parseInt(pageSizeSelect.value, 10) || 10;
  currentPage = 1;
  renderTable();
});

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(getFilteredCashiers().length / pageSize);
  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
  }
});

pageNumbersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".pageNumberBtn");
  if (!btn) return;
  currentPage = parseInt(btn.dataset.page, 10);
  renderTable();
});

// Table actions (event delegation)
tableBody.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".editBtn");
  if (editBtn) {
    const c = cashiers.find((x) => getCashierKey(x) === editBtn.dataset.key);
    if (c) openCashierModal(c);
    return;
  }

  const resetBtn = e.target.closest(".resetBtn");
  if (resetBtn) {
    const c = cashiers.find((x) => getCashierKey(x) === resetBtn.dataset.key);
    if (c) openResetModal(c);
    return;
  }

  const historyBtn = e.target.closest(".historyBtn");
  if (historyBtn) {
    const c = cashiers.find((x) => getCashierKey(x) === historyBtn.dataset.key);
    if (c) openHistoryModal(c);
    return;
  }

  const toggleBtn = e.target.closest(".toggleStatusBtn");
  if (toggleBtn) {
    const c = cashiers.find((x) => getCashierKey(x) === toggleBtn.dataset.key);
    if (!c) return;
    const current = c.status || "Active";
    const next = current === "Active" ? "Inactive" : "Active";

    openConfirmModal(
      next === "Inactive" ? "Deactivate Cashier" : "Activate Cashier",
      next === "Inactive"
        ? `Are you sure you want to deactivate <strong>${esc(c.username)}</strong>? They will no longer be able to sign in.`
        : `Reactivate <strong>${esc(c.username)}</strong>'s account?`,
      () => {
        const allUsers = loadUsers();
        const idx = allUsers.findIndex(
          (u) =>
            String(u.role || "").toLowerCase() === "cashier" &&
            String(u.username || "") === String(c.username),
        );
        if (idx !== -1) {
          allUsers[idx].status = next;
          saveUsers(allUsers);
          renderTable();
        }
      },
      next === "Inactive",
    );
    return;
  }
});

// Add cashier
document
  .getElementById("addCashierBtn")
  .addEventListener("click", () => openCashierModal(null));

// Modal close buttons
document
  .getElementById("modalCloseBtn")
  .addEventListener("click", closeCashierModal);
document
  .getElementById("cancelBtn")
  .addEventListener("click", closeCashierModal);
document
  .getElementById("resetCloseBtn")
  .addEventListener("click", closeResetModal);
document
  .getElementById("resetCancelBtn")
  .addEventListener("click", closeResetModal);
document
  .getElementById("confirmCloseBtn")
  .addEventListener("click", closeConfirmModal);
document
  .getElementById("confirmCancelBtn")
  .addEventListener("click", closeConfirmModal);
document
  .getElementById("historyCloseBtn")
  .addEventListener("click", closeHistoryModal);
document
  .getElementById("historyDoneBtn")
  .addEventListener("click", closeHistoryModal);

// Password visibility toggles
document.getElementById("passwordToggle").addEventListener("click", () => {
  const input = document.getElementById("cashierPassword");
  input.type = input.type === "password" ? "text" : "password";
});

document.getElementById("resetPasswordToggle").addEventListener("click", () => {
  const input = document.getElementById("resetNewPassword");
  input.type = input.type === "password" ? "text" : "password";
});

// Backdrop close
[cashierModal, resetModal, confirmModal, historyModal].forEach((m) => {
  m.addEventListener("click", (e) => {
    if (e.target === m) {
      if (m === cashierModal) closeCashierModal();
      else if (m === resetModal) closeResetModal();
      else if (m === confirmModal) closeConfirmModal();
      else if (m === historyModal) closeHistoryModal();
    }
  });
});

// Esc closes any open modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (cashierModal.classList.contains("open")) closeCashierModal();
    if (resetModal.classList.contains("open")) closeResetModal();
    if (confirmModal.classList.contains("open")) closeConfirmModal();
    if (historyModal.classList.contains("open")) closeHistoryModal();
  }
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
   14. INIT
   ------------------------------------------------------------ */
function init() {
  renderTable();
  renderUserProfile();
}

init();
