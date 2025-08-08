// orders.js (with Date Filtering)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, doc, updateDoc, query, orderBy, onSnapshot, addDoc, serverTimestamp, enableIndexedDbPersistence, where } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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
  const auth = getAuth(adminApp);
  enableIndexedDbPersistence(db).catch(err => console.warn("persistence:", err));

  // --- DOM Elements ---
  const adminPanelWrapper = document.getElementById('admin-panel-wrapper');
  const adminLogoutBtn = document.getElementById('admin-logout-btn');
  const ordersContainer = document.getElementById('orders-list-container');
  const dateFilterButtons = document.querySelectorAll('.date-filter-btn');
  const statusFilterButtons = document.querySelectorAll('.filter-btn');
  const searchInput = document.getElementById('order-search-input');
  const newCountSpan = document.getElementById('new-count');
  const progressCountSpan = document.getElementById('progress-count');
  const chatModal = document.getElementById('chat-modal');
  const closeChatBtn = document.getElementById('close-chat-btn');
  const chatMessagesContainer = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const sendQrBtn = document.getElementById('send-qr-btn');

  // --- State ---
  let allOrders = [];
  let currentStatusFilter = 'all';
  let currentDateFilter = 'today'; // Default to showing today's orders
  let ordersUnsub = null;
  let currentChatOrderId = null;
  let chatUnsub = null;

  // --- Auth ---
  onAuthStateChanged(auth, user => {
    if (user) {
      adminPanelWrapper?.classList.remove('hidden');
      listenForOrders();
    } else {
      window.location.href = '../admin/admin.html';
    }
  });

  adminLogoutBtn?.addEventListener('click', () => signOut(auth).then(() => window.location.href = '../admin/admin.html').catch(err => console.error(err)));

  // --- Orders Listener ---
  function listenForOrders() {
    if (ordersUnsub) ordersUnsub();
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    ordersUnsub = onSnapshot(q, snap => {
      allOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateFilterCounts();
      renderOrders();
    });
  }

  // --- Render Orders (UPDATED with Date Filter) ---
  function renderOrders() {
    ordersContainer.innerHTML = '';
    const term = (searchInput?.value || '').toLowerCase();

    // 1. Filter by Date Range
    const dateFiltered = filterByDate(allOrders, currentDateFilter);

    // 2. Filter by Status
    const statusFiltered = dateFiltered.filter(o => currentStatusFilter === 'all' || o.status === currentStatusFilter);

    // 3. Filter by Search Term
    const finalFiltered = statusFiltered.filter(o => !term || (o.userName || '').toLowerCase().includes(term) || (o.userEmail || '').toLowerCase().includes(term));

    if (!finalFiltered.length) {
      ordersContainer.innerHTML = '<p>No orders match the current filters.</p>';
      return;
    }
    finalFiltered.forEach(o => ordersContainer.appendChild(createOrderCard(o)));
  }

  // --- NEW: Date Filtering Logic ---
  function filterByDate(orders, range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let startDate;

    if (range === 'today') {
      startDate = today;
    } else if (range === 'week') {
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Start of week (Monday)
    } else if (range === 'month') {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1); // Start of month
    } else {
      return orders; // Should not happen, but as a fallback
    }

    return orders.filter(order => {
      if (!order.createdAt || !order.createdAt.seconds) return false;
      const orderDate = new Date(order.createdAt.seconds * 1000);
      return orderDate >= startDate;
    });
  }

  // --- Filter Counts & Events ---
  function updateFilterCounts() {
    const newCount = allOrders.filter(o => o.status === 'new').length;
    const progressCount = allOrders.filter(o => o.status === 'in-progress').length;
    newCountSpan.textContent = `(${newCount})`;
    progressCountSpan.textContent = `(${progressCount})`;
  }

  dateFilterButtons.forEach(b => b.addEventListener('click', () => {
    dateFilterButtons.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentDateFilter = b.dataset.range;
    renderOrders();
  }));

  statusFilterButtons.forEach(b => b.addEventListener('click', () => {
    statusFilterButtons.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentStatusFilter = b.dataset.status;
    renderOrders();
  }));

  searchInput?.addEventListener('input', renderOrders);

  // --- All other functions (createOrderCard, openChat, sendMessage, etc.) are unchanged ---
  function createOrderCard(order) {
    const c = document.createElement('div');
    c.className = 'order-card';
    const date = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'N/A';
    const rows = (order.items || []).map(it => `<tr><td>${it.name}</td><td>${it.quantity}</td><td>₹${(it.price || 0).toFixed(2)}</td><td class="item-total">₹${((it.price || 0) * it.quantity).toFixed(2)}</td></tr>`).join('');
    const isCancelled = order.status === 'cancelled';
    const statuses = ['new', 'in-progress', 'completed', 'cancelled'];
    const statusPillsHTML = statuses.map(status => `<button class="status-pill status-${status} ${order.status === status ? 'active' : ''}" data-status="${status}" data-id="${order.id}" ${isCancelled ? 'disabled' : ''}>${status.replace('-', ' ')}</button>`).join('');
    c.innerHTML = `<div class="order-header"><h3>${order.userName}</h3><span>${date}</span></div><div class="order-body"><p><strong>Email:</strong> ${order.userEmail}</p><table class="order-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></div><div class="order-footer"><div class="order-footer-actions"><button class="btn-chat" data-id="${order.id}">Chat</button><div class="order-status-pills">${statusPillsHTML}</div></div><div class="order-total">₹${(order.totalAmount || 0).toFixed(2)}</div></div>`;
    c.querySelector('.btn-chat')?.addEventListener('click', () => openChat(order.id));
    c.querySelector('.order-status-pills')?.addEventListener('click', async e => { if (e.target.classList.contains('status-pill') && !e.target.disabled) { const newStatus = e.target.dataset.status; const orderId = e.target.dataset.id; try { await updateDoc(doc(db, 'orders', orderId), { status: newStatus }); } catch (err) { console.error('Status update error:', err); } } });
    return c;
  }
  function openChat(orderId) { currentChatOrderId = orderId; chatMessagesContainer && (chatMessagesContainer.innerHTML = '<p>Loading...</p>'); openModal(chatModal); if (chatUnsub) chatUnsub(); const messagesRef = collection(db, `orders/${orderId}/messages`); chatUnsub = onSnapshot(query(messagesRef, orderBy('timestamp')), snap => { chatMessagesContainer.innerHTML = ''; snap.forEach(d => { const m = d.data(); const div = document.createElement('div'); div.className = 'message ' + (m.sender === 'admin' ? 'sent' : 'received'); div.innerHTML = m.type === 'qr_code' ? `<img src="${m.content}" alt="QR Code">` : m.content; chatMessagesContainer.appendChild(div); }); chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight; }); }
  async function sendMessage(content, type = 'text') { if (!currentChatOrderId || !content?.trim()) return; try { await addDoc(collection(db, `orders/${currentChatOrderId}/messages`), { content, sender: 'admin', timestamp: serverTimestamp(), type, readByCustomer: false }); if (type === 'text') chatInput.value = ''; } catch (err) { console.error('send message error:', err); } }
  chatSendBtn?.addEventListener('click', () => sendMessage((chatInput?.value || '').trim()));
  chatInput?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage((chatInput.value || '').trim()); } });
  sendQrBtn?.addEventListener('click', () => sendMessage('https://placehold.co/300x300/eee/ccc?text=Your+Payment+QR+Code', 'qr_code'));
  closeChatBtn?.addEventListener('click', () => closeModal(chatModal));
  window.addEventListener('click', e => { if (e.target === chatModal) closeModal(chatModal); });
  function openModal(m) { if (m) m.style.display = 'block'; }
  function closeModal(m) { if (m) m.style.display = 'none'; }
});
