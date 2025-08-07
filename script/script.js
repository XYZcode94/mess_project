// script.js (with Advanced Search Logic)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc, addDoc, serverTimestamp, query, orderBy, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

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
    const productsCollection = collection(db, 'products');
    
    // --- State Management ---
    let allProductsCache = []; // Master list of all products from the DB
    let displayedProducts = []; // Products currently shown on the page
    let cart = [];
    let currentUser = null;
    const productsPerPage = 6;
    const searchHistoryKey = 'beverageSearchHistory';

    // --- DOM Elements ---
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
    const confirmModal = document.getElementById('confirm-modal');
    const confirmBtnYes = document.getElementById('confirm-btn-yes');
    const confirmBtnNo = document.getElementById('confirm-btn-no');
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const navLinks = document.getElementById('nav-links');
    let itemToRemoveId = null;

    // --- Hamburger Menu Logic ---
    if (hamburgerBtn && navLinks) {
        hamburgerBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // --- ADVANCED SEARCH & PRODUCT DISPLAY ---
    async function initializeProducts() {
        renderSkeletonLoader();
        try {
            const q = query(productsCollection, orderBy('name'));
            const snapshot = await getDocs(q);
            allProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            resetToPaginatedView();
        } catch (error) {
            console.error("Error fetching products:", error);
            beverageGrid.innerHTML = '<p>Could not load menu.</p>';
        }
    }

    function resetToPaginatedView() {
        displayedProducts = allProductsCache.slice(0, productsPerPage);
        renderProducts(displayedProducts);
        if (allProductsCache.length > productsPerPage) {
            loadMoreBtn.classList.remove('hidden');
        } else {
            loadMoreBtn.classList.add('hidden');
        }
    }

    function loadMoreProducts() {
        const currentCount = displayedProducts.length;
        const newProducts = allProductsCache.slice(currentCount, currentCount + productsPerPage);
        displayedProducts.push(...newProducts);
        renderProducts(newProducts, true); // Append the new products
        if (displayedProducts.length >= allProductsCache.length) {
            loadMoreBtn.classList.add('hidden');
        }
    }

    function performAdvancedSearch(searchTerm) {
        const searchWords = searchTerm.toLowerCase().split(' ').filter(word => word.length > 0);
        
        const filteredProducts = allProductsCache.filter(product => {
            const productNameLower = product.name.toLowerCase();
            // Check if every search word is included in the product name
            return searchWords.every(word => productNameLower.includes(word));
        });

        renderProducts(filteredProducts);
        loadMoreBtn.classList.add('hidden'); // Hide load more during search
    }

    function renderProducts(productsToRender, append = false) {
        if (!append) beverageGrid.innerHTML = '';
        if (productsToRender.length === 0 && !append) {
            beverageGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No beverages found.</p>';
            return;
        }
        productsToRender.forEach(product => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<img src="${product.image}" alt="${product.name}" /><div class="card-content"><h3>${product.name}</h3><p>${product.description}</p><span>₹${product.price.toFixed(2)}</span><button class="add-to-cart-btn" data-id="${product.id}" ${!currentUser ? 'disabled' : ''}>${!currentUser ? 'Login to Order' : 'Add to Cart'}</button></div>`;
            beverageGrid.appendChild(card);
        });
        setupCardAnimations();
    }
    
    // --- SEARCH HISTORY LOGIC ---
    function getSearchHistory() { return JSON.parse(localStorage.getItem(searchHistoryKey)) || []; }
    function addToSearchHistory(term) { if (!term || term.length < 2) return; let history = getSearchHistory(); history = history.filter(item => item.toLowerCase() !== term.toLowerCase()); history.unshift(term); if (history.length > 5) history.pop(); localStorage.setItem(searchHistoryKey, JSON.stringify(history)); }
    function renderSearchHistory() { const history = getSearchHistory(); searchHistoryContainer.innerHTML = ''; if (history.length > 0) { history.forEach(term => { const item = document.createElement('div'); item.className = 'search-history-item'; item.textContent = term; item.addEventListener('click', () => { searchInput.value = term; searchForm.dispatchEvent(new Event('submit', { cancelable: true })); }); searchHistoryContainer.appendChild(item); }); searchHistoryContainer.classList.remove('hidden'); } else { hideSearchHistory(); } }
    function hideSearchHistory() { searchHistoryContainer.classList.add('hidden'); }

    // --- Event Listeners ---
    loadMoreBtn.addEventListener('click', loadMoreProducts);

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        addToSearchHistory(searchTerm);
        performAdvancedSearch(searchTerm);
        searchInput.blur();
        hideSearchHistory();
    });

    searchInput.addEventListener('input', (e) => {
        if (e.target.value === '') {
            resetToPaginatedView();
        }
    });

    searchInput.addEventListener('focus', renderSearchHistory);
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-container')) hideSearchHistory(); });
    searchHistoryContainer.addEventListener('wheel', (e) => e.stopPropagation());

    // --- AUTHENTICATION ---
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            guestActions.classList.add('hidden');
            userActions.classList.remove('hidden');
            userName.textContent = user.displayName.split(' ')[0];
            userAvatar.src = user.photoURL;
            await handleUserLogin(user);
            await loadCartFromFirestore();
        } else {
            userActions.classList.add('hidden');
            guestActions.classList.remove('hidden');
            cart = [];
            updateCart();
        }
        await initializeProducts(); // Initial fetch and display
    });
    
    // --- CART LOGIC ---
    async function addToCart(productId) {
        if (!currentUser) { showToast("Please log in to add items to your cart.", 'info'); return; }
        const product = allProductsCache.find(p => p.id === productId);
        if (!product) { console.error("Product not found in cache!"); showToast("An error occurred, please try again.", 'error'); return; }
        const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, productId);
        const cartItemDoc = await getDoc(cartItemRef);
        if (cartItemDoc.exists()) {
            const currentQuantity = cartItemDoc.data().quantity;
            await setDoc(cartItemRef, { quantity: currentQuantity + 1 }, { merge: true });
        } else {
            await setDoc(cartItemRef, { ...product, quantity: 1 });
        }
        await loadCartFromFirestore();
        showToast(`${product.name} added to cart!`);
    }

    // --- All other functions ---
    function showToast(message, type = 'success') { let backgroundColor; switch (type) { case 'error': backgroundColor = "linear-gradient(to right, #e74c3c, #c03b2b)"; break; case 'info': backgroundColor = "linear-gradient(to right, #3498db, #2980b9)"; break; default: backgroundColor = "linear-gradient(to right, #00b09b, #96c93d)"; break; } Toastify({ text: message, duration: 3000, close: true, gravity: "top", position: "right", stopOnFocus: true, style: { background: backgroundColor, borderRadius: "8px" }, }).showToast(); }
    function renderSkeletonLoader() { beverageGrid.innerHTML = ''; for (let i = 0; i < 3; i++) { const skeletonCard = document.createElement('div'); skeletonCard.className = 'card skeleton'; skeletonCard.innerHTML = `<div class="skeleton-img"></div><div class="skeleton-content"><div class="skeleton-title"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div><div class="skeleton-price"></div><div class="skeleton-button"></div></div>`; beverageGrid.appendChild(skeletonCard); } }
    function setupCardAnimations() { const cards = document.querySelectorAll('.card:not(.skeleton)'); if (cards.length === 0) return; const observer = new IntersectionObserver(entries => { entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } }); }, { threshold: 0.1 }); cards.forEach(card => observer.observe(card)); }
    async function handleUserLogin(user) { const userRef = doc(db, "users", user.uid); const userDoc = await getDoc(userRef); if (!userDoc.exists()) { await setDoc(userRef, { name: user.displayName, email: user.email, createdAt: serverTimestamp() }); } }
    loginBtn.addEventListener('click', () => { const provider = new GoogleAuthProvider(); signInWithPopup(auth, provider).catch(error => console.error("Login failed:", error)); });
    logoutBtn.addEventListener('click', () => { signOut(auth); });
    async function loadCartFromFirestore() { if (!currentUser) return; const cartCollectionRef = collection(db, `users/${currentUser.uid}/cart`); const snapshot = await getDocs(cartCollectionRef); cart = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); updateCart(); }
    async function updateCartItemQuantity(productId, newQuantity) { if (!currentUser) return; const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, productId); if (newQuantity > 0) { await setDoc(cartItemRef, { quantity: newQuantity }, { merge: true }); } else { await deleteDoc(cartItemRef); } await loadCartFromFirestore(); }
    function updateCart() { renderCartItems(); updateCartCount(); updateCartTotal(); }
    function renderCartItems() { cartItemsContainer.innerHTML = ''; if (cart.length === 0) { cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>'; placeOrderBtn.disabled = true; return; } placeOrderBtn.disabled = false; cart.forEach(item => { const itemElement = document.createElement('div'); itemElement.className = 'cart-item'; itemElement.innerHTML = `<img src="${item.image}" alt="${item.name}"><div class="cart-item-details"><h4>${item.name}</h4><span class="cart-item-price">₹${item.price.toFixed(2)}</span></div><div class="cart-item-actions"><div class="quantity-controls"><button class="quantity-change" data-id="${item.id}" data-change="-1">-</button><input type="number" value="${item.quantity}" min="1" data-id="${item.id}" class="quantity-input"><button class="quantity-change" data-id="${item.id}" data-change="1">+</button></div><button class="btn-remove-item" data-id="${item.id}" title="Remove item"><svg fill="currentColor" viewBox="0 0 16 16" height="1em" width="1em"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"></path><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"></path></svg></button></div>`; cartItemsContainer.appendChild(itemElement); }); }
    function updateCartCount() { const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0); cartCount.textContent = totalItems; }
    function updateCartTotal() { const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0); cartTotal.textContent = `₹${total.toFixed(2)}`; }
    beverageGrid.addEventListener('click', e => { if (e.target.classList.contains('add-to-cart-btn')) { addToCart(e.target.dataset.id); } });
    cartItemsContainer.addEventListener('click', e => { const target = e.target.closest('.btn-remove-item, .quantity-change'); if (!target) return; const productId = target.dataset.id; if (target.classList.contains('quantity-change')) { const change = parseInt(target.dataset.change); const item = cart.find(i => i.id === productId); if (item) { updateCartItemQuantity(productId, item.quantity + change); } } if (target.classList.contains('btn-remove-item')) { openConfirmModal(productId); } });
    cartItemsContainer.addEventListener('change', e => { if (e.target.classList.contains('quantity-input')) { const productId = e.target.dataset.id; const newQuantity = parseInt(e.target.value); updateCartItemQuantity(productId, newQuantity); } });
    placeOrderBtn.addEventListener('click', async () => { if (!currentUser || cart.length === 0) return; const ordersCollectionRef = collection(db, 'orders'); const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0); try { await addDoc(ordersCollectionRef, { userId: currentUser.uid, userName: currentUser.displayName, userEmail: currentUser.email, items: cart, totalAmount: total, status: 'new', createdAt: serverTimestamp() }); for (const item of cart) { const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, item.id); await deleteDoc(cartItemRef); } showToast("Order placed successfully! Thank you."); await loadCartFromFirestore(); closeModal(cartModal); } catch (error) { console.error("Error placing order: ", error); showToast("There was an error placing your order.", 'error'); } });
    function openModal(modal) { modal.style.display = 'block'; }
    function closeModal(modal) { modal.style.display = 'none'; }
    cartLink.addEventListener('click', (e) => { e.preventDefault(); openModal(cartModal); });
    closeCartBtn.addEventListener('click', () => closeModal(cartModal));
    window.addEventListener('click', e => { if (e.target === cartModal) closeModal(cartModal); if (e.target === confirmModal) closeConfirmModal(); });
});
