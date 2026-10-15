/* ============================================================
   PRODUCTS PAGE — REAL LOCALSTORAGE DATA, CRUD, FILTERS, PAGINATION
   ============================================================ */

/* ------------------------------------------------------------
   1. DATA LOADING
   ------------------------------------------------------------ */
let products = [];
try {
  products = JSON.parse(localStorage.getItem("productData")) || [];
} catch (e) {
  console.warn("Could not parse productData from localStorage:", e);
}
if (!Array.isArray(products)) products = [];

function saveProducts() {
  localStorage.setItem("productData", JSON.stringify(products));
}

/* ------------------------------------------------------------
   2. HELPERS
   ------------------------------------------------------------ */
const money = (value) => Number(value || 0).toLocaleString("en-US") + " MMK";

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

/**
 * Always return a STRING key for a product.
 * localStorage may store the id as a number, and dataset always returns
 * strings — normalizing on both sides avoids the mismatch bug.
 */
const getProductKey = (p) => String(p?.id ?? p?.sku ?? "");

const LOW_STOCK_THRESHOLD = 10;

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let currentPage = 1;
let pageSize = 10;
let searchQuery = "";
let filterCategory = "";
let filterStock = "";
let filterStatus = "";
let editingProductId = null; // always a string (or null)
let deletingProductId = null; // always a string (or null)

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const tableBody = document.getElementById("productsTableBody");
const searchInput = document.getElementById("productSearch");
const categoryFilter = document.getElementById("filterCategory");
const stockFilter = document.getElementById("filterStock");
const statusFilter = document.getElementById("filterStatus");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");

const paginationInfo = document.getElementById("paginationInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");

const productModal = document.getElementById("productModal");
const deleteModal = document.getElementById("deleteModal");
const productForm = document.getElementById("productForm");
const modalTitle = document.getElementById("modalTitle");

/* ------------------------------------------------------------
   5. FILTER & PAGINATION LOGIC
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

    if (filterStock) {
      const stock = Number(p.stock || 0);
      const min = Number(p.minStock || LOW_STOCK_THRESHOLD);
      if (filterStock === "out" && stock !== 0) return false;
      if (filterStock === "low" && (stock === 0 || stock > min)) return false;
      if (filterStock === "in" && stock <= min) return false;
    }

    if (filterStatus && p.status !== filterStatus) return false;

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

function renderCategoryFilter() {
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ];

  categoryFilter.innerHTML =
    `<option value="">All Categories</option>` +
    categories
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");

  const datalist = document.getElementById("categoryList");
  if (datalist) {
    datalist.innerHTML = categories
      .map((c) => `<option value="${esc(c)}">`)
      .join("");
  }
}

function renderTable() {
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
    tableBody.innerHTML = `<tr><td colspan="7" class="emptyState">No products found matching your filters.</td></tr>`;
    renderPagination(0, 1, 0, 0);
    return;
  }

  pageItems.forEach((p) => {
    const stock = Number(p.stock || 0);
    const min = Number(p.minStock || LOW_STOCK_THRESHOLD);
    let stockClass = "ok";
    let stockLabel = stock;

    if (stock === 0) {
      stockClass = "out";
      stockLabel = "0 (Out)";
    } else if (stock <= min) {
      stockClass = "low";
      stockLabel = `${stock} (Low)`;
    }

    const thumb = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.name)}" onerror="this.style.display='none'; this.parentElement.textContent='📦'" />`
      : "📦";

    const statusBadgeHtml =
      p.status === "active"
        ? `<span class="badge badgeSuccess"><span class="dot"></span>Active</span>`
        : `<span class="badge badgeNeutral"><span class="dot"></span>Inactive</span>`;

    // ★ Use getProductKey so both the data-id and the lookup use strings
    const key = getProductKey(p);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="productNameCell">
          <span class="productThumb">${thumb}</span>
          <div class="productNameText">
            <strong>${esc(p.name)}</strong>
            <span>${esc(p.sku || "")}</span>
          </div>
        </div>
      </td>
      <td>${esc(p.sku)}</td>
      <td>${esc(p.category)}</td>
      <td>${money(p.price)}</td>
      <td class="stockCell ${stockClass}">${stockLabel}</td>
      <td>${statusBadgeHtml}</td>
      <td>
        <div class="actionsCell">
          <button class="actionBtn editBtn" type="button" data-id="${esc(key)}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="actionBtn danger deleteBtn" type="button" data-id="${esc(key)}" title="Delete">
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
      return `<button class="pageNumberBtn${p === currentPage ? " active" : ""}" type="button" data-page="${p}">${p}</button>`;
    })
    .join("");
}

/* ------------------------------------------------------------
   7. MODAL LOGIC
   ------------------------------------------------------------ */

