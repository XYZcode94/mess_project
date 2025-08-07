// profile.js (Corrected Hamburger Logic)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, updateDoc, onSnapshot, enableIndexedDbPersistence, deleteDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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

    // --- DOM Elements ---
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
    const cartCountNav = document.getElementById('cart-count');
    const cartLink = document.getElementById('cart-link');
    const cartModal = document.getElementById('cart-modal');
    const closeCartBtn = document.getElementById('close-cart-btn');
    const cartItemsContainer = document.getElementById('cart-items-container');
    const cartTotal = document.getElementById('cart-total');
    const placeOrderBtn = document.getElementById('place-order-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmTitle = document.getElementById('confirm-title');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmBtnYes = document.getElementById('confirm-btn-yes');
    const confirmBtnNo = document.getElementById('confirm-btn-no');
    const hamburgerBtn = document.getElementById('hamburger-btn'); // Get hamburger button
    const navLinks = document.getElementById('nav-links'); // Get nav links container

    let cartListener = null;
    let cart = [];
    let confirmAction = null;

    // --- THIS IS THE FIX ---
    // Hamburger Menu Logic
    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // --- Custom Confirmation Modal Logic ---
    function openConfirmModal(title, message, onConfirm) {
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmAction = onConfirm;
        openModal(confirmModal);
    }

    function closeConfirmModal() {
        confirmAction = null;
        closeModal(confirmModal);
    }

    confirmBtnYes.addEventListener('click', () => {
        if (typeof confirmAction === 'function') {
            confirmAction();
        }
        closeConfirmModal();
    });

    confirmBtnNo.addEventListener('click', closeConfirmModal);

    onAuthStateChanged(auth, user => {
        if (user) {
            displayUserInfo(user);
            fetchUserOrders(user.uid);
            listenForCartUpdates(user.uid);
            userActions.classList.remove('hidden');
            guestActions.classList.add('hidden');
            profileContent.classList.remove('hidden');
        } else {
            if (cartListener) cartListener();
            window.location.href = '../index.html';
        }
    });
    
    logoutBtn.addEventListener('click', () => {
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        }).catch(error => console.error("Logout failed:", error));
    });
    
    function displayUserInfo(user) {
        userNameNav.textContent = user.displayName.split(' ')[0];
        userAvatarNav.src = user.photoURL;
        profileAvatarLarge.src = user.photoURL;
        profileDisplayName.textContent = `Welcome, ${user.displayName}!`;
        profileEmail.textContent = user.email;
    }

    // --- Cart Logic ---
    function listenForCartUpdates(userId) {
        const cartCollectionRef = collection(db, `users/${userId}/cart`);
        cartListener = onSnapshot(cartCollectionRef, (snapshot) => {
            cart = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
            renderCartItems();
            updateCartTotal();
        });
    }

    function updateCartCount(count) {
        if (cartCountNav) cartCountNav.textContent = count;
    }
    
    function renderCartItems() {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
            if (placeOrderBtn) placeOrderBtn.disabled = true;
            return;
        }
        if (placeOrderBtn) placeOrderBtn.disabled = false;
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details"><h4>${item.name}</h4><span class="cart-item-price">₹${item.price.toFixed(2)}</span></div>
                <div class="cart-item-actions">
                    <div class="quantity-controls">
                        <button class="quantity-change" data-id="${item.id}" data-change="-1">-</button>
                        <input type="number" value="${item.quantity}" min="1" data-id="${item.id}" class="quantity-input">
                        <button class="quantity-change" data-id="${item.id}" data-change="1">+</button>
                    </div>
                    <button class="btn-remove-item" data-id="${item.id}" title="Remove item">
                        <svg fill="currentColor" viewBox="0 0 16 16" height="1em" width="1em"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"></path><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"></path></svg>
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(itemElement);
        });
    }

    function updateCartTotal() {
        if (!cartTotal) return;
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cartTotal.textContent = `₹${total.toFixed(2)}`;
    }

    async function updateCartItemQuantity(productId, newQuantity) {
        const userId = auth.currentUser.uid;
        if (!userId) return;
        const cartItemRef = doc(db, `users/${userId}/cart`, productId);
        if (newQuantity > 0) {
            await updateDoc(cartItemRef, { quantity: newQuantity });
        } else {
            await deleteDoc(cartItemRef);
        }
    }

    // --- Modal Controls ---
    function openModal(modal) { if (modal) modal.style.display = 'block'; }
    function closeModal(modal) { if (modal) modal.style.display = 'none'; }
    cartLink.addEventListener('click', (e) => { e.preventDefault(); openModal(cartModal); });
    closeCartBtn.addEventListener('click', () => closeModal(cartModal));
    window.addEventListener('click', e => { 
        if (e.target === cartModal) closeModal(cartModal);
        if (e.target === confirmModal) closeConfirmModal();
    });

    // --- Event Listeners for Cart Actions ---
    cartItemsContainer.addEventListener('click', e => {
        const target = e.target.closest('.btn-remove-item, .quantity-change');
        if (!target) return;
        const productId = target.dataset.id;
        if (target.classList.contains('quantity-change')) {
            const change = parseInt(target.dataset.change);
            const item = cart.find(i => i.id === productId);
            if (item) updateCartItemQuantity(productId, item.quantity + change);
        }
        if (target.classList.contains('btn-remove-item')) {
            openConfirmModal(
                'Remove Item?',
                'Are you sure you want to remove this item from your cart?',
                () => updateCartItemQuantity(productId, 0)
            );
        }
    });

    cartItemsContainer.addEventListener('change', e => {
        if (e.target.classList.contains('quantity-input')) {
            const productId = e.target.dataset.id;
            const newQuantity = parseInt(e.target.value);
            updateCartItemQuantity(productId, newQuantity);
        }
    });
    
    placeOrderBtn.addEventListener('click', async () => {
        if (!auth.currentUser || cart.length === 0) return;
        const ordersCollectionRef = collection(db, 'orders');
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        try {
            await addDoc(ordersCollectionRef, { userId: auth.currentUser.uid, userName: auth.currentUser.displayName, userEmail: auth.currentUser.email, items: cart, totalAmount: total, status: 'new', createdAt: serverTimestamp() });
            for (const item of cart) {
                const cartItemRef = doc(db, `users/${auth.currentUser.uid}/cart`, item.id);
                await deleteDoc(cartItemRef);
            }
            showToast("Order placed successfully! Thank you.");
            closeModal(cartModal);
        } catch (error) {
            console.error("Error placing order: ", error);
            showToast("There was an error placing your order.", 'error');
        }
    });

    // --- Order History Functions ---
    async function fetchUserOrders(userId) {
        orderHistoryContainer.innerHTML = '<p class="loading-message">Loading your orders...</p>';
        try {
            const q = query(ordersCollectionRef, where("userId", "==", userId), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                orderHistoryContainer.innerHTML = '<p class="empty-message">You have not placed any orders yet.</p>';
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
        card.className = 'order-card-accordion';
        card.id = `order-${order.id}`;
        const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const statusClass = `status-${order.status}`;
        let progressPercent = '0%';
        let orderedActive = 'active';
        let progressActive = '';
        let completedActive = '';
        if (order.status === 'in-progress') { progressPercent = '50%'; progressActive = 'active'; }
        else if (order.status === 'completed') { progressPercent = '100%'; progressActive = 'active'; completedActive = 'active'; }
        else if (order.status === 'cancelled') { progressPercent = '0%'; orderedActive = ''; }
        const itemsTable = order.items.map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${item.price.toFixed(2)}</td></tr>`).join('');
        let orderFooterHTML = '';
        if (order.status === 'new') {
            orderFooterHTML = `<div class="order-footer"><button class="btn-cancel-order" data-id="${order.id}">Cancel Order</button><div class="order-total">Total: ₹${order.totalAmount.toFixed(2)}</div></div>`;
        } else {
            orderFooterHTML = `<div class="order-footer"><div></div><div class="order-total">Total: ₹${order.totalAmount.toFixed(2)}</div></div>`;
        }
        card.innerHTML = `<div class="order-summary"><div class="order-summary-col"><div class="order-date">${orderDate}</div></div><div class="order-summary-col"><div class="order-status ${statusClass}">${order.status}</div></div><div class="order-summary-col total">₹${order.totalAmount.toFixed(2)}</div></div><div class="order-details"><div class="progress-tracker"><div class="progress-bar" style="width: ${progressPercent};"></div><div class="progress-step ${orderedActive}"><div class="progress-circle"></div><div class="progress-label">Ordered</div></div><div class="progress-step ${progressActive}"><div class="progress-circle"></div><div class="progress-label">In Progress</div></div><div class="progress-step ${completedActive}"><div class="progress-circle"></div><div class="progress-label">Completed</div></div></div><table class="order-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemsTable}</tbody></table>${orderFooterHTML}</div>`;
        const summary = card.querySelector('.order-summary');
        summary.addEventListener('click', () => { card.classList.toggle('active'); });
        const cancelButton = card.querySelector('.btn-cancel-order');
        if (cancelButton) {
            cancelButton.addEventListener('click', (e) => {
                e.stopPropagation();
                openConfirmModal(
                    'Cancel Order?',
                    'Are you sure you want to cancel this order? This cannot be undone.',
                    () => handleCancelOrder(order.id, e.target)
                );
            });
        }
        return card;
    }

    async function handleCancelOrder(orderId, buttonElement) {
        const orderRef = doc(db, 'orders', orderId);
        try {
            await updateDoc(orderRef, { status: 'cancelled' });
            showToast("Order cancelled successfully.", 'success');
            const cardToUpdate = document.getElementById(`order-${orderId}`);
            const statusElement = cardToUpdate.querySelector('.order-status');
            statusElement.textContent = 'cancelled';
            statusElement.className = 'order-status status-cancelled';
            buttonElement.remove();
        } catch (error) {
            console.error("Error cancelling order: ", error);
            showToast("Failed to cancel order. Please try again.", 'error');
        }
    }
    
    function showToast(message, type = 'success') { let backgroundColor; switch (type) { case 'error': backgroundColor = "linear-gradient(to right, #e74c3c, #c03b2b)"; break; case 'info': backgroundColor = "linear-gradient(to right, #3498db, #2980b9)"; break; default: backgroundColor = "linear-gradient(to right, #00b09b, #96c93d)"; break; } Toastify({ text: message, duration: 3000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: backgroundColor, borderRadius: "8px" }, }).showToast(); }
});
