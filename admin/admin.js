// admin.js (Final Version with All Features)

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, deleteDoc, doc, getDoc, orderBy, query, updateDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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


    // Initialize a named, secondary app for the admin panel
    const adminApp = initializeApp(firebaseConfig, 'adminApp');
    
    const db = getFirestore(adminApp);
    const adminAuth = getAuth(adminApp);

    // Enable Offline Persistence for the admin panel
    enableIndexedDbPersistence(db).catch((err) => { console.error("Firestore persistence error: ", err); });

    const productsCollection = collection(db, 'products');

    // --- State Variable ---
    let editState = { isEditing: false, productId: null };
    let localProductsCache = [];

    // --- DOM Elements ---
    const adminPanelWrapper = document.getElementById('admin-panel-wrapper');
    const loginView = document.getElementById('login-view');
    const loginBtn = document.getElementById('login-btn');
    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    const menuList = document.getElementById('current-menu');
    const form = document.getElementById('add-item-form');
    const formButton = form.querySelector('button[type="submit"]');
    const formContainer = document.querySelector('.form-container');
    const loginErrorMessage = document.getElementById('login-error-message');

    // --- AUTHENTICATION with Role Check ---
    onAuthStateChanged(adminAuth, async (user) => {
        if (user) {
            // User is logged in, now check if they are an admin
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists() && userDoc.data().role === 'admin') {
                // User is an admin, show the panel
                adminPanelWrapper.classList.remove('hidden');
                loginView.classList.add('hidden');
                loadProducts();
            } else {
                // User is NOT an admin, deny access
                loginErrorMessage.textContent = "Access Denied. You do not have admin privileges.";
                loginErrorMessage.classList.remove('hidden');
                signOut(adminAuth); // Log them out immediately
            }
        } else {
            // User is signed out, show the login view
            loginView.classList.remove('hidden');
            adminPanelWrapper.classList.add('hidden');
            loginErrorMessage.classList.add('hidden');
        }
    });

    loginBtn.addEventListener('click', () => {
        const provider = new GoogleAuthProvider();
        signInWithPopup(adminAuth, provider).catch(error => console.error("Admin Login failed:", error));
    });

    adminLogoutBtn.addEventListener('click', () => {
        signOut(adminAuth).then(() => {
            // The onAuthStateChanged listener will handle the UI changes
            console.log('Admin signed out successfully.');
        }).catch(error => {
            console.error("Admin Logout failed:", error);
        });
    });

    // --- DATABASE & RENDER FUNCTIONS ---
    async function loadProducts() {
        try {
            const q = query(productsCollection, orderBy('name'));
            const snapshot = await getDocs(q);
            localProductsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderMenu(localProductsCache);
        } catch (error) {
            console.error("FIRESTORE ERROR during loadProducts:", error);
        }
    }
    
    function renderMenu(products) {
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
                    <p>₹${product.price.toFixed(2)}</p>
                </div>
                <div class="menu-item-actions">
                    <button class="edit-btn" data-id="${product.id}">Edit</button>
                    <button class="remove-btn" data-id="${product.id}">Remove</button>
                </div>
            `;
            menuList.appendChild(itemElement);
        });
    }

    // --- FORM SUBMISSION (ADD & UPDATE LOGIC) ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productData = {
            name: document.getElementById('name').value,
            description: document.getElementById('description').value,
            price: parseFloat(document.getElementById('price').value),
            image: document.getElementById('image').value,
        };

        if (editState.isEditing) {
            const docRef = doc(db, 'products', editState.productId);
            try {
                await updateDoc(docRef, productData);
                resetFormState();
                await loadProducts();
            } catch (error) {
                console.error("Error updating document: ", error);
            }
        } else {
            try {
                await addDoc(productsCollection, productData);
                form.reset();
                await loadProducts();
            } catch (error) {
                console.error("Error adding document: ", error);
            }
        }
    });

    // --- CLICK HANDLING FOR EDIT & REMOVE ---
    menuList.addEventListener('click', async (e) => {
        const target = e.target;
        const productId = target.dataset.id;
        if (!productId) return;

        if (target.classList.contains('edit-btn')) {
            const productToEdit = localProductsCache.find(p => p.id === productId);
            if (productToEdit) {
                document.getElementById('name').value = productToEdit.name;
                document.getElementById('description').value = productToEdit.description;
                document.getElementById('price').value = productToEdit.price;
                document.getElementById('image').value = productToEdit.image;
                editState.isEditing = true;
                editState.productId = productId;
                formButton.textContent = 'Update Item';
                formButton.classList.add('update-mode');
                addCancelButton();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        if (target.classList.contains('remove-btn')) {
            if (confirm(`Are you sure you want to delete this item?`)) {
                try {
                    await deleteDoc(doc(db, 'products', productId));
                    await loadProducts();
                } catch (error) {
                    console.error("Error removing document: ", error);
                }
            }
        }
    });

    // --- HELPER FUNCTIONS FOR UI STATE ---
    function addCancelButton() {
        if (!document.getElementById('cancel-edit-btn')) {
            const cancelButton = document.createElement('button');
            cancelButton.type = 'button';
            cancelButton.id = 'cancel-edit-btn';
            cancelButton.textContent = 'Cancel Edit';
            cancelButton.className = 'btn-cancel-edit';
            formContainer.appendChild(cancelButton);
            cancelButton.addEventListener('click', resetFormState);
        }
    }

    function resetFormState() {
        form.reset();
        editState.isEditing = false;
        editState.productId = null;
        formButton.textContent = 'Add Item';
        formButton.classList.remove('update-mode');
        const cancelButton = document.getElementById('cancel-edit-btn');
        if (cancelButton) {
            cancelButton.remove();
        }
    }
});
