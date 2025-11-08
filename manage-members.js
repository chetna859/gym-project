// manage-members.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  remove,
  get,
  child,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// ---- Firebase config (same as your app) ----
const firebaseConfig = {
  apiKey: "AIzaSyAwgtQa3u_g5H79XdxzxI9KBlh8PE0yXZQ",
  authDomain: "gym-management-project-5fc39.firebaseapp.com",
  projectId: "gym-management-project-5fc39",
  storageBucket: "gym-management-project-5fc39.firebasestorage.app",
  messagingSenderId: "621076096063",
  appId: "1:621076096063:web:33f65f2102e0ea6277448a",
  measurementId: "G-763KCFL1TF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const membersBody = document.getElementById("membersBody");
const searchInput = document.getElementById("searchInput");

// Ensure only logged-in admin can view (light client-side guard)
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index1.html";
    return;
  }
  // check role from RD
  try {
    const membersRef = ref(db, "members/" + user.uid);
    const snap = await get(membersRef);
    const me = snap.exists() ? snap.val() : null;
    if (!me || me.role !== "admin") {
      alert("Access denied — admin only");
      window.location.href = "index1.html";
      return;
    }
    // load list
    loadMembers();
  } catch (err) {
    console.error(err);
    alert("Failed to verify admin.");
    window.location.href = "index1.html";
  }
});

function refreshList() {
  loadMembers();
}

// load and render members
function loadMembers() {
  const allRef = ref(db, "members");
  onValue(allRef, (snapshot) => {
    membersBody.innerHTML = "";
    const q = (searchInput.value || "").toLowerCase().trim();

    if (!snapshot.exists()) {
      membersBody.innerHTML = "<tr><td colspan='5'>No members found.</td></tr>";
      return;
    }

    snapshot.forEach((childSnap) => {
      const uid = childSnap.key;
      const data = childSnap.val();
      const name = data.name || "-";
      const email = data.email || "-";
      const role = data.role || "member";

      // search filter
      const combined = `${uid} ${name} ${email}`.toLowerCase();
      if (q && !combined.includes(q)) return;

      const tr = document.createElement("tr");

      const uidTd = document.createElement("td");
      uidTd.textContent = uid;
      uidTd.style.fontFamily = "monospace";
      tr.appendChild(uidTd);

      const nameTd = document.createElement("td");
      nameTd.textContent = name;
      tr.appendChild(nameTd);

      const emailTd = document.createElement("td");
      emailTd.textContent = email;
      tr.appendChild(emailTd);

      const roleTd = document.createElement("td");
      roleTd.textContent = role;
      tr.appendChild(roleTd);

      const actionsTd = document.createElement("td");

      // copy UID
      const copyBtn = document.createElement("button");
      copyBtn.textContent = "Copy UID";
      copyBtn.className = "action-btn copy-btn";
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(uid).then(() => {
          copyBtn.textContent = "Copied ✓";
          setTimeout(() => (copyBtn.textContent = "Copy UID"), 1200);
        });
      };
      actionsTd.appendChild(copyBtn);

      // promote to admin (hide if already admin)
      if (role !== "admin") {
        const promoteBtn = document.createElement("button");
        promoteBtn.textContent = "Promote → Admin";
        promoteBtn.className = "action-btn promote-btn";
        promoteBtn.onclick = () => promoteToAdmin(uid, promoteBtn, roleTd);
        actionsTd.appendChild(promoteBtn);
      }

      // delete member
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "action-btn delete-btn";
      deleteBtn.onclick = () => {
        if (!confirm(`Delete member ${name} (${email})? This removes their RD record.`)) return;
        remove(ref(db, "members/" + uid))
          .then(() => {
            alert("Member record removed from Realtime DB.");
          })
          .catch((err) => alert("Delete failed: " + err.message));
      };
      actionsTd.appendChild(deleteBtn);

      tr.appendChild(actionsTd);
      membersBody.appendChild(tr);
    });

    // if table empty after filters
    if (!membersBody.hasChildNodes()) {
      membersBody.innerHTML = "<tr><td colspan='5'>No members match your search.</td></tr>";
    }
  }, { onlyOnce: false }); // realtime updates
}

// promote helper
function promoteToAdmin(uid, btn, roleTd) {
  if (!confirm("Make this member an admin?")) return;
  const updates = {};
  updates["/members/" + uid + "/role"] = "admin";
  update(ref(db), updates)
    .then(() => {
      alert("Promoted to admin!");
      roleTd.textContent = "admin";
      btn.remove();
    })
    .catch((err) => {
      console.error(err);
      alert("Promotion failed: " + err.message);
    });
}

// logout
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index1.html";
  });
};

// live-search
searchInput.addEventListener("input", () => {
  // simple debounce
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(loadMembers, 250);
});
