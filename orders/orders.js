// orders.js (with Corrected Logout Redirect)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, doc, updateDoc, query, orderBy, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
        apiKey: "AIzaSyCaFan1ZaRDsHTaR5O2m9KmWLy0nSp3L1o",
        authDomain: "mess-project-3c021.firebaseapp.com",
        projectId: "mess-project-3c021",
        storageBucket: "mess-project-3c021.firebasestorage.app",
        messagingSenderId: "428617648708",
        appId: "1:428617648708:web:e5bf65bb56e89ae14b8a11",
        measurementId: "G-GFTQ6G6ZVJ"
    };


    const adminApp = initializeApp(firebaseConfig, 'adminApp');
    const db = getFirestore(adminApp);
    const adminAuth = getAuth(adminApp);
    enableIndexedDbPersistence(db).catch((err) => { console.error("Firestore persistence error: ", err); });
    const ordersCollectionRef = collection(db, 'orders');

    const adminPanelWrapper = document.getElementById('admin-panel-wrapper');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const ordersContainer = document.getElementById('orders-list-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const newCountSpan = document.getElementById('new-count');
    const progressCountSpan = document.getElementById('progress-count');

    let allOrders = [];
    let currentFilter = 'all';

    // --- AUTHENTICATION & LOGOUT ---
    onAuthStateChanged(adminAuth, user => {
        if (user) {
            adminPanelWrapper.classList.remove('hidden');
            listenForOrders();
        } else {
            // This still handles the initial check if a logged-out user tries to access the page
            window.location.href = 'admin.html';
        }
    });

    // --- THIS IS THE FIX ---
    adminLogoutBtn.addEventListener('click', () => {
        signOut(adminAuth).then(() => {
            // This code runs AFTER the user is successfully signed out
            console.log('Admin signed out, redirecting...');
            window.location.href = 'admin.html';
        }).catch(error => {
            console.error("Admin Logout failed:", error);
        });
    });

    // --- ORDER DISPLAY & FILTERING (Unchanged) ---
    function listenForOrders() {
        const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
        onSnapshot(q, (snapshot) => {
            allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateFilterCounts();
            renderFilteredOrders();
        });
    }

    function renderFilteredOrders() {
        ordersContainer.innerHTML = '';
        const filteredOrders = allOrders.filter(order => {
            if (currentFilter === 'all') return true;
            return order.status === currentFilter;
        });
        if (filteredOrders.length === 0) {
            ordersContainer.innerHTML = `<p>No orders found for the "${currentFilter}" filter.</p>`;
            return;
        }
        filteredOrders.forEach(order => {
            const orderCard = createOrderCard(order);
            ordersContainer.appendChild(orderCard);
        });
    }
    
    function updateFilterCounts() {
        const newCount = allOrders.filter(o => o.status === 'new').length;
        const progressCount = allOrders.filter(o => o.status === 'in-progress').length;
        newCountSpan.textContent = `(${newCount})`;
        progressCountSpan.textContent = `(${progressCount})`;
    }

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.status;
            renderFilteredOrders();
        });
    });

    function createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';
        const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'N/A';
        const itemsTable = order.items.map(item => `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td class="item-total">₹${(item.quantity * item.price).toFixed(2)}</td>
            </tr>
        `).join('');
        card.innerHTML = `
            <div class="order-header">
                <h3>Order from: ${order.userName}</h3>
                <span class="order-date">${orderDate}</span>
            </div>
            <div class="order-body">
                <div class="order-customer"><p><strong>Email:</strong> ${order.userEmail}</p></div>
                <table class="order-items-table">
                    <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                    <tbody>${itemsTable}</tbody>
                </table>
            </div>
            <div class="order-footer">
                <div class="order-status">
                    <label for="status-${order.id}"><strong>Status: </strong></label>
                    <select id="status-${order.id}" data-order-id="${order.id}" class="status-${order.status}">
                        <option value="new" ${order.status === 'new' ? 'selected' : ''}>New</option>
                        <option value="in-progress" ${order.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </div>
                <div class="order-total">Grand Total: ₹${order.totalAmount.toFixed(2)}</div>
            </div>
        `;
        const statusSelect = card.querySelector(`#status-${order.id}`);
        statusSelect.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            const orderId = e.target.dataset.orderId;
            const orderRef = doc(db, 'orders', orderId);
            statusSelect.className = `status-${newStatus}`;
            try { await updateDoc(orderRef, { status: newStatus }); } 
            catch (error) { console.error("Error updating status: ", error); }
        });
        return card;
    }
});
