// profile.js (Unified, Optimized & Fixed Confirm Modal)

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
    getFirestore, collection, getDocs, query, where, orderBy,
    doc, updateDoc, onSnapshot, addDoc, serverTimestamp,
    writeBatch, enableIndexedDbPersistence, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
    getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. FIREBASE INITIALIZATION ---
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

    // --- 2. DOM ELEMENTS ---
    const $ = id => document.getElementById(id);
    const elements = {
        profileContent: $('profile-content'),
        userActions: $('user-actions'),
        guestActions: $('guest-actions'),
        userAvatarNav: $('user-avatar'),
        userNameNav: $('user-name'),
        logoutBtn: $('logout-btn'),
        profileAvatarLarge: $('profile-avatar-large'),
        profileDisplayName: $('profile-display-name'),
        profileEmail: $('profile-email'),
        orderHistoryContainer: $('order-history-container'),
        cartCountNav: $('cart-count'),
        cartLink: $('cart-link'),
        cartModal: $('cart-modal'),
        closeCartBtn: $('close-cart-btn'),
        cartItemsContainer: $('cart-items-container'),
        cartTotal: $('cart-total'),
        placeOrderBtn: $('place-order-btn'),
        confirmModal: $('confirm-modal'),
        confirmTitle: $('confirm-title'),
        confirmMessage: $('confirm-message'),
        confirmBtnYes: $('confirm-btn-yes'),
        confirmBtnNo: $('confirm-btn-no'),
        chatModal: $('chat-modal'),
        closeChatBtn: $('close-chat-btn'),
        chatMessagesContainer: $('chat-messages'),
        chatInput: $('chat-input'),
        chatSendBtn: $('chat-send-btn'),
        chatNotificationDot: $('chat-notification-dot'),
        hamburgerBtn: $('hamburger-btn'),
        navLinks: $('nav-links')
    };

    // --- 3. STATE VARIABLES ---
    let cart = [];
    let cartUnsub = null, ordersUnsub = null, chatUnsub = null;
    let confirmAction = null;
    let currentUser = null;
    let currentChatOrderId = null;

    // --- 4. HELPERS ---
    const openModal = m => m && (m.style.display = 'block');
    const closeModal = m => m && (m.style.display = 'none');
    const showToast = (msg, type = 'info') => {
        if (typeof Toastify !== 'undefined') {
            const bg = type === 'error' ? "linear-gradient(to right,#e74c3c,#c03b2b)" :
                        type === 'success' ? "linear-gradient(to right,#00b09b,#96c93d)" :
                        "linear-gradient(to right,#3498db,#2980b9)";
            Toastify({
                text: msg, duration: 3000, close: true,
                gravity: "top", position: "right",
                style: { background: bg, borderRadius: "8px" }
            }).showToast();
        } else {
            console.log(`[toast-${type}] ${msg}`);
        }
    };

    const openConfirmModal = (title, message, onConfirm) => {
        if (!elements.confirmModal) return;
        elements.confirmTitle.textContent = title;
        elements.confirmMessage.textContent = message;
        confirmAction = onConfirm;
        openModal(elements.confirmModal);
    };

    // --- 5. AUTHENTICATION ---
    onAuthStateChanged(auth, user => {
        [cartUnsub, ordersUnsub, chatUnsub].forEach(unsub => unsub && unsub());
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
        elements.userActions?.classList.remove('hidden');
        elements.guestActions?.classList.add('hidden');
        elements.profileContent?.classList.remove('hidden');
    }

    function displayUserInfo(user) {
        elements.userNameNav.textContent = user.displayName?.split(' ')[0] || 'User';
        elements.userAvatarNav.src = user.photoURL || '';
        elements.profileAvatarLarge.src = user.photoURL || '';
        elements.profileDisplayName.textContent = `Welcome, ${user.displayName || ''}!`;
        elements.profileEmail.textContent = user.email || '';
    }

    // --- 6. ORDER HISTORY ---
    function listenForUserOrdersAndNotifications(userId) {
        const container = elements.orderHistoryContainer;
        if (!container) return;
        container.innerHTML = '<p class="loading-message">Loading your orders...</p>';

        const ordersQ = query(
            collection(db, 'orders'),
            where("userId", "==", userId),
            orderBy("createdAt", "desc")
        );

        ordersUnsub = onSnapshot(ordersQ, async snapshot => {
            if (snapshot.empty) {
                container.innerHTML = '<p class="empty-message">You have not placed any orders yet.</p>';
                elements.chatNotificationDot?.classList.remove('visible');
                return;
            }

            let hasUnread = false;
            const cards = await Promise.all(snapshot.docs.map(async docSnap => {
                const order = { id: docSnap.id, ...docSnap.data() };
                const unreadQ = query(
                    collection(db, `orders/${order.id}/messages`),
                    where('sender', '==', 'admin'),
                    where('readByCustomer', '==', false)
                );
                const unreadSnap = await getDocs(unreadQ);
                if (unreadSnap.size > 0) hasUnread = true;
                return createOrderCard(order, unreadSnap.size);
            }));

            container.innerHTML = '';
            cards.forEach(c => container.appendChild(c));
            elements.chatNotificationDot?.classList.toggle('visible', hasUnread);
        }, err => {
            console.error('Orders listener error:', err);
            container.innerHTML = '<p class="error-text">Could not load orders. Please check permissions.</p>';
        });
    }

    function createOrderCard(order, unreadCount) {
        const card = document.createElement('div');
        card.className = 'order-card-accordion';
        card.id = `order-${order.id}`;

        const orderDate = order.createdAt ?
            new Date(order.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';
        const statusClass = `status-${order.status}`;
        const itemsTable = (order.items || [])
            .map(item => `<tr><td>${item.name}</td><td>${item.quantity}</td><td>₹${(item.price || 0).toFixed(2)}</td></tr>`)
            .join('');

        let progressPercent = '0%', orderedActive = 'active', progressActive = '', completedActive = '';
        if (order.status === 'in-progress') {
            progressPercent = '50%'; progressActive = 'active';
        } else if (order.status === 'completed') {
            progressPercent = '100%'; progressActive = completedActive = 'active';
        } else if (order.status === 'cancelled') {
            orderedActive = '';
        }

        const footerHTML = `
            <div class="order-footer">
                <div class="order-footer-actions">
                    <button class="btn-view-chat" data-id="${order.id}">
                        View Chat <span class="chat-notification-badge ${unreadCount > 0 ? 'visible' : ''}">${unreadCount || ''}</span>
                    </button>
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
                <div class="progress-tracker">
                    <div class="progress-bar" style="width: ${progressPercent};"></div>
                    <div class="progress-step ${orderedActive}"><div class="progress-circle"></div><div class="progress-label">Ordered</div></div>
                    <div class="progress-step ${progressActive}"><div class="progress-circle"></div><div class="progress-label">In Progress</div></div>
                    <div class="progress-step ${completedActive}"><div class="progress-circle"></div><div class="progress-label">Completed</div></div>
                </div>
                <table class="order-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${itemsTable}</tbody></table>
                ${footerHTML}
            </div>
        `;

        card.querySelector('.order-summary').addEventListener('click', () => card.classList.toggle('active'));
        card.querySelector('.btn-view-chat')?.addEventListener('click', e => {
            e.stopPropagation();
            openChat(order.id);
        });
        card.querySelector('.btn-cancel-order')?.addEventListener('click', e => {
            e.stopPropagation();
            openConfirmModal('Cancel Order?', 'Are you sure? This cannot be undone.', () => handleCancelOrder(order.id));
        });

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

    // --- 7. CHAT ---
    async function openChat(orderId) {
        if (!elements.chatModal) return;
        currentChatOrderId = orderId;
        elements.chatMessagesContainer.innerHTML = '<p>Loading chat...</p>';
        openModal(elements.chatModal);

        try {
            const unreadQ = query(
                collection(db, `orders/${orderId}/messages`),
                where('sender', '==', 'admin'),
                where('readByCustomer', '==', false)
            );
            const unreadSnap = await getDocs(unreadQ);
            if (!unreadSnap.empty) {
                const batch = writeBatch(db);
                unreadSnap.forEach(d => batch.update(d.ref, { readByCustomer: true }));
                await batch.commit();
            }
        } catch (err) {
            console.warn('Could not mark messages as read:', err.code);
        }

        if (chatUnsub) chatUnsub();
        const q = query(collection(db, `orders/${orderId}/messages`), orderBy('timestamp'));
        chatUnsub = onSnapshot(q, snapshot => {
            elements.chatMessagesContainer.innerHTML = '';
            snapshot.forEach(docSnap => {
                const message = docSnap.data();
                const div = document.createElement('div');
                div.className = `message ${message.sender === 'customer' ? 'sent' : 'received'}`;
                div.innerHTML = message.type === 'qr_code'
                    ? `<img src="${message.content}" alt="Payment QR Code">`
                    : message.content;
                elements.chatMessagesContainer.appendChild(div);
            });
            elements.chatMessagesContainer.scrollTop = elements.chatMessagesContainer.scrollHeight;
        }, err => {
            console.error('Chat listener error:', err);
            showToast('Unable to open chat.', 'error');
            closeModal(elements.chatModal);
        });
    }

    async function sendMessage() {
        if (!currentChatOrderId) return;
        const content = elements.chatInput.value.trim();
        if (!content) return;
        try {
            await addDoc(collection(db, `orders/${currentChatOrderId}/messages`), {
                content, sender: 'customer', timestamp: serverTimestamp(),
                type: 'text', readByCustomer: true
            });
            elements.chatInput.value = '';
        } catch (err) {
            console.error('Send message failed:', err);
            showToast('Failed to send message', 'error');
        }
    }

    // --- 8. CART ---
    function listenForCartUpdates(userId) {
        const cartRef = collection(db, `users/${userId}/cart`);
        if (cartUnsub) cartUnsub();
        cartUnsub = onSnapshot(cartRef, snapshot => {
            cart = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            updateCartCount(cart.reduce((s, it) => s + (it.quantity || 0), 0));
            renderCartItems();
            updateCartTotal();
        }, err => {
            console.error('Cart listener error:', err);
            showToast('Unable to access cart.', 'error');
        });
    }

    const updateCartCount = count => elements.cartCountNav.textContent = count;

    function renderCartItems() {
        const container = elements.cartItemsContainer;
        container.innerHTML = '';
        if (!cart.length) {
            container.innerHTML = '<p>Your cart is empty.</p>';
            elements.placeOrderBtn.disabled = true;
            return;
        }
        elements.placeOrderBtn.disabled = false;
        cart.forEach(item => {
            const el = document.createElement('div');
            el.className = 'cart-item';
            el.innerHTML = `
                <img src="${item.image || ''}" alt="${item.name || ''}">
                <div class="cart-item-details">
                    <h4>${item.name || ''}</h4>
                    <span class="cart-item-price">₹${(item.price || 0).toFixed(2)}</span>
                </div>
                <div class="cart-item-actions">
                    <div class="quantity-controls">
                        <button class="quantity-change" data-id="${item.id}" data-change="-1">-</button>
                        <input type="number" value="${item.quantity || 1}" min="1" data-id="${item.id}" class="quantity-input">
                        <button class="quantity-change" data-id="${item.id}" data-change="1">+</button>
                    </div>
                    <button class="btn-remove-item" data-id="${item.id}" title="Remove item">🗑</button>
                </div>
            `;
            container.appendChild(el);
        });
    }

    function updateCartTotal() {
        const total = cart.reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0);
        elements.cartTotal.textContent = `₹${total.toFixed(2)}`;
    }

    async function updateCartItemQuantity(productId, qty) {
        if (!currentUser) return;
        const ref = doc(db, `users/${currentUser.uid}/cart`, productId);
        try {
            if (qty > 0) await updateDoc(ref, { quantity: qty });
            else await deleteDoc(ref);
        } catch (err) {
            console.error('Update cart error:', err);
            showToast('Failed to update cart', 'error');
        }
    }

    async function placeOrder() {
        if (!currentUser || !cart.length) return;
        const total = cart.reduce((s, it) => s + ((it.price || 0) * (it.quantity || 0)), 0);
        try {
            await addDoc(collection(db, 'orders'), {
                userId: currentUser.uid,
                userName: currentUser.displayName || '',
                userEmail: currentUser.email || '',
                items: cart,
                totalAmount: total,
                status: 'new',
                createdAt: serverTimestamp()
            });
            const batch = writeBatch(db);
            cart.forEach(it => batch.delete(doc(db, `users/${currentUser.uid}/cart`, it.id)));
            await batch.commit();
            showToast('Order placed successfully!', 'success');
            closeModal(elements.cartModal);
        } catch (err) {
            console.error('Place order error:', err);
            showToast('Could not place order', 'error');
        }
    }

    // --- 9. EVENTS ---
    elements.hamburgerBtn?.addEventListener('click', () => elements.navLinks.classList.toggle('active'));
    elements.logoutBtn?.addEventListener('click', () => signOut(auth));
    elements.cartLink?.addEventListener('click', e => { e.preventDefault(); openModal(elements.cartModal); });
    elements.closeCartBtn?.addEventListener('click', () => closeModal(elements.cartModal));
    elements.closeChatBtn?.addEventListener('click', () => closeModal(elements.chatModal));
    elements.chatSendBtn?.addEventListener('click', sendMessage);
    elements.chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
    elements.placeOrderBtn?.addEventListener('click', placeOrder);

    elements.cartItemsContainer?.addEventListener('click', e => {
        const t = e.target.closest('.btn-remove-item, .quantity-change');
        if (!t) return;
        const id = t.dataset.id;
        if (t.classList.contains('quantity-change')) {
            const change = parseInt(t.dataset.change, 10);
            const it = cart.find(x => x.id === id);
            if (it) updateCartItemQuantity(id, (it.quantity || 1) + change);
        } else if (t.classList.contains('btn-remove-item')) {
            updateCartItemQuantity(id, 0);
        }
    });

    elements.cartItemsContainer?.addEventListener('change', e => {
        const input = e.target.closest('.quantity-input');
        if (!input) return;
        updateCartItemQuantity(input.dataset.id, parseInt(input.value, 10));
    });

    // ✅ FIXED CONFIRM MODAL BUTTONS
    elements.confirmBtnYes?.addEventListener('click', () => {
        if (typeof confirmAction === 'function') confirmAction();
        closeModal(elements.confirmModal);
    });
    elements.confirmBtnNo?.addEventListener('click', () => {
        closeModal(elements.confirmModal);
    });

});
