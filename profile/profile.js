// profile.js (with Cancel Order Logic)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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


    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    enableIndexedDbPersistence(db).catch((err) => { console.error("Firestore persistence error: ", err); });
    const ordersCollectionRef = collection(db, 'orders');

    const profileContent = document.getElementById('profile-content');
    const userActions = document.getElementById('user-actions');
    const guestActions = document.getElementById('guest-actions');
    const userAvatarNav = document.getElementById('user-avatar');
    const userNameNav = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-btn');
    const profileAvatarLarge = document.getElementById('profile-avatar-large');
    const profileDisplayName = document.getElementById('profile-display-name');
    const profileEmail = document.getElementById('profile-email');
    const orderHistoryContainer = document.getElementById('order-history-container');

    // --- Helper function for showing toast notifications ---
    function showToast(message, type = 'success') {
        let backgroundColor = type === 'error' ? "linear-gradient(to right, #e74c3c, #c0392b)" : "linear-gradient(to right, #00b09b, #96c93d)";
        Toastify({ text: message, duration: 3000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: backgroundColor, borderRadius: "8px" } }).showToast();
    }

    onAuthStateChanged(auth, user => {
        if (user) {
            displayUserInfo(user);
            fetchUserOrders(user.uid);
            userActions.classList.remove('hidden');
            guestActions.classList.add('hidden');
            profileContent.classList.remove('hidden');
        } else {
            window.location.href = 'index.html';
        }
    });
    
    logoutBtn.addEventListener('click', () => { signOut(auth); });
    function displayUserInfo(user) { userNameNav.textContent = user.displayName.split(' ')[0]; userAvatarNav.src = user.photoURL; profileAvatarLarge.src = user.photoURL; profileDisplayName.textContent = `Welcome, ${user.displayName}!`; profileEmail.textContent = user.email; }

    async function fetchUserOrders(userId) {
        try {
            const q = query(ordersCollectionRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                orderHistoryContainer.innerHTML = '<p>You have not placed any orders yet.</p>';
                return;
            }

            orderHistoryContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const order = { id: doc.id, ...doc.data() };
                const orderCard = createOrderCard(order);
                orderHistoryContainer.appendChild(orderCard);
            });
        } catch (error) {
            console.error("Error fetching order history: ", error);
            orderHistoryContainer.innerHTML = '<p class="error-text">Could not load order history.</p>';
        }
    }

    function createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';
        card.id = `order-${order.id}`; // Give the card a unique ID

        const itemsTable = order.items.map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${item.price.toFixed(2)}</td></tr>`).join('');
        const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const statusClass = `status-${order.status}`;

        // Conditionally create the cancel button and the footer
        let orderFooterHTML = '';
        if (order.status === 'new') {
            orderFooterHTML = `
                <div class="order-footer">
                    <button class="btn-cancel-order" data-id="${order.id}">Cancel Order</button>
                    <div class="order-total">Total: ₹${order.totalAmount.toFixed(2)}</div>
                </div>
            `;
        } else {
            orderFooterHTML = `
                <div class="order-footer">
                    <div></div> <!-- Spacer -->
                    <div class="order-total">Total: ₹${order.totalAmount.toFixed(2)}</div>
                </div>
            `;
        }

        card.innerHTML = `
            <div class="order-header">
                <div class="order-status ${statusClass}">${order.status}</div>
                <div class="order-date">Ordered on: ${orderDate}</div>
            </div>
            <table class="order-items-table">
                <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
                <tbody>${itemsTable}</tbody>
            </table>
            ${orderFooterHTML}
        `;

        // Add event listener if the cancel button exists
        const cancelButton = card.querySelector('.btn-cancel-order');
        if (cancelButton) {
            cancelButton.addEventListener('click', handleCancelOrder);
        }

        return card;
    }

    async function handleCancelOrder(e) {
        const orderId = e.target.dataset.id;
        if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
            return;
        }

        const orderRef = doc(db, 'orders', orderId);
        try {
            await updateDoc(orderRef, { status: 'cancelled' });
            showToast("Order cancelled successfully.", 'success');

            // Update the UI in real-time
            const cardToUpdate = document.getElementById(`order-${orderId}`);
            const statusElement = cardToUpdate.querySelector('.order-status');
            statusElement.textContent = 'cancelled';
            statusElement.className = 'order-status status-cancelled';
            e.target.remove(); // Remove the cancel button
        } catch (error) {
            console.error("Error cancelling order: ", error);
            showToast("Failed to cancel order. Please try again.", 'error');
        }
    }
});

function toggleMenu() {
    const navLinks = document.getElementById('nav-links');
    navLinks.classList.toggle('active');
}
