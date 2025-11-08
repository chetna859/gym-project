



// ================= Firebase Config =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getDatabase, ref, push, set, onValue, query, orderByChild, remove, get
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import {
  getAuth, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAwgtQa3u_g5H79XdxzxI9KBlh8PE0yXZQ",
  authDomain: "gym-management-project-5fc39.firebaseapp.com",
  databaseURL: "https://gym-management-project-5fc39-default-rtdb.firebaseio.com",
  projectId: "gym-management-project-5fc39",
  storageBucket: "gym-management-project-5fc39.firebasestorage.app",
  messagingSenderId: "621076096063",
  appId: "1:621076096063:web:33f65f2102e0ea6277448a",
  measurementId: "G-763KCFL1TF"
};

// --- Init Firebase ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ================= Elements =================
const sendBtn = document.getElementById("sendBtn");
const sendStatus = document.getElementById("sendStatus");
const notifUid = document.getElementById("notifUid");
const notifMessage = document.getElementById("notifMessage");
const sendToAll = document.getElementById("sendToAll");
const historyList = document.getElementById("historyList");

// ================= Auth Check =================
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "index1.html"; // redirect if not logged in
  }
});

// ================= Send Notification =================
sendBtn.addEventListener("click", async () => {
  const uid = notifUid.value.trim();
  const message = notifMessage.value.trim();
  const broadcast = sendToAll.checked;

  if (!message) {
    alert("Message cannot be empty!");
    return;
  }

  sendBtn.disabled = true;
  sendStatus.innerHTML = `<span class="spinner"></span> Sending...`;

  try {
    const adminId = auth.currentUser ? auth.currentUser.uid : "admin";
    const now = new Date().toISOString();

    // ===== Save in global notifications history =====
    const notifRef = ref(db, "notifications");
    const newNotif = push(notifRef);
    await set(newNotif, {
      message,
      targetUid: broadcast ? "ALL" : uid || "UNKNOWN",
      createdAt: now,
      fromAdmin: adminId
    });

    // ===== Send to all members individually =====
    if (broadcast) {
      const membersSnap = await get(ref(db, "members"));
      if (membersSnap.exists()) {
        membersSnap.forEach(member => {
          const memberUid = member.key;
          const memberNotifRef = push(ref(db, "memberNotifications/" + memberUid));
          set(memberNotifRef, {
            message,
            createdAt: now,
            fromAdmin: adminId
          });
        });
      }
    } else if (uid) {
      // Send to single UID
      const memberNotifRef = push(ref(db, "memberNotifications/" + uid));
      await set(memberNotifRef, {
        message,
        createdAt: now,
        fromAdmin: adminId
      });
    }

    sendStatus.innerHTML = "✅ Sent!";
    notifMessage.value = "";
    notifUid.value = "";
    sendToAll.checked = false;

  } catch (err) {
    console.error(err);
    sendStatus.innerHTML = "❌ Failed: " + err.message;
  }

  sendBtn.disabled = false;
  setTimeout(() => (sendStatus.innerHTML = ""), 3000);
});

// ================= Load Notification History =================
function loadHistory() {
  const notifRef = query(ref(db, "notifications"), orderByChild("createdAt"));
  onValue(notifRef, snapshot => {
    if (!snapshot.exists()) {
      historyList.innerHTML = "No notifications yet.";
      return;
    }

    const items = [];
    snapshot.forEach(child => {
      items.push({ id: child.key, ...child.val() });
    });

    // Sort newest first
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    historyList.innerHTML = "";
    items.forEach(n => {
      const div = document.createElement("div");
      div.className = "history-item";

      const left = document.createElement("div");
      left.className = "history-left";
      left.innerHTML = `<div>${n.message}</div>
        <div class="muted">${n.targetUid === "ALL" ? "Broadcasted to ALL" : "Sent to UID: " + n.targetUid}</div>
        <div class="muted">${new Date(n.createdAt).toLocaleString()}</div>`;

      const right = document.createElement("div");
      const delBtn = document.createElement("button");
      delBtn.className = "btn-small btn-danger";
      delBtn.innerText = "Delete";
      delBtn.onclick = () => deleteNotification(n.id);

      right.appendChild(delBtn);
      div.appendChild(left);
      div.appendChild(right);

      historyList.appendChild(div);
    });
  });
}
loadHistory();

// ================= Delete Notification =================
function deleteNotification(id) {
  if (confirm("Are you sure you want to delete this notification?")) {
    remove(ref(db, "notifications/" + id)).catch(err => {
      alert("❌ Failed to delete: " + err.message);
    });
  }
}

// ================= Logout =================
window.logout = function () {
  signOut(auth).then(() => {
    window.location.href = "index1.html";
  });
};
