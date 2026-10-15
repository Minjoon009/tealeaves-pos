/* ============================================================
   DASHBOARD — REAL LOCALSTORAGE DATA, RENDERING, CHART
   ============================================================ */

/* ------------------------------------------------------------
   1. DATA LOADING & HELPERS
   ------------------------------------------------------------ */

const LOW_STOCK_THRESHOLD = 10; // Default threshold if productData doesn't have one

function loadLocalStorageData() {
  const parse = (key, fallback) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      console.warn(`Error parsing localStorage key "${key}":`, e);
      return fallback;
    }
  };

  return {
    currentUser: parse("currentUser", {
      username: "Admin",
      email: "admin@example.com",
    }),
    orderData: parse("orderData", []),
    productData: parse("productData", []),
    stockRequests: parse("stockRequests", []),
  };
}

// Central data store
const DB = loadLocalStorageData();

/* ------------------------------------------------------------
   2. CALCULATION HELPERS
   ------------------------------------------------------------ */

const money = (value) => Number(value || 0).toLocaleString("en-US") + " MMK";

const shortMoney = (value) => {
  const n = Number(value || 0);
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
};

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

const formatTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Calculate total for a single order object */
function getOrderTotal(order) {
  const products = order.products || [];
  const subtotal = products.reduce(
    (sum, p) => sum + (p.qty || 0) * (p.price || 0),
    0,
  );
  const discount = Number(order.discount) || 0;
  const taxRate = Number(order.taxRate) || 0;
  const tax = Math.round((subtotal - discount) * taxRate);
  return subtotal - discount + tax;
}

/** Format status badge */
const statusBadge = (status) => {
  const map = {
    completed: { cls: "badgeSuccess", label: "Completed" },
    refunded: { cls: "badgeWarning", label: "Refunded" },
    cancelled: { cls: "badgeDanger", label: "Cancelled" },
    pending: { cls: "badgeInfo", label: "Pending" },
  };
  const s = map[status] || { cls: "badgeNeutral", label: status || "Unknown" };
  return `<span class="badge ${s.cls}"><span class="dot"></span>${s.label}</span>`;
};

/* ------------------------------------------------------------
   3. PROFILE & NOTIFICATIONS
   ------------------------------------------------------------ */

