// script.js (Complete replacement using modern Firebase v9 syntax)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  // --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
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
  const productsCollection = collection(db, 'products');
  let products = [];
  let cart = [];

  // --- DOM Elements ---
  const beverageGrid = document.getElementById('beverage-grid');
  const cartLink = document.getElementById('cart-link');
  // ... (All your other DOM element variables are fine)

  // --- RENDER PRODUCTS from DATABASE ---
  async function getAndRenderProducts() {
    beverageGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Loading menu...</p>';
    try {
      const q = query(productsCollection, orderBy('name'));
      const snapshot = await getDocs(q);
      products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      beverageGrid.innerHTML = '';
      if (products.length === 0) {
        beverageGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1; font-size: 1.2rem;">The menu is currently empty.</p>';
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
                        <span>$${product.price.toFixed(2)}</span>
                        <button class="add-to-cart-btn" data-id="${product.id}">Add to Cart</button>
                    </div>
                `;
        beverageGrid.appendChild(card);
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      beverageGrid.innerHTML = '<p style="text-align: center; color: red; grid-column: 1 / -1;">Could not load menu.</p>';
    }
  }

  // --- ALL YOUR CART AND MODAL FUNCTIONS AND EVENT LISTENERS ---
  // Copy the rest of your cart/modal functions and event listeners
  // from your previous script.js file and paste them here.
  // They do not need to be changed.


  // --- INITIALIZE ---
  getAndRenderProducts();
});

function toggleMenu() {
  // ... this function is also unchanged
}