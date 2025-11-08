// ================= Firebase Imports =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { 
  getDatabase, 
  ref, 
  set,
  get,      
  child     
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// ================= Firebase Config =================
const firebaseConfig = {
  apiKey: "AIzaSyAwgtQa3u_g5H79XdxzxI9KBlh8PE0yXZQ",
  authDomain: "gym-management-project-5fc39.firebaseapp.com",
  projectId: "gym-management-project-5fc39",
  storageBucket: "gym-management-project-5fc39.firebasestorage.app",
  messagingSenderId: "621076096063",
  appId: "1:621076096063:web:33f65f2102e0ea6277448a",
  measurementId: "G-763KCFL1TF"
};

// ================= Initialize =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ================= Helpers =================
function logAction(action, details) {
  console.log(`[LOG] ${action}:`, details);
  
}


// ================== Register ==================
window.register = async function () { // <-- Make function async
  const name = document.getElementById("regName").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;

  if (!name || !email || !password) {
    return alert("Please fill in all fields.");
  }

  try {
    // 1. Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save extra info in Realtime Database and AWAIT the result
    await set(ref(db, "members/" + user.uid), {
      name: name,
      email: email,
      role: "member"
    });

    alert("✅ Registered Successfully! Member record created in database.");
    logAction("REGISTER", `${email} as member`);
  } catch (error) {
    // This will catch errors from both Auth and Database writes
    alert("❌ Registration Failed: " + error.message);
  }
};


// ================== Login ==================
window.login = function () {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      // Fetch role from Realtime Database
      const dbRef = ref(db);
      get(child(dbRef, "members/" + user.uid)).then((snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val();
          logAction("LOGIN", email);

          if (userData.role === "admin") {
            window.location.href = "admin-dashboard.html";
          } else {
            window.location.href = "member-dashboard.html";
          }
        } else {
          alert("❌ User data not found in database");
        }
      });

    })
    .catch((error) => {
      alert("❌ " + error.message);
    });
};

// ================== Show/Hide Forms ==================
window.showRegister = function () {
  document.getElementById("registerForm").style.display = "block";
  document.getElementById("loginForm").style.display = "none";
};

window.showLogin = function () {
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("loginForm").style.display = "block";
};

// ================== Password Toggle ==================
window.togglePassword = function (inputId, button) {
  const passwordInput = document.getElementById(inputId);
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    button.textContent = "🙈"; // Change icon to 'hide'
  } else {
    passwordInput.type = "password";
    button.textContent = "👁️"; // Change icon back to 'show'
  }
};
