// admin.js (Complete replacement)
document.addEventListener('DOMContentLoaded', () => {

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCaFan1ZaRDsHTaR5O2m9KmWLy0nSp3L1o",
  authDomain: "mess-project-3c021.firebaseapp.com",
  projectId: "mess-project-3c021",
  storageBucket: "mess-project-3c021.firebasestorage.app",
  messagingSenderId: "428617648708",
  appId: "1:428617648708:web:e5bf65bb56e89ae14b8a11",
  measurementId: "G-GFTQ6G6ZVJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

    // --- Initialize Firebase ---
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore(); // Our database
    const auth = firebase.auth();     // Our authentication service
    const productsCollection = db.collection('products'); // A "table" for our products

    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const adminContent = document.getElementById('admin-content');
    const loginBtn = document.getElementById('login-btn');
    const menuList = document.getElementById('current-menu');
    const form = document.getElementById('add-item-form');
    let products = []; // Local cache of products

    // --- AUTHENTICATION ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            loginView.classList.add('hidden');
            adminContent.classList.remove('hidden');
            loadProducts();
        } else {
            // User is signed out.
            adminContent.classList.add('hidden');
            loginView.classList.remove('hidden');
        }
    });

    loginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => console.error("Login failed:", error));
    });

    // --- DATABASE FUNCTIONS ---
    async function loadProducts() {
        const snapshot = await productsCollection.orderBy('name').get();
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

    // Add item
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newProduct = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: parseFloat(document.getElementById('price').value),
            image: document.getElementById('image').value,
        };
        try {
            await productsCollection.add(newProduct);
            form.reset();
            loadProducts(); // Reload from database to show new item
        } catch (error) {
            console.error("Error adding document: ", error);
        }
    });

    // Remove item
    menuList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('remove-btn')) {
            const idToRemove = e.target.dataset.id;
            try {
                await productsCollection.doc(idToRemove).delete();
                loadProducts(); // Reload from database
            } catch (error) {
                console.error("Error removing document: ", error);
            }
        }
    });
});