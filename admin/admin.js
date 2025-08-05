// admin.js (Complete replacement using modern Firebase v9 syntax)

// Import the functions you need from the SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, orderBy, query } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
    // (It's okay to have this here, just don't share it publicly)
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY", // Use your actual key here
        authDomain: "mess-project-3c021.firebaseapp.com",
        projectId: "mess-project-3c021",
        storageBucket: "mess-project-3c021.appspot.com",
        messagingSenderId: "428617648708",
        appId: "1:428617648708:web:e5bf65bb56e89ae14b8a11",
        measurementId: "G-GFTQ6G6ZVJ"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const productsCollection = collection(db, 'products');

    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const adminContent = document.getElementById('admin-content');
    const loginBtn = document.getElementById('login-btn');
    const menuList = document.getElementById('current-menu');
    const form = document.getElementById('add-item-form');
    let products = [];

    // --- AUTHENTICATION ---
    onAuthStateChanged(auth, user => {
        if (user) {
            loginView.classList.add('hidden');
            adminContent.classList.remove('hidden');
            loadProducts();
        } else {
            adminContent.classList.add('hidden');
            loginView.classList.remove('hidden');
        }
    });

    loginBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(auth, provider).catch(error => console.error("Login failed:", error));
    });

    // --- DATABASE FUNCTIONS ---
    async function loadProducts() {
        const q = query(productsCollection, orderBy('name'));
        const snapshot = await getDocs(q);
        products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMenu();
    }

    const renderMenu = () => {
        menuList.innerHTML = '';
        if (products.length === 0) {
            menuList.innerHTML = '<p>No items on the menu yet.</p>';
            return;
        }
        products.forEach(product => {
            const itemElement = document.createElement('div');
            itemElement.className = 'menu-item';
            itemElement.innerHTML = `
                <img src="${product.image}" alt="${product.name}">
                <div class="menu-item-info">
                    <h4>${product.name}</h4>
                    <p>$${product.price.toFixed(2)}</p>
                </div>
                <button class="remove-btn" data-id="${product.id}">Remove</button>
            `;
            menuList.appendChild(itemElement);
        });
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newProduct = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: parseFloat(document.getElementById('price').value),
            image: document.getElementById('image').value,
        };
        try {
            await addDoc(productsCollection, newProduct);
            form.reset();
            loadProducts();
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    });

    menuList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const idToRemove = e.target.dataset.id;
            try {
                const docRef = doc(db, 'products', idToRemove);
                await deleteDoc(docRef);
                loadProducts();
            } catch (error) {
                console.error("Error removing document: ", error);
            }
        }
    });
});