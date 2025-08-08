// functions/index.js (with UPI Payments)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe = require("stripe")(functions.config().stripe.secret);

admin.initializeApp();

// This function creates the Stripe Checkout Session
exports.createStripeCheckout = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to place an order."
    );
  }

  const cartItems = data.items;
  const YOUR_DOMAIN = "https://mess-project-3c021.web.app"; // Or your Vercel domain

  const line_items = cartItems.map((item) => {
    return {
      price_data: {
        currency: "inr", // Use Indian Rupees
        product_data: {
          name: item.name,
          images: [item.image],
        },
        unit_amount: Math.round(item.price * 100), // Price in paise, rounded to avoid decimals
      },
      quantity: item.quantity,
    };
  });

  const session = await stripe.checkout.sessions.create({
    // --- THIS IS THE KEY CHANGE FOR INDIA ---
    // We are adding 'upi' to accept payments via India's most popular method.
    // When you expand globally, you can add more methods here.
    payment_method_types: ["card", "upi"],
    line_items: line_items,
    mode: "payment",
    success_url: `${YOUR_DOMAIN}/success.html`,
    cancel_url: `${YOUR_DOMAIN}/cancel.html`,
    metadata: {
        userId: context.auth.uid,
    }
  });

  return { id: session.id };
});

// This function listens for the webhook from Stripe to create the final order
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = functions.config().stripe.webhook_secret;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata.userId;
    
    // Retrieve the full user details from Firestore
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    // Retrieve the user's cart from Firestore
    const cartRef = admin.firestore().collection('users').doc(userId).collection('cart');
    const cartSnapshot = await cartRef.get();
    const cartItems = cartSnapshot.docs.map(doc => doc.data());
    const totalAmount = session.amount_total / 100;

    // Create the order in your Firestore database
    await admin.firestore().collection("orders").add({
        userId: userId,
        userName: userData.name,
        userEmail: userData.email,
        items: cartItems,
        totalAmount: totalAmount,
        status: 'new',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Clear the user's cart
    const batch = admin.firestore().batch();
    cartSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
  }

  res.status(200).send();
});
