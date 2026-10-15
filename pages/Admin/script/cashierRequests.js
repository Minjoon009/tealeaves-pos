/* ============================================================
   CASHIER REQUESTS PAGE
   - 3 statuses only: pending / approved / rejected
   - Approving a request updates productData automatically
   - Every approval writes to stockHistory (audit log)
   ============================================================ */

/* ------------------------------------------------------------
   1. STORAGE
   ------------------------------------------------------------ */
const STORAGE_KEY = "stockRequests";
const PRODUCT_KEY = "productData";
const HISTORY_KEY = "stockHistory";

function loadRequests() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse stockRequests:", e);
    return [];
  }
}

function loadProducts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveRequests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  console.log("💾 stockRequests saved:", requests);
}

function saveProducts() {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
  console.log("💾 productData saved:", products);
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  console.log("💾 stockHistory saved:", history);
}

let requests = loadRequests();
let products = loadProducts();
let history = loadHistory();

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

const money = (v) => Number(v || 0).toLocaleString("en-US") + " Ks";

const formatDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (iso) => {
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
  const d = new Date(iso);
  if (isNaN(d)) return "—";
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

/** Only 3 statuses now */
const STATUS_CONFIG = {
  pending: { label: "Pending", cls: "badgeWarning" },
  approved: { label: "Approved", cls: "badgeSuccess" },
  rejected: { label: "Rejected", cls: "badgeDanger" },
};

function statusBadge(status) {
  const cfg = STATUS_CONFIG[status] || {
    label: status || "—",
    cls: "badgeNeutral",
  };
  return `<span class="badge ${cfg.cls}"><span class="dot"></span>${esc(cfg.label)}</span>`;
}

function getCurrentAdmin() {
  try {
    const u = JSON.parse(localStorage.getItem("currentUser")) || {};
    return u.username || "Admin User";
  } catch {
    return "Admin User";
  }
}

const getProductKey = (p) => String(p?.id ?? p?.sku ?? "");

function getMinStock(p) {
  return Number(p.minStock) || 10;
}

/** Generate a new PROD-### id for a newly created product */
function nextProductId() {
  let max = 0;
  products.forEach((p) => {
    const m = /^PROD-(\d+)$/.exec(String(p.id || ""));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return "PROD-" + String(max + 1).padStart(4, "0");
}

/** Generate the next ADJ-#### id for the audit log */
function nextAdjustmentId() {
  let max = 0;
  history.forEach((h) => {
    const m = /^ADJ-(\d+)$/.exec(String(h.id || ""));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return "ADJ-" + String(max + 1).padStart(4, "0");
}

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let currentPage = 1;
let pageSize = 10;
let searchQuery = "";
let statusFilter = "all";
let typeFilter = "";
let activeRequestId = null;

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const tableBody = document.getElementById("requestsTableBody");
const searchInput = document.getElementById("requestSearch");
const typeFilterEl = document.getElementById("filterType");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const statusTabs = document.getElementById("statusTabs");

const paginationInfo = document.getElementById("paginationInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");

const detailModal = document.getElementById("detailModal");
const detailTitle = document.getElementById("detailTitle");
const detailSubId = document.getElementById("detailSubId");
const detailStatusBadge = document.getElementById("detailStatusBadge");
const detailCashier = document.getElementById("detailCashier");
const detailType = document.getElementById("detailType");
const detailProduct = document.getElementById("detailProduct");
const detailQty = document.getElementById("detailQty");
const detailSku = document.getElementById("detailSku");
const detailSkuWrap = document.getElementById("detailSkuWrap");
const detailCategory = document.getElementById("detailCategory");
const detailCategoryWrap = document.getElementById("detailCategoryWrap");
const detailPrice = document.getElementById("detailPrice");
const detailPriceWrap = document.getElementById("detailPriceWrap");
const detailDate = document.getElementById("detailDate");
const detailReason = document.getElementById("detailReason");
const detailNotes = document.getElementById("detailNotes");
const detailNotesWrap = document.getElementById("detailNotesWrap");
const detailActions = document.getElementById("detailActions");

/* ------------------------------------------------------------
   5. NOTIFICATIONS + SIDEBAR BADGE
   ------------------------------------------------------------ */
function renderNotifications() {
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
            <div class="notifDesc">
              ${esc(r.cashier || "Cashier")} requested ${Number(r.quantity || 0)} unit${
                Number(r.quantity) === 1 ? "" : "s"
              }
            </div>
            <div class="notifTime">${relativeTime(r.createdAt)}</div>
          </div>
        </li>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   6. FILTERING & PAGINATION
   ------------------------------------------------------------ */
function getFilteredRequests() {
  return requests
    .filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = [r.id, r.productName, r.sku, r.cashier, r.reason].map(
          (x) => String(x || "").toLowerCase(),
        );
        if (!fields.some((f) => f.includes(q))) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
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

function updateTabCounts() {
  const counts = {
    all: requests.length,
    pending: 0,
    approved: 0,
    rejected: 0,
  };
  requests.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status]++;
  });

  statusTabs.querySelectorAll(".tabCount").forEach((el) => {
    const key = el.dataset.count;
    el.textContent = counts[key] ?? 0;
  });
}

/* ------------------------------------------------------------
   7. RENDER TABLE
   ------------------------------------------------------------ */
function renderTable() {
  requests = loadRequests();
  products = loadProducts();

  updateTabCounts();
  renderNotifications();

  const filtered = getFilteredRequests();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  const pageItems = filtered.slice(start, end);

  tableBody.innerHTML = "";

  if (!totalItems) {
    tableBody.innerHTML = `<tr><td colspan="8" class="emptyState">No requests found.</td></tr>`;
    renderPagination(0, 1, 0, 0);
    return;
  }

  pageItems.forEach((r) => {
    const isStock = r.type === "add-stock";

    const matchedProduct = products.find(
      (p) =>
        (r.sku &&
          String(p.sku || "").toLowerCase() === String(r.sku).toLowerCase()) ||
        (!r.sku &&
          String(p.name || "").toLowerCase() ===
            String(r.productName).toLowerCase()),
    );

    const thumb = matchedProduct?.image
      ? `<img src="${esc(matchedProduct.image)}" alt="" onerror="this.style.display='none'; this.parentElement.textContent='${isStock ? "📦" : "✨"}'" />`
      : isStock
        ? "📦"
        : "✨";

    const typePill = isStock
      ? `<span class="typePill stock">Add Stock</span>`
      : `<span class="typePill new">New Product</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="reqId">${esc(r.id)}</span></td>
      <td>${esc(r.cashier || "Cashier")}</td>
      <td>${typePill}</td>
      <td>
        <div class="productCell">
          <span class="productThumb">${thumb}</span>
          <div class="productName">
            <strong>${esc(r.productName)}</strong>
            <span>${esc(r.sku || r.category || "")}</span>
          </div>
        </div>
      </td>
      <td class="qtyCell">${Number(r.quantity || 0)}</td>
      <td class="dateCell">${formatDate(r.createdAt)}</td>
      <td>${statusBadge(r.status)}</td>
      <td>
        <button class="viewBtn" type="button" data-id="${esc(r.id)}">View</button>
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
   8. DETAIL MODAL
   ------------------------------------------------------------ */
function openDetail(id) {
  const r = requests.find((x) => String(x.id) === String(id));
  if (!r) {
    console.warn("Request not found:", id);
    return;
  }

  activeRequestId = String(r.id);
  console.log("📂 Opened request:", activeRequestId, "status:", r.status);

  detailTitle.textContent =
    r.type === "add-stock" ? "Stock Request" : "New Product Request";
  detailSubId.textContent = r.id;
  detailStatusBadge.innerHTML = statusBadge(r.status);

  detailCashier.textContent = r.cashier || "Cashier";
  detailType.textContent =
    r.type === "add-stock" ? "Add Stock (existing product)" : "New Product";
  detailProduct.textContent = r.productName || "—";
  detailQty.textContent = String(r.quantity || 0);
  detailDate.textContent = formatDateTime(r.createdAt);
  detailReason.textContent = r.reason ? `“${r.reason}”` : "No reason provided.";

  if (r.sku) {
    detailSkuWrap.hidden = false;
    detailSku.textContent = r.sku;
  } else {
    detailSkuWrap.hidden = true;
  }

  if (r.category) {
    detailCategoryWrap.hidden = false;
    detailCategory.textContent = r.category;
  } else {
    detailCategoryWrap.hidden = true;
  }

  if (r.type === "new-product" && r.price) {
    detailPriceWrap.hidden = false;
    detailPrice.textContent = money(r.price);
  } else {
    detailPriceWrap.hidden = true;
  }

  if (r.adminNotes) {
    detailNotesWrap.hidden = false;
    detailNotes.textContent = r.adminNotes;
  } else {
    detailNotesWrap.hidden = true;
  }

  renderDetailActions(r);

  detailModal.classList.add("open");
  detailModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  detailModal.classList.remove("open");
  detailModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  activeRequestId = null;
}

/* ---------- RENDER ACTION BUTTONS (only 2 actions per status) ---------- */
function renderDetailActions(r) {
  const status = r.status;
  const actions = [];

  if (status === "pending") {
    actions.push({
      key: "approve",
      label: "Approve",
      cls: "btnSuccess",
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    });
    actions.push({
      key: "reject",
      label: "Reject",
      cls: "btnDanger",
      icon: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    });
  }

  // Approved / Rejected are terminal — no actions, just show info
  if (!actions.length) {
    detailActions.innerHTML = `
      <div style="flex:1;font-size:12.5px;color:var(--color-text-muted);text-align:center;padding:6px 0;">
        This request has been <strong>${esc(status)}</strong>${
          r.reviewedBy ? ` by ${esc(r.reviewedBy)}` : ""
        }${r.reviewedAt ? ` on ${esc(formatDateTime(r.reviewedAt))}` : ""}.
        ${r.adminNotes ? `<div style="margin-top:6px;font-style:italic;">“${esc(r.adminNotes)}”</div>` : ""}
      </div>
      <button class="btn btnGhost" data-action="cancel" type="button">Close</button>
    `;
    return;
  }

  detailActions.innerHTML =
    `
      <button class="btn btnGhost" data-action="cancel" type="button">Close</button>
      <div class="spacer"></div>
    ` +
    actions
      .map(
        (a) =>
          `<button class="btn ${a.cls}" data-action="${a.key}" type="button">${a.icon} ${a.label}</button>`,
      )
      .join("");
}

/* ------------------------------------------------------------
   9. REJECT PANEL (reason required)
   ------------------------------------------------------------ */
function showRejectPanel() {
  detailActions.innerHTML = `
    <div class="actionPanel" style="flex:1 1 100%;">
      <div class="actionPanelTitle">Reject this request?</div>
      <label for="actionNote" class="detailLabel" style="display:block;margin-bottom:6px;">
        Reason for rejection <span style="color:var(--color-danger)">*</span>
      </label>
      <textarea class="field" id="actionNote" rows="3" placeholder="e.g. Product discontinued by supplier"></textarea>
      <span class="errorText" id="actionNoteError"></span>
    </div>
    <button class="btn btnGhost" data-action="cancel-reject" type="button">Cancel</button>
    <div class="spacer"></div>
    <button class="btn btnDanger" data-action="confirm-reject" type="button">
      Confirm Reject
    </button>
  `;
  document.getElementById("actionNote")?.focus();
}

/* ------------------------------------------------------------
   10. APPROVAL LOGIC — updates productData + stockHistory
   ------------------------------------------------------------ */

/**
 * Handle a stock request approval:
 *   - add-stock   → find product by SKU, add quantity to its stock
 *   - new-product → create a new product entry with the requested data
 * Every change is also recorded in stockHistory.
 */
function approveAddStock(req) {
  const product = products.find(
    (p) =>
      String(p.sku || "").toLowerCase() === String(req.sku || "").toLowerCase(),
  );

  if (!product) {
    console.warn("Product not found for SKU:", req.sku);
    alert(
      `Cannot approve: no product in inventory matches SKU "${req.sku}".\n` +
        `Please add the product first from the Products page.`,
    );
    return null;
  }

  const idx = products.findIndex(
    (p) => getProductKey(p) === getProductKey(product),
  );
  const previousStock = Number(product.stock || 0);
  const addedQty = Number(req.quantity || 0);
  const newStock = previousStock + addedQty;

  products[idx] = {
    ...product,
    stock: newStock,
    updatedAt: new Date().toISOString(),
  };
  saveProducts();

  // Write audit entry
  history.unshift({
    id: nextAdjustmentId(),
    productKey: getProductKey(product),
    productName: product.name,
    sku: product.sku,
    type: "in",
    quantity: addedQty,
    previousStock: previousStock,
    newStock: newStock,
    reason: `Approved cashier request ${req.id}`,
    notes: req.reason || "",
    admin: getCurrentAdmin(),
    timestamp: new Date().toISOString(),
  });
  saveHistory();

  return { product, previousStock, newStock, addedQty };
}

/**
 * Handle a new-product request approval:
 *   - Creates a new product in productData with the requested details
 */
function approveNewProduct(req) {
  // Guard: SKU uniqueness when auto-generated
  let sku = req.sku;
  if (!sku) {
    // Generate a simple SKU based on category
    const prefix = (req.category || "GEN").substring(0, 3).toUpperCase();
    let counter =
      products.filter((p) => String(p.sku || "").startsWith(prefix + "-"))
        .length + 1;
    sku = `${prefix}-${String(counter).padStart(3, "0")}`;

    // Ensure uniqueness
    while (
      products.some(
        (p) => String(p.sku || "").toUpperCase() === sku.toUpperCase(),
      )
    ) {
      counter++;
      sku = `${prefix}-${String(counter).padStart(3, "0")}`;
    }
  }

  // Guard: name uniqueness
  if (
    products.some(
      (p) =>
        String(p.name || "").toLowerCase() ===
        String(req.productName).toLowerCase(),
    )
  ) {
    alert(
      `Cannot approve: a product named "${req.productName}" already exists in inventory.`,
    );
    return null;
  }

  const newProduct = {
    id: nextProductId(),
    name: req.productName,
    sku: sku,
    category: req.category || "Others",
    price: Number(req.price) || 0,
    stock: Number(req.quantity) || 0,
    minStock: 10,
    status: "Active",
    image: "",
    description: `Created from cashier request ${req.id}`,
    createdAt: new Date().toISOString(),
  };

  products.unshift(newProduct);
  saveProducts();

  // Write audit entry
  history.unshift({
    id: nextAdjustmentId(),
    productKey: getProductKey(newProduct),
    productName: newProduct.name,
    sku: newProduct.sku,
    type: "in",
    quantity: newProduct.stock,
    previousStock: 0,
    newStock: newProduct.stock,
    reason: `New product approved from cashier request ${req.id}`,
    notes: req.reason || "",
    admin: getCurrentAdmin(),
    timestamp: new Date().toISOString(),
  });
  saveHistory();

  return { product: newProduct };
}

/* ------------------------------------------------------------
   11. HANDLE ACTION — approve / reject
   ------------------------------------------------------------ */
function handleAction(actionKey, noteText = "") {
  console.log("🎯 handleAction:", actionKey, "for:", activeRequestId);

  if (!activeRequestId) {
    console.warn("No active request ID");
    return;
  }

  // Reload products + history so we're working with fresh data
  products = loadProducts();
  history = loadHistory();

  const idx = requests.findIndex(
    (x) => String(x.id) === String(activeRequestId),
  );
  if (idx === -1) {
    console.warn("Request not found in memory:", activeRequestId);
    return;
  }

  const r = requests[idx];
  const admin = getCurrentAdmin();
  const now = new Date().toISOString();

  /* ---------- APPROVE ---------- */
  if (actionKey === "approve") {
    let result = null;

    if (r.type === "add-stock") {
      result = approveAddStock(r);
    } else if (r.type === "new-product") {
      result = approveNewProduct(r);
    }

    // If the underlying operation failed, stop here — don't flip the status
    if (result === null) return;

    requests[idx] = {
      ...r,
      status: "approved",
      adminNotes: noteText || r.adminNotes || "",
      reviewedBy: admin,
      reviewedAt: now,
    };

    saveRequests();
    console.log(`   ✓ ${r.id}: ${r.status} → approved`);
    console.log(`   ✓ productData updated`);
  } else if (actionKey === "reject") {
    /* ---------- REJECT ---------- */
    requests[idx] = {
      ...r,
      status: "rejected",
      adminNotes: noteText || r.adminNotes || "",
      reviewedBy: admin,
      reviewedAt: now,
    };
    saveRequests();
    console.log(`   ✓ ${r.id}: ${r.status} → rejected`);
  }

  closeDetail();
  renderTable();
}

/* ------------------------------------------------------------
   12. EVENT LISTENERS
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

// Notification click → open the request
document.addEventListener("click", (e) => {
  const notif = e.target.closest(".notifItem");
  if (!notif) return;
  const id = notif.dataset.notifId;
  if (id) {
    closeAllDropdowns();
    openDetail(id);
  }
});

// Status tabs
statusTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".statusTab");
  if (!tab) return;

  statusFilter = tab.dataset.status;
  currentPage = 1;

  statusTabs
    .querySelectorAll(".statusTab")
    .forEach((t) => t.classList.toggle("active", t === tab));

  renderTable();
});

// Filters
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  currentPage = 1;
  renderTable();
});

typeFilterEl.addEventListener("change", () => {
  typeFilter = typeFilterEl.value;
  currentPage = 1;
  renderTable();
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  typeFilterEl.value = "";
  searchQuery = "";
  typeFilter = "";
  statusFilter = "all";
  currentPage = 1;
  statusTabs
    .querySelectorAll(".statusTab")
    .forEach((t) => t.classList.toggle("active", t.dataset.status === "all"));
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
  const totalPages = Math.ceil(getFilteredRequests().length / pageSize);
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

// Table "View" buttons
tableBody.addEventListener("click", (e) => {
  const btn = e.target.closest(".viewBtn");
  if (!btn) return;
  openDetail(btn.dataset.id);
});

/* ---------- ACTION BUTTON CLICKS ---------- */
detailActions.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  console.log("🖱️ Clicked action:", action);

  if (action === "cancel") {
    closeDetail();
    return;
  }

  if (action === "cancel-reject") {
    const r = requests.find((x) => String(x.id) === activeRequestId);
    if (r) renderDetailActions(r);
    return;
  }

  if (action === "approve") {
    handleAction("approve", "");
    return;
  }

  if (action === "reject") {
    showRejectPanel();
    return;
  }

  if (action === "confirm-reject") {
    const note = document.getElementById("actionNote").value.trim();
    if (!note) {
      const field = document.getElementById("actionNote");
      field.classList.add("invalid");
      document.getElementById("actionNoteError").textContent =
        "A reason is required to reject a request.";
      return;
    }
    handleAction("reject", note);
    return;
  }
});

// Modal close
document
  .getElementById("detailCloseBtn")
  .addEventListener("click", closeDetail);

// Backdrop close
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetail();
});

// Esc closes modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && detailModal.classList.contains("open")) {
    closeDetail();
  }
});

// Refresh button
document.getElementById("refreshBtn").addEventListener("click", () => {
  requests = loadRequests();
  products = loadProducts();
  history = loadHistory();
  renderTable();
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
   13. INIT
   ------------------------------------------------------------ */
function init() {
  renderTable();
  renderUserProfile();
}

init();
