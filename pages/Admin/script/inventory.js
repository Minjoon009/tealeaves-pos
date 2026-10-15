/* ============================================================
   INVENTORY PAGE
   Reads productData from localStorage, writes stockHistory.
   ============================================================ */

/* ------------------------------------------------------------
   1. STORAGE KEYS & LOADING
   ------------------------------------------------------------ */
const PRODUCT_KEY = "productData";
const HISTORY_KEY = "stockHistory";
const LOW_STOCK_DEFAULT = 10;

function loadProducts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse productData:", e);
    return [];
  }
}

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse stockHistory:", e);
    return [];
  }
}

function saveProducts() {
  localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

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

const getProductKey = (p) => String(p?.id ?? p?.sku ?? "");
const getMinStock = (p) => Number(p.minStock) || LOW_STOCK_DEFAULT;

function getStockStatus(p) {
  const stock = Number(p.stock || 0);
  const min = getMinStock(p);
  if (stock === 0) return "out";
  if (stock <= min) return "low";
  return "in";
}

function formatDateTime(iso) {
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
}

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
  return formatDateTime(iso);
}

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let currentPage = 1;
let pageSize = 10;
let searchQuery = "";
let filterCategory = "";
let filterStock = "";

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const tableBody = document.getElementById("inventoryTableBody");
const summaryEl = document.getElementById("invSummary");
const searchInput = document.getElementById("invSearch");
const categoryFilter = document.getElementById("invFilterCategory");
const stockFilter = document.getElementById("invFilterStock");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const paginationInfo = document.getElementById("paginationInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");

const adjustModal = document.getElementById("adjustModal");
const historyModal = document.getElementById("historyModal");
const adjustForm = document.getElementById("adjustForm");
const adjustModalTitle = document.getElementById("adjustModalTitle");
const adjustProductSelect = document.getElementById("adjustProduct");
const stockPreview = document.getElementById("stockPreview");
const currentStockValue = document.getElementById("currentStockValue");
const newStockValue = document.getElementById("newStockValue");
const qtyLabel = document.getElementById("qtyLabel");
const qtyHint = document.getElementById("qtyHint");
const adjustQty = document.getElementById("adjustQty");
const adjustReason = document.getElementById("adjustReason");
const adjustNotes = document.getElementById("adjustNotes");

const historyList = document.getElementById("historyList");
const historySearch = document.getElementById("historySearch");
const historyTypeFilter = document.getElementById("historyTypeFilter");

let preselectedProductKey = null;
let historyProductKey = null;

/* ------------------------------------------------------------
   5. FILTERING & PAGINATION
   ------------------------------------------------------------ */
function getFilteredProducts() {
  return products.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = String(p.name || "")
        .toLowerCase()
        .includes(q);
      const matchesSku = String(p.sku || "")
        .toLowerCase()
        .includes(q);
      if (!matchesName && !matchesSku) return false;
    }
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterStock && getStockStatus(p) !== filterStock) return false;
    return true;
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
   6. RENDER — SUMMARY CARDS
   ------------------------------------------------------------ */
