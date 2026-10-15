const demoUserData = [
  {
    username: "admin",
    email: "admin@example.com",
    password: "Admin@123",
    role: "admin",
  },
  {
    username: "John",
    email: "thiri@example.com",
    password: "Cashier@789",
    role: "cashier",
  },
];
const categoryData = [
  {
    id: "CAT-001",
    name: "Food",
    description: "",
    status: "Active",
    createdAt: "2026-10-14T05:12:05.834Z",
  },
];
const productData = [
  {
    id: 1,
    name: "Chicken Burger",
    sku: "FOD-001",
    category: "Food",
    price: 4500,
    stock: 20,
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
    status: "active",
    minStock: 10,
    description: "",
  },
  {
    id: 2,
    name: "Beef Burger",
    sku: "FOD-002",
    category: "Food",
    price: 5500,
    stock: 12,
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 3,
    name: "French Fries",
    sku: "FOD-003",
    category: "Food",
    price: 2500,
    stock: 25,
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 4,
    name: "Fried Chicken",
    sku: "FOD-004",
    category: "Food",
    price: 3500,
    stock: 19,
    image:
      "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 5,
    name: "Chicken Sandwich",
    sku: "FOD-005",
    category: "Food",
    price: 4000,
    stock: 10,
    image:
      "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 6,
    name: "Cheese Pizza",
    sku: "FOD-006",
    category: "Food",
    price: 7500,
    stock: 8,
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 7,
    name: "Pepperoni Pizza",
    sku: "FOD-007",
    category: "Food",
    price: 8500,
    stock: 6,
    image:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 8,
    name: "Spaghetti Bolognese",
    sku: "FOD-008",
    category: "Food",
    price: 6500,
    stock: 8,
    image:
      "https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 9,
    name: "Chicken Pasta",
    sku: "FOD-009",
    category: "Food",
    price: 7000,
    stock: 7,
    image:
      "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 10,
    name: "Chicken Fried Rice",
    sku: "FOD-010",
    category: "Food",
    price: 5000,
    stock: 14,
    image:
      "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 11,
    name: "Beef Fried Rice",
    sku: "FOD-011",
    category: "Food",
    price: 5500,
    stock: 11,
    image:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 12,
    name: "Chicken Noodles",
    sku: "FOD-012",
    category: "Food",
    price: 4500,
    stock: 13,
    image:
      "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 13,
    name: "Club Sandwich",
    sku: "FOD-013",
    category: "Food",
    price: 5500,
    stock: 8,
    image:
      "https://images.unsplash.com/photo-1521390188846-e2a3a97453a0?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 14,
    name: "Caesar Salad",
    sku: "FOD-014",
    category: "Food",
    price: 4500,
    stock: 5,
    image:
      "https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 15,
    name: "Fish and Chips",
    sku: "FOD-015",
    category: "Food",
    price: 6500,
    stock: 4,
    image:
      "https://images.unsplash.com/photo-1579208030886-b937da0925dc?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 16,
    name: "Hot Dog",
    sku: "FOD-016",
    category: "Food",
    price: 3500,
    stock: 16,
    image:
      "https://images.unsplash.com/photo-1612392062631-94dd858cba88?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 17,
    name: "Tacos",
    sku: "FOD-017",
    category: "Food",
    price: 5000,
    stock: 10,
    image:
      "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 18,
    name: "Pancakes",
    sku: "FOD-018",
    category: "Food",
    price: 3500,
    stock: 7,
    image:
      "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 19,
    name: "Waffles",
    sku: "FOD-019",
    category: "Food",
    price: 4000,
    stock: 6,
    image:
      "https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
  {
    id: 20,
    name: "Grilled Chicken",
    sku: "FOD-020",
    category: "Food",
    price: 6000,
    stock: 10,
    image:
      "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&q=80",
    status: "active",
  },
];

try {
  const btnLoadData = document.getElementById("btnLoadData");
  btnLoadData.addEventListener("click", () => {
    // console.log(demoUserData);
    localStorage.setItem("userData", JSON.stringify(demoUserData));
    localStorage.setItem("productData", JSON.stringify(productData));
    localStorage.setItem("categoryData", JSON.stringify(categoryData));
    alert("Data loaded successfully.");
  });
} catch (error) {
  console.log(error);
}
