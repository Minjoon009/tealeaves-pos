/* ============================================================
   CATEGORIES PAGE
   Reads categoryData from localStorage.
   Falls back to deriving categories from productData on first run.
   ============================================================ */

/* ------------------------------------------------------------
   1. DATA LOADING
   ------------------------------------------------------------ */
const STORAGE_KEY = "categoryData";
const PRODUCT_KEY = "productData";

function loadProducts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PRODUCT_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse productData:", e);
    return [];
  }
}

function loadCategories() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {
    console.warn("Could not parse categoryData:", e);
  }

  // First run: seed categories from unique categories in productData
  const products = loadProducts();
  const uniqueNames = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  return uniqueNames.map((name, i) => ({
    id: `CAT-${String(i + 1).padStart(3, "0")}`,
    name: name,
    description: "",
    status: "Active",
    createdAt: new Date().toISOString(),
  }));
}

let products = loadProducts();
let categories = loadCategories();

function saveCategories() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
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

const getCategoryKey = (c) => String(c?.id ?? c?.name ?? "");

/** Count how many products belong to a category (by name, case-insensitive). */
function countProductsInCategory(categoryName) {
  const target = String(categoryName || "").toLowerCase();
  return products.filter(
    (p) => String(p.category || "").toLowerCase() === target,
  ).length;
}

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let currentPage = 1;
let pageSize = 10;
let searchQuery = "";
let filterStatus = "";
let editingCategoryKey = null;
let deletingCategoryKey = null;

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const tableBody = document.getElementById("categoriesTableBody");
const searchInput = document.getElementById("categorySearch");
const statusFilter = document.getElementById("filterStatus");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const paginationInfo = document.getElementById("paginationInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");

const categoryModal = document.getElementById("categoryModal");
const deleteModal = document.getElementById("deleteModal");
const categoryForm = document.getElementById("categoryForm");
const modalTitle = document.getElementById("modalTitle");

/* ------------------------------------------------------------
   5. FILTER & PAGINATION
   ------------------------------------------------------------ */