function renderSummary() {
  const totalItems = products.length;
  const lowItems = products.filter((p) => getStockStatus(p) === "low").length;
  const outItems = products.filter((p) => getStockStatus(p) === "out").length;

  const last24h = history.filter(
    (h) => Date.now() - new Date(h.timestamp).getTime() < 24 * 60 * 60 * 1000,
  ).length;

  const cards = [
    {
      label: "Total Items",
      value: String(totalItems),
      sub: "products in inventory",
      iconClass: "primary",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    },
    {
      label: "Low Stock",
      value: String(lowItems),
      sub: "below minimum threshold",
      iconClass: "warning",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    },
    {
      label: "Out of Stock",
      value: String(outItems),
      sub: "needs immediate restock",
      iconClass: "danger",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    },
    {
      label: "Adjustments (24h)",
      value: String(last24h),
      sub: "stock changes recorded",
      iconClass: "success",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
    },
  ];

  summaryEl.innerHTML = cards
    .map(
      (c) => `
        <article class="summaryCard">
          <div class="summaryCardHead">
            <div class="summaryCardIcon ${c.iconClass}">${c.icon}</div>
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
   7. RENDER — CATEGORY FILTER
   ------------------------------------------------------------ */
function renderCategoryFilter() {
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];
  categoryFilter.innerHTML =
    `<option value="">All Categories</option>` +
    categories
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
}

/* ------------------------------------------------------------
   8. RENDER — TABLE
   ------------------------------------------------------------ */
function renderTable() {
  // Refresh products from localStorage each render so cross-tab updates show
  products = loadProducts();

  const filtered = getFilteredProducts();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  const pageItems = filtered.slice(start, end);

  tableBody.innerHTML = "";

  if (!totalItems) {
    tableBody.innerHTML = `<tr><td colspan="8" class="emptyState">No inventory items found.</td></tr>`;
    renderPagination(0, 1, 0, 0);
    return;
  }

  pageItems.forEach((p) => {
    const status = getStockStatus(p);
    const stock = Number(p.stock || 0);
    const min = getMinStock(p);
    const key = getProductKey(p);

    const statusBadgeHtml =
      status === "out"
        ? `<span class="badge badgeDanger"><span class="dot"></span>Out of Stock</span>`
        : status === "low"
          ? `<span class="badge badgeWarning"><span class="dot"></span>Low Stock</span>`
          : `<span class="badge badgeSuccess"><span class="dot"></span>In Stock</span>`;

    const thumb = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.display='none'; this.parentElement.textContent='📦'" />`
      : "📦";

    // Find latest adjustment for this product
    const lastAdj = history
      .filter((h) => String(h.productKey) === key)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

    const lastUpdatedHtml = lastAdj
      ? `<span title="${esc(formatDateTime(lastAdj.timestamp))}">${esc(relativeTime(lastAdj.timestamp))}</span>`
      : `<span style="color:var(--color-text-muted)">—</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="productCell">
          <span class="productThumb">${thumb}</span>
          <div class="productNameText">
            <strong>${esc(p.name)}</strong>
            <span>${esc(p.sku || "")}</span>
          </div>
        </div>
      </td>
      <td>${esc(p.sku)}</td>
      <td>${esc(p.category)}</td>
      <td class="stockNum ${status}">${stock}</td>
      <td class="minStockNum">${min}</td>
      <td>${statusBadgeHtml}</td>
      <td class="lastUpdated">${lastUpdatedHtml}</td>
      <td>
        <div class="actionsCell">
          <button class="actionBtn adjustBtn" type="button" data-key="${esc(key)}" title="Adjust Stock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="actionBtn historyBtn" type="button" data-key="${esc(key)}" title="View History">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
   9. ADJUSTMENT MODAL
   ------------------------------------------------------------ */
function populateProductSelect() {
  adjustProductSelect.innerHTML =
    `<option value="">Select a product</option>` +
    products
      .map((p) => {
        const key = getProductKey(p);
        return `<option value="${esc(key)}">${esc(p.name)} (${esc(p.sku || key)})</option>`;
      })
      .join("");
}

function openAdjustModal(productKey = null) {
  preselectedProductKey = productKey;
  adjustModalTitle.textContent = productKey ? "Adjust Stock" : "Adjust Stock";

  adjustForm.reset();
  document
    .querySelectorAll("#adjustForm .errorText")
    .forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll("#adjustForm .field")
    .forEach((el) => el.classList.remove("invalid"));

  // Default type: Stock In
  const inRadio = adjustForm.querySelector('input[name="adjType"][value="in"]');
  if (inRadio) inRadio.checked = true;

  populateProductSelect();

  if (productKey) {
    adjustProductSelect.value = productKey;
    adjustProductSelect.disabled = true; // lock it when opened from a row
  } else {
    adjustProductSelect.disabled = false;
  }

  updateStockPreview();
  updateQtyLabel();

  adjustModal.classList.add("open");
  adjustModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => adjustProductSelect.focus(), 60);
}

function closeAdjustModal() {
  adjustModal.classList.remove("open");
  adjustModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  preselectedProductKey = null;
}

function updateStockPreview() {
  const key = adjustProductSelect.value;
  const product = products.find((p) => getProductKey(p) === key);

  if (!product) {
    stockPreview.hidden = true;
    return;
  }

  stockPreview.hidden = false;
  const current = Number(product.stock || 0);
  currentStockValue.textContent = current;

  // Compute the projected new stock based on current form state
  const type = adjustForm.querySelector('input[name="adjType"]:checked').value;
  const qty = Number(adjustQty.value) || 0;

  let projected = current;
  if (type === "in") projected = current + qty;
  else if (type === "out") projected = Math.max(0, current - qty);
  else if (type === "correction") projected = qty;

  newStockValue.textContent = projected;

  // Color-code based on result
  const min = getMinStock(product);
  let color = "var(--color-text)";
  if (projected === 0) color = "var(--color-danger)";
  else if (projected <= min) color = "var(--color-warning)";
  else color = "var(--color-success)";
  newStockValue.style.color = color;
}

function updateQtyLabel() {
  const type = adjustForm.querySelector('input[name="adjType"]:checked').value;
  if (type === "in") {
    qtyLabel.innerHTML = `Quantity to Add <span class="requiredMark">*</span>`;
    qtyHint.textContent = "How many units are being added to stock.";
    adjustQty.min = "1";
  } else if (type === "out") {
    qtyLabel.innerHTML = `Quantity to Remove <span class="requiredMark">*</span>`;
    qtyHint.textContent = "How many units are being removed from stock.";
    adjustQty.min = "1";
  } else {
    qtyLabel.innerHTML = `New Correct Stock Value <span class="requiredMark">*</span>`;
    qtyHint.textContent =
      "Enter the actual counted quantity. This replaces the current stock.";
    adjustQty.min = "0";
  }
  adjustQty.value = "";
  updateStockPreview();
}

/* ------------------------------------------------------------
   10. FORM SUBMISSION
   ------------------------------------------------------------ */
function validateAdjustForm() {
  let isValid = true;

  const productKey = adjustProductSelect.value;
  const type = adjustForm.querySelector('input[name="adjType"]:checked').value;
  const qty = Number(adjustQty.value);
  const reason = adjustReason.value;

  // Clear
  adjustProductSelect.classList.remove("invalid");
  adjustQty.classList.remove("invalid");
  adjustReason.classList.remove("invalid");
  document.getElementById("error-adjustProduct").textContent = "";
  document.getElementById("error-adjustQty").textContent = "";
  document.getElementById("error-adjustReason").textContent = "";

  if (!productKey) {
    adjustProductSelect.classList.add("invalid");
    document.getElementById("error-adjustProduct").textContent =
      "Please select a product.";
    isValid = false;
  }

  if (adjustQty.value === "" || !Number.isFinite(qty)) {
    adjustQty.classList.add("invalid");
    document.getElementById("error-adjustQty").textContent =
      "Enter a quantity.";
    isValid = false;
  } else if (type !== "correction" && qty <= 0) {
    adjustQty.classList.add("invalid");
    document.getElementById("error-adjustQty").textContent =
      "Quantity must be greater than 0.";
    isValid = false;
  } else if (type === "correction" && qty < 0) {
    adjustQty.classList.add("invalid");
    document.getElementById("error-adjustQty").textContent =
      "Correction quantity can't be negative.";
    isValid = false;
  }

  if (type === "out") {
    const product = products.find((p) => getProductKey(p) === productKey);
    if (product && qty > Number(product.stock || 0)) {
      adjustQty.classList.add("invalid");
      document.getElementById("error-adjustQty").textContent =
        `Cannot remove more than current stock (${product.stock}).`;
      isValid = false;
    }
  }

  if (!reason) {
    adjustReason.classList.add("invalid");
    document.getElementById("error-adjustReason").textContent =
      "Please select a reason.";
    isValid = false;
  }

  return isValid;
}

adjustForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateAdjustForm()) return;

  const productKey = adjustProductSelect.value;
  const type = adjustForm.querySelector('input[name="adjType"]:checked').value;
  const qty = Number(adjustQty.value);
  const reason = adjustReason.value;
  const notes = adjustNotes.value.trim();

  const productIndex = products.findIndex(
    (p) => getProductKey(p) === productKey,
  );
  if (productIndex === -1) return;

  const product = products[productIndex];
  const previousStock = Number(product.stock || 0);
  let newStock = previousStock;

  if (type === "in") newStock = previousStock + qty;
  else if (type === "out") newStock = Math.max(0, previousStock - qty);
  else if (type === "correction") newStock = qty;

  // Update product
  products[productIndex] = {
    ...product,
    stock: newStock,
    updatedAt: new Date().toISOString(),
  };
  saveProducts();

  // Record audit entry
  const admin =
    (JSON.parse(localStorage.getItem("currentUser")) || {}).username ||
    "Admin User";

  // Next ADJ id
  let maxId = 0;
  history.forEach((h) => {
    const m = /^ADJ-(\d+)$/.exec(h.id || "");
    if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
  });
  const adjId = "ADJ-" + String(maxId + 1).padStart(4, "0");

  history.unshift({
    id: adjId,
    productKey: productKey,
    productName: product.name,
    sku: product.sku,
    type: type,
    quantity: qty,
    previousStock: previousStock,
    newStock: newStock,
    reason: reason,
    notes: notes,
    admin: admin,
    timestamp: new Date().toISOString(),
  });
  saveHistory();

  closeAdjustModal();
  renderSummary();
  renderTable();

  // Refresh history modal if open
  if (historyModal.classList.contains("open")) {
    renderHistory();
  }
});

/* ------------------------------------------------------------
   11. HISTORY MODAL
   ------------------------------------------------------------ */
function openHistoryModal(productKey = null) {
  historyProductKey = productKey;
  historySearch.value = "";
  historyTypeFilter.value = "";

  historyModalTitle.textContent = productKey
    ? `Stock History — ${products.find((p) => getProductKey(p) === productKey)?.name || "Product"}`
    : "Stock Movement History";

  renderHistory();

  historyModal.classList.add("open");
  historyModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeHistoryModal() {
  historyModal.classList.remove("open");
  historyModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  historyProductKey = null;
}

function renderHistory() {
  history = loadHistory();

  const query = historySearch.value.toLowerCase().trim();
  const typeFilter = historyTypeFilter.value;

  let items = [...history];

  if (historyProductKey) {
    items = items.filter((h) => String(h.productKey) === historyProductKey);
  }

  if (query) {
    items = items.filter((h) => {
      return (
        String(h.productName || "")
          .toLowerCase()
          .includes(query) ||
        String(h.sku || "")
          .toLowerCase()
          .includes(query) ||
        String(h.reason || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }

  if (typeFilter) {
    items = items.filter((h) => h.type === typeFilter);
  }

  if (!items.length) {
    historyList.innerHTML = `<div class="emptyHistory">No stock movements found.</div>`;
    return;
  }

  historyList.innerHTML = items
    .slice(0, 100)
    .map((h) => {
      const iconChar = h.type === "in" ? "+" : h.type === "out" ? "−" : "✎";
      const delta = h.newStock - h.previousStock;
      const deltaText = delta > 0 ? `+${delta}` : String(delta);
      const deltaClass = delta > 0 ? "up" : delta < 0 ? "down" : "";

      const typeLabel =
        h.type === "in"
          ? "Stock In"
          : h.type === "out"
            ? "Stock Out"
            : "Correction";

      return `
        <div class="historyItem">
          <span class="historyIcon ${h.type}">${iconChar}</span>
          <div class="historyBody">
            <div class="historyTitle">${esc(h.productName)}</div>
            <div class="historyChange">
              ${typeLabel} — <span class="delta ${deltaClass}">${deltaText}</span>
              &nbsp;·&nbsp; ${h.previousStock} → <strong>${h.newStock}</strong>
            </div>
            <div class="historyMeta">
              ${esc(h.reason)} <span class="sep">•</span>
              By ${esc(h.admin)} <span class="sep">•</span>
              ${esc(formatDateTime(h.timestamp))}
            </div>
            ${h.notes ? `<div class="historyNotes">“${esc(h.notes)}”</div>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
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

// Filters
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  currentPage = 1;
  renderTable();
});

categoryFilter.addEventListener("change", () => {
  filterCategory = categoryFilter.value;
  currentPage = 1;
  renderTable();
});

stockFilter.addEventListener("change", () => {
  filterStock = stockFilter.value;
  currentPage = 1;
  renderTable();
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  stockFilter.value = "";
  searchQuery = "";
  filterCategory = "";
  filterStock = "";
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
  const totalPages = Math.ceil(getFilteredProducts().length / pageSize);
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

// Table actions
tableBody.addEventListener("click", (e) => {
  const adjustBtn = e.target.closest(".adjustBtn");
  if (adjustBtn) {
    openAdjustModal(String(adjustBtn.dataset.key));
    return;
  }

  const historyBtn = e.target.closest(".historyBtn");
  if (historyBtn) {
    openHistoryModal(String(historyBtn.dataset.key));
    return;
  }
});

// Open adjustment modal from header button
document
  .getElementById("adjustStockBtn")
  .addEventListener("click", () => openAdjustModal(null));

// Open global history modal
document
  .getElementById("viewHistoryBtn")
  .addEventListener("click", () => openHistoryModal(null));

// Modal close buttons
document
  .getElementById("adjustCloseBtn")
  .addEventListener("click", closeAdjustModal);
document
  .getElementById("adjustCancelBtn")
  .addEventListener("click", closeAdjustModal);
document
  .getElementById("historyCloseBtn")
  .addEventListener("click", closeHistoryModal);
document
  .getElementById("historyDoneBtn")
  .addEventListener("click", closeHistoryModal);

// Adjustment form live updates
adjustProductSelect.addEventListener("change", updateStockPreview);
adjustQty.addEventListener("input", updateStockPreview);

adjustForm.querySelectorAll('input[name="adjType"]').forEach((radio) => {
  radio.addEventListener("change", () => {
    updateQtyLabel();
    // Clear any previous error state
    adjustQty.classList.remove("invalid");
    document.getElementById("error-adjustQty").textContent = "";
  });
});

// History filters
historySearch.addEventListener("input", renderHistory);
historyTypeFilter.addEventListener("change", renderHistory);

// Close on backdrop click
[adjustModal, historyModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal === adjustModal ? closeAdjustModal() : closeHistoryModal();
    }
  });
});

// Esc closes modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (adjustModal.classList.contains("open")) closeAdjustModal();
    if (historyModal.classList.contains("open")) closeHistoryModal();
  }
});
function renderNotifications() {
  const LOW_STOCK_THRESHOLD = 10;
  const list = document.getElementById("notifList");
  const notifs = [];
  var productData = JSON.parse(localStorage.getItem("productData")) || [];

  // 1. Low stock alerts
  productData.forEach((p) => {
    if (Number(p.stock) <= LOW_STOCK_THRESHOLD) {
      notifs.push({
        kind: "warning",
        icon: "⚠️",
        title: `Low stock: ${p.name}`,
        desc: `Only ${p.stock} units left (min ${LOW_STOCK_THRESHOLD}).`,
        time: "Just now",
      });
    }
  });

  // 2. Pending stock requests
  var pendingReqs = JSON.parse(localStorage.getItem("stockRequests")) || [];
  pendingReqs = pendingReqs.filter((r) => r.status === "pending");
  pendingReqs.forEach((r) => {
    notifs.push({
      kind: "info",
      icon: "📦",
      title: `New stock request ${r.id}`,
      desc: `${r.cashier || "Cashier"} requested ${r.quantity} × ${r.productName}.`,
      time: "Recently",
    });
  });

  // Limit to 5 notifications
  const displayNotifs = notifs.slice(0, 5);

  document.getElementById("notifBadge").textContent = displayNotifs.length;
  document.getElementById("notifHeaderCount").textContent =
    `${displayNotifs.length} new`;

  if (displayNotifs.length === 0) {
    list.innerHTML = `<li class="emptyState" style="padding: 20px;"><span>No new notifications</span></li>`;
  } else {
    list.innerHTML = displayNotifs
      .map(
        (n) => `
        <li class="notifItem">
          <span class="notifIcon ${n.kind}">${n.icon}</span>
          <div class="notifBody">
            <div class="notifTitle">${esc(n.title)}</div>
            <div class="notifDesc">${esc(n.desc)}</div>
            <div class="notifTime">${esc(n.time)}</div>
          </div>
        </li>
      `,
      )
      .join("");
  }

  // Sidebar badge
  const navBadge = document.getElementById("navRequestsBadge");
  if (navBadge) navBadge.textContent = pendingReqs.length;
}
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
  renderUserProfile();
  renderCategoryFilter();
  renderSummary();
  renderTable();
  renderNotifications();
}

init();
