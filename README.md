# 🍽 Prem Nagri – A Modern Restaurant Ordering Platform

Prem Nagri is a complete, commercial-grade, and fully responsive web application tailored for restaurants.  
It delivers a seamless ordering experience for customers and a powerful, secure management dashboard for administrators.  
Built from the ground up using modern web technologies with a focus on security, performance, and an excellent user experience.

<p align="center">
  <a href="https://mess-project-3c021.web.app/"><img src="https://img.shields.io/badge/🌐-Live%20Demo-brightgreen" alt="Live Demo" /></a>
  <a href="https://github.com/XYZcode94/mess_project"><img src="https://img.shields.io/badge/📂-GitHub%20Repo-blue" alt="GitHub Repo" /></a>
</p>

---

## 📸 Screenshots

| Customer Website            | Admin Panel               |
|----------------------------|--------------------------|
| ![Home Page](screenshots/homepage.png)  | ![Admin Dashboard](screenshots/admin-dashboard.png) |
| ![Cart & Checkout](screenshots/cart.png) | ![Order Management](screenshots/orders.png)        |
| ![Profile Page](screenshots/profile.png) | ![Live Chat](screenshots/chat.png)                  |

---

## 🚀 Key Features

### 👩‍💻 Customer-Facing Website (`index.html`, `profile.html`)

- **High-Performance Menu**  
  Products are loaded in batches with a "Load More" button to ensure fast browsing.

- **Advanced Smart Search**  
  Client-side search supports partial matches, case-insensitive, and out-of-order word matching (e.g., searching "Chai Masala" finds "Masala Chai").

- **Search History**  
  Stores the last 5 unique searches locally for quick access.

- **Secure Customer Authentication**  
  Google Sign-In powered by Firebase Authentication.

- **Persistent Shopping Cart**  
  Cart saved in Firestore, enabling session continuity across devices.

- **Professional Cart UI**  
  Includes quantity controls, custom confirmation dialogs, and a dustbin icon for removing items.

- **"Pay on Delivery" Ordering System**  
  Orders saved securely with clear payment instructions.

- **Auditory Feedback**  
  Zomato-style order confirmation sound using Tone.js.

- **Geolocation for Delivery**  
  Auto-fetch delivery address using the browser Geolocation API combined with OpenStreetMap Nominatim API.

- **Complete User Profile Page**  
  Displays user info, interactive order history with accordion UI, live order tracker, and cancellation option for new orders.

- **Real-Time Chat & Notifications**  
  Private chat per order with notification badges for unread admin messages.

---

### 🛠 Admin Panel (`admin.html`, `orders.html`)

- **Separate Secure Authentication**  
  Isolated Firebase app instance for admin login, preventing session conflicts.

- **Role-Based Access Control (RBAC)**  
  Only users with `role: 'admin'` in the database can access the admin panel.

- **Full Menu Management (CRUD)**  
  Add, edit, and delete menu items through a user-friendly interface.

- **Professional Real-Time Order Dashboard**  
  Real-time order updates with filters by date ("Today", "This Week", "This Month") and status ("New", "In Progress", etc.).

- **Order Management**  
  One-click status updates using visual status pills. Cancelled orders are locked from modification.

- **Admin-Customer Chat**  
  Real-time chat per order with ability to send payment QR codes.

---

## 📊 Feature Overview

| Feature               | Customer | Admin |
|-----------------------|----------|-------|
| Google Sign-In        | ✅       | ✅     |
| Menu Browsing         | ✅       | ✅ (CRUD) |
| Search & History      | ✅       | ❌     |
| Persistent Cart       | ✅       | ❌     |
| Pay on Delivery       | ✅       | ❌     |
| Geolocation           | ✅       | ❌     |
| Order Status Tracking | ✅       | ✅     |
| Order Filters         | ❌       | ✅     |
| Real-Time Chat        | ✅       | ✅     |

---

## 🛠 Technology Stack

| Layer             | Technology / Library          | Purpose                         |
|-------------------|------------------------------|--------------------------------|
| Frontend          | HTML5, CSS3 (Flexbox/Grid)   | Responsive UI & animations     |
|                   | JavaScript (ES6 Modules)     | Client-side logic & UI          |
| Backend & Database | Firebase Firestore            | Real-time NoSQL data storage   |
| Authentication    | Firebase Authentication       | Secure user login/sign-up      |
| Hosting           | Firebase Hosting              | Fast, secure global hosting    |
| Notifications     | Toastify.js                  | User-friendly notifications    |
| Sound Effects     | Tone.js                      | Order confirmation sounds      |
| Geolocation       | Browser Geolocation API       | User location fetching          |
| Reverse Geocoding | OpenStreetMap Nominatim API  | Convert coordinates to address |

---

## 🚀 Getting Started

To run this project locally, you will need a Firebase project.

### 1. Clone the repository

```bash
git clone https://github.com/XYZcode94/mess_project.git
cd mess_project
