// script.js (patched / reviewed version)
// - Many problems from original file were fixed and are described inline as comments.
// - Keep this as a module: <script type="module" src="script.js"></script>

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
  enableIndexedDbPersistence,
  runTransaction
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

  // ---------------------------
  // Firebase config (unchanged)
  // ---------------------------
  const firebaseConfig = {
    apiKey: "AIzaSyCaFan1ZaRDsHTaR5O2m9KmWLy0nSp3L1o",
    authDomain: "mess-project-3c021.firebaseapp.com",
    projectId: "mess-project-3c021",
    storageBucket: "mess-project-3c021.firebasestorage.app", // verify in console if needed
    messagingSenderId: "428617648708",
    appId: "1:428617648708:web:e5bf65bb56e89ae14b8a11",
    measurementId: "G-GFTQ6G6ZVJ"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);

  // Try enabling persistence, but it's optional
  enableIndexedDbPersistence(db).catch(err => {
    console.warn("Could not enable persistence (OK in many cases):", err);
  });

  const productsCollection = collection(db, 'products');

  // ---------------------------
  // State
  // ---------------------------
  let allProductsCache = []; // cached product objects (be careful with size!)
  let cart = []; // local copy of cart (items are { id, quantity, ...from firestore })
  let currentUser = null;
  let lastVisibleDoc = null;
  let isFetching = false;
  const productsPerPage = 6;
  const searchHistoryKey = 'beverageSearchHistory';
  let itemToRemoveId = null;
  let initialLoadStarted = false;
  let cardObserver = null;
  let audioAllowed = false; // user must enable sound (some browsers require user gesture)

  // ---------------------------
  // Audio files - FIX: module-relative and lazy usage
  // Problem: relative path resolved relative to document, not module; autoplay blocked.
  // Fix: use import.meta.url to resolve module-relative path; play only when allowed or after interaction.
  // ---------------------------
  const orderSuccessUrl = new URL('../sound/order-success.mp3', import.meta.url).href;
  const orderErrorUrl = new URL('../sound/order-error.mp3', import.meta.url).href;
  // Create Audio objects lazily (do not auto-play). This prevents preloading large files and gives us control.
  let orderSuccessSound = null;
  let orderErrorSound = null;
  function ensureAudioCreated() {
    if (!orderSuccessSound) orderSuccessSound = new Audio(orderSuccessUrl);
    if (!orderErrorSound) orderErrorSound = new Audio(orderErrorUrl);
  }
  // Example: enable audio on first user click (you may wire a UI toggle instead)
  window.addEventListener('click', () => { audioAllowed = true; ensureAudioCreated(); }, { once: true });

  // ---------------------------
  // DOM refs (guarded) - unchanged except usage
  // ---------------------------
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

  // warn if critical elements missing (unchanged behavior)
  [
    'beverage-grid', 'search-form', 'search-input', 'load-more-btn',
    'cart-items-container', 'cart-count', 'cart-total', 'place-order-btn'
  ].forEach(id => {
    // FIX: Corrected syntax for console.warn string
    if (!document.getElementById(id)) console.warn(`Element not found: #${id}`);
  });

  // ---------------------------
  // Helper: Toast fallback (improves on original)
  // Problem: original showToast fell back to console.info only - invisible to users.
  // Fix: keep Toastify when available, otherwise show a minimal DOM toast so user sees errors.
  // ---------------------------
  function showToast(message, type = 'success') {
    try {
      if (typeof Toastify !== 'undefined') {
        let background;
        if (type === 'error') background = "linear-gradient(to right, #dc3545, #c82333)";
        else if (type === 'info') background = "linear-gradient(to right, #17a2b8, #117a8b)";
        else background = "linear-gradient(to right, #28a745, #218838)";
        Toastify({
          text: message,
          duration: 3000,
          close: true,
          gravity: "top",
          position: "center",
          stopOnFocus: true,
          style: {
            background,
            color: "#fff",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "12px 20px",
            textAlign: "center"
          }
        }).showToast();
      } else {
        // fallback DOM toast (visible)
        const el = document.createElement('div');
        // FIX: Corrected className assignment with valid, space-separated classes.
        el.className = `fallback-toast fallback-toast-${type}`;
        el.textContent = message;
        Object.assign(el.style, {
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: (type === 'error' ? '#c82333' : (type === 'info' ? '#117a8b' : '#218838')),
          color: '#fff',
          padding: '10px 16px',
          borderRadius: '8px',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        });
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
        console.info("TOAST:", message);
      }
    } catch (err) {
      console.error("showToast error:", err);
    }
  }

  // ---------------------------
  // Skeleton loader (unchanged)
  // ---------------------------
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

  // ---------------------------
  // IntersectionObserver reuse - FIX
  // Problem: original created a new IntersectionObserver on every render causing leaks and duplicated observation.
  // Fix: create one observer and reuse it. Observe only non-visible cards.
  // ---------------------------
  function setupCardAnimations() {
    if (!('IntersectionObserver' in window)) return;
    if (!cardObserver) {
      cardObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            cardObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
    }
    const cards = document.querySelectorAll('.card:not(.skeleton):not(.visible)');
    cards.forEach(c => cardObserver.observe(c));
  }

  // ---------------------------
  // Simple modal utilities (unchanged)
  // ---------------------------
  function openModal(modal) { if (modal) modal.style.display = 'block'; }
  function closeModal(modal) { if (modal) modal.style.display = 'none'; }

  // ---------------------------
  // Search history (unchanged, small improvement)
  // ---------------------------
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
        if (searchInput) searchInput.value = term;
        // FIX: use requestSubmit when available (more realistic than dispatchEvent)
        if (searchForm && typeof searchForm.requestSubmit === 'function') searchForm.requestSubmit();
        else if (searchForm) searchForm.dispatchEvent(new Event('submit', { cancelable: true }));
      });
      searchHistoryContainer.appendChild(item);
    });
    searchHistoryContainer.classList.remove('hidden');
  }
  function hideSearchHistory() { if (searchHistoryContainer) searchHistoryContainer.classList.add('hidden'); }

  // ---------------------------
  // Safe DOM product rendering - FIX major XSS issue
  // Problem: original used innerHTML with user-supplied fields (XSS).
  // Fix: create DOM nodes and set textContent / validated attributes.
  // ---------------------------

  // Helper: validate an image URL
  function isSafeImageUrl(url) {
    if (!url) return false;
    try {
      const u = new URL(url, location.href);
      // allow http(s) only (or add 'data:' if you intentionally accept it)
      return (u.protocol === 'https:' || u.protocol === 'http:');
    } catch (e) {
      return false;
    }
  }

  // Helper: safe price formatting
  function formatPrice(price) {
    const priceNum = Number(price);
    return Number.isFinite(priceNum) ? `₹${priceNum.toFixed(2)}` : '—';
  }

  // Create a product card (safe)
  function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'card';

    const img = document.createElement('img');
    img.alt = product.name || '';
    img.src = isSafeImageUrl(product.image) ? product.image : '/images/placeholder.png';
    // optional: add lazy loading
    img.loading = 'lazy';

    const content = document.createElement('div');
    content.className = 'card-content';

    const h3 = document.createElement('h3');
    h3.textContent = product.name || 'Unnamed';

    const p = document.createElement('p');
    p.textContent = product.description || '';

    const spanPrice = document.createElement('span');
    spanPrice.textContent = formatPrice(product.price);

    const btn = document.createElement('button');
    btn.type = 'button'; // FIX: ensure buttons do not submit parent forms unintentionally
    btn.className = 'add-to-cart-btn';
    btn.dataset.id = product.id;
    // Make label reflect currentUser; we'll update buttons after auth changes
    btn.disabled = !currentUser;
    btn.textContent = currentUser ? 'Add to Cart' : 'Login to Order';

    content.appendChild(h3);
    content.appendChild(p);
    content.appendChild(spanPrice);
    content.appendChild(btn);

    card.appendChild(img);
    card.appendChild(content);
    return card;
  }

  // Render products using DocumentFragment for efficiency
  function renderProducts(productsToRender = [], clearGrid = false) {
    if (!beverageGrid) return;
    if (clearGrid) beverageGrid.innerHTML = '';
    if (!productsToRender || productsToRender.length === 0) {
      if (beverageGrid.innerHTML.trim() === '') {
        beverageGrid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">No beverages found.</p>';
      }
      return;
    }

    const fragment = document.createDocumentFragment();
    productsToRender.forEach(product => {
      const card = createProductCard(product);
      fragment.appendChild(card);
    });
    beverageGrid.appendChild(fragment);
    setupCardAnimations();
  }

  function toggleLoadMoreButton(show) {
    if (!loadMoreBtn) return;
    loadMoreBtn.classList.toggle('hidden', !show);
  }

  // ---------------------------
  // Firestore fetching & pagination improvements
  // - fetchPage guarded against passing undefined to startAfter
  // ---------------------------
  async function fetchPage(startAfterDoc = null) {
    if (isFetching) return;
    isFetching = true;
    if (loadMoreBtn) { loadMoreBtn.disabled = true; loadMoreBtn.textContent = 'Loading...'; }
    if (!startAfterDoc) renderSkeletonLoader();

    try {
      let q;
      if (startAfterDoc) {
        q = query(productsCollection, orderBy('name'), startAfter(startAfterDoc), limit(productsPerPage));
      } else {
        q = query(productsCollection, orderBy('name'), limit(productsPerPage));
      }
      const snap = await getDocs(q);
      const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Append to cache but avoid duplicates
      const existingIds = new Set(allProductsCache.map(p => p.id));
      products.forEach(p => { if (!existingIds.has(p.id)) allProductsCache.push(p); });

      if (!startAfterDoc) {
        beverageGrid.innerHTML = '';
      }
      renderProducts(products);
      lastVisibleDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
      toggleLoadMoreButton(snap.docs.length >= productsPerPage);

    } catch (err) {
      console.error("fetchPage error:", err);
      if (beverageGrid) beverageGrid.innerHTML = '<p>Could not load menu.</p>';
      showToast("Could not load menu. See console.", 'error');
    } finally {
      isFetching = false;
      if (loadMoreBtn) { loadMoreBtn.disabled = false; loadMoreBtn.textContent = 'Load More'; }
    }
  }

  // ---------------------------
  // Fetch everything into cache safely (paged)
  // Problem: original fetched whole collection at once - OOM risk.
  // Fix: fetch in batches with startAfter loop; still be careful with huge collections.
  // ---------------------------
  async function fetchAllProductsIntoCache(batchSize = 200) {
    try {
      let last = null;
      allProductsCache = [];
      while (true) {
        const q = last
          ? query(productsCollection, orderBy('name'), startAfter(last), limit(batchSize))
          : query(productsCollection, orderBy('name'), limit(batchSize));
        const snap = await getDocs(q);
        if (!snap || snap.empty) break;
        snap.docs.forEach(d => allProductsCache.push({ id: d.id, ...d.data() }));
        last = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < batchSize) break;
      }
      console.info(`Fetched ${allProductsCache.length} products into cache.`);
    } catch (err) {
      console.error("fetchAllProductsIntoCache error:", err);
    }
  }

  // ---------------------------
  // Server-side search fallback - improved for case-insensitive prefix searches
  // Problem: original capitalized only first char and used regular name field (case-sensitive).
  // Fix: assume documents include a 'name_lower' field (recommended) and search on that. Also show fallback message when index required.
  // NOTE: This requires you to write 'name_lower' to product docs on write/update.
  // ---------------------------
  async function serverSideSearch(searchTerm) {
    if (!searchTerm) return;
    try {
      const startLower = searchTerm.toLowerCase();
      const q = query(productsCollection, orderBy('name_lower'), where('name_lower', '>=', startLower), where('name_lower', '<=', startLower + '\uf8ff'));
      const snap = await getDocs(q);
      const found = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (beverageGrid) beverageGrid.innerHTML = '';
      renderProducts(found, true);
      toggleLoadMoreButton(false);
    } catch (err) {
      // If index missing, Firestore will throw with a link to create it
      console.error("serverSideSearch error:", err);
      showToast("Search failed. Check console (index maybe required).", 'error');
    }
  }

  // ---------------------------
  // Client-side advanced search (unchanged idea but safe)
  // ---------------------------
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

  // ---------------------------
  // resetToPaginatedView: improved to respect initial load centralization
  // ---------------------------
  function resetToPaginatedView() {
    if (!beverageGrid) return;
    beverageGrid.innerHTML = '';
    lastVisibleDoc = null;
    if (allProductsCache && allProductsCache.length >= productsPerPage) {
      renderProducts(allProductsCache.slice(0, productsPerPage), true);
      toggleLoadMoreButton(allProductsCache.length > productsPerPage);
    } else {
      fetchPage();
    }
  }

  // ---------------------------
  // Auth & cart code
  // ---------------------------
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

    // Centralized initial load: avoid duplicate fetches
    if (!initialLoadStarted) {
      initialLoadStarted = true;
      // Fetch first page then load all in background
      renderSkeletonLoader();
      await fetchPage();
      fetchAllProductsIntoCache().catch(err => console.warn("Background full cache load failed:", err));
    } else {
      resetToPaginatedView();
    }
  });

  // updateAddToCartButtonsState (unchanged logic but safe)
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

  // ensureUserDocument (unchanged)
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

  // ---------------------------
  // Cart functions - MAJOR CHANGE: store only productId + quantity in cart docs (do not trust client price)
  // Problem: original stored name/price/image in cart from client (trust issue).
  // Fix: store minimal info (productId + quantity) and resolve canonical data when creating order.
  // ---------------------------
  async function addToCart(productId) {
    if (!currentUser) { showToast("Please log in to add items to your cart.", 'info'); return; }
    // Ensure product exists in cache first
    const product = allProductsCache.find(p => p.id === productId);
    if (!product) { console.error("Product not in cache:", productId); showToast("Product not found.", 'error'); return; }
    try {
      // FIX: Use template literal for Firestore path.
      const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, productId);
      const cartItemDoc = await getDoc(cartItemRef);
      if (cartItemDoc.exists()) {
        const qty = (cartItemDoc.data().quantity || 0) + 1;
        await setDoc(cartItemRef, { quantity: qty }, { merge: true });
      } else {
        // safer: store productId & quantity only; client can keep a local copy of name/image for UI but server is trusted source
        await setDoc(cartItemRef, { productId: productId, quantity: 1, updatedAt: serverTimestamp() });
      }
      await loadCartFromFirestore();
      showToast(`${product.name} added to cart!`);
    } catch (err) {
      console.error("addToCart error:", err);
      showToast("Failed to add to cart.", 'error');
    }
  }

  // loadCartFromFirestore loads cart items and enriches them with product data from cache if available
  async function loadCartFromFirestore() {
    if (!currentUser) return;
    try {
      // FIX: Use template literal for Firestore path.
      const snap = await getDocs(collection(db, `users/${currentUser.uid}/cart`));
      // each cart doc might contain productId & quantity
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // enrich with canonical product info from cache where possible (not trusting client values)
      cart = raw.map(item => {
        const prod = allProductsCache.find(p => p.id === item.id || p.id === item.productId);
        return {
          id: item.id,
          productId: item.productId || item.id,
          quantity: Number.isInteger(item.quantity) ? item.quantity : (item.quantity ? Number(item.quantity) : 1),
          name: prod ? prod.name : (item.name || 'Unknown'),
          price: prod ? prod.price : (item.price || 0),
          image: prod && isSafeImageUrl(prod.image) ? prod.image : (isSafeImageUrl(item.image) ? item.image : '/images/placeholder.png')
        };
      });
      updateCartUI();
    } catch (err) {
      console.error("loadCartFromFirestore error:", err);
    }
  }

  // updateCartItemQuantity: validate input before writing
  async function updateCartItemQuantity(productId, newQuantity) {
    if (!currentUser) return;
    // FIX: validate newQuantity properly
    if (!Number.isInteger(newQuantity) || newQuantity < 0 || Number.isNaN(newQuantity)) {
      console.warn('Ignored invalid quantity:', newQuantity);
      return;
    }
    try {
      // FIX: Use template literal for Firestore path.
      const ref = doc(db, `users/${currentUser.uid}/cart`, productId);
      if (newQuantity === 0) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { quantity: newQuantity }, { merge: true });
      }
      await loadCartFromFirestore();
    } catch (err) {
      console.error("updateCartItemQuantity error:", err);
    }
  }

  // renderCartItems: use safe DOM creation (no innerHTML injection) and use formatPrice
  function renderCartItems() {
    if (!cartItemsContainer) return;
    if (!cart || cart.length === 0) {
      cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
      if (placeOrderBtn) placeOrderBtn.disabled = true;
      return;
    }
    if (placeOrderBtn) placeOrderBtn.disabled = false;

    // Build DOM fragment
    const frag = document.createDocumentFragment();
    cart.forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.className = 'cart-item';

      const img = document.createElement('img');
      img.src = item.image || '/images/placeholder.png';
      img.alt = item.name || '';

      const details = document.createElement('div');
      details.className = 'cart-item-details';
      const h4 = document.createElement('h4');
      h4.textContent = item.name || '';
      const priceSpan = document.createElement('span');
      priceSpan.className = 'cart-item-price';
      priceSpan.textContent = formatPrice(item.price);

      details.appendChild(h4);
      details.appendChild(priceSpan);

      const actions = document.createElement('div');
      actions.className = 'cart-item-actions';

      const controls = document.createElement('div');
      controls.className = 'quantity-controls';

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'quantity-change';
      minusBtn.dataset.id = item.id;
      minusBtn.dataset.change = '-1';
      minusBtn.textContent = '-';

      const input = document.createElement('input');
      input.type = 'number';
      input.value = item.quantity;
      input.min = '1';
      input.dataset.id = item.id;
      input.className = 'quantity-input';

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'quantity-change';
      plusBtn.dataset.id = item.id;
      plusBtn.dataset.change = '1';
      plusBtn.textContent = '+';

      controls.appendChild(minusBtn);
      controls.appendChild(input);
      controls.appendChild(plusBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-item';
      removeBtn.dataset.id = item.id;
      removeBtn.title = 'Remove item';
      removeBtn.textContent = 'Remove';

      actions.appendChild(controls);
      actions.appendChild(removeBtn);

      wrapper.appendChild(img);
      wrapper.appendChild(details);
      wrapper.appendChild(actions);
      frag.appendChild(wrapper);
    });
    cartItemsContainer.innerHTML = '';
    cartItemsContainer.appendChild(frag);
  }

  // updateCartUI: compute totals safely
  function updateCartUI() {
    renderCartItems();
    const totalItems = cart.reduce((s, i) => s + (Number.isFinite(Number(i.quantity)) ? Number(i.quantity) : 0), 0);
    const totalAmount = cart.reduce((s, i) => s + (Number.isFinite(Number(i.price)) ? Number(i.price) * (Number(i.quantity) || 0) : 0), 0);
    if (cartCount) cartCount.textContent = totalItems;
    if (cartTotal) cartTotal.textContent = formatPrice(totalAmount);
  }

  // ---------------------------
  // placeOrder: FIX atomicity & server trust
  // Problem: original created an order client-side using client price then deleted cart items; not atomic and trusts client data.
  // Fix: Use runTransaction to create order and delete cart docs atomically (client-side transaction has limits).
  // Ideally move to Cloud Function to validate prices and inventory with server admin privileges.
  // ---------------------------
  async function placeOrder() {
    if (!currentUser || !cart || cart.length === 0) return;

    try {
      // Enforce server validation: we attempt a transaction that:
      //  - reads canonical product prices from productsCollection
      //  - computes total
      //  - writes order doc and deletes cart docs in single transaction
      await runTransaction(db, async (tx) => {
        // compute total from canonical product docs
        let total = 0;
        const productDocs = [];
        for (const item of cart) {
          // item.productId is canonical id (we ensured earlier)
          const prodRef = doc(db, 'products', item.productId);
          const prodSnap = await tx.get(prodRef);
          // FIX: Use template literal for error message.
          if (!prodSnap.exists()) throw new Error(`Product not found: ${item.productId}`);
          const prodData = prodSnap.data();
          const priceNum = Number(prodData.price);
          // FIX: Use template literal for error message.
          if (!Number.isFinite(priceNum)) throw new Error(`Invalid price for product ${item.productId}`);
          total += priceNum * (Number(item.quantity) || 0);
          productDocs.push({ id: prodSnap.id, ...prodData });
        }

        const ordersRef = collection(db, 'orders');
        const orderRef = doc(ordersRef); // new doc ref
        // write order (serverTimestamp will be set)
        tx.set(orderRef, {
          userId: currentUser.uid,
          userName: currentUser.displayName || '',
          userEmail: currentUser.email || '',
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })), // minimal canonical info
          totalAmount: total,
          status: 'new',
          createdAt: serverTimestamp()
        });

        // delete cart entries
        for (const item of cart) {
          // FIX: Use template literal for Firestore path.
          const cartRef = doc(db, `users/${currentUser.uid}/cart`, item.id);
          tx.delete(cartRef);
        }
      });

      // play success sound if allowed
      if (audioAllowed) {
        try { ensureAudioCreated(); orderSuccessSound.play().catch(e => console.warn("Audio play blocked:", e)); }
        catch (e) { console.warn("Audio play error:", e); }
      }

      // Reload cart
      await loadCartFromFirestore();
      showToast("Order placed successfully! Please pay via UPI on delivery.", 'success');
      closeModal(cartModal);
    } catch (err) {
      console.error("placeOrder error:", err);
      if (audioAllowed) {
        try { ensureAudioCreated(); orderErrorSound.play().catch(e => console.warn("Audio play blocked:", e)); }
        catch (e) { console.warn("Audio play error:", e); }
      }
      showToast("Error placing order. See console.", 'error');
    }
  }

  // ---------------------------
  // Confirm modal handlers (unchanged semantics, safe)
  // ---------------------------
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

  // ---------------------------
  // Events wiring
  // ---------------------------
  if (hamburgerBtn && navLinks) {
    hamburgerBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
  }

  if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => fetchPage(lastVisibleDoc));

  // Debounce helper - FIX: add debounce to avoid hammering server on search
  function debounce(fn, delay = 300) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const term = (searchInput && (searchInput.value || '')).trim();
      if (!term) {
        resetToPaginatedView();
        return;
      }
      addToSearchHistory(term);
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
    // FIX: debounce the input handler
    searchInput.addEventListener('input', debounce((e) => {
      if (e.target.value === '') {
        resetToPaginatedView();
      }
    }, 300));
    searchInput.addEventListener('focus', renderSearchHistory);
  }

  // Document click to hide search history (remove redundant if(document) check)
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) hideSearchHistory();
  });

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
        // ensure not NaN
        const newQty = Math.max(0, (item.quantity || 0) + (Number.isFinite(Number(change)) ? change : 0));
        updateCartItemQuantity(id, newQty);
      } else {
        openConfirmModal(id);
      }
    });

    // input 'change' handler - FIX: robust parse and validation
    cartItemsContainer.addEventListener('change', (e) => {
      const input = e.target;
      if (input.classList && input.classList.contains('quantity-input')) {
        const id = input.dataset.id;
        const raw = input.value;
        const newQty = Number(raw);
        if (!Number.isInteger(newQty) || newQty < 1) {
          // revert to previous safe quantity
          const item = cart.find(i => i.id === id);
          input.value = item ? item.quantity : 1;
          return;
        }
        updateCartItemQuantity(id, newQty);
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

  // ---------------------------
  // FIX: Removed the redundant IIFE for initial load.
  // The logic is now correctly and safely handled only within the
  // onAuthStateChanged listener, which is the single source of truth for app startup.
  // ---------------------------

  // ---------------------------
  // Final notes as comments inside the file:
  // - SECURITY: Ensure Firestore security rules are strict:
  //     * users/{uid}/cart writes only allowed by authenticated user where request.auth.uid == uid
  //     * orders creation should be validated server-side (Cloud Function recommended)
  // - SEARCH: For robust full-text search, integrate Algolia/Elastic or Firebase Extensions with search indexing.
  // - PERFORMANCE: If products collection is large, avoid client-side full cache; prefer server-side search or dedicated search index.
  // - MAINTAINABILITY: Add JSDoc and possibly convert to TypeScript for stronger guarantees.
  // ---------------------------

});