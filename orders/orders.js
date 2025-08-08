// orders.js (Final Professional Version)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, doc, updateDoc, query, orderBy, onSnapshot, addDoc, serverTimestamp, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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

  const app = initializeApp(firebaseConfig, 'adminApp');
  const db = getFirestore(app);
  const auth = getAuth(app);
  enableIndexedDbPersistence(db).catch(err => console.warn("persistence:", err));

  // DOM
  const adminPanelWrapper = document.getElementById('admin-panel-wrapper');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');
  const ordersContainer = document.getElementById('orders-list-container');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const newCountSpan = document.getElementById('new-count');
  const progressCountSpan = document.getElementById('progress-count');
  const searchInput = document.getElementById('order-search-input');
  const chatModal = document.getElementById('chat-modal');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatMessagesContainer = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const sendQrBtn = document.getElementById('send-qr-btn');

  // state
  let allOrders = [];
  let currentFilter = 'all';
  let currentChatOrderId = null;
  let chatUnsub = null;
  let ordersUnsub = null;

  onAuthStateChanged(auth, user => {
    if (user) {
      adminPanelWrapper?.classList.remove('hidden');
      listenForOrders();
    } else {
      window.location.href = '/admin.html';
    }
  });

  adminLogoutBtn?.addEventListener('click', () => signOut(auth).then(() => window.location.href = '/admin.html').catch(err => console.error(err)));

  function listenForOrders() {
    if (ordersUnsub) ordersUnsub();
    ordersUnsub = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
      allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateFilterCounts();
      renderOrders();
    });
  }

  function renderOrders() {
    ordersContainer.innerHTML = '';
    const term = (searchInput?.value || '').toLowerCase();
    const filtered = allOrders
      .filter(o => currentFilter === 'all' || o.status === currentFilter)
      .filter(o => !term || (o.userName || '').toLowerCase().includes(term) || (o.userEmail || '').toLowerCase().includes(term));
    if (!filtered.length) { ordersContainer.innerHTML = '<p>No orders found.</p>'; return; }
    filtered.forEach(o => ordersContainer.appendChild(createOrderCard(o)));
  }

  function updateFilterCounts() {
    newCountSpan && (newCountSpan.textContent = `(${allOrders.filter(o => o.status === 'new').length})`);
    progressCountSpan && (progressCountSpan.textContent = `(${allOrders.filter(o => o.status === 'in-progress').length})`);
  }

  filterButtons.forEach(b => b.addEventListener('click', () => {
    filterButtons.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentFilter = b.dataset.status;
    renderOrders();
  }));

  searchInput?.addEventListener('input', renderOrders);

  function createOrderCard(order) {
    const c = document.createElement('div');
    c.className = 'order-card';
    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'N/A';
    const rows = (order.items || []).map(it => `<tr><td>${it.name}</td><td>${it.quantity}</td><td>₹${(it.price||0).toFixed(2)}</td><td class="item-total">₹${((it.price||0)*it.quantity).toFixed(2)}</td></tr>`).join('');
    
    const statuses = ['new', 'in-progress', 'completed', 'cancelled'];
    const statusPillsHTML = statuses.map(status => `
        <button 
            class="status-pill status-${status} ${order.status === status ? 'active' : ''}" 
            data-status="${status}"
            data-id="${order.id}">
            ${status.replace('-', ' ')}
        </button>
    `).join('');

    c.innerHTML = `
      <div class="order-header"><h3>${order.userName}</h3><span>${date}</span></div>
      <div class="order-body">
        <p><strong>Email:</strong> ${order.userEmail}</p>
        <table class="order-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="order-footer">
        <div class="order-footer-actions">
            <button class="btn-chat" data-id="${order.id}">Chat</button>
            <div class="order-status-pills">${statusPillsHTML}</div>
        </div>
        <div class="order-total">₹${(order.totalAmount||0).toFixed(2)}</div>
      </div>
    `;

    c.querySelector('.btn-chat')?.addEventListener('click', () => openChat(order.id));
    
    c.querySelector('.order-status-pills')?.addEventListener('click', async e => {
        if (e.target.classList.contains('status-pill')) {
            const newStatus = e.target.dataset.status;
            const orderId = e.target.dataset.id;
            try { await updateDoc(doc(db, 'orders', orderId), { status: newStatus }); }
            catch (err) { console.error('Status update error:', err); }
        }
    });

    return c;
  }

  function openChat(orderId) {
    currentChatOrderId = orderId;
    chatMessagesContainer && (chatMessagesContainer.innerHTML = '<p>Loading...</p>');
    openModal(chatModal);

    if (chatUnsub) chatUnsub();
    const messagesRef = collection(db, `orders/${orderId}/messages`);
    chatUnsub = onSnapshot(query(messagesRef, orderBy('timestamp')), snap => {
      chatMessagesContainer.innerHTML = '';
      snap.forEach(d => {
        const m = d.data();
        const div = document.createElement('div');
        div.className = 'message ' + (m.sender === 'admin' ? 'sent' : 'received');
        div.innerHTML = m.type === 'qr_code'
          ? `<img src="${m.content}" alt="QR Code">`
          : m.content;
        chatMessagesContainer.appendChild(div);
      });
      chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    });
  }

  async function sendMessage(content, type='text') {
    if (!currentChatOrderId || !content?.trim()) return;
    try {
      await addDoc(collection(db, `orders/${currentChatOrderId}/messages`), {
        content, sender: 'admin', timestamp: serverTimestamp(), type, readByCustomer: false
      });
      if (type === 'text') chatInput.value = '';
    } catch (err) { console.error('send message error:', err); }
  }

  chatSendBtn?.addEventListener('click', () => sendMessage((chatInput?.value||'').trim()));
  chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage((chatInput.value||'').trim()); }});
  sendQrBtn?.addEventListener('click', () =>
    sendMessage('https://placehold.co/300x300/eee/ccc?text=Your+Payment+QR+Code','qr_code')
  );

  closeChatBtn?.addEventListener('click', () => closeModal(chatModal));
  window.addEventListener('click', e => { if (e.target === chatModal) closeModal(chatModal); });

  function openModal(m) { if (m) m.style.display = 'block'; }
  function closeModal(m) { if (m) m.style.display = 'none'; }
});