function openProductModal(product = null) {
  editingProductId = product ? getProductKey(product) : null;
  modalTitle.textContent = product ? "Edit Product" : "Add Product";

  productForm.reset();
  document
    .querySelectorAll(".errorText")
    .forEach((el) => (el.textContent = ""));
  document
    .querySelectorAll(".field")
    .forEach((el) => el.classList.remove("invalid"));

  if (product) {
    document.getElementById("productId").value = getProductKey(product);
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productSku").value = product.sku || "";
    document.getElementById("productCategory").value = product.category || "";
    document.getElementById("productPrice").value = product.price || "";
    document.getElementById("productStock").value = product.stock ?? 0;
    document.getElementById("productMinStock").value =
      product.minStock ?? LOW_STOCK_THRESHOLD;
    document.getElementById("productStatus").value = product.status || "active";
    document.getElementById("productImage").value = product.image || "";
    document.getElementById("productDescription").value =
      product.description || "";
  } else {
    document.getElementById("productId").value = "";
    document.getElementById("productMinStock").value = LOW_STOCK_THRESHOLD;
    document.getElementById("productStatus").value = "active";
  }

  productModal.classList.add("open");
  productModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => document.getElementById("productName").focus(), 60);
}

function closeProductModal() {
  productModal.classList.remove("open");
  productModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  editingProductId = null;
}

function openDeleteModal(id, name) {
  deletingProductId = String(id); // ensure string
  document.getElementById("deleteProductName").textContent = name;
  deleteModal.classList.add("open");
  deleteModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDeleteModal() {
  deleteModal.classList.remove("open");
  deleteModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  deletingProductId = null;
}

/* ------------------------------------------------------------
   8. FORM VALIDATION & SUBMISSION
   ------------------------------------------------------------ */

function validateForm() {
  let isValid = true;

  const name = document.getElementById("productName");
  const sku = document.getElementById("productSku");
  const category = document.getElementById("productCategory");
  const price = document.getElementById("productPrice");
  const stock = document.getElementById("productStock");

  [name, sku, category, price, stock].forEach((el) => {
    el.classList.remove("invalid");
    document.getElementById(`error-${el.id}`).textContent = "";
  });

  if (!name.value.trim()) {
    name.classList.add("invalid");
    document.getElementById("error-productName").textContent =
      "Product name is required.";
    isValid = false;
  }

  if (!sku.value.trim()) {
    sku.classList.add("invalid");
    document.getElementById("error-productSku").textContent =
      "SKU is required.";
    isValid = false;
  } else {
    const currentKey = editingProductId;
    const duplicate = products.find(
      (p) =>
        String(p.sku || "").toLowerCase() === sku.value.trim().toLowerCase() &&
        getProductKey(p) !== currentKey,
    );
    if (duplicate) {
      sku.classList.add("invalid");
      document.getElementById("error-productSku").textContent =
        "This SKU is already in use.";
      isValid = false;
    }
  }

  if (!category.value.trim()) {
    category.classList.add("invalid");
    document.getElementById("error-productCategory").textContent =
      "Category is required.";
    isValid = false;
  }

  if (price.value === "" || Number(price.value) < 0) {
    price.classList.add("invalid");
    document.getElementById("error-productPrice").textContent =
      "Enter a valid price (0 or more).";
    isValid = false;
  }

  if (stock.value === "" || Number(stock.value) < 0) {
    stock.classList.add("invalid");
    document.getElementById("error-productStock").textContent =
      "Enter a valid stock quantity (0 or more).";
    isValid = false;
  }

  return isValid;
}

productForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validateForm()) return;

  const formId = document.getElementById("productId").value;
  const newProduct = {
    id: formId || `PROD-${Date.now()}`,
    name: document.getElementById("productName").value.trim(),
    sku: document.getElementById("productSku").value.trim().toUpperCase(),
    category: document.getElementById("productCategory").value.trim(),
    price: Number(document.getElementById("productPrice").value),
    stock: Number(document.getElementById("productStock").value),
    minStock:
      Number(document.getElementById("productMinStock").value) ||
      LOW_STOCK_THRESHOLD,
    status: document.getElementById("productStatus").value,
    image: document.getElementById("productImage").value.trim() || "",
    description:
      document.getElementById("productDescription").value.trim() || "",
  };

  if (editingProductId) {
    // Update existing — compare using getProductKey
    const index = products.findIndex(
      (p) => getProductKey(p) === editingProductId,
    );
    if (index !== -1) {
      products[index] = {
        ...products[index],
        ...newProduct,
        id: products[index].id,
      };
    }
  } else {
    products.unshift(newProduct);
  }

  saveProducts();
  renderCategoryFilter();
  closeProductModal();
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

