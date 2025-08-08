// profile.js (Final Professional Version)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy, doc, updateDoc, onSnapshot, addDoc, serverTimestamp, writeBatch, enableIndexedDbPersistence, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & INITIALIZATION ---
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
    enableIndexedDbPersistence(db).catch(err => console.warn("Firestore persistence:", err));
    
    // --- 2. DOM ELEMENT REFERENCES ---
    const $ = id => document.getElementById(id);
    const profileContent = $('profile-content');
    const userActions = $('user-actions');
    const guestActions = $('guest-actions');
    const userAvatarNav = $('user-avatar');
    const userNameNav = $('user-name');
    const logoutBtn = $('logout-btn');
    const profileAvatarLarge = $('profile-avatar-large');
    const profileDisplayName = $('profile-display-name');
    const profileEmail = $('profile-email');
    const orderHistoryContainer = $('order-history-container');
    const cartCountNav = $('cart-count');
    const cartLink = $('cart-link');
    const cartModal = $('cart-modal');
    const closeCartBtn = $('close-cart-btn');
    const cartItemsContainer = $('cart-items-container');
    const cartTotal = $('cart-total');
    const placeOrderBtn = $('place-order-btn');
    const confirmModal = $('confirm-modal');
    const confirmTitle = $('confirm-title');
    const confirmMessage = $('confirm-message');
    const confirmBtnYes = $('confirm-btn-yes');
    const confirmBtnNo = $('confirm-btn-no');
    const chatModal = $('chat-modal');
    const closeChatBtn = $('close-chat-btn');
    const chatMessagesContainer = $('chat-messages');
    const chatInput = $('chat-input');
    const chatSendBtn = $('chat-send-btn');
    const chatNotificationDot = $('chat-notification-dot');
    const hamburgerBtn = $('hamburger-btn');
    const navLinks = $('nav-links');

    // --- 3. STATE MANAGEMENT ---
    let cartUnsub = null;
    let ordersUnsub = null;
    let chatUnsub = null;
    let cart = [];
    let confirmAction = null;
    let currentUser = null;
    let currentChatOrderId = null;

    // --- 4. HELPER FUNCTIONS ---
    function openModal(m) { if (m) m.style.display = 'block'; }
    function closeModal(m) { if (m) m.style.display = 'none'; }
    function showToast(msg, type = 'info') {
        if (typeof Toastify !== 'undefined') {
            let bg = type === 'error' ? "linear-gradient(to right,#e74c3c,#c03b2b)" : (type === 'success' ? "linear-gradient(to right,#00b09b,#96c93d)" : "linear-gradient(to right,#3498db,#2980b9)");
            Toastify({ text: msg, duration: 3000, close: true, gravity: "top", position: "right", style: { background: bg, borderRadius: "8px" } }).showToast();
        } else {
            console.log(`[toast-${type}] ${msg}`);
        }
    }

    // --- 5. CORE AUTHENTICATION ---
    onAuthStateChanged(auth, user => {
        // Cleanup previous listeners to prevent memory leaks
        if (cartUnsub) cartUnsub();
        if (ordersUnsub) ordersUnsub();
        if (chatUnsub) chatUnsub();

        currentUser = user;
        if (user) {
            setupUserPage(user);
        } else {
            window.location.href = 'index.html';
        }
    });

    function setupUserPage(user) {
        displayUserInfo(user);
        listenForCartUpdates(user.uid);
        listenForUserOrdersAndNotifications(user.uid);
        userActions?.classList.remove('hidden');
        guestActions?.classList.add('hidden');
        profileContent?.classList.remove('hidden');
    }
    
    function displayUserInfo(user) {
        if (userNameNav) userNameNav.textContent = user.displayName?.split(' ')[0] || 'User';
        if (userAvatarNav) userAvatarNav.src = user.photoURL || '';
        if (profileAvatarLarge) profileAvatarLarge.src = user.photoURL || '';
        if (profileDisplayName) profileDisplayName.textContent = `Welcome, ${user.displayName || ''}!`;
        if (profileEmail) profileEmail.textContent = user.email || '';
    }

    // --- 6. ORDER HISTORY & NOTIFICATIONS ---
    function listenForUserOrdersAndNotifications(userId) {
        if (!orderHistoryContainer) return;
        orderHistoryContainer.innerHTML = '<p class="loading-message">Loading your orders...</p>';

        const ordersQ = query(collection(db, 'orders'), where("userId", "==", userId), orderBy("createdAt", "desc"));

        ordersUnsub = onSnapshot(ordersQ, async snapshot => {
            if (snapshot.empty) {
                orderHistoryContainer.innerHTML = '<p class="empty-message">You have not placed any orders yet.</p>';
                if (chatNotificationDot) chatNotificationDot.classList.remove('visible');
                return;
            }

            let hasAnyUnread = false;
            const cardPromises = snapshot.docs.map(async (docSnap) => {
                const order = { id: docSnap.id, ...docSnap.data() };
                let unreadCount = 0;
                try {
                    const messagesRef = collection(db, `orders/${order.id}/messages`);
                    const unreadQ = query(messagesRef, where('sender', '==', 'admin'), where('readByCustomer', '==', false));
                    const unreadSnap = await getDocs(unreadQ);
                    unreadCount = unreadSnap.size;
                } catch (err) {
                    console.warn('Could not read messages for order', order.id, err.code);
                }
                if (unreadCount > 0) hasAnyUnread = true;
                return createOrderCard(order, unreadCount);
            });

            const cards = await Promise.all(cardPromises);
            orderHistoryContainer.innerHTML = '';
            cards.forEach(c => orderHistoryContainer.appendChild(c));
            if (chatNotificationDot) chatNotificationDot.classList.toggle('visible', hasAnyUnread);

        }, (error) => {
            console.error('Orders listener error:', error);
            orderHistoryContainer.innerHTML = '<p class="error-text">Could not load orders. Please check permissions.</p>';
        });
    }

    function createOrderCard(order, unreadCount) {
        const card = document.createElement('div');
        card.className = 'order-card-accordion';
        card.id = `order-${order.id}`;

        const orderDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const statusClass = `status-${order.status}`;
        const itemsTable = (order.items || []).map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${(item.price || 0).toFixed(2)}</td></tr>`).join('');
        
        let progressPercent = '0%', orderedActive = 'active', progressActive = '', completedActive = '';
        if (order.status === 'in-progress') { progressPercent = '50%'; progressActive = 'active'; }
        else if (order.status === 'completed') { progressPercent = '100%'; progressActive = 'active'; completedActive = 'active'; }
        else if (order.status === 'cancelled') { progressPercent = '0%'; orderedActive = ''; }

        const orderFooterHTML = `
            <div class="order-footer">
                <div class="order-footer-actions">
                    <button class="btn-view-chat" data-id="${order.id}">View Chat <span class="chat-notification-badge ${unreadCount > 0 ? 'visible' : ''}">${unreadCount || ''}</span></button>
                    ${order.status === 'new' ? `<button class="btn-cancel-order" data-id="${order.id}">Cancel Order</button>` : ''}
                </div>
                <div class="order-total">Total: ₹${(order.totalAmount || 0).toFixed(2)}</div>
            </div>
        `;

        card.innerHTML = `
            <div class="order-summary">
                <div class="order-summary-col"><div class="order-date">${orderDate}</div></div>
                <div class="order-summary-col"><div class="order-status ${statusClass}">${order.status}</div></div>
                <div class="order-summary-col total">₹${(order.totalAmount || 0).toFixed(2)}</div>
            </div>
            <div class="order-details">
                <div class="progress-tracker"><div class="progress-bar" style="width: ${progressPercent};"></div><div class="progress-step ${orderedActive}"><div class="progress-circle"></div><div class="progress-label">Ordered</div></div><div class="progress-step ${progressActive}"><div class="progress-circle"></div><div class="progress-label">In Progress</div></div><div class="progress-step ${completedActive}"><div class="progress-circle"></div><div class="progress-label">Completed</div></div></div>
                <table class="order-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemsTable}</tbody></table>
                ${orderFooterHTML}
            </div>
        `;

        card.querySelector('.order-summary')?.addEventListener('click', () => card.classList.toggle('active'));
        card.querySelector('.btn-view-chat')?.addEventListener('click', (e) => { e.stopPropagation(); openChat(order.id); });
        card.querySelector('.btn-cancel-order')?.addEventListener('click', (e) => { e.stopPropagation(); openConfirmModal('Cancel Order?', 'Are you sure? This cannot be undone.', () => handleCancelOrder(order.id)); });
        
        return card;
    }

    async function handleCancelOrder(orderId) {
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'cancelled' });
            showToast('Order cancelled.', 'success');
        } catch (err) {
            console.error('Cancel order error:', err);
            showToast('Failed to cancel order', 'error');
        }
    }

    // --- 7. CHAT LOGIC ---
    async function openChat(orderId) {
        if (!chatModal || !chatMessagesContainer) return;
        currentChatOrderId = orderId;
        chatMessagesContainer.innerHTML = '<p>Loading chat...</p>';
        openModal(chatModal);

        try {
            const messagesRef = collection(db, `orders/${orderId}/messages`);
            const unreadQuery = query(messagesRef, where('sender', '==', 'admin'), where('readByCustomer', '==', false));
            const unreadSnapshot = await getDocs(unreadQuery);
            if (!unreadSnapshot.empty) {
                const batch = writeBatch(db);
                unreadSnapshot.forEach(d => batch.update(d.ref, { readByCustomer: true }));
                await batch.commit();
            }
        } catch (err) {
            console.warn('Could not mark messages as read:', err.code);
        }

        if (chatUnsub) chatUnsub();
        const q = query(collection(db, `orders/${orderId}/messages`), orderBy('timestamp'));
        chatUnsub = onSnapshot(q, snapshot => {
            chatMessagesContainer.innerHTML = '';
            snapshot.forEach(docSnap => {
                const message = docSnap.data();
                const div = document.createElement('div');
                div.className = `message ${message.sender === 'customer' ? 'sent' : 'received'}`;
                if (message.type === 'qr_code') {
                    div.classList.add('qr-code');
                    div.innerHTML = `<img src="${message.content}" alt="Payment QR Code">`;
                } else {
                    div.textContent = message.content;
                }
                chatMessagesContainer.appendChild(div);
            });
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, error => {
            console.error('Chat listener error:', error);
            showToast('Unable to open chat.', 'error');
            closeModal(chatModal);
        });
    }

    async function sendMessage() {
        if (!currentChatOrderId || !chatInput) return;
        const content = chatInput.value.trim();
        if (!content) return;
        try {
            await addDoc(collection(db, `orders/${currentChatOrderId}/messages`), { content, sender: 'customer', timestamp: serverTimestamp(), type: 'text', readByCustomer: true });
            chatInput.value = '';
        } catch (err) {
            console.error('Send message failed:', err);
            showToast('Failed to send message', 'error');
        }
    }

    // --- 8. CART LOGIC ---
    function listenForCartUpdates(userId) {
        const cartRef = collection(db, `users/${userId}/cart`);
        if (cartUnsub) cartUnsub();
        cartUnsub = onSnapshot(cartRef, snapshot => {
            cart = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            updateCartCount(cart.reduce((s, it) => s + (it.quantity || 0), 0));
            renderCartItems();
            updateCartTotal();
        }, error => {
            console.error('Cart listener error:', error);
            showToast('Unable to access cart.', 'error');
        });
    }

    function updateCartCount(count) { if (cartCountNav) cartCountNav.textContent = count; }

    function renderCartItems() {
        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';
        if (!cart.length) {
            cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
            if (placeOrderBtn) placeOrderBtn.disabled = true;
            return;
        }
        if (placeOrderBtn) placeOrderBtn.disabled = false;
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `<img src="${item.image || ''}" alt="${item.name || ''}"><div class="cart-item-details"><h4>${item.name || ''}</h4><span class="cart-item-price">₹${(item.price || 0).toFixed(2)}</span></div><div class="cart-item-actions"><div class="quantity-controls"><button class="quantity-change" data-id="${item.id}" data-change="-1">-</button><input type="number" value="${item.quantity || 1}" min="1" data-id="${item.id}" class="quantity-input"><button class="quantity-change" data-id="${item.id}" data-change="1">+</button></div><button class="btn-remove-item" data-id="${item.id}" title="Remove item"><svg fill="currentColor" viewBox="0 0 16 16" height="1em" width="1em"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"></path><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"></path></svg></button></div>`;
            cartItemsContainer.appendChild(itemElement);
        });
    }

    function updateCartTotal() {
        if (!cartTotal) return;
        const total = cart.reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0);
        cartTotal.textContent = `₹${total.toFixed(2)}`;
    }

    async function updateCartItemQuantity(productId, newQuantity) {
        if (!currentUser) return;
        try {
            const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, productId);
            if (newQuantity > 0) await updateDoc(cartItemRef, { quantity: newQuantity });
            else await deleteDoc(cartItemRef);
        } catch (err) {
            console.error('Update cart error:', err);
            showToast('Failed to update cart', 'error');
        }
    }
    
    async function placeOrder() {
        if (!currentUser || !cart.length) return;
        const total = cart.reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0);
        try {
            await addDoc(collection(db, 'orders'), { userId: currentUser.uid, userName: currentUser.displayName || '', userEmail: currentUser.email || '', items: cart, totalAmount: total, status: 'new', createdAt: serverTimestamp() });
            const batch = writeBatch(db);
            cart.forEach(it => batch.delete(doc(db, `users/${currentUser.uid}/cart`, it.id)));
            await batch.commit();
            showToast('Order placed successfully!', 'success');
            closeModal(cartModal);
        } catch (err) {
            console.error('Place order error:', err);
            showToast('Could not place order', 'error');
        }
    }

    // --- 9. EVENT LISTENERS ---
    function openConfirmModal(title, message, onConfirm) {
        if (!confirmModal) return;
        confirmTitle && (confirmTitle.textContent = title);
        confirmMessage && (confirmMessage.textContent = message);
        confirmAction = onConfirm;
        openModal(confirmModal);
    }
    
    hamburgerBtn?.addEventListener('click', () => navLinks.classList.toggle('active'));
    logoutBtn?.addEventListener('click', () => signOut(auth));
    cartLink?.addEventListener('click', (e) => { e.preventDefault(); openModal(cartModal); });
    closeCartBtn?.addEventListener('click', () => closeModal(cartModal));
    closeChatBtn?.addEventListener('click', () => closeModal(chatModal));
    chatSendBtn?.addEventListener('click', sendMessage);
    chatInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });
    placeOrderBtn?.addEventListener('click', placeOrder);
    
    cartItemsContainer?.addEventListener('click', e => {
        const t = e.target.closest('.btn-remove-item, .quantity-change');
        if (!t) return;
        const id = t.dataset.id;
        if (t.classList.contains('quantity-change')) {
            const change = parseInt(t.dataset.change || '0', 10);
            const it = cart.find(x => x.id === id);
            if (it) updateCartItemQuantity(id, (it.quantity || 1) + change);
        } else if (t.classList.contains('btn-remove-item')) {
            openConfirmModal('Remove Item?', 'Remove this item from cart?', () => updateCartItemQuantity(id, 0));
        }
    });

    cartItemsContainer?.addEventListener('change', e => {
        if (!e.target.classList.contains('quantity-input')) return;
        const id = e.target.dataset.id; const q = parseInt(e.target.value || '1', 10); updateCartItemQuantity(id, q);
    });

    window.addEventListener('click', e => {
        if (e.target === cartModal) closeModal(cartModal);
        if (e.target === chatModal) closeModal(chatModal);
        if (e.target === confirmModal) closeConfirmModal();
    });
});
