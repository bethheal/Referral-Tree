export const menuItems = [
  { label: "Overview", icon: "house", slug: "overview" },
  { label: "My Referrals", icon: "user-group", slug: "my-referrals" },
  { label: "Referral Tree", icon: "sitemap", slug: "referral-tree" },
  { label: "Points & Earnings", icon: "coins", slug: "points-earnings" },
  { label: "Rewards", icon: "gift", slug: "rewards" },
  { label: "Orders", icon: "receipt", slug: "orders" },
  { label: "Notifications", icon: "bell", slug: "notifications" },
  { label: "Profile", icon: "user", slug: "profile" },
];

export const bottomNavItems = [
  { label: "Products", icon: "bag-shopping", slug: "products" },
  { label: "Cart", icon: "cart-shopping", slug: "cart" },
  { label: "Home", icon: "house", slug: "home" },
  { label: "Payments", icon: "credit-card", slug: "payments" },
  { label: "Profile", icon: "user", slug: "profile" },
];

export const products = [
  {
    name: "Organic Rice",
    price: 180,
    category: "Grains",
    unit: "5kg bag",
    rating: 4.8,
    description: "Premium long grain rice for everyday family meals.",
    color: "#F9C74F",
    icon: "bowl-rice",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Fresh Oil",
    price: 120,
    category: "Pantry",
    unit: "1 litre",
    rating: 4.6,
    description: "Clean cooking oil for frying, stews, and quick meals.",
    color: "#90BE6D",
    icon: "bottle-droplet",
    image:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Honey Jar",
    price: 95,
    category: "Sweet",
    unit: "500g jar",
    rating: 4.9,
    description: "Golden honey for breakfast, tea, and healthy snacks.",
    color: "#F8961E",
    icon: "jar",
    image:
      "https://images.unsplash.com/photo-1587049352846-4a222e784d38?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Brown Beans",
    price: 150,
    category: "Grains",
    unit: "2kg pack",
    rating: 4.7,
    description: "Nutritious brown beans sorted and ready to cook.",
    color: "#577590",
    icon: "seedling",
    image:
      "https://images.unsplash.com/photo-1515543904379-3d757afe72e4?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Tomato Paste",
    price: 55,
    category: "Pantry",
    unit: "6 tins",
    rating: 4.5,
    description: "Rich tomato base for jollof, soups, and sauces.",
    color: "#C23122",
    icon: "box",
    image:
      "https://images.unsplash.com/photo-1607305387299-a3d9611cd469?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Plantain Chips",
    price: 35,
    category: "Snack",
    unit: "family pack",
    rating: 4.6,
    description: "Crispy plantain chips for a quick sweet-salty snack.",
    color: "#D7B126",
    icon: "cookie",
    image:
      "https://images.unsplash.com/photo-1599490659213-e2b9527bd087?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Millet Flour",
    price: 85,
    category: "Grains",
    unit: "1kg pack",
    rating: 4.4,
    description: "Finely milled flour for porridge and local recipes.",
    color: "#C9A66B",
    icon: "wheat-awn",
    image:
      "https://images.unsplash.com/photo-1627485937980-221c88ac04f9?auto=format&fit=crop&w=500&q=80",
  },
  {
    name: "Cocoa Powder",
    price: 110,
    category: "Sweet",
    unit: "750g pouch",
    rating: 4.8,
    description: "Deep cocoa flavor for drinks, baking, and desserts.",
    color: "#6F4E37",
    icon: "mug-hot",
    image:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=500&q=80",
  },
];

export const formatGhs = (amount: number) =>
  `GHS ${amount.toLocaleString("en-GH", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })}`;

export const orders = [
  { id: "#AF-1024", status: "Delivered", total: "GHS 420" },
  { id: "#AF-1025", status: "Processing", total: "GHS 310" },
  { id: "#AF-1026", status: "Packed", total: "GHS 240" },
];

export const sectionContent = {
  overview: {
    title: "Overview",
    items: ["24 active referrals", "1,250 reward points", "GHS 860 earnings"],
  },
  "my-referrals": {
    title: "My Referrals",
    items: ["Ama joined today", "Kofi placed first order", "5 pending invites"],
  },
  "referral-tree": {
    title: "Referral Tree",
    items: ["Level 1: 12 members", "Level 2: 8 members", "Level 3: 4 members"],
  },
  "points-earnings": {
    title: "Points & Earnings",
    items: ["1,250 points available", "GHS 860 earned", "GHS 120 pending payout"],
  },
  rewards: {
    title: "Rewards",
    items: ["Free delivery unlocked", "10% cart discount", "Refer 3 more for bonus"],
  },
  orders: {
    title: "Orders",
    items: orders.map((order) => `${order.id} - ${order.status} - ${order.total}`),
  },
  notifications: {
    title: "Notifications",
    items: ["Order #AF-1025 is processing", "You earned 50 points", "New reward available"],
  },
  profile: {
    title: "Profile",
    items: ["Jennifer", "jennifer@example.com", "Gold member"],
  },
  products: {
    title: "Products",
    items: products.map((product) => `${product.name} - ${formatGhs(product.price)}`),
  },
  cart: {
    title: "Cart",
    items: ["Organic Rice x1", "Fresh Oil x1", "Honey Jar x1", "Estimated total GHS 395"],
  },
  payments: {
    title: "Payments",
    items: ["Visa ending 1234", "Mastercard ending 8821", "Default card: Visa"],
  },
};
