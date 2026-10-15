const currentUserData = JSON.parse(localStorage.getItem("currentUser")) ?? [];
const adminPage = [
  "dashboard.html",
  "cashierRequests.html",
  "cashierManagement.html",
  "categories.html",
  "settings.html",
  "inventory.html",
  "orders.html",
  "products.html",
  "reports.html",
];
const cashierPage = [
  "home.html",
  "history.html",
  "receipt.html",
  "requestProduct.html",
];

if (currentUserData.length != 0) {
  if (adminPage.includes(window.location.href.split("/").pop())) {
    if (currentUserData.role != "admin") {
      window.location = "../Authentication/Error.html?You are not an admin.";
    }
  }
  if (cashierPage.includes(window.location.href.split("/").pop())) {
    if (currentUserData.role != "cashier") {
      window.location = "../Authentication/Error.html?You are not a cashier.";
    }
  }
} else {
  window.location = "../Authentication/Login.html";
}
