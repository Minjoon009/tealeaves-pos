/* ============================================================
   REPORTS & ANALYTICS PAGE
   Aggregates orderData for the selected date range + filters.
   ============================================================ */

/* ------------------------------------------------------------
   1. STORAGE
   ------------------------------------------------------------ */
const ORDER_KEY = "orderData";
const PRODUCT_KEY = "productData";
const USER_KEY = "userData";
const REQUEST_KEY = "stockRequests";

function loadOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDER_KEY)) || [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
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

function loadUsers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY)) || [];
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
const shortMoney = (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
};

/** Calculate net total for an order. */
function calcOrderTotal(order) {
  const products = order.products || [];
  const subtotal = products.reduce(
    (s, p) => s + (Number(p.qty) || 0) * (Number(p.price) || 0),
    0,
  );
  const discount = Number(order.discount) || 0;
  const taxRate = Number(order.taxRate) || 0;
  const tax = Math.round((subtotal - discount) * taxRate);
  return subtotal - discount + tax;
}

/** Count items sold in an order. */
function orderQty(order) {
  return (order.products || []).reduce((s, p) => s + (Number(p.qty) || 0), 0);
}

function getPaymentMethod(order) {
  return order.payment || "Cash";
}

/** Format YYYY-MM-DD as local date key. */
function dayKey(dateLike) {
  const d = new Date(dateLike);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateInput(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------
   3. STATE
   ------------------------------------------------------------ */
let orders = [];
let products = [];
let users = [];
let currentRange = "30d";
let filterFrom = "";
let filterTo = "";
let filterCashier = "";
let filterCategory = "";
let filterPayment = "";

// Chart instances
let trendChart = null;
let paymentChart = null;
let categoryChart = null;
let cashierChart = null;

/* ------------------------------------------------------------
   4. DOM REFS
   ------------------------------------------------------------ */
const summaryEl = document.getElementById("reportSummary");
const rangePresets = document.getElementById("rangePresets");
const dateRangeFields = document.getElementById("dateRangeFields");
const dateFromInput = document.getElementById("filterDateFrom");
const dateToInput = document.getElementById("filterDateTo");
const cashierFilterEl = document.getElementById("filterCashier");
const categoryFilterEl = document.getElementById("filterCategory");
const paymentFilterEl = document.getElementById("filterPayment");
const resetFiltersBtn = document.getElementById("resetFiltersBtn");
const topProductsBody = document.getElementById("topProductsBody");
const trendSubtitle = document.getElementById("trendSubtitle");

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
   6. DATE RANGE HELPERS
   ------------------------------------------------------------ */
function applyPreset(preset) {
  const now = new Date();
  let from = new Date();
  let to = new Date();

  switch (preset) {
    case "today": {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    }
    case "7d": {
      from = new Date(now);
      from.setDate(from.getDate() - 6);
      to = new Date(now);
      break;
    }
    case "30d": {
      from = new Date(now);
      from.setDate(from.getDate() - 29);
      to = new Date(now);
      break;
    }
    case "thisMonth": {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    }
    case "custom": {
      // Leave existing filterFrom / filterTo as-is
      dateRangeFields.hidden = false;
      return;
    }
  }

  filterFrom = formatDateInput(from);
  filterTo = formatDateInput(to);
  dateFromInput.value = filterFrom;
  dateToInput.value = filterTo;

  if (preset !== "custom") {
    dateRangeFields.hidden = true;
  }
}

/* ------------------------------------------------------------
   7. FILTERING
   ------------------------------------------------------------ */
function getFilteredOrders() {
  const fromTime = filterFrom
    ? new Date(filterFrom + "T00:00:00").getTime()
    : -Infinity;
  const toTime = filterTo
    ? new Date(filterTo + "T23:59:59").getTime()
    : Infinity;

  return orders.filter((o) => {
    const t = new Date(o.date).getTime();
    if (isNaN(t)) return false;
    if (t < fromTime || t > toTime) return false;

    if (filterCashier && String(o.cashier || "") !== filterCashier)
      return false;

    if (filterPayment && getPaymentMethod(o) !== filterPayment) return false;

    if (filterCategory) {
      const hasCat = (o.products || []).some(
        (p) => String(p.category || "") === filterCategory,
      );
      if (!hasCat) return false;
    }

    return true;
  });
}

/* ------------------------------------------------------------
   8. RENDER — SUMMARY CARDS
   ------------------------------------------------------------ */
function renderSummary(filtered) {
  const totalRevenue = filtered.reduce((s, o) => s + calcOrderTotal(o), 0);
  const totalOrders = filtered.length;
  const totalItems = filtered.reduce((s, o) => s + orderQty(o), 0);
  const avgOrder = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;

  const cards = [
    {
      label: "Total Revenue",
      value: money(totalRevenue),
      sub: "selected range",
      cls: "success",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    },
    {
      label: "Total Orders",
      value: numberFmt(totalOrders),
      sub: "transactions",
      cls: "primary",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    },
    {
      label: "Items Sold",
      value: numberFmt(totalItems),
      sub: "units total",
      cls: "info",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    },
    {
      label: "Avg. Order Value",
      value: money(avgOrder),
      sub: "per transaction",
      cls: "warning",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
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
   9. RENDER — TREND CHART
   ------------------------------------------------------------ */
function renderTrendChart(filtered) {
  // Group by day (or hour if range is <= 1 day)
  const dayMap = new Map();

  filtered.forEach((o) => {
    const k = dayKey(o.date);
    if (!k) return;
    if (!dayMap.has(k)) dayMap.set(k, { revenue: 0, orders: 0 });
    const entry = dayMap.get(k);
    entry.revenue += calcOrderTotal(o);
    entry.orders += 1;
  });

  // Sort keys
  const keys = [...dayMap.keys()].sort();

  // Fill empty days across the range for a smooth line
  const filled = [];
  if (keys.length) {
    const startDate = new Date(keys[0] + "T00:00:00");
    const endDate = new Date(keys[keys.length - 1] + "T00:00:00");
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
      const k = formatDateInput(cursor);
      const entry = dayMap.get(k) || { revenue: 0, orders: 0 };
      filled.push({ key: k, ...entry, date: new Date(cursor) });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const labels = filled.map((d) =>
    d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  );
  const revenue = filled.map((d) => d.revenue);
  const orderCounts = filled.map((d) => d.orders);

  trendSubtitle.textContent = filled.length
    ? `Daily totals from ${labels[0]} to ${labels[labels.length - 1]}.`
    : "No data for the selected range.";

  const ctx = document.getElementById("trendChart").getContext("2d");
  if (trendChart) trendChart.destroy();

  trendChart = new Chart(ctx, {
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Revenue (MMK)",
          data: revenue,
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          hoverBackgroundColor: "rgba(37, 99, 235, 1)",
          borderRadius: 6,
          barPercentage: 0.55,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Orders",
          data: orderCounts,
          borderColor: "#16a34a",
          backgroundColor: "rgba(22, 163, 74, 0.12)",
          borderWidth: 2.5,
          tension: 0.35,
          pointRadius: 3,
          pointBackgroundColor: "#16a34a",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          pointHoverRadius: 5,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "circle",
            font: { family: "Inter", size: 12, weight: "600" },
            color: "#64748b",
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.yAxisID === "y") {
                return `Revenue: ${money(ctx.parsed.y)}`;
              }
              return `Orders: ${ctx.parsed.y}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: "#94a3b8",
            font: { family: "Inter", size: 11, weight: "600" },
            maxRotation: 0,
            autoSkipPadding: 20,
          },
        },
        y: {
          position: "left",
          beginAtZero: true,
          grid: { color: "#f1f5f9", drawBorder: false },
          ticks: {
            color: "#94a3b8",
            font: { family: "Inter", size: 11 },
            callback: (v) => shortMoney(v),
          },
        },
        y1: {
          position: "right",
          beginAtZero: true,
          grid: { display: false },
          ticks: {
            color: "#94a3b8",
            font: { family: "Inter", size: 11 },
            precision: 0,
          },
        },
      },
    },
  });
}

/* ------------------------------------------------------------
   10. RENDER — PAYMENT CHART
   ------------------------------------------------------------ */
function renderPaymentChart(filtered) {
  const byMethod = {};
  filtered.forEach((o) => {
    const m = getPaymentMethod(o);
    byMethod[m] = (byMethod[m] || 0) + calcOrderTotal(o);
  });

  const labels = Object.keys(byMethod);
  const values = labels.map((k) => byMethod[k]);

  const colors = labels.map((l) => {
    const lower = l.toLowerCase();
    if (lower === "cash") return "#16a34a";
    if (lower === "card") return "#2563eb";
    if (lower === "wallet") return "#d97706";
    return "#94a3b8";
  });

  const ctx = document.getElementById("paymentChart").getContext("2d");
  if (paymentChart) paymentChart.destroy();

  paymentChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "circle",
            font: { family: "Inter", size: 12, weight: "600" },
            color: "#64748b",
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => `${ctx.label}: ${money(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

/* ------------------------------------------------------------
   11. RENDER — CATEGORY CHART
   ------------------------------------------------------------ */
function renderCategoryChart(filtered) {
  const byCategory = {};

  filtered.forEach((o) => {
    (o.products || []).forEach((p) => {
      const cat = p.category || "Uncategorized";
      const amount = (Number(p.qty) || 0) * (Number(p.price) || 0);
      byCategory[cat] = (byCategory[cat] || 0) + amount;
    });
  });

  const sortedEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const labels = sortedEntries.map((e) => e[0]);
  const values = sortedEntries.map((e) => e[1]);

  const palette = [
    "#2563eb",
    "#16a34a",
    "#d97706",
    "#dc2626",
    "#7c3aed",
    "#0d9488",
    "#ea580c",
    "#64748b",
  ];

  const colors = labels.map((_, i) => palette[i % palette.length]);

  const ctx = document.getElementById("categoryChart").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#ffffff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: "circle",
            font: { family: "Inter", size: 12, weight: "600" },
            color: "#64748b",
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => `${ctx.label}: ${money(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

/* ------------------------------------------------------------
   12. RENDER — CASHIER CHART
   ------------------------------------------------------------ */
function renderCashierChart(filtered) {
  const byCashier = {};
  filtered.forEach((o) => {
    const c = o.cashier || "Unknown";
    byCashier[c] = (byCashier[c] || 0) + calcOrderTotal(o);
  });

  const sortedEntries = Object.entries(byCashier).sort((a, b) => b[1] - a[1]);
  const labels = sortedEntries.map((e) => e[0]);
  const values = sortedEntries.map((e) => e[1]);

  const ctx = document.getElementById("cashierChart").getContext("2d");
  if (cashierChart) cashierChart.destroy();

  cashierChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue (MMK)",
          data: values,
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          hoverBackgroundColor: "rgba(37, 99, 235, 1)",
          borderRadius: 6,
          barPercentage: 0.55,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#111827",
          titleColor: "#f8fafc",
          bodyColor: "#e2e8f0",
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => `Revenue: ${money(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "#f1f5f9", drawBorder: false },
          ticks: {
            color: "#94a3b8",
            font: { family: "Inter", size: 11 },
            callback: (v) => shortMoney(v),
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: "#64748b",
            font: { family: "Inter", size: 12, weight: "600" },
          },
        },
      },
    },
  });
}

/* ------------------------------------------------------------
   13. RENDER — TOP PRODUCTS TABLE
   ------------------------------------------------------------ */
function renderTopProducts(filtered) {
  const byProduct = new Map();

  filtered.forEach((o) => {
    (o.products || []).forEach((p) => {
      const key = String(p.sku || p.name || "");
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          name: p.name || "—",
          sku: p.sku || "—",
          category: p.category || "—",
          qty: 0,
          revenue: 0,
        });
      }
      const entry = byProduct.get(key);
      entry.qty += Number(p.qty) || 0;
      entry.revenue += (Number(p.qty) || 0) * (Number(p.price) || 0);
    });
  });

  const list = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = list.reduce((s, p) => s + p.revenue, 0);

  if (!list.length) {
    topProductsBody.innerHTML = `<tr><td colspan="7" class="emptyState">No products sold in the selected range.</td></tr>`;
    return;
  }

  topProductsBody.innerHTML = list
    .slice(0, 20)
    .map((p, i) => {
      const rank = i + 1;
      const rankCls =
        rank === 1 ? "top1" : rank === 2 ? "top2" : rank === 3 ? "top3" : "";
      const share = totalRevenue ? (p.revenue / totalRevenue) * 100 : 0;

      return `
        <tr>
          <td class="rankCell ${rankCls}">#${rank}</td>
          <td>
            <div class="productInfoCell">
              <strong>${esc(p.name)}</strong>
            </div>
          </td>
          <td class="skuCell">${esc(p.sku)}</td>
          <td>${esc(p.category)}</td>
          <td class="revenueCell">${numberFmt(p.qty)}</td>
          <td class="revenueCell">${money(p.revenue)}</td>
          <td class="shareCell">
            <div>${share.toFixed(1)}%</div>
            <div class="shareBar"><div class="shareBarFill" style="width:${share}%"></div></div>
          </td>
        </tr>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   14. RENDER — CASHIER & CATEGORY FILTERS
   ------------------------------------------------------------ */
function renderFilterDropdowns() {
  // Cashiers from orderData
  const cashierNames = [
    ...new Set(orders.map((o) => o.cashier).filter(Boolean)),
  ].sort();
  cashierFilterEl.innerHTML =
    `<option value="">All Cashiers</option>` +
    cashierNames
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");

  // Categories
  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ].sort();
  categoryFilterEl.innerHTML =
    `<option value="">All Categories</option>` +
    categories
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
}

/* ------------------------------------------------------------
   15. MASTER RENDER
   ------------------------------------------------------------ */
function renderAll() {
  // Reload data each render so cross-tab edits show up
  orders = loadOrders();
  products = loadProducts();
  users = loadUsers();

  renderNotifications();
  renderFilterDropdowns();

  // Preserve filter selections after re-rendering the dropdowns
  cashierFilterEl.value = filterCashier;
  categoryFilterEl.value = filterCategory;

  const filtered = getFilteredOrders();

  renderSummary(filtered);
  renderTrendChart(filtered);
  renderPaymentChart(filtered);
  renderCategoryChart(filtered);
  renderCashierChart(filtered);
  renderTopProducts(filtered);
}

/* ------------------------------------------------------------
   16. EXPORT CSV
   ------------------------------------------------------------ */
function exportCsv() {
  const filtered = getFilteredOrders();
  const byProduct = new Map();

  filtered.forEach((o) => {
    (o.products || []).forEach((p) => {
      const key = String(p.sku || p.name || "");
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          name: p.name || "—",
          sku: p.sku || "—",
          category: p.category || "—",
          qty: 0,
          revenue: 0,
        });
      }
      const entry = byProduct.get(key);
      entry.qty += Number(p.qty) || 0;
      entry.revenue += (Number(p.qty) || 0) * (Number(p.price) || 0);
    });
  });

  const list = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue);

  const header = ["Rank", "Product", "SKU", "Category", "Qty Sold", "Revenue"];
  const rows = list.map((p, i) => [
    i + 1,
    p.name,
    p.sku,
    p.category,
    p.qty,
    p.revenue,
  ]);

  const escapeCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv =
    `Report: ${filterFrom} to ${filterTo}\n` +
    [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${filterFrom}-to-${filterTo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------
   17. EVENT LISTENERS
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

// Range presets
rangePresets.addEventListener("click", (e) => {
  const btn = e.target.closest(".rangeBtn");
  if (!btn) return;

  const preset = btn.dataset.range;
  currentRange = preset;

  rangePresets
    .querySelectorAll(".rangeBtn")
    .forEach((b) => b.classList.toggle("active", b === btn));

  if (preset === "custom") {
    dateRangeFields.hidden = false;
    // Keep whatever dates are currently in the inputs
    filterFrom = dateFromInput.value || filterFrom;
    filterTo = dateToInput.value || filterTo;
  } else {
    applyPreset(preset);
  }

  renderAll();
});

dateFromInput.addEventListener("change", () => {
  filterFrom = dateFromInput.value;
  renderAll();
});

dateToInput.addEventListener("change", () => {
  filterTo = dateToInput.value;
  renderAll();
});

// Other filters
cashierFilterEl.addEventListener("change", () => {
  filterCashier = cashierFilterEl.value;
  renderAll();
});

categoryFilterEl.addEventListener("change", () => {
  filterCategory = categoryFilterEl.value;
  renderAll();
});

paymentFilterEl.addEventListener("change", () => {
  filterPayment = paymentFilterEl.value;
  renderAll();
});

resetFiltersBtn.addEventListener("click", () => {
  filterCashier = "";
  filterCategory = "";
  filterPayment = "";
  cashierFilterEl.value = "";
  categoryFilterEl.value = "";
  paymentFilterEl.value = "";

  currentRange = "30d";
  rangePresets
    .querySelectorAll(".rangeBtn")
    .forEach((b) => b.classList.toggle("active", b.dataset.range === "30d"));
  applyPreset("30d");

  renderAll();
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
// Export & print
document.getElementById("exportBtn").addEventListener("click", exportCsv);
document
  .getElementById("printBtn")
  .addEventListener("click", () => window.print());
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
   18. INIT
   ------------------------------------------------------------ */
function init() {
  // Load data
  orders = loadOrders();
  products = loadProducts();
  users = loadUsers();
  renderUserProfile();
  // Apply default range
  applyPreset("30d");

  renderAll();
}

// Wait for Chart.js
if (window.Chart) {
  init();
} else {
  window.addEventListener("load", init);
}
