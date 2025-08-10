# 🍽 Prem Nagri – Modern Restaurant Ordering Platform

A complete, commercial-grade, fully responsive restaurant ordering system.  
Delivering a smooth **customer experience** alongside a secure, powerful **admin panel**.

<p align="center">
  <a href="https://mess-project.vercel.app/"><img src="https://img.shields.io/badge/🌐-Live%20Demo-brightgreen" alt="Live Demo" /></a>
  <a href="https://github.com/XYZcode94/mess_project"><img src="https://img.shields.io/badge/📂-GitHub%20Repo-blue" alt="GitHub Repo" /></a>
</p>

---

## 📸 Screenshots

| Customer Website                   | Admin Panel                  |
| -------------------------------- | ----------------------------|
| ![Home Page](screenshots/homepage.png)         | ![Admin Dashboard](screenshots/admin-dashboard.png)     |
| ![Cart & Checkout](screenshots/cart.png)       | ![Order Management](screenshots/orders.png)             |
| ![Profile Page](screenshots/profile.png)       | ![Live Chat](screenshots/chat.png)                       |

---

## 🏗 Architecture

![Architecture Diagram](screenshots/architecture-diagram.png)  
*Both Customer and Admin apps connect to Firebase for authentication, real-time data sync, and hosting.*

---

## 🚀 Key Features

### 👨‍🍳 Customer Website

- **High-Performance Menu with Pagination**  
- **Smart Search:** Partial, case-insensitive, out-of-order matching (e.g. “Chai Masala” finds “Masala Chai”)  
- **Search History:** Last 5 unique searches stored locally  
- **Secure Google Authentication** via Firebase  
- **Persistent Cart** synced across devices via Firestore  
- **Pay on Delivery:** Orders saved with clear payment instructions  
- **Zomato-Style Order Sound:** Tone.js feedback on successful orders  
- **Geolocation Delivery:** Auto-address fetching using OpenStreetMap Nominatim API  
- **Profile Page:** Order history, real-time tracker, and cancel option for new orders  
- **Real-Time Chat & Notifications:** Per-order messaging with unread message badges  

### 🛠 Admin Panel

- **Separate Firebase Auth Instance** for admins  
- **Role-Based Access Control:** Only users with `role: admin` have access  
- **Full Menu Management (CRUD):** Add, edit, and delete menu items  
- **Real-Time Orders Dashboard:** Filters by date and status, search by customer info  
- **One-Click Status Updates:** Visual status pills, cancelled orders locked  
- **Admin-Customer Chat:** Order-specific messaging with payment QR code sharing  

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

## 📦 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/XYZcode94/mess_project.git
cd mess_project
