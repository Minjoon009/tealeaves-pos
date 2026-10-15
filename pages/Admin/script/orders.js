/* ============================================================
   ORDERS & RECEIPTS PAGE
   Reads orderData from localStorage.
   ============================================================ */

/* ------------------------------------------------------------
   1. STORAGE
   ------------------------------------------------------------ */
const ORDER_KEY = "orderData";
const REQUEST_KEY = "stockRequests";
const PRODUCT_KEY = "productData";

function loadOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Could not parse orderData:", e);
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

let orders = loadOrders();

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
const numberFmt = (v) => Number(v || 0).toLocaleString("en-US");

/** Calculate subtotal, tax, net, change for an order. */
function calcTotals(order) {
  const products = order.products || [];
  const subtotal = products.reduce(
    (sum, p) => sum + (Number(p.qty) || 0) * (Number(p.price) || 0),
    0,
  );
  const totalQty = products.reduce((sum, p) => sum + (Number(p.qty) || 0), 0);
  const discount = Number(order.discount) || 0;
  const taxRate = Number(order.taxRate) || 0;
  const tax = Math.round((subtotal - discount) * taxRate);
  const net = subtotal - discount + tax;
  const received = Number(order.received) || 0;
  const change = received - net;
  return { subtotal, totalQty, discount, tax, net, received, change };
}

/** Simple status derived from order data (no explicit status field). */
function getOrderStatus(order) {
  if (order.status) return order.status;
  // Default: completed if it has products and a received amount
  if (order.products && order.products.length && order.received) {
    return "completed";
  }
  return "pending";
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return formatDate(iso) + ", " + formatTime(iso);
}

/** Simple payment method inference (if not stored). */
function getPaymentMethod(order) {
  return order.payment || "Cash";
}

const STATUS_BADGE = {
  completed: { label: "Completed", cls: "badgeSuccess" },
  refunded: { label: "Refunded", cls: "badgeWarning" },
  cancelled: { label: "Cancelled", cls: "badgeDanger" },
  pending: { label: "Pending", cls: "badgeInfo" },
};

function statusBadge(status) {
  const cfg = STATUS_BADGE[status] || {
    label: status || "—",
    cls: "badgeNeutral",
  };
  return `<span class="badge ${cfg.cls}"><span class="dot"></span>${esc(cfg.label)}</span>`;
}

function paymentPill(method) {
  const key = String(method || "Cash").toLowerCase();
  const cls = key === "card" ? "card" : key === "wallet" ? "wallet" : "cash";
  return `<span class="paymentPill ${cls}">${esc(method)}</span>`;
}

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let currentPage = 1;
let pageSize = 10;
let searchQuery = "";
let filterCashier = "";
let filterPayment = "";
let filterDateFrom = "";
let filterDateTo = "";
let activeOrderId = null;

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const tableBody = document.getElementById("ordersTableBody");
const searchInput = document.getElementById("orderSearch");
const cashierFilter = document.getElementById("filterCashier");
const paymentFilter = document.getElementById("filterPayment");
const dateFromInput = document.getElementById("filterDateFrom");
const dateToInput = document.getElementById("filterDateTo");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const summaryRow = document.getElementById("ordersSummary");

