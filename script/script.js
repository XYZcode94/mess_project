// script.js (Final Version with All Features)

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
    let products = [];
    let cart = [];
    let currentUser = null;

    // --- DOM Elements ---
    const beverageGrid = document.getElementById('beverage-grid');
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

    // --- Helper function for showing toast notifications ---
    function showToast(message, type = 'success') {
        let backgroundColor;
        switch (type) {
            case 'error':
                backgroundColor = "linear-gradient(to right, #e74c3c, #c0392b)";
                break;
            case 'info':
                backgroundColor = "linear-gradient(to right, #3498db, #2980b9)";
                break;
            default: // success
                backgroundColor = "linear-gradient(to right, #00b09b, #96c93d)";
                break;
        }
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top",
            position: "right",
            stopOnFocus: true,
            style: {
                background: backgroundColor,
                borderRadius: "8px"
            },
        }).showToast();
    }

    // --- Function to render the skeleton loader ---
    function renderSkeletonLoader() {
        beverageGrid.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const skeletonCard = document.createElement('div');
            skeletonCard.className = 'card skeleton';
            skeletonCard.innerHTML = `
                <div class="skeleton-img"></div>
                <div class="skeleton-content">
                    <div class="skeleton-title"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                    <div class="skeleton-price"></div>
                    <div class="skeleton-button"></div>
                </div>
            `;
            beverageGrid.appendChild(skeletonCard);
        }
    }

    function setupCardAnimations() {
        const cards = document.querySelectorAll('.card:not(.skeleton)');
        if (cards.length === 0) return;

        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        cards.forEach(card => observer.observe(card));
    }

    // --- AUTHENTICATION ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await handleUserLogin(user);
            guestActions.classList.add('hidden');
            userActions.classList.remove('hidden');
            userName.textContent = user.displayName.split(' ')[0];
            userAvatar.src = user.photoURL;
            await loadCartFromFirestore();
        } else {
            currentUser = null;
            userActions.classList.add('hidden');
            guestActions.classList.remove('hidden');
            cart = [];
            updateCart();
        }
        await getAndRenderProducts();
    });

    async function handleUserLogin(user) {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            await setDoc(userRef, {
                name: user.displayName,
                email: user.email,
                createdAt: serverTimestamp()
            });
        }
    }

    loginBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => console.error("Login failed:", error));
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });

    // --- PRODUCTS ---
    async function getAndRenderProducts() {
        renderSkeletonLoader();
        try {
            const q = query(productsCollection, orderBy('name'));
            const snapshot = await getDocs(q);
            products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            beverageGrid.innerHTML = '';
            if (products.length === 0) {
                beverageGrid.innerHTML = '<p>The menu is currently empty.</p>';
                return;
            }
            products.forEach(product => {
                const card = document.createElement('div');
                card.className = 'card';
                card.innerHTML = `
                    <img src="${product.image}" alt="${product.name}" />
                    <div class="card-content">
                        <h3>${product.name}</h3>
                        <p>${product.description}</p>
                        <span>₹${product.price.toFixed(2)}</span>
                        <button class="add-to-cart-btn" data-id="${product.id}" ${!currentUser ? 'disabled' : ''}>
                            ${!currentUser ? 'Login to Order' : 'Add to Cart'}
                        </button>
                    </div>
                `;
                beverageGrid.appendChild(card);
            });

            setupCardAnimations();

        } catch (error) {
            console.error("Error fetching products:", error);
            beverageGrid.innerHTML = '<p>Could not load menu.</p>';
        }
    }

    // --- CART ---
    async function loadCartFromFirestore() {
        if (!currentUser) return;
        const cartCollectionRef = collection(db, `users/${currentUser.uid}/cart`);
        const snapshot = await getDocs(cartCollectionRef);
        cart = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCart();
    }

    async function addToCart(productId) {
        if (!currentUser) {
            showToast("Please log in to add items to your cart.", 'info');
            return;
        }
        const product = products.find(p => p.id === productId);
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
    
    async function updateCartItemQuantity(productId, newQuantity) {
        if (!currentUser) return;
        const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, productId);
        if (newQuantity > 0) {
            await setDoc(cartItemRef, { quantity: newQuantity }, { merge: true });
        } else {
            await deleteDoc(cartItemRef);
        }
        await loadCartFromFirestore();
    }

    function updateCart() {
        renderCartItems();
        updateCartCount();
        updateCartTotal();
    }

    function renderCartItems() {
        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
            placeOrderBtn.disabled = true;
            return;
        }
        placeOrderBtn.disabled = false;
        cart.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'cart-item';
            itemElement.innerHTML = `
                <img src="${item.image}" alt="${item.name}">
                <div class="cart-item-details">
                    <h4>${item.name}</h4>
                    <span class="cart-item-price">₹${item.price.toFixed(2)}</span>
                </div>
                <div class="cart-item-actions">
                    <button class="quantity-change" data-id="${item.id}" data-change="-1">-</button>
                    <input type="number" value="${item.quantity}" min="0" data-id="${item.id}" class="quantity-input">
                    <button class="quantity-change" data-id="${item.id}" data-change="1">+</button>
                </div>
            `;
            cartItemsContainer.appendChild(itemElement);
        });
    }

    function updateCartCount() {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }

    function updateCartTotal() {
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cartTotal.textContent = `₹${total.toFixed(2)}`;
    }

    // --- Event Listeners ---
    beverageGrid.addEventListener('click', e => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            addToCart(e.target.dataset.id);
        }
    });
    
    cartItemsContainer.addEventListener('click', e => {
        if (e.target.classList.contains('quantity-change')) {
            const productId = e.target.dataset.id;
            const change = parseInt(e.target.dataset.change);
            const item = cart.find(i => i.id === productId);
            if (item) {
                updateCartItemQuantity(productId, item.quantity + change);
            }
        }
    });

    cartItemsContainer.addEventListener('change', e => {
        if (e.target.classList.contains('quantity-input')) {
            const productId = e.target.dataset.id;
            const newQuantity = parseInt(e.target.value);
            updateCartItemQuantity(productId, newQuantity);
        }
    });

    // --- Place Order ---
    placeOrderBtn.addEventListener('click', async () => {
        if (!currentUser || cart.length === 0) return;
        
        const ordersCollectionRef = collection(db, 'orders');
        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        try {
            await addDoc(ordersCollectionRef, {
                userId: currentUser.uid,
                userName: currentUser.displayName,
                userEmail: currentUser.email,
                items: cart,
                totalAmount: total,
                status: 'new',
                createdAt: serverTimestamp()
            });

            for (const item of cart) {
                const cartItemRef = doc(db, `users/${currentUser.uid}/cart`, item.id);
                await deleteDoc(cartItemRef);
            }
            
            showToast("Order placed successfully! Thank you.");
            await loadCartFromFirestore();
            closeModal(cartModal);

        } catch (error) {
            console.error("Error placing order: ", error);
            showToast("There was an error placing your order.", 'error');
        }
    });

    // --- Modal Controls ---
    function openModal(modal) { modal.style.display = 'block'; }
    function closeModal(modal) { modal.style.display = 'none'; }
    cartLink.addEventListener('click', (e) => { e.preventDefault(); openModal(cartModal); });
    closeCartBtn.addEventListener('click', () => closeModal(cartModal));
    window.addEventListener('click', e => { if (e.target === cartModal) closeModal(cartModal); });
});

function toggleMenu() {
    const navLinks = document.getElementById('nav-links');
    navLinks.classList.toggle('active');
}
