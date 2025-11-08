// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut,  onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, push, set, get} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// Config
const firebaseConfig = {
  apiKey: "AIzaSyAwgtQa3u_g5H79XdxzxI9KBlh8PE0yXZQ",
  authDomain: "gym-management-project-5fc39.firebaseapp.com",
  databaseURL: "https://gym-management-project-5fc39-default-rtdb.firebaseio.com/",
  projectId: "gym-management-project-5fc39",
  storageBucket: "gym-management-project-5fc39.firebasestorage.app",
  messagingSenderId: "621076096063",
  appId: "1:621076096063:web:33f65f2102e0ea6277448a",
  measurementId: "G-763KCFL1TF"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ✅ Add test receipt
window.addTestReceipt = function () {
  const uid = document.getElementById("memberUID").value.trim();
  if (!uid) return alert("Please enter a member UID!");

  const receiptsRef = ref(db, "receipts/" + uid);
  const newReceiptRef = push(receiptsRef); // auto ID

  set(newReceiptRef, {
    amount: Math.floor(Math.random() * 2000) + 500, // random amount
    date: new Date().toISOString().split("T")[0],  // today's date
    status: "Paid"
  }).then(() => {
    alert("✅ Test receipt added!");
  }).catch((err) => {
    alert("❌ " + err.message);
  });
};

// ✅ Add test notification
window.addTestNotification = function () {
  const uid = document.getElementById("memberUID").value.trim();
  if (!uid) return alert("Please enter a member UID!");

  const notifRef = ref(db, "notifications/" + uid);
  const newNotifRef = push(notifRef); // auto ID

  // it's fine to store a string but storing an object is recommended
  set(newNotifRef, { message: "This is a test notification at " + new Date().toLocaleTimeString(), createdAt: new Date().toISOString(), fromAdmin: auth.currentUser?.uid || null })
    .then(() => {
      alert("✅ Test notification added!");
    }).catch((err) => {
      alert("❌ " + err.message);
    });
};

// ✅ Logout
window.logout = function () {
  signOut(auth).then(() => {
    alert("✅ Logged out");
    window.location.href = "index1.html";
  });
};

// show admin-only UI elements after verifying role
async function showAdminLinksIfAdmin(user) {
  try {
    if (!user) return; // not logged in
    const snap = await get(ref(db, "members/" + user.uid));
    if (!snap.exists()) return;
    const me = snap.val();
    if (me && me.role === "admin") {
      const el = document.getElementById("manageNotificationsLink");
      if (el) el.style.display = ""; // make it visible
      else console.warn("manageNotificationsLink element not found in DOM.");
    }
  } catch (err) {
    console.error("Failed to check admin role:", err);
  }
}

// Wait for auth state to be ready before checking role
onAuthStateChanged(auth, (user) => {
  // call the helper when auth is initialized (user can be null or an object)
  showAdminLinksIfAdmin(user);
});