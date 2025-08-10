// script.js (Unified, cleaned, ready-to-use)
// Use: <script type="module" src="script.js"></script>

// ---------------- Audio ----------------
const orderSuccessSound = new Audio('../sound/order-success.mp3');
const orderErrorSound = new Audio('../sound/order-error.mp3');

// ---------------- Firebase imports ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc,
  addDoc, serverTimestamp, query, orderBy, limit, startAfter, where,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

// ---------------- Config & Initialization ----------------
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
enableIndexedDbPersistence(db).catch(err => {
  console.warn("IndexedDB persistence not enabled (maybe multiple tabs):", err);
});

const productsCollection = collection(db, 'products');

// ---------------- State ----------------
let allProductsCache = [];
let cart = [];
let currentUser = null;
let lastVisibleDoc = null;
let isFetching = false;
const productsPerPage = 6;
const searchHistoryKey = 'beverageSearchHistory';
let itemToRemoveId = null;
let deliveryAddress = null;

// ---------------- DOM refs (guarded) ----------------
const $ = id => document.getElementById(id);
const beverageGrid = $('beverage-grid');
const searchForm = $('search-form');
const searchInput = $('search-input');
const searchHistoryContainer = $('search-history');
const loadMoreBtn = $('load-more-btn');
const userActions = $('user-actions');
const guestActions = $('guest-actions');
const userAvatar = $('user-avatar');
const userName = $('user-name');
const loginBtn = $('login-btn');
const logoutBtn = $('logout-btn');
const cartLink = $('cart-link');
const cartModal = $('cart-modal');
const cartCount = $('cart-count');
const cartItemsContainer = $('cart-items-container');
const cartTotal = $('cart-total');
const placeOrderBtn = $('place-order-btn');
const closeCartBtn = $('close-cart-btn');
const confirmModal = $('confirm-modal');
const confirmBtnYes = $('confirm-btn-yes');
const confirmBtnNo = $('confirm-btn-no');
const hamburgerBtn = $('hamburger-btn');
const navLinks = $('nav-links');
const getLocationBtn = $('get-location-btn');
const addressDisplay = $('address-display');

// Minimal DOM guard: warn missing critical elements
[
  'beverage-grid', 'search-form', 'search-input', 'load-more-btn',
  'cart-items-container', 'cart-count', 'cart-total', 'place-order-btn'
].forEach(id => {
  if (!$(id)) console.warn(`Element not found: #${id}`);
});

// ---------------- Helpers ----------------
function showToast(message, type = 'success') {
  try {
    if (typeof Toastify !== 'undefined') {
      const background = type === 'error'
        ? "linear-gradient(to right,#dc3545,#c82333)"
        : type === 'info'
          ? "linear-gradient(to right,#17a2b8,#117a8b)"
          : "linear-gradient(to right,#28a745,#218838)";
      Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top",
        position: "center",
        stopOnFocus: true,
        style: { background, color: "#fff", borderRadius: "8px", fontWeight: "600" }
      }).showToast();
    } else {
      console.info(`[${type}] ${message}`);
    }
  } catch (err) {
    console.error("showToast error:", err);
  }
}
function openModal(modal) { if (modal) modal.style.display = 'block'; }
function closeModal(modal) { if (modal) modal.style.display = 'none'; }
function renderSkeletonLoader() {
  if (!beverageGrid) return;
  beverageGrid.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('div');
    s.className = 'card skeleton';
    s.innerHTML = `
      <div style="height:140px;background:#eee;border-radius:8px;margin-bottom:8px"></div>
      <div style="height:16px;width:60%;background:#eee;margin-bottom:8px"></div>
      <div style="height:12px;width:90%;background:#eee;margin-bottom:6px"></div>
    `;
    beverageGrid.appendChild(s);
  }
}
function setupCardAnimations() {
  const cards = document.querySelectorAll('.card:not(.skeleton)');
  if (!cards || cards.length === 0) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) {
        en.target.classList.add('visible');
        obs.unobserve(en.target);
      }
    });
  }, { threshold: 0.1 });
  cards.forEach(c => obs.observe(c));
}

// ---------------- Search history ----------------
function getSearchHistory() { return JSON.parse(localStorage.getItem(searchHistoryKey) || '[]'); }
function addToSearchHistory(term) {
  if (!term || term.length < 2) return;
  let history = getSearchHistory().filter(h => h.toLowerCase() !== term.toLowerCase());
  history.unshift(term);
  if (history.length > 5) history = history.slice(0, 5);
  localStorage.setItem(searchHistoryKey, JSON.stringify(history));
}
function renderSearchHistory() {
  if (!searchHistoryContainer) return;
  const history = getSearchHistory();
  searchHistoryContainer.innerHTML = '';
  if (!history.length) { searchHistoryContainer.classList.add('hidden'); return; }
  history.forEach(term => {
    const el = document.createElement('div');
    el.className = 'search-history-item';
    el.textContent = term;
    el.addEventListener('click', () => {
      if (searchInput) searchInput.value = term;
      searchForm?.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    searchHistoryContainer.appendChild(el);
  });
  searchHistoryContainer.classList.remove('hidden');
}
function hideSearchHistory() { if (searchHistoryContainer) searchHistoryContainer.classList.add('hidden'); }

// ---------------- Products rendering & fetch ----------------
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
        <div class="card-bottom">
          <span class="price">${price}</span>
          <button class="add-to-cart-btn" data-id="${product.id}" ${!currentUser ? 'disabled' : ''}>
            ${!currentUser ? 'Login to Order' : 'Add to Cart'}
          </button>
        </div>
      </div>
    `;
    beverageGrid.appendChild(card);
  });
  setupCardAnimations();
}
function toggleLoadMoreButton(show) {
  if (!loadMoreBtn) return;
  loadMoreBtn.classList.toggle('hidden', !show);
}

// Fetch a paginated page of products
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
    // append to cache, avoiding duplicates
    const ids = new Set(allProductsCache.map(p => p.id));
    for (const p of products) if (!ids.has(p.id)) allProductsCache.push(p);
    if (!startAfterDoc) beverageGrid.innerHTML = '';
    renderProducts(products);
    lastVisibleDoc = snap.docs[snap.docs.length - 1] || lastVisibleDoc;
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

// Fetch all products into client cache (careful for very large datasets)
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

// server-side fallback search
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

// advanced client-side search
function performAdvancedSearch(searchTerm) {
  const words = searchTerm.toLowerCase().split(' ').filter(Boolean);
  const filtered = allProductsCache.filter(product => {
    const name = (product.name || '').toLowerCase();
    return words.every(w => name.includes(w));
  });
  beverageGrid.innerHTML = '';
  renderProducts(filtered, true);
  toggleLoadMoreButton(false);
}
function resetToPaginatedView() {
  beverageGrid.innerHTML = '';
  lastVisibleDoc = null;
  if (allProductsCache && allProductsCache.length >= productsPerPage) {
    renderProducts(allProductsCache.slice(0, productsPerPage), true);
    toggleLoadMoreButton(allProductsCache.length > productsPerPage);
  } else {
    fetchPage();
  }
}

// ---------------- Auth & User doc ----------------
async function ensureUserDocument(user) {
  if (!user) return;
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

// ---------------- Cart operations ----------------
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
    if (placeOrderBtn) placeOrderBtn.disabled = true;
    return;
  }
  if (placeOrderBtn) placeOrderBtn.disabled = false;
  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img src="${item.image || ''}" alt="${item.name || ''}">
      <div class="cart-item-details">
        <h4>${item.name || ''}</h4>
        <span class="cart-item-price">₹${(item.price || 0).toFixed(2)}</span>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-controls">
          <button class="quantity-change" data-id="${item.id}" data-change="-1">-</button>
          <input type="number" value="${item.quantity}" min="1" data-id="${item.id}" class="quantity-input">
          <button class="quantity-change" data-id="${item.id}" data-change="1">+</button>
        </div>
        <button class="btn-remove-item" data-id="${item.id}" title="Remove item">🗑</button>
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

// ---------------- Location (Get Address) ----------------
if (getLocationBtn) {
  getLocationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      if (addressDisplay) addressDisplay.value = "Geolocation not supported.";
      return;
    }
    if (addressDisplay) { addressDisplay.value = "Getting your location..."; addressDisplay.classList.add('loading'); }
    if (placeOrderBtn) placeOrderBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`);
          const data = await res.json();
          if (data && data.address) {
            deliveryAddress = [
              data.address.road, data.address.suburb, data.address.city,
              data.address.state, data.address.postcode, data.address.country
            ].filter(Boolean).join(', ');
            if (addressDisplay) addressDisplay.value = deliveryAddress;
            if (placeOrderBtn) placeOrderBtn.disabled = false;
          } else {
            if (addressDisplay) addressDisplay.value = "Could not derive address. Try again.";
          }
        } catch (err) {
          console.error("reverse geocode error:", err);
          if (addressDisplay) addressDisplay.value = "Could not find address.";
        } finally {
          if (addressDisplay) addressDisplay.classList.remove('loading');
        }
      },
      (error) => {
        if (addressDisplay) {
          switch (error.code) {
            case error.PERMISSION_DENIED: addressDisplay.value = "Location permission denied."; break;
            case error.POSITION_UNAVAILABLE: addressDisplay.value = "Location unavailable."; break;
            case error.TIMEOUT: addressDisplay.value = "Location request timed out."; break;
            default: addressDisplay.value = "Unknown location error."; break;
          }
          addressDisplay.classList.remove('loading');
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
    );
  });
}

