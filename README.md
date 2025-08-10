# 🍽 Prem Nagri – Modern Restaurant Ordering Platform

![Firebase](https://img.shields.io/badge/Backend-Firebase-orange)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-yellow)
![HTML5](https://img.shields.io/badge/HTML5-✔-blue)
![CSS3](https://img.shields.io/badge/CSS3-✔-purple)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Live-brightgreen)

Prem Nagri is a **complete, commercial-grade, and fully responsive** restaurant web application.  
It offers a **seamless ordering experience for customers** and a **secure, feature-rich admin panel** for restaurant staff.

**Live Demo:** [mess-project.vercel.app](https://mess-project.vercel.app/)  
**GitHub Repo:** [mess_project](https://github.com/XYZcode94/mess_project)

---

## 📸 Screenshots

### Customer Website
![Home Page](screenshots/homepage.png)
![Cart & Checkout](screenshots/cart.png)
![Profile Page](screenshots/profile.png)

### Admin Panel
![Admin Dashboard](screenshots/admin-dashboard.png)
![Order Management](screenshots/orders.png)

---

## 🏗 Architecture Overview

![Architecture Diagram](screenshots/architecture-diagram.png)

**Flow:**
1. **Customer Website** → Firebase Authentication → Firestore (Products, Orders, Chats)
2. **Admin Panel** → Separate Firebase Auth Instance → Firestore (Menu Management, Order Management)
3. **Both Sides** communicate with Firestore in real-time.

---

## 🚀 Features

### 🍴 Customer-Facing Website
- **High-Performance Menu** – Paginated product loading with "Load More" button.
- **Smart Search** – Case-insensitive, partial, and out-of-order search.
- **Search History** – Saves last 5 searches locally.
- **Google Sign-In** – Secure authentication via Firebase.
- **Persistent Cart** – Saved to Firestore for cross-device access.
- **"Pay on Delivery" Orders** – Orders saved with payment instructions.
- **Zomato-Style Sound** – Tone.js sound effect for order placement.
- **Geolocation Delivery** – Auto-fetch address using OpenStreetMap.
- **Full Profile Page** – Personal info, order history, cancel option, live progress.
- **Real-Time Chat & Notifications** – Per-order chat with unread message indicators.

### 🛠 Admin Panel
- **Separate Firebase Auth** – Isolated admin login.
- **Role-Based Access Control** – Only `role: 'admin'` users allowed.
- **Full Menu Management (CRUD)** – Add, edit, delete menu items.
- **Real-Time Orders Dashboard** – Date & status filters + live updates.
- **Order Status Pills** – One-click status change with lock for cancelled orders.
- **Admin-Customer Chat** – Direct per-order messaging + payment QR.

---

## 🛠 Technology Stack

**Frontend:**  
- HTML5, CSS3 (Flexbox, Grid, animations)
- JavaScript (ES6 Modules)

**Backend & Database:**  
- Firebase Hosting  
- Firebase Authentication  
- Firestore (NoSQL, real-time updates)

**Libraries & APIs:**  
- [Toastify.js](https://apvarun.github.io/toastify-js/) – Notifications  
- [Tone.js](https://tonejs.github.io/) – Audio effects  
- [OpenStreetMap Nominatim API](https://nominatim.openstreetmap.org/) – Reverse geocoding  

---

## 📦 Getting Started

1. **Clone Repository**
   ```bash
   git clone https://github.com/XYZcode94/mess_project.git
   cd mess_project