const paginationInfo = document.getElementById("paginationInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageNumbersEl = document.getElementById("pageNumbers");

const orderModal = document.getElementById("orderModal");
const modalOrderId = document.getElementById("modalOrderId");
const modalCashier = document.getElementById("modalCashier");
const modalDateTime = document.getElementById("modalDateTime");
const modalPayment = document.getElementById("modalPayment");
const modalStatus = document.getElementById("modalStatus");
const modalItems = document.getElementById("modalItems");
const modalSubtotal = document.getElementById("modalSubtotal");
const modalDiscount = document.getElementById("modalDiscount");
const modalTax = document.getElementById("modalTax");
const modalNet = document.getElementById("modalNet");
const modalReceived = document.getElementById("modalReceived");
const modalChange = document.getElementById("modalChange");

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
function getFilteredOrders() {
  return orders
    .filter((o) => {
      const totals = calcTotals(o);

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = [
          o.id,
          o.cashier,
          o.payment,
          ...(o.products || []).map((p) => p.name),
          ...(o.products || []).map((p) => p.sku),
        ]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase());
        if (!fields.some((f) => f.includes(q))) return false;
      }

      // Cashier
      if (filterCashier && o.cashier !== filterCashier) return false;

      // Payment
      if (filterPayment && getPaymentMethod(o) !== filterPayment) return false;

      // Date range
      if (filterDateFrom || filterDateTo) {
        const d = new Date(o.date);
        if (isNaN(d)) return false;
        const day = d.toISOString().slice(0, 10);

        if (filterDateFrom && day < filterDateFrom) return false;
        if (filterDateTo && day > filterDateTo) return false;
      }

      return true;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
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
   7. RENDER — CASHIER FILTER
   ------------------------------------------------------------ */
function renderCashierFilter() {
  const cashiers = [
    ...new Set(orders.map((o) => o.cashier).filter(Boolean)),
  ].sort();
  cashierFilter.innerHTML =
    `<option value="">All Cashiers</option>` +
    cashiers
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
}

/* ------------------------------------------------------------
   8. RENDER — SUMMARY TILES
   ------------------------------------------------------------ */
function renderSummary() {
  const filtered = getFilteredOrders();
  const totalRevenue = filtered.reduce((sum, o) => sum + calcTotals(o).net, 0);
  const totalOrders = filtered.length;
  const avgOrder = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
  const totalItems = filtered.reduce(
    (sum, o) => sum + calcTotals(o).totalQty,
    0,
  );

  const tiles = [
    {
      label: "Total Orders",
      value: numberFmt(totalOrders),
      cls: "primary",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    },
    {
      label: "Total Revenue",
      value: money(totalRevenue),
      cls: "success",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    },
    {
      label: "Avg. Order",
      value: money(avgOrder),
      cls: "info",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    },
    {
      label: "Items Sold",
      value: numberFmt(totalItems),
      cls: "warning",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    },
  ];

  summaryRow.innerHTML = tiles
    .map(
      (t) => `
        <div class="summaryTile">
          <span class="summaryTileIcon ${t.cls}">${t.icon}</span>
          <div class="summaryTileBody">
            <div class="summaryTileLabel">${t.label}</div>
            <div class="summaryTileValue">${t.value}</div>
          </div>
        </div>
      `,
    )
    .join("");
}

/* ------------------------------------------------------------
   9. RENDER — TABLE
   ------------------------------------------------------------ */
function renderTable() {
  orders = loadOrders();

  renderNotifications();
  renderCashierFilter();
  renderSummary();

  const filtered = getFilteredOrders();
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalItems);
  const pageItems = filtered.slice(start, end);

  tableBody.innerHTML = "";

  if (!totalItems) {
    tableBody.innerHTML = `<tr><td colspan="10" class="emptyState">No orders found matching your filters.</td></tr>`;
    renderPagination(0, 1, 0, 0);
    return;
  }

  pageItems.forEach((o) => {
    const totals = calcTotals(o);
    const status = getOrderStatus(o);
    const payment = getPaymentMethod(o);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="orderId" title="${esc(o.id)}">${esc(o.id)}</span>
      </td>
      <td class="dateCell">
        <strong>${formatDate(o.date)}</strong>
        <span>${formatTime(o.date)}</span>
      </td>
      <td>${esc(o.cashier || "—")}</td>
      <td><span class="itemsCount">${totals.totalQty} items</span></td>
      <td class="amountCell">${money(totals.subtotal)}</td>
      <td class="amountCell ${totals.discount > 0 ? "discount" : ""}">
        ${totals.discount > 0 ? "−" + money(totals.discount) : "—"}
      </td>
      <td class="amountCell">${money(totals.net)}</td>
      <td>${paymentPill(payment)}</td>
      <td>${statusBadge(status)}</td>
      <td>
        <div class="actionCell">
          <button class="iconAction viewOrderBtn" type="button" data-id="${esc(o.id)}" title="View order">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="iconAction printOrderBtn" type="button" data-id="${esc(o.id)}" title="Print receipt">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
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
   10. ORDER DETAIL MODAL
   ------------------------------------------------------------ */
function openOrderModal(orderId) {
  const o = orders.find((x) => String(x.id) === String(orderId));
  if (!o) return;

  activeOrderId = o.id;
  const totals = calcTotals(o);

  modalOrderId.textContent = o.id;
  modalCashier.textContent = o.cashier || "—";
  modalDateTime.textContent = formatDateTime(o.date);
  modalPayment.textContent = getPaymentMethod(o);
  modalStatus.innerHTML = statusBadge(getOrderStatus(o));

  modalItems.innerHTML = (o.products || [])
    .map((p) => {
      const meta = [p.sku, p.category].filter(Boolean).join(" • ");
      const amount = (Number(p.qty) || 0) * (Number(p.price) || 0);
      return `
        <tr>
          <td>
            <span class="itemName">${esc(p.name)}</span>
            ${meta ? `<span class="itemMeta">${esc(meta)}</span>` : ""}
          </td>
          <td>${numberFmt(p.qty)}</td>
          <td>${numberFmt(p.price)}</td>
          <td>${numberFmt(amount)}</td>
        </tr>
      `;
    })
    .join("");

  modalSubtotal.textContent = money(totals.subtotal);
  modalDiscount.textContent =
    totals.discount > 0 ? "−" + money(totals.discount) : money(0);
  modalTax.textContent = money(totals.tax);
  modalNet.textContent = money(totals.net);
  modalReceived.textContent = money(totals.received);
  modalChange.textContent = money(totals.change);

  orderModal.classList.add("open");
  orderModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeOrderModal() {
  orderModal.classList.remove("open");
  orderModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  activeOrderId = null;
}

/* ------------------------------------------------------------
   PRINT RECEIPT — iframe-based (most reliable approach)
   ------------------------------------------------------------ */
function printOrderReceipt(orderId) {
  console.log("🖨️ printOrderReceipt called with:", orderId);

  const o = orders.find((x) => String(x.id) === String(orderId));
  if (!o) {
    console.warn("Order not found:", orderId);
    alert("Order not found. Please refresh the page and try again.");
    return;
  }

  const totals = calcTotals(o);

  // ---------- Build receipt HTML ----------
  const itemsHtml = (o.products || [])
    .map((p) => {
      const meta = [p.sku, p.category].filter(Boolean).join(" • ");
      const amount = (Number(p.qty) || 0) * (Number(p.price) || 0);
      return `
        <tr>
          <td>
            <span class="item-name">${esc(p.name)}</span>
            ${meta ? `<span class="item-meta">${esc(meta)}</span>` : ""}
          </td>
          <td>${numberFmt(p.qty)}</td>
          <td>${numberFmt(p.price)}</td>
          <td>${numberFmt(amount)}</td>
        </tr>
      `;
    })
    .join("");

  const receiptHtml = `
    <div class="receipt-container">
      <header class="shopInfoContainer">
        <h1>Tea Leaves</h1>
        <p class="shop-location">No. 17-29, Bagayar Road,<br />Sanchaung Township</p>
        <p class="shop-phone">Ph: 09-775 330 034, 779 829 159,<br />973 465 852</p>
        <p class="shop-time">Open Daily: 8:00 AM – 7:00 PM</p>
      </header>

      <section class="orderInfoContainer">
        <div>
          <div class="labelAndValue"><span>ORDER NO.</span><span>${esc(o.id)}</span></div>
          <div class="labelAndValue"><span>CASHIER</span><span>${esc(o.cashier || "—")}</span></div>
        </div>
        <div>
          <div class="labelAndValue"><span>DATE</span><span>${formatDate(o.date)}</span></div>
          <div class="labelAndValue"><span>TIME</span><span>${formatTime(o.date)}</span></div>
        </div>
      </section>

      <section class="orderItemTable">
        <table class="order-item-list">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div class="ruler"></div>

        <div class="line"><span>Subtotal (${totals.totalQty} items)</span><span>${money(totals.subtotal)}</span></div>
        <div class="line"><span>Discount</span><span>${money(totals.discount)}</span></div>
        <div class="line"><span>Tax</span><span>${money(totals.tax)}</span></div>
        <div class="line net"><span>NET AMOUNT</span><span>${money(totals.net)}</span></div>
        <div class="line"><span>Received</span><span>${money(totals.received)}</span></div>

        <div class="ruler"></div>

        <div class="line change"><span>CHANGE</span><span>${money(totals.change)}</span></div>
      </section>

      <footer class="receipt-footer">
        <p class="thank-you">Thank You for Visiting!</p>
        <p>We appreciate your support.</p>
        <p>Please visit us again.</p>
        <div class="divider"></div>
        <p>Please keep this receipt for your records.</p>
      </footer>
    </div>
  `;

  // ---------- Print styles (scoped to the iframe only) ----------
  const printCss = `
    @page { margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "Courier New", ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      line-height: 1.45;
      color: #111827;
      background: #ffffff;
    }
    .receipt-container { width: 320px; margin: 0 auto; padding: 20px 22px 24px; background: #ffffff; }
    p { margin: 0; }
    .shopInfoContainer { text-align: center; }
    .shopInfoContainer h1 {
      font-family: "Great Vibes", cursive;
      font-size: 32px;
      font-weight: 400;
      margin: 0 0 6px;
      letter-spacing: 0.02em;
    }
    .shop-location, .shop-phone { font-size: 11px; color: #374151; }
    .shop-time { margin-top: 6px; font-size: 10.5px; color: #6b7280; }
    .orderInfoContainer {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px dashed #9ca3af;
      font-size: 11px;
    }
    .orderInfoContainer > div { flex: 1 1 0; min-width: 0; }
    .labelAndValue { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .labelAndValue span:first-child { color: #6b7280; letter-spacing: 0.05em; white-space: nowrap; }
    .labelAndValue span:last-child { font-weight: 700; text-align: right; word-break: break-word; }
    .orderItemTable { margin-top: 14px; }
    .order-item-list { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
    .order-item-list th {
      padding: 4px 0 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6b7280;
      text-align: right;
      border-bottom: 1px dashed #9ca3af;
    }
    .order-item-list th:first-child { width: 44%; text-align: left; }
    .order-item-list th:nth-child(2) { width: 12%; }
    .order-item-list th:nth-child(3) { width: 22%; }
    .order-item-list th:nth-child(4) { width: 22%; }
    .order-item-list td { padding: 6px 0; text-align: right; vertical-align: top; word-break: break-word; }
    .order-item-list td:first-child { text-align: left; padding-right: 8px; }
    .item-name { display: block; font-weight: 700; }
    .item-meta { display: block; font-size: 9.5px; color: #6b7280; }
    .ruler { border-top: 1px dashed #9ca3af; margin: 10px 0; }
    .line { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 2px 0; }
    .line.net { margin-top: 6px; padding-top: 6px; border-top: 1px solid #111827; font-size: 14px; font-weight: 800; }
    .line.change { font-size: 14px; font-weight: 800; }
    .receipt-footer { margin-top: 16px; text-align: center; font-size: 11px; color: #374151; }
    .receipt-footer .thank-you { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .receipt-footer .divider { border-top: 1px dashed #9ca3af; margin: 10px 0; }
  `;

  // ---------- Create hidden iframe ----------
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.visibility = "hidden";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt</title>
        <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet" />
        <style>${printCss}</style>
      </head>
      <body>${receiptHtml}</body>
    </html>
  `);
  doc.close();

  // ---------- Trigger print once the iframe has rendered ----------
  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.error("Print failed:", err);
      alert("Could not open the print dialog. Please try again.");
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1200);
    }
  };

  // Give the iframe a tick to load fonts + apply layout
  if (iframe.contentWindow.document.readyState === "complete") {
    setTimeout(triggerPrint, 400);
  } else {
    iframe.addEventListener("load", () => setTimeout(triggerPrint, 400));
  }
}

/* ------------------------------------------------------------
   12. EXPORT CSV
   ------------------------------------------------------------ */
function exportCsv() {
  const filtered = getFilteredOrders();

  if (!filtered.length) {
    alert("No orders to export.");
    return;
  }

  const header = [
    "Order ID",
    "Date",
    "Time",
    "Cashier",
    "Items",
    "Subtotal",
    "Discount",
    "Tax",
    "Total",
    "Received",
    "Change",
    "Payment",
    "Status",
  ];

  const rows = filtered.map((o) => {
    const t = calcTotals(o);
    return [
      o.id,
      formatDate(o.date),
      formatTime(o.date),
      o.cashier || "",
      t.totalQty,
      t.subtotal,
      t.discount,
      t.tax,
      t.net,
      t.received,
      t.change,
      getPaymentMethod(o),
      getOrderStatus(o),
    ];
  });

  const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows]
    .map((r) => r.map(escapeCsv).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

// Notification click → navigate to requests
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

cashierFilter.addEventListener("change", () => {
  filterCashier = cashierFilter.value;
  currentPage = 1;
  renderTable();
});

paymentFilter.addEventListener("change", () => {
  filterPayment = paymentFilter.value;
  currentPage = 1;
  renderTable();
});

dateFromInput.addEventListener("change", () => {
  filterDateFrom = dateFromInput.value;
  currentPage = 1;
  renderTable();
});

dateToInput.addEventListener("change", () => {
  filterDateTo = dateToInput.value;
  currentPage = 1;
  renderTable();
});

resetFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  cashierFilter.value = "";
  paymentFilter.value = "";
  dateFromInput.value = "";
  dateToInput.value = "";
  searchQuery = "";
  filterCashier = "";
  filterPayment = "";
  filterDateFrom = "";
  filterDateTo = "";
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
  const totalPages = Math.ceil(getFilteredOrders().length / pageSize);
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
  const viewBtn = e.target.closest(".viewOrderBtn");
  if (viewBtn) {
    openOrderModal(viewBtn.dataset.id);
    return;
  }

  const printBtn = e.target.closest(".printOrderBtn");
  if (printBtn) {
    printOrderReceipt(printBtn.dataset.id);
    return;
  }
});

// Modal close
document
  .getElementById("modalCloseBtn")
  .addEventListener("click", closeOrderModal);
document
  .getElementById("cancelDetailBtn")
  .addEventListener("click", closeOrderModal);

// Print receipt from modal
document.getElementById("printReceiptBtn").addEventListener("click", () => {
  if (activeOrderId) printOrderReceipt(activeOrderId);
});

// Backdrop close
orderModal.addEventListener("click", (e) => {
  if (e.target === orderModal) closeOrderModal();
});

// Esc closes modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && orderModal.classList.contains("open")) {
    closeOrderModal();
  }
});

// Export / refresh
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document.getElementById("refreshBtn").addEventListener("click", () => {
  orders = loadOrders();
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
   14. INIT
   ------------------------------------------------------------ */
function init() {
  renderUserProfile();
  renderTable();
}

init();