function getFilteredCategories() {
  return categories.filter((c) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchesName = String(c.name || "")
        .toLowerCase()
        .includes(q);
      const matchesDesc = String(c.description || "")
        .toLowerCase()
        .includes(q);
      if (!matchesName && !matchesDesc) return false;
    }

    if (filterStatus && c.status !== filterStatus) return false;

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
   6. RENDERING
   ------------------------------------------------------------ */
function renderTable() {
  // Refresh products so counts stay accurate if user adds products elsewhere
  products = loadProducts();

  const filtered = getFilteredCategories();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  const pageItems = filtered.slice(start, end);

  tableBody.innerHTML = "";

  if (!totalItems) {
    tableBody.innerHTML = `<tr><td colspan="5" class="emptyState">No categories found matching your filters.</td></tr>`;
    renderPagination(0, 1, 0, 0);
    return;
  }

  pageItems.forEach((c) => {
    const key = getCategoryKey(c);
    const productCount = countProductsInCategory(c.name);
    const initial = String(c.name || "?")
      .charAt(0)
      .toUpperCase();

    const statusBadgeHtml =
      c.status === "Active"
        ? `<span class="badge badgeSuccess"><span class="dot"></span>Active</span>`
        : `<span class="badge badgeNeutral"><span class="dot"></span>Inactive</span>`;

    const countBadge =
      productCount === 0
        ? `<span class="productCountBadge zero">0 products</span>`
        : `<span class="productCountBadge">${productCount} product${
            productCount === 1 ? "" : "s"
          }</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="categoryNameCell">
          <span class="categoryIcon">${esc(initial)}</span>
          <div class="categoryNameText">
            <strong>${esc(c.name)}</strong>
            <span>${esc(c.id || "")}</span>
          </div>
        </div>
      </td>
      <td class="categoryDescCell" title="${esc(c.description || "")}">
        ${c.description ? esc(c.description) : `<span style="color:var(--color-text-muted)">—</span>`}
      </td>
      <td>${countBadge}</td>
      <td>${statusBadgeHtml}</td>
      <td>
        <div class="actionsCell">
          <button class="actionBtn editBtn" type="button" data-key="${esc(key)}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="actionBtn danger deleteBtn" type="button" data-key="${esc(key)}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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
   7. MODAL LOGIC
   ------------------------------------------------------------ */
function openCategoryModal(category = null) {
  editingCategoryKey = category ? getCategoryKey(category) : null;
  modalTitle.textContent = category ? "Edit Category" : "Add Category";

  categoryForm.reset();
  document
    .querySelectorAll(".errorText")
    .forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll(".field")
    .forEach((el) => el.classList.remove("invalid"));

  if (category) {
    document.getElementById("categoryKey").value = getCategoryKey(category);
    document.getElementById("categoryName").value = category.name || "";
    document.getElementById("categoryDescription").value =
      category.description || "";
    document.getElementById("categoryStatus").value =
      category.status || "Active";
  } else {
    document.getElementById("categoryKey").value = "";
    document.getElementById("categoryStatus").value = "Active";
  }

  categoryModal.classList.add("open");
  categoryModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => document.getElementById("categoryName").focus(), 60);
}

function closeCategoryModal() {
  categoryModal.classList.remove("open");
  categoryModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  editingCategoryKey = null;
}

function openDeleteModal(key, name) {
  deletingCategoryKey = String(key);

  const productCount = countProductsInCategory(name);
  const warning = document.getElementById("deleteWarning");
  const warningText = document.getElementById("deleteWarningText");
  const confirmBtn = document.getElementById("confirmDeleteBtn");

  document.getElementById("deleteCategoryName").textContent = name;

  if (productCount > 0) {
    warning.hidden = false;
    warningText.textContent = `This category has ${productCount} product${
      productCount === 1 ? "" : "s"
    } assigned to it. Move or delete those products first.`;
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = "0.45";
    confirmBtn.style.cursor = "not-allowed";
  } else {
    warning.hidden = true;
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = "";
    confirmBtn.style.cursor = "";
  }

  deleteModal.classList.add("open");
  deleteModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDeleteModal() {
  deleteModal.classList.remove("open");
  deleteModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  deletingCategoryKey = null;
}

/* ------------------------------------------------------------
   8. VALIDATION & SUBMISSION
   ------------------------------------------------------------ */
function validateForm() {
  let isValid = true;
  const name = document.getElementById("categoryName");

  name.classList.remove("invalid");
  document.getElementById("error-categoryName").textContent = "";

  if (!name.value.trim()) {
    name.classList.add("invalid");
    document.getElementById("error-categoryName").textContent =
      "Category name is required.";
    isValid = false;
  } else {
    // Duplicate name check (excluding the one being edited)
    const duplicate = categories.find(
      (c) =>
        String(c.name || "").toLowerCase() ===
          name.value.trim().toLowerCase() &&
        getCategoryKey(c) !== editingCategoryKey,
    );
    if (duplicate) {
      name.classList.add("invalid");
      document.getElementById("error-categoryName").textContent =
        "A category with this name already exists.";
      isValid = false;
    }
  }

  return isValid;
}

categoryForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const formKey = document.getElementById("categoryKey").value;
  const name = document.getElementById("categoryName").value.trim();
  const description = document
    .getElementById("categoryDescription")
    .value.trim();
  const status = document.getElementById("categoryStatus").value;

  if (editingCategoryKey) {
    // Update existing
    const index = categories.findIndex(
      (c) => getCategoryKey(c) === editingCategoryKey,
    );
    if (index !== -1) {
      const oldName = categories[index].name;
      categories[index] = {
        ...categories[index],
        name,
        description,
        status,
      };

      // Optional: rename category on existing products to keep data consistent
      if (oldName !== name) {
        let changed = false;
        products = products.map((p) => {
          if (
            String(p.category || "").toLowerCase() === oldName.toLowerCase()
          ) {
            changed = true;
            return { ...p, category: name };
          }
          return p;
        });
        if (changed) {
          localStorage.setItem(PRODUCT_KEY, JSON.stringify(products));
        }
      }
    }
  } else {
    // Create new — generate next CAT-### id
    let max = 0;
    categories.forEach((c) => {
      const m = /^CAT-(\d+)$/.exec(c.id || "");
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    const newId = "CAT-" + String(max + 1).padStart(3, "0");

    categories.unshift({
      id: newId,
      name,
      description,
      status,
      createdAt: new Date().toISOString(),
    });
  }

  saveCategories();
  closeCategoryModal();
  renderTable();
});

/* ------------------------------------------------------------
   9. EVENT LISTENERS
   ------------------------------------------------------------ */

// Sidebar toggle (mobile)
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

statusFilter.addEventListener("change", () => {
  filterStatus = statusFilter.value;
  currentPage = 1;
  renderTable();
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "";
  searchQuery = "";
  filterStatus = "";
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
  const totalPages = Math.ceil(getFilteredCategories().length / pageSize);
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

/* ---------- table actions ---------- */
tableBody.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".editBtn");
  if (editBtn) {
    const key = String(editBtn.dataset.key);
    const category = categories.find((c) => getCategoryKey(c) === key);
    if (category) openCategoryModal(category);
    return;
  }

  const deleteBtn = e.target.closest(".deleteBtn");
  if (deleteBtn) {
    const key = String(deleteBtn.dataset.key);
    const category = categories.find((c) => getCategoryKey(c) === key);
    if (category) openDeleteModal(key, category.name);
    return;
  }
});

// Modal events
document
  .getElementById("addCategoryBtn")
  .addEventListener("click", () => openCategoryModal(null));
document
  .getElementById("modalCloseBtn")
  .addEventListener("click", closeCategoryModal);
document
  .getElementById("cancelBtn")
  .addEventListener("click", closeCategoryModal);
document
  .getElementById("deleteModalClose")
  .addEventListener("click", closeDeleteModal);
document
  .getElementById("cancelDeleteBtn")
  .addEventListener("click", closeDeleteModal);

// Confirm delete
document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
  if (!deletingCategoryKey) return;
  const category = categories.find(
    (c) => getCategoryKey(c) === deletingCategoryKey,
  );
  if (!category) return;

  // Extra safety — re-check product count
  if (countProductsInCategory(category.name) > 0) {
    return; // button already disabled, but double-check
  }

  categories = categories.filter(
    (c) => getCategoryKey(c) !== deletingCategoryKey,
  );
  saveCategories();
  closeDeleteModal();
  renderTable();
});

// Close modals on overlay click
[categoryModal, deleteModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal === categoryModal ? closeCategoryModal() : closeDeleteModal();
    }
  });
});

// Esc key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (categoryModal.classList.contains("open")) closeCategoryModal();
    if (deleteModal.classList.contains("open")) closeDeleteModal();
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
   10. INIT
   ------------------------------------------------------------ */
function init() {
  // Persist seeded categories on first run so they exist for the next visit
  if (!localStorage.getItem(STORAGE_KEY) && categories.length) {
    saveCategories();
  }
  renderTable();
  renderNotifications();
  renderUserProfile();
}

init();
