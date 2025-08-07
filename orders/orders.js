// orders.js (with Filtering & Search)

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


    // Initialize the named, secondary app for the admin panel
    const adminApp = initializeApp(firebaseConfig, 'adminApp');
    const db = getFirestore(adminApp);
    const adminAuth = getAuth(adminApp);

    // Enable Offline Persistence for the admin panel
    enableIndexedDbPersistence(db).catch((err) => { console.error("Firestore persistence error: ", err); });
    
    const ordersCollectionRef = collection(db, 'orders');

    // --- DOM Elements ---
    const adminPanelWrapper = document.getElementById('admin-panel-wrapper');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const ordersContainer = document.getElementById('orders-list-container');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const newCountSpan = document.getElementById('new-count');
    const progressCountSpan = document.getElementById('progress-count');
    const searchInput = document.getElementById('order-search-input');

    let allOrders = []; // Local cache for all orders
    let currentFilter = 'all'; // State for the current filter

    // --- AUTHENTICATION & LOGOUT ---
    onAuthStateChanged(adminAuth, user => {
        if (user) {
            // If admin is logged in, show the panel and listen for orders
            adminPanelWrapper.classList.remove('hidden');
            listenForOrders();
        } else {
            // If not logged in, redirect to the admin login page
            window.location.href = 'admin.html';
        }
    });

    adminLogoutBtn.addEventListener('click', () => {
        signOut(adminAuth).then(() => {
            // The onAuthStateChanged listener above will handle the redirect
            console.log('Admin signed out successfully.');
        }).catch(error => {
            console.error("Admin Logout failed:", error);
        });
    });

    // --- ORDER DISPLAY, FILTERING, & SEARCH ---
    function listenForOrders() {
        const q = query(ordersCollectionRef, orderBy('createdAt', 'desc'));
        
        // Use onSnapshot for real-time updates
        onSnapshot(q, (snapshot) => {
            allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateFilterCounts();
            renderOrders(); // A single render function now handles everything
        });
    }

    function renderOrders() {
        ordersContainer.innerHTML = '';
        const searchTerm = searchInput.value.toLowerCase();

        // 1. Apply the status filter first
        const filteredByStatus = allOrders.filter(order => {
            if (currentFilter === 'all') return true;
            return order.status === currentFilter;
        });

        // 2. Apply the search filter on the result of the status filter
        const filteredBySearch = filteredByStatus.filter(order => {
            if (!searchTerm) return true; // If search is empty, show all from status filter
            const nameMatch = order.userName.toLowerCase().includes(searchTerm);
            const emailMatch = order.userEmail.toLowerCase().includes(searchTerm);
            return nameMatch || emailMatch;
        });

        if (filteredBySearch.length === 0) {
            ordersContainer.innerHTML = `<p>No orders found.</p>`;
            return;
        }

        filteredBySearch.forEach(order => {
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
    
    // --- Event Listeners ---
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.status;
            renderOrders(); // Re-render with the new filter
        });
    });

    searchInput.addEventListener('input', () => {
        renderOrders(); // Re-render on every keystroke in the search bar
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

            // Update the class on the select element for instant visual feedback
            statusSelect.className = `status-${newStatus}`;

            try {
                await updateDoc(orderRef, { status: newStatus });
                // onSnapshot will handle the full re-render automatically
            } catch (error) {
                console.error("Error updating status: ", error);
            }
        });
        return card;
    }
});