// Search & Filters
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

statusFilter.addEventListener("change", () => {
  filterStatus = statusFilter.value;
  currentPage = 1;
  renderTable();
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  categoryFilter.value = "";
  stockFilter.value = "";
  statusFilter.value = "";
  searchQuery = "";
  filterCategory = "";
  filterStock = "";
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

/* ------------------------------------------------------------
   ★ TABLE ACTIONS — THE FIXED PART
   Every lookup uses getProductKey so types always match.
   ------------------------------------------------------------ */
tableBody.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".editBtn");
  if (editBtn) {
    const id = String(editBtn.dataset.id); // always a string
    const product = products.find((p) => getProductKey(p) === id);
    if (product) openProductModal(product);
    return;
  }

  const deleteBtn = e.target.closest(".deleteBtn");
  if (deleteBtn) {
    const id = String(deleteBtn.dataset.id);
    const product = products.find((p) => getProductKey(p) === id);
    if (product) openDeleteModal(id, product.name);
    return;
  }
});

// Modal Events
document
  .getElementById("addProductBtn")
  .addEventListener("click", () => openProductModal(null));
document
  .getElementById("modalCloseBtn")
  .addEventListener("click", closeProductModal);
document
  .getElementById("cancelBtn")
  .addEventListener("click", closeProductModal);
document
  .getElementById("deleteModalClose")
  .addEventListener("click", closeDeleteModal);
document
  .getElementById("cancelDeleteBtn")
  .addEventListener("click", closeDeleteModal);

// Confirm Delete
document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
  if (!deletingProductId) return;
  // Compare using getProductKey (string-safe)
  products = products.filter((p) => getProductKey(p) !== deletingProductId);
  saveProducts();
  renderCategoryFilter();
  closeDeleteModal();
  renderTable();
});

// Close modals on overlay click
[productModal, deleteModal].forEach((modal) => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal === productModal ? closeProductModal() : closeDeleteModal();
    }
  });
});

// Esc key to close modals
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (productModal.classList.contains("open")) closeProductModal();
    if (deleteModal.classList.contains("open")) closeDeleteModal();
  }
});

function renderNotifications() {
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

// function loadPendingRequests() {
//   const navBadge = document.getElementById("navRequestsBadge");
//   if (navBadge) navBadge.textContent = pendingReqs.length;
// }
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
  renderUserProfile();
  renderCategoryFilter();
  renderTable();
  renderNotifications();
}

init();
