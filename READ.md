# READ.md — Tea Leaves POS (Getting Started)

A Point-of-Sale (POS) web app built with **plain HTML, CSS and JavaScript only**.
There is no backend, no build step and no npm dependencies — all data is stored in
the browser's `localStorage`.

---

## 1. Requirements

- A modern browser (Chrome / Edge / Firefox).
- Optional but **recommended**: [VS Code](https://code.visualstudio.com/) with the
  **Live Server** extension (or any local static file server).
- Internet connection is only needed for Google Fonts and product images (Unsplash).

## 2. How to start the website

### Option A — VS Code Live Server (recommended)

1. Open the project folder `e:\POS (HTML, CSS, JS)` in VS Code.
2. Open `index.html`.
3. Right-click inside the editor → **Open with Live Server**
   (or click **Go Live** in the status bar).
4. The browser opens at `http://127.0.0.1:5500/` and you are redirected to the
   login page automatically.

### Option B — Any static server

From the project root (`e:\POS (HTML, CSS, JS)`), run one of:

```bash
npx serve .
# or
python -m http.server 5500
```

Then open `http://localhost:5500/`.

> **Why a server instead of double-clicking the file?**
> Opening via `file://` mostly works, but the **Logout** button redirects to `/`
> (the site root), which does not resolve correctly when the site is opened as
> local files. Use a local server to avoid this.

## 3. Load the demo data (first run)

The app starts empty — you must load the demo data once before you can log in.

1. Go to the login page (`pages/Authentication/Login.html`).
   `index.html` will send you there automatically on first visit.
2. Click the **Load Data** button (`#btnLoadData`, the button under the Login
   button).
3. You should see the alert **"Data loaded successfully."**
4. **Refresh the page (F5)** before logging in.

The **Load Data** button (implemented in `pages/Authentication/data/data.js`)
writes the following demo data into `localStorage`:

| Key            | Contents                                         |
| -------------- | ------------------------------------------------ |
| `userData`     | 2 demo users (1 admin, 1 cashier)                |
| `productData`  | 20 demo products (food menu with prices & stock) |
| `categoryData` | 1 demo category (`Food`)                         |

> ⚠️ **Important — always refresh after clicking Load Data.**
> The login script reads `userData` from `localStorage` **once, when the page
> loads**. If you click _Load Data_ and then click _Login_ without refreshing,
> the login form still holds the old (empty) user list and will show
> **"Invalid credentials"**. Refresh the page, then log in.

You can click **Load Data** again at any time to reset the users, products and
categories back to the demo defaults (existing orders are kept).

## 4. Demo login credentials

Enter the **email** and password in the login form (the form validates by email,
not by username):

### Admin

| Field    | Value               |
| -------- | ------------------- |
| Username | `admin`             |
| Email    | `admin@example.com` |
| Password | `Admin@123`         |
| Role     | `admin`             |

After login you land on **`pages/Admin/dashboard.html`** (full admin panel:
dashboard, products, categories, inventory, orders, reports, settings, cashier
management & requests).

### Cashier

| Field    | Value              |
| -------- | ------------------ |
| Username | `John`             |
| Email    | `john@example.com` |
| Password | `Cashier@123`      |
| Role     | `cashier`          |

After login you land on **`pages/Cashier/home.html`** (POS screen, order history,
receipts, product requests).

These users come from `demoUserData` in `pages/Authentication/data/data.js`.

## 5. How routing & access control works

- **`index.html`** (+ `js/script.js`) — entry point/router:
  - logged in as `admin` → `pages/Admin/dashboard.html`
  - logged in as `cashier` → `pages/Cashier/home.html`
  - not logged in → `pages/Authentication/Login.html`
- **`pages/Authentication/auth.js`** — included by the app pages:
  - no `currentUser` in `localStorage` → redirects to the login page.
  - opening an **admin page** while logged in as cashier → `Error.html`
    ("You are not an admin.").
  - opening a **cashier page** while logged in as admin → `Error.html`
    ("You are not a cashier.").
- **Logout** — the _Logout_ button in the sidebar/nav clears the `currentUser`
  key and returns to the site root (→ login page).

## 6. Project structure

```
e:\POS (HTML, CSS, JS)\
├── index.html                     # Entry point (redirects by role)
├── js\
│   └── script.js                  # Entry-point router
└── pages\
    ├── Authentication\
    │   ├── Login.html             # Login form + Load Data button
    │   ├── Error.html             # Access-denied / error page
    │   ├── auth.js                # Role guard for all pages
    │   ├── css\style.css
    │   └── data\data.js           # Demo data + btnLoadData handler
    ├── Admin\
    │   ├── dashboard.html         # + products, categories, inventory,
    │   │                          #   orders, reports, settings,
    │   │                          #   cashierManagement, cashierRequests
    │   ├── script\*.js            # One JS file per page
    │   └── style\*.css            # One CSS file per page
    └── Cashier\
        ├── home.html              # + history, receipt, requestProduct, test
        ├── style\*.css
        └── assets\                # Images & fonts
```

## 7. Data storage (localStorage keys)

All app state lives in the browser's `localStorage`:

| Key             | Set by                         | Used for                            |
| --------------- | ------------------------------ | ----------------------------------- |
| `userData`      | Load Data button               | Registered users (login validation) |
| `currentUser`   | Login button                   | Current session (role-based access) |
| `productData`   | Load Data button / admin pages | Product catalog, stock, prices      |
| `categoryData`  | Load Data button               | Product categories                  |
| `orderData`     | Cashier POS / receipt pages    | Placed orders / sales history       |
| `stockRequests` | Inventory / request pages      | Stock replenishment requests        |

### Reset everything

Open the browser DevTools (**F12**) → **Console** and run:

```js
localStorage.clear();
location.reload();
```

Then click **Load Data** on the login page again to restore the demo data.

## 8. Troubleshooting

| Problem                                        | Fix                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| "Invalid credentials" right after loading data | **Refresh the login page (F5)**, then log in again.                                |
| "Data loaded successfully" never appears       | Make sure you are on `pages/Authentication/Login.html`.                            |
| Redirected to `Error.html`                     | You are logged in with the wrong role — log out and use the matching demo account. |
| Redirected straight to the login page          | No `currentUser` session — log in (and load demo data first).                      |
| Empty product list / empty POS screen          | Click **Load Data** on the login page first.                                       |
| Logout lands on a broken page (`file:///`)     | Serve the site with Live Server / a local server instead.                          |
| Images or fonts missing                        | Check your internet connection (CDN resources).                                    |
