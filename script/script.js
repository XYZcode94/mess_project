// script.js (Unified, debug-friendly, ready-to-use)
// Make sure your <script> tag is: <script type="module" src="script.js"></script>
const orderSuccessSound = new Audio('../sound/order-success.mp3');
// e.g. './sounds/order-success.mp3' or full URL

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

  // --- CHECK: these element IDs must exist in your HTML ---
  // beverage-grid, search-form, search-input, search-history, load-more-btn,
  // user-actions, guest-actions, user-avatar, user-name, login-btn, logout-btn,
  // cart-link, cart-modal, cart-count, cart-items-container, cart-total,
  // place-order-btn, close-cart-btn, confirm-modal, confirm-btn-yes, confirm-btn-no,
  // hamburger-btn, nav-links
  //
  // If any are missing, you will see "Element not found" messages in console.

  // --- Firebase Config (leave as-is if correct) ---
  const firebaseConfig = {
    apiKey: "AIzaSyCaFan1ZaRDsHTaR5O2m9KmWLy0nSp3L1o",
    authDomain: "mess-project-3c021.firebaseapp.com",
    projectId: "mess-project-3c021",
    storageBucket: "mess-project-3c021.firebasestorage.app",
    messagingSenderId: "428617648708",
    appId: "1:428617648708:web:e5bf65bb56e89ae14b8a11",
    measurementId: "G-GFTQ6G6ZVJ"
  };

  // --- Initialize Firebase ---
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  enableIndexedDbPersistence(db).catch(err => {
    console.warn("Could not enable persistence (OK in many cases):", err);
  });
  const productsCollection = collection(db, 'products');

  // --- State ---
  let allProductsCache = []; // master cache (used for client-side advanced search)
  let cart = [];
  let currentUser = null;
  let lastVisibleDoc = null;
  let isFetching = false;
  const productsPerPage = 6;
  const searchHistoryKey = 'beverageSearchHistory';
  let itemToRemoveId = null;

  // --- DOM refs (guarded) ---
  const beverageGrid = document.getElementById('beverage-grid');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const searchHistoryContainer = document.getElementById('search-history');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const userActions = document.getElementById('user-actions');
  const guestActions = document.getElementById('guest-actions');
  const userAvatar = document.getElementById('user-avatar');
  const userName = document.getElementById('user-name');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const cartLink = document.getElementById('cart-link');
  const cartModal = document.getElementById('cart-modal');
  const cartCount = document.getElementById('cart-count');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartTotal = document.getElementById('cart-total');
  const placeOrderBtn = document.getElementById('place-order-btn');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const confirmModal = document.getElementById('confirm-modal');
  const confirmBtnYes = document.getElementById('confirm-btn-yes');
  const confirmBtnNo = document.getElementById('confirm-btn-no');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const navLinks = document.getElementById('nav-links');

  // quick guard: warn if critical elements missing
  [
    'beverage-grid', 'search-form', 'search-input', 'load-more-btn',
    'cart-items-container', 'cart-count', 'cart-total', 'place-order-btn'
  ].forEach(id => {
    if (!document.getElementById(id)) console.warn(`Element not found: #${id}`);
  });

  // --- Helper UI functions ---
  function showToast(message, type = 'success') {
    try {
      if (typeof Toastify !== 'undefined') {
        let background;
        if (type === 'error') background = "linear-gradient(to right, #dc3545, #c82333)";
        else if (type === 'info') background = "linear-gradient(to right, #17a2b8, #117a8b)";
        else background = "linear-gradient(to right, #28a745, #218838)"; // success

        Toastify({
          text: message,
          duration: 3000,
          close: true,
          gravity: "top",
          position: "center",
          stopOnFocus: true,
          style: {
            background,
            color: "#fff",          // white text
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "12px 20px",
            textAlign: "center"
          }
        }).showToast();
      } else {
        console.info("TOAST:", message);
      }
    } catch (err) {
      console.error("showToast error:", err);
    }
  }


  function renderSkeletonLoader() {
    if (!beverageGrid) return;
    beverageGrid.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const skeletonCard = document.createElement('div');
      skeletonCard.className = 'card skeleton';
      skeletonCard.innerHTML = `
        <div class="skeleton-img" style="height:140px;background:#eee;border-radius:8px;margin-bottom:8px"></div>
        <div class="skeleton-content">
          <div style="height:16px;width:60%;background:#eee;margin-bottom:8px"></div>
          <div style="height:12px;width:90%;background:#eee;margin-bottom:6px"></div>
          <div style="height:12px;width:70%;background:#eee;margin-bottom:6px"></div>
          <div style="height:18px;width:30%;background:#eee;margin-top:8px"></div>
        </div>`;
      beverageGrid.appendChild(skeletonCard);
    }
  }

  function setupCardAnimations() {
    const cards = document.querySelectorAll('.card:not(.skeleton)');
    if (!cards || cards.length === 0) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    cards.forEach(c => observer.observe(c));
  }

  function openModal(modal) { if (modal) modal.style.display = 'block'; }
  function closeModal(modal) { if (modal) modal.style.display = 'none'; }

  // --- Search history ---
  function getSearchHistory() { return JSON.parse(localStorage.getItem(searchHistoryKey) || '[]'); }
  function addToSearchHistory(term) {
    if (!term || term.length < 2) return;
    let history = getSearchHistory().filter(h => h.toLowerCase() !== term.toLowerCase());
    history.unshift(term);
    if (history.length > 5) history.pop();
    localStorage.setItem(searchHistoryKey, JSON.stringify(history));
  }
  function renderSearchHistory() {
    if (!searchHistoryContainer) return;
    const history = getSearchHistory();
    searchHistoryContainer.innerHTML = '';
    if (!history || history.length === 0) { hideSearchHistory(); return; }
    history.forEach(term => {
      const item = document.createElement('div');
      item.className = 'search-history-item';
      item.textContent = term;
      item.addEventListener('click', () => {
        searchInput.value = term;
        searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
      });
      searchHistoryContainer.appendChild(item);
    });
    searchHistoryContainer.classList.remove('hidden');
  }
  function hideSearchHistory() { if (searchHistoryContainer) searchHistoryContainer.classList.add('hidden'); }

  // --- Render products ---
  function renderProducts(productsToRender = [], clearGrid = false) {
    if (!beverageGrid) return;
    if (clearGrid) beverageGrid.innerHTML = '';
    if (!productsToRender || productsToRender.length === 0) {
      if (beverageGrid.innerHTML.trim() === '') {
        beverageGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">No beverages found.</p>';
      }
      return;
    }
    productsToRender.forEach(product => {
      const card = document.createElement('div');
      card.className = 'card';
      const price = (typeof product.price === 'number') ? `₹${product.price.toFixed(2)}` : '';
      card.innerHTML = `
        <img src="${product.image || ''}" alt="${product.name || ''}" />
        <div class="card-content">
          <h3>${product.name || 'Unnamed'}</h3>
          <p>${product.description || ''}</p>
          <span>${price}</span>
          <button class="add-to-cart-btn" data-id="${product.id}" ${!currentUser ? 'disabled' : ''}>
            ${!currentUser ? 'Login to Order' : 'Add to Cart'}
          </button>
        </div>`;
      beverageGrid.appendChild(card);
    });
    setupCardAnimations();
  }

  function toggleLoadMoreButton(show) {
    if (!loadMoreBtn) return;
    loadMoreBtn.classList.toggle('hidden', !show);
  }

  // --- Firestore fetching ---
  // Fetch a single page
  async function fetchPage(startAfterDoc = null) {
    if (isFetching) return;
    isFetching = true;
    if (loadMoreBtn) { loadMoreBtn.disabled = true; loadMoreBtn.textContent = 'Loading...'; }
    if (!startAfterDoc) renderSkeletonLoader();
    try {
      const q = startAfterDoc
        ? query(productsCollection, orderBy('name'), startAfter(startAfterDoc), limit(productsPerPage))
        : query(productsCollection, orderBy('name'), limit(productsPerPage));
      const snap = await getDocs(q);
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Append to cache but avoid duplicates
      const existingIds = new Set(allProductsCache.map(p => p.id));
      products.forEach(p => { if (!existingIds.has(p.id)) allProductsCache.push(p); });
      // Render fetched page
      if (!startAfterDoc) {
        beverageGrid.innerHTML = '';
      }
      renderProducts(products);
      lastVisibleDoc = snap.docs[snap.docs.length - 1] || lastVisibleDoc;
      toggleLoadMoreButton(snap.docs.length >= productsPerPage);
    } catch (err) {
      console.error("fetchPage error:", err);
      beverageGrid.innerHTML = '<p>Could not load menu.</p>';
      showToast("Could not load menu. See console.", 'error');
    } finally {
      isFetching = false;
      if (loadMoreBtn) { loadMoreBtn.disabled = false; loadMoreBtn.textContent = 'Load More'; }
    }
  }

  // Fetch everything into cache (used for client-side search). Use carefully for large datasets.
  async function fetchAllProductsIntoCache() {
    try {
      const q = query(productsCollection, orderBy('name'));
      const snap = await getDocs(q);
      allProductsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.info(`Fetched ${allProductsCache.length} products into cache.`);
    } catch (err) {
      console.error("fetchAllProductsIntoCache error:", err);
    }
  }

  // Server-side fallback search (if cache not yet available)
  async function serverSideSearch(searchTerm) {
    if (!searchTerm) return;
    try {
      const start = searchTerm.charAt(0).toUpperCase() + searchTerm.slice(1);
      const q = query(productsCollection, orderBy('name'), where('name', '>=', start), where('name', '<=', start + '\uf8ff'));
      const snap = await getDocs(q);
      const found = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      beverageGrid.innerHTML = '';
      renderProducts(found, true);
      toggleLoadMoreButton(false);
    } catch (err) {
      console.error("serverSideSearch error:", err);
      showToast("Search failed. Check console.", 'error');
    }
  }

  // --- Advanced client-side search ---
  function performAdvancedSearch(searchTerm) {
    const searchWords = searchTerm.toLowerCase().split(' ').filter(Boolean);
    const filtered = allProductsCache.filter(product => {
      const name = (product.name || '').toLowerCase();
      return searchWords.every(w => name.includes(w));
    });
    beverageGrid.innerHTML = '';
    renderProducts(filtered, false);
    toggleLoadMoreButton(false);
  }

  // --- Reset to paginated view ---
  function resetToPaginatedView() {
    beverageGrid.innerHTML = '';
    lastVisibleDoc = null;
    // Show first page from cache if available, otherwise fetch a page
    if (allProductsCache && allProductsCache.length >= productsPerPage) {
      renderProducts(allProductsCache.slice(0, productsPerPage), true);
      toggleLoadMoreButton(allProductsCache.length > productsPerPage);
    } else {
      fetchPage(); // will populate cache and UI
    }
  }

  // --- Auth & cart code ---
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateAddToCartButtonsState();
    if (user) {
      if (guestActions) guestActions.classList.add('hidden');
      if (userActions) userActions.classList.remove('hidden');
      if (userName) userName.textContent = (user.displayName || '').split(' ')[0] || 'User';
      if (userAvatar && user.photoURL) userAvatar.src = user.photoURL;
      await ensureUserDocument(user);
      await loadCartFromFirestore();
    } else {
      if (userActions) userActions.classList.add('hidden');
      if (guestActions) guestActions.classList.remove('hidden');
      cart = [];
      updateCartUI();
    }
    // Start UI product fetches
    if (allProductsCache.length === 0) {
      // Fetch first page then load all in background
      await fetchPage();
      fetchAllProductsIntoCache().catch(err => console.warn("Background full cache load failed:", err));
    } else {
      resetToPaginatedView();
    }
  });

  function updateAddToCartButtonsState() {
    const btns = document.querySelectorAll('.add-to-cart-btn');
    btns.forEach(b => {
      if (!b) return;
      if (currentUser) {
        b.disabled = false;
        b.textContent = 'Add to Cart';
      } else {
        b.disabled = true;
        b.textContent = 'Login to Order';
      }
    });
  }

  async function ensureUserDocument(user) {
    try {
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, { name: user.displayName || '', email: user.email || '', createdAt: serverTimestamp() });
      }
    } catch (err) {
      console.error("ensureUserDocument error:", err);
    }
  }

  // --- Cart functions ---
  async function addToCart(productId) {
    if (!currentUser) { showToast("Please log in to add items to your cart.", 'info'); return; }
    const product = allProductsCache.find(p => p.id === productId);
    if (!product) { console.error("Product not in cache:", productId); showToast("Product not found.", 'error'); return; }
    try {
      const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, productId);
      const cartItemDoc = await getDoc(cartItemRef);
      if (cartItemDoc.exists()) {
        const qty = (cartItemDoc.data().quantity || 0) + 1;
        await setDoc(cartItemRef, { quantity: qty }, { merge: true });
      } else {
        // store minimal product info in cart doc
        const { name, price, image } = product;
        await setDoc(cartItemRef, { name, price, image, quantity: 1 });
      }
      await loadCartFromFirestore();
      showToast(`${product.name} added to cart!`);
    } catch (err) {
      console.error("addToCart error:", err);
      showToast("Failed to add to cart.", 'error');
    }
  }

  async function loadCartFromFirestore() {
    if (!currentUser) return;
    try {
      const snap = await getDocs(collection(db, `users/${currentUser.uid}/cart`));
      cart = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateCartUI();
    } catch (err) {
      console.error("loadCartFromFirestore error:", err);
    }
  }

  async function updateCartItemQuantity(productId, newQuantity) {
    if (!currentUser) return;
    try {
      const ref = doc(db, `users/${currentUser.uid}/cart`, productId);
      if (newQuantity > 0) {
        await setDoc(ref, { quantity: newQuantity }, { merge: true });
      } else {
        await deleteDoc(ref);
      }
      await loadCartFromFirestore();
    } catch (err) {
      console.error("updateCartItemQuantity error:", err);
    }
  }

  function renderCartItems() {
    if (!cartItemsContainer) return;
    if (!cart || cart.length === 0) {
      cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
      placeOrderBtn.disabled = true;
      return;
    }
    placeOrderBtn.disabled = false;
    cartItemsContainer.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img src="${item.image || ''}" alt="${item.name || ''}">
        <div class="cart-item-details"><h4>${item.name || ''}</h4><span class="cart-item-price">₹${(item.price || 0).toFixed(2)}</span></div>
        <div class="cart-item-actions">
          <div class="quantity-controls">
            <button class="quantity-change" data-id="${item.id}" data-change="-1">-</button>
            <input type="number" value="${item.quantity}" min="1" data-id="${item.id}" class="quantity-input">
            <button class="quantity-change" data-id="${item.id}" data-change="1">+</button>
          </div>
          <button class="btn-remove-item" data-id="${item.id}" title="Remove item">Remove</button>
        </div>
      </div>`).join('');
  }

  function updateCartUI() {
    renderCartItems();
    const totalItems = cart.reduce((s, i) => s + (i.quantity || 0), 0);
    const totalAmount = cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
    if (cartCount) cartCount.textContent = totalItems;
    if (cartTotal) cartTotal.textContent = `₹${totalAmount.toFixed(2)}`;
  }

  // Place order

  async function placeOrder() {
    if (!currentUser || !cart || cart.length === 0) return;

    try {
      const ordersRef = collection(db, 'orders');
      const total = cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);

      // 1. Add order to Firestore
      await addDoc(ordersRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || '',
        userEmail: currentUser.email || '',
        items: cart,
        totalAmount: total,
        status: 'new',
        createdAt: serverTimestamp()
      });

      // 2. Play your custom order success sound
      orderSuccessSound.play().catch(e => {
        console.warn("Audio play was blocked:", e);
      });

      // 3. Clear the cart in Firestore
      for (const item of cart) {
        await deleteDoc(doc(db, `users/${currentUser.uid}/cart`, item.id));
      }

      // 4. Reload cart, show toast, close modal
      await loadCartFromFirestore();
      showToast("Order placed successfully! Please pay via UPI on delivery.", 'success');
      closeModal(cartModal);

    } catch (err) {
      console.error("placeOrder error:", err);
      showToast("Error placing order. See console.", 'error');
    }
  }

  // --- Modal confirm remove item ---
  function openConfirmModal(productId) {
    itemToRemoveId = productId;
    openModal(confirmModal);
  }
  function closeConfirmModal() {
    itemToRemoveId = null;
    closeModal(confirmModal);
  }
  if (confirmBtnYes) confirmBtnYes.addEventListener('click', async () => {
    if (itemToRemoveId) await updateCartItemQuantity(itemToRemoveId, 0);
    closeConfirmModal();
  });
  if (confirmBtnNo) confirmBtnNo.addEventListener('click', closeConfirmModal);

  // --- Events wiring ---
  if (hamburgerBtn && navLinks) {
    hamburgerBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
  }

  if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => fetchPage(lastVisibleDoc));

  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const term = (searchInput && searchInput.value || '').trim();
      if (!term) {
        resetToPaginatedView();
        return;
      }
      addToSearchHistory(term);
      // If cache loaded, use client-side advanced search; otherwise fallback to server-side search
      if (allProductsCache && allProductsCache.length > 0) {
        performAdvancedSearch(term);
      } else {
        await serverSideSearch(term);
      }
      hideSearchHistory();
      if (searchInput) searchInput.blur();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (e.target.value === '') {
        resetToPaginatedView();
      }
    });
    searchInput.addEventListener('focus', renderSearchHistory);
  }
  if (document) {
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) hideSearchHistory();
    });
  }

  if (beverageGrid) {
    beverageGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.add-to-cart-btn');
      if (!btn) return;
      const id = btn.dataset.id;
      addToCart(id);
    });
  }

  if (cartItemsContainer) {
    cartItemsContainer.addEventListener('click', (e) => {
      const target = e.target.closest('.btn-remove-item, .quantity-change');
      if (!target) return;
      const id = target.dataset.id;
      if (target.classList.contains('quantity-change')) {
        const change = parseInt(target.dataset.change || '0', 10);
        const item = cart.find(i => i.id === id);
        if (!item) return;
        updateCartItemQuantity(id, Math.max(0, (item.quantity || 0) + change));
      } else {
        openConfirmModal(id);
      }
    });
    cartItemsContainer.addEventListener('change', (e) => {
      const input = e.target;
      if (input.classList && input.classList.contains('quantity-input')) {
        const id = input.dataset.id;
        const newQty = parseInt(input.value || '1', 10);
        updateCartItemQuantity(id, Math.max(1, newQty));
      }
    });
  }

  if (loginBtn) loginBtn.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => console.error("Login failed:", err));
  });
  if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth).catch(err => console.error("Sign out failed:", err)));

  if (cartLink) cartLink.addEventListener('click', (e) => { e.preventDefault(); openModal(cartModal); });
  if (closeCartBtn) closeCartBtn.addEventListener('click', () => closeModal(cartModal));
  if (placeOrderBtn) placeOrderBtn.addEventListener('click', () => placeOrder());

  window.addEventListener('click', (e) => {
    if (e.target === cartModal) closeModal(cartModal);
    if (e.target === confirmModal) closeConfirmModal();
  });

  // --- Initial load: get first page and start background cache load ---
  (async function initialLoad() {
    // show skeleton then fetch page
    renderSkeletonLoader();
    await fetchPage();              // shows first page
    fetchAllProductsIntoCache();    // background populate cache (non-blocking)
  })();

});