// ---------------- Place Order (Single unified function) ----------------
async function placeOrder() {
  if (!currentUser) { showToast("Please log in before placing an order.", 'info'); return; }
  if (!cart || cart.length === 0) { showToast("Your cart is empty.", 'info'); return; }
  if (!deliveryAddress) { showToast("Please get your delivery address before placing an order.", 'info'); return; }
  // if (!contactNumber) {showToast("Please provide your contact number before placing an order.", 'info'); return}
  if (placeOrderBtn) { placeOrderBtn.disabled = true; placeOrderBtn.textContent = 'Placing Order...'; }

  try {
    const totalAmount = cart.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0);
    await addDoc(collection(db, 'orders'), {
      userId: currentUser.uid,
      userName: currentUser.displayName || '',
      userEmail: currentUser.email || '',
      items: cart,
      totalAmount,
      status: 'new',
      createdAt: serverTimestamp(),
      deliveryAddress
    
    });

    // play success sound (safe)
    if (typeof orderSuccessSound !== 'undefined') {
      orderSuccessSound.play().catch(e => console.warn("Audio play blocked:", e));
    }

    // clear cart in parallel for speed
    await Promise.all(cart.map(item => deleteDoc(doc(db, `users/${currentUser.uid}/cart`, item.id))));

    // reload cart and UI
    await loadCartFromFirestore();
    showToast("Order placed successfully! Please pay via UPI on delivery.", 'success');
    closeModal(cartModal);
  } catch (err) {
    console.error("placeOrder error:", err);
    if (typeof orderErrorSound !== 'undefined') {
      orderErrorSound.play().catch(e => console.warn("Audio play blocked:", e));
    }
    showToast("Error placing order. See console.", 'error');
  } finally {
    if (placeOrderBtn) { placeOrderBtn.disabled = false; placeOrderBtn.textContent = 'Place Order'; }
    deliveryAddress = null;
    if (addressDisplay) addressDisplay.value = "";
  }
}

// ---------------- Confirm remove item modal ----------------
function openConfirmModal(productId) {
  itemToRemoveId = productId;
  openModal(confirmModal);
}
function closeConfirmModal() {
  itemToRemoveId = null;
  closeModal(confirmModal);
}
if (confirmBtnYes) confirmBtnYes.addEventListener('click', async () => {
  if (itemToRemoveId && currentUser) {
    await deleteDoc(doc(db, `users/${currentUser.uid}/cart`, itemToRemoveId));
    await loadCartFromFirestore();
  }
  closeConfirmModal();
});
if (confirmBtnNo) confirmBtnNo.addEventListener('click', closeConfirmModal);

// ---------------- Event wiring ----------------
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
    if (e.target.value === '') resetToPaginatedView();
  });
  searchInput.addEventListener('focus', renderSearchHistory);
}
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

if (loginBtn) loginBtn.addEventListener('click', () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch(err => console.error("Login failed:", err))
);
if (logoutBtn) logoutBtn.addEventListener('click', () =>
  signOut(auth).catch(err => console.error("Sign out failed:", err))
);

if (cartLink) cartLink.addEventListener('click', (e) => { e.preventDefault(); openModal(cartModal); });
if (closeCartBtn) closeCartBtn.addEventListener('click', () => closeModal(cartModal));
if (placeOrderBtn) placeOrderBtn.addEventListener('click', () => placeOrder());

window.addEventListener('click', (e) => {
  if (e.target === cartModal) closeModal(cartModal);
  if (e.target === confirmModal) closeConfirmModal();
});

// ---------------- Auth state listener & initial product load ----------------
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  updateAddToCartButtonsState();
  if (user) {
    guestActions?.classList.add('hidden');
    userActions?.classList.remove('hidden');
    if (userName) userName.textContent = (user.displayName || '').split(' ')[0] || 'User';
    if (user.photoURL && userAvatar) userAvatar.src = user.photoURL;
    await ensureUserDocument(user);
    await loadCartFromFirestore();
  } else {
    userActions?.classList.add('hidden');
    guestActions?.classList.remove('hidden');
    cart = [];
    updateCartUI();
  }

  if (allProductsCache.length === 0) {
    await fetchPage();
    fetchAllProductsIntoCache().catch(err => console.warn("Background cache load failed:", err));
  } else {
    resetToPaginatedView();
  }
});

function updateAddToCartButtonsState() {
  const btns = document.querySelectorAll('.add-to-cart-btn');
  btns.forEach(b => {
    if (!b) return;
    if (currentUser) { b.disabled = false; b.textContent = 'Add to Cart'; }
    else { b.disabled = true; b.textContent = 'Login to Order'; }
  });
}

// ---------------- Initial bootstrap ----------------
(async function initialLoad() {
  renderSkeletonLoader();
  await fetchPage();
  // background full cache (non-blocking)
  fetchAllProductsIntoCache();
})();