function renderUserProfile() {
  const user = DB.currentUser;
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

function renderNotifications() {
  const list = document.getElementById("notifList");
  const notifs = [];

  // 1. Low stock alerts
  DB.productData.forEach((p) => {
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
  const pendingReqs = DB.stockRequests.filter((r) => r.status === "pending");
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

/* ------------------------------------------------------------
   4. SUMMARY CARDS
   ------------------------------------------------------------ */

function renderSummaryCards() {
  const today = new Date().toDateString();

  // Today's Orders & Sales
  const todayOrders = DB.orderData.filter(
    (o) => new Date(o.date).toDateString() === today,
  );
  const todaySalesTotal = todayOrders.reduce(
    (sum, o) => sum + getOrderTotal(o),
    0,
  );

  // Total Products
  const totalProducts = DB.productData.length;

  // Low Stock
  const lowStockCount = DB.productData.filter(
    (p) => Number(p.stock) <= LOW_STOCK_THRESHOLD,
  ).length;

  // Pending Requests
  const pendingReqCount = DB.stockRequests.filter(
    (r) => r.status === "pending",
  ).length;

  const cards = [
    {
      key: "todaySales",
      label: "Today's Sales",
      value: money(todaySalesTotal),
      trend: 0,
      sub: "vs yesterday",
      iconClass: "primary",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    },
    {
      key: "todayOrders",
      label: "Today's Orders",
      value: String(todayOrders.length),
      trend: 0,
      sub: "vs yesterday",
      iconClass: "info",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    },
    {
      key: "totalProducts",
      label: "Total Products",
      value: String(totalProducts),
      trend: 0,
      sub: "this week",
      iconClass: "success",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    },
    {
      key: "lowStock",
      label: "Low-Stock Items",
      value: String(lowStockCount),
      trend: 0,
      sub: "vs last week",
      iconClass: "warning",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    },
    {
      key: "pendingReq",
      label: "Pending Requests",
      value: String(pendingReqCount),
      trend: 0,
      sub: "awaiting review",
      iconClass: "danger",
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
    },
  ];

  document.getElementById("summaryCards").innerHTML = cards
    .map((c) => {
      const trendCls = c.trend > 0 ? "up" : c.trend < 0 ? "down" : "flat";
      const trendText = "No change";

      return `
        <article class="summaryCard">
          <div class="summaryCardHead">
            <div class="summaryCardIcon ${c.iconClass}">${c.icon}</div>
            <span class="summaryCardTrend ${trendCls}">${trendText}</span>
          </div>
          <div class="summaryCardLabel">${c.label}</div>
          <div class="summaryCardValue">${c.value}</div>
          <div class="summaryCardSub">${esc(c.sub)}</div>
        </article>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   5. CHART — Aggregate real orderData
   ------------------------------------------------------------ */

let salesChart = null;
let currentRange = "7d";

function aggregateOrdersForChart(range) {
  const now = new Date();
  const todayStr = now.toDateString();
  const labels = [];
  const revenueData = [];
  const ordersData = [];

  if (range === "today") {
    // Group by hour for today
    const hours = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM
    const hourlyRevenue = {};
    const hourlyOrders = {};

    hours.forEach((h) => {
      hourlyRevenue[h] = 0;
      hourlyOrders[h] = 0;
    });

    DB.orderData.forEach((o) => {
      const d = new Date(o.date);
      if (d.toDateString() === todayStr) {
        const h = d.getHours();
        if (hourlyRevenue[h] !== undefined) {
          hourlyRevenue[h] += getOrderTotal(o);
          hourlyOrders[h] += 1;
        }
      }
    });

    hours.forEach((h) => {
      const period = h >= 12 ? "PM" : "AM";
      const displayH = h > 12 ? h - 12 : h;
      labels.push(`${displayH} ${period}`);
      revenueData.push(hourlyRevenue[h]);
      ordersData.push(hourlyOrders[h]);
    });
  } else {
    // Group by day for "7d" or "30d"
    const days = range === "7d" ? 7 : 30;
    const dailyRevenue = {};
    const dailyOrders = {};

    // Initialize last N days
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      dailyRevenue[key] = 0;
      dailyOrders[key] = 0;
    }

    DB.orderData.forEach((o) => {
      const d = new Date(o.date);
      const key = d.toDateString();
      if (dailyRevenue[key] !== undefined) {
        dailyRevenue[key] += getOrderTotal(o);
        dailyOrders[key] += 1;
      }
    });

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();

      if (range === "7d") {
        labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
      } else {
        labels.push(
          d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        );
      }
      revenueData.push(dailyRevenue[key]);
      ordersData.push(dailyOrders[key]);
    }
  }

  return {
    labels,
    revenue: revenueData,
    orders: ordersData,
    totals: {
      revenue: revenueData.reduce((s, v) => s + v, 0),
      orders: ordersData.reduce((s, v) => s + v, 0),
    },
  };
}

function updateChartSummary(range) {
  const data = aggregateOrdersForChart(range);
  const avg = data.totals.orders
    ? Math.round(data.totals.revenue / data.totals.orders)
    : 0;

  document.getElementById("chartRevenue").textContent = money(
    data.totals.revenue,
  );
  document.getElementById("chartOrders").textContent = data.totals.orders;
  document.getElementById("chartAvg").textContent = money(avg);
}

function renderChart(range) {
  const data = aggregateOrdersForChart(range);
  const ctx = document.getElementById("salesChart").getContext("2d");

  if (salesChart) {
    salesChart.destroy();
  }

  salesChart = new Chart(ctx, {
    data: {
      labels: data.labels,
      datasets: [
        {
          type: "bar",
          label: "Revenue (MMK)",
          data: data.revenue,
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          hoverBackgroundColor: "rgba(37, 99, 235, 1)",
          borderRadius: 6,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Orders",
          data: data.orders,
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
          titleFont: { family: "Inter", size: 12, weight: "700" },
          bodyFont: { family: "Inter", size: 12 },
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

  updateChartSummary(range);
}

/* ------------------------------------------------------------
   6. RECENT ORDERS
   ------------------------------------------------------------ */

function renderRecentOrders() {
  const body = document.getElementById("recentOrdersBody");
  const recent = [...DB.orderData]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (recent.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="emptyState">No orders found.</td></tr>`;
    return;
  }

  body.innerHTML = recent
    .map(
      (o) => `
      <tr>
        <td>${esc(o.id)}</td>
        <td>${formatTime(o.date)}</td>
        <td>${esc(o.cashier)}</td>
        <td class="amount">${money(getOrderTotal(o))}</td>
        <td>Cash</td>
        <td>${statusBadge("completed")}</td>
        <td>
          <button class="rowAction" type="button" aria-label="View order" data-order-id="${esc(o.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </td>
      </tr>
    `,
    )
    .join("");
}

/* ------------------------------------------------------------
   7. LOW STOCK
   ------------------------------------------------------------ */

function renderLowStock() {
  const list = document.getElementById("lowStockList");
  const items = DB.productData
    .filter((p) => Number(p.stock) <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => Number(a.stock) - Number(b.stock))
    .slice(0, 5);

  if (items.length === 0) {
    list.innerHTML = `
      <li class="emptyState">
        <div class="emptyIcon">✅</div>
        <p>All stock levels are healthy</p>
        <span>No items need restocking right now.</span>
      </li>
    `;
    return;
  }

  list.innerHTML = items
    .map((p) => {
      const out = Number(p.stock) === 0;
      const qtyCls = out ? "out" : "low";
      // Use an emoji fallback since we might not have images in localStorage
      const emoji = p.image ? p.image : "📦";

      return `
        <li class="alertItem" data-sku="${esc(p.sku)}">
          <span class="alertThumb">${emoji === "" ? "📦" : '<img src="' + emoji + '" alt="">'}</span>
          <div class="alertBody">
            <div class="alertName">${esc(p.name)}</div>
            <div class="alertMeta">${esc(p.sku)}</div>
          </div>
          <div class="alertStock">
            <span class="alertQty ${qtyCls}">${p.stock}</span>
            <span class="alertThreshold">min ${LOW_STOCK_THRESHOLD}</span>
          </div>
        </li>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   8. PENDING REQUESTS
   ------------------------------------------------------------ */

function renderPendingRequests() {
  const list = document.getElementById("pendingRequestsList");
  const items = DB.stockRequests
    .filter((r) => r.status === "pending")
    .slice(0, 5);

  if (items.length === 0) {
    list.innerHTML = `
      <li class="emptyState">
        <div class="emptyIcon">🎉</div>
        <p>No pending requests</p>
        <span>All cashier requests have been reviewed.</span>
      </li>
    `;
    return;
  }

  list.innerHTML = items
    .map((r) => {
      const isStock = r.type === "add-stock";
      const iconCls = isStock ? "stock" : "new";
      const icon = isStock ? "📦" : "✨";
      const label = isStock ? "Add Stock" : "New Product";

      // Calculate time ago
      const diff = Date.now() - new Date(r.createdAt || Date.now()).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const timeAgo =
        hours < 1
          ? "Just now"
          : hours < 24
            ? `${hours}h ago`
            : `${Math.floor(hours / 24)}d ago`;

      return `
        <li class="requestItem" data-request-id="${esc(r.id)}">
          <span class="requestIcon ${iconCls}">${icon}</span>
          <div class="requestBody">
            <div class="requestTitle">${esc(r.productName)}</div>
            <div class="requestSub">${label} • ${esc(r.cashier || "Cashier")}</div>
            <div class="requestTime">${timeAgo}</div>
          </div>
          <span class="requestQty">+${r.quantity}</span>
        </li>
      `;
    })
    .join("");
}

/* ------------------------------------------------------------
   9. INTERACTIONS
   ------------------------------------------------------------ */

/* ---- sidebar toggle (mobile) ---- */
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

/* ---- dropdowns ---- */
function closeAllDropdowns() {
  document.querySelectorAll(".dropdown.open").forEach((d) => {
    d.classList.remove("open");
  });
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

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllDropdowns();
});

/* ---- range tabs ---- */
document.getElementById("rangeTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".rangeTab");
  if (!tab) return;

  const range = tab.dataset.range;
  if (range === currentRange) return;

  currentRange = range;

  document
    .querySelectorAll(".rangeTab")
    .forEach((t) => t.classList.toggle("active", t === tab));

  renderChart(range);
});

/* ---- refresh button ---- */
document.getElementById("refreshBtn").addEventListener("click", () => {
  // Reload data from localStorage to reflect any external changes
  Object.assign(DB, loadLocalStorageData());

  renderUserProfile();
  renderSummaryCards();
  renderChart(currentRange);
  renderRecentOrders();
  renderLowStock();
  renderPendingRequests();
  renderNotifications();
});

/* ---- row actions (view order / view request / view product) ---- */
document.addEventListener("click", (e) => {
  const rowBtn = e.target.closest(".rowAction");
  if (rowBtn) {
    const id = rowBtn.dataset.orderId;
    console.log("View order:", id);
    // In production: window.location.href = `./orders.html?id=${id}`;
  }

  const requestItem = e.target.closest(".requestItem");
  if (requestItem) {
    const id = requestItem.dataset.requestId;
    console.log("Open request:", id);
    // window.location.href = `./cashierRequests.html?id=${id}`;
  }

  const alertItem = e.target.closest(".alertItem");
  if (alertItem) {
    const sku = alertItem.dataset.sku;
    console.log("Open inventory item:", sku);
    // window.location.href = `./inventory.html?sku=${sku}`;
  }
});

/* ------------------------------------------------------------
   10. INIT
   ------------------------------------------------------------ */

function init() {
  renderUserProfile();
  renderSummaryCards();
  renderRecentOrders();
  renderLowStock();
  renderPendingRequests();
  renderNotifications();

  // Chart must wait for Chart.js to load
  if (window.Chart) {
    renderChart(currentRange);
  } else {
    window.addEventListener("load", () => renderChart(currentRange));
  }
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

init();
