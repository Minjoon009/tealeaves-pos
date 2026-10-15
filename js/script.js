const currentUser = JSON.parse(localStorage.getItem("currentUser")) ?? [];
if (currentUser.length != 0) {
  if (currentUser.role == "admin") {
    window.location = "./pages/Admin/dashboard.html";
  } else {
    window.location = "./pages/Cashier/home.html";
  }
} else {
  window.location = "./pages/Authentication/Login.html";
}
