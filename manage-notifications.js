// manage-notifications.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, push, set, get, remove
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// ---------- CONFIG ----------
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// DOM
const notifUidEl = document.getElementById("notifUid");
const notifMessageEl = document.getElementById("notifMessage");
const sendToAllEl = document.getElementById("sendToAll");
const sendBtn = document.getElementById("sendBtn");
const sendStatus = document.getElementById("sendStatus");
const historyList = document.getElementById("historyList");

// Admin guard: allow only admins
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "index1.html";
  try {
    const snap = await get(ref(db, `members/${user.uid}`));
    const me = snap.exists() ? snap.val() : null;
    if (!me || me.role !== "admin") {
      alert("Access denied — admin only");
      return window.location.href = "index1.html";
    }
    loadHistory();
  } catch (err) {
    console.error(err);
    alert("Auth check failed");
    window.location.href = "index1.html";
  }
});

window.logout = function () {
  signOut(auth).then(() => window.location.href = "index1.html");
};

// ---------- Helpers ----------

// Single member
async function sendNotificationToMember(targetUid, message, fromAdminUid) {
  const notifRef = push(ref(db, `notifications/${targetUid}`));
  const payload = { message, createdAt: new Date().toISOString(), fromAdmin: fromAdminUid || null };
  await set(notifRef, payload);
  return notifRef.key;
}

// All members
async function sendToAllMembers(message, fromAdminUid, onProgress) {
  const membersSnap = await get(ref(db, "members"));
  if (!membersSnap.exists()) return { sent: 0, total: 0, serrors: [] };

  const members = [];
  membersSnap.forEach(s => members.push({ uid: s.key }));

  const total = members.length;
  let sent = 0;
  const errors = [];

  for (let i = 0; i < total; i++) {
    const uid = members[i].uid;
    try {
      await sendNotificationToMember(uid, message, fromAdminUid);
      sent++;
      if (onProgress) onProgress(sent, total, uid);
    } catch (err) {
      console.error("❌ Failed for", uid, err);
      errors.push({ uid, error: err.message });
      if (onProgress) onProgress(sent, total, uid, err);
    }
  }

  return { sent, total, errors };
}

// Save history
async function writeAdminHistory(target, message, sentCount = 0) {
  const hRef = push(ref(db, "adminNotifications"));
  await set(hRef, {
    target,
    message,
    count: sentCount,
    sentBy: auth.currentUser?.uid || "system",
    createdAt: new Date().toISOString()
  });
  return hRef.key;
}

// ---------- UI: Send ----------
sendBtn.addEventListener("click", async () => {
  const uid = (notifUidEl.value || "").trim();
  const msg = (notifMessageEl.value || "").trim();
  const sendAll = sendToAllEl.checked;

  if (!msg) return alert("Please type a message.");

  sendBtn.disabled = true;
  sendStatus.innerHTML = `<span class="muted">Sending...</span>`;

  try {
    if (sendAll) {
      const result = await sendToAllMembers(msg, auth.currentUser?.uid, (done, total, uid) => {
        sendStatus.innerHTML = `<span class="muted">Sent ${done}/${total} (last: ${uid})</span>`;
      });

      await writeAdminHistory("ALL", msg, result.sent);

      if (result.errors.length > 0) {
        alert(`⚠️ Sent to ${result.sent}/${result.total}. Errors: ${result.errors.length} (check console).`);
      } else {
        alert(`✅ Notification sent to ${result.sent}/${result.total} members.`);
      }
    } else {
      if (!uid) {
        alert("Enter a Member UID or check 'Send to ALL'.");
        return;
      }
      await sendNotificationToMember(uid, msg, auth.currentUser?.uid);
      await writeAdminHistory(uid, msg, 1);
      alert("✅ Notification sent to " + uid);
    }

    notifUidEl.value = "";
    notifMessageEl.value = "";
    sendToAllEl.checked = false;
    loadHistory();
  } catch (err) {
    console.error("Send failed:", err);
    alert("❌ " + err.message);
  } finally {
    sendBtn.disabled = false;
    sendStatus.innerHTML = "";
  }
});

// ---------- History ----------
async function loadHistory() {
  historyList.innerHTML = "Loading history...";
  const snap = await get(ref(db, "adminNotifications"));
  if (!snap.exists()) {
    historyList.innerHTML = "<div class='muted'>No notifications sent yet.</div>";
    return;
  }
  const arr = [];
  snap.forEach(s => arr.push({ id: s.key, ...s.val() }));
  arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  historyList.innerHTML = "";
  arr.forEach(item => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div>
        <div><strong>${escapeHtml(item.target === "ALL" ? "All Members" : item.target)}</strong></div>
        <div class="muted">${escapeHtml(item.message)}</div>
        <div class="muted">Sent: ${new Date(item.createdAt).toLocaleString()} • Count: ${item.count}</div>
      </div>
      <div>
        <button onclick='resend("${item.id}")'>Resend</button>
        <button onclick='deleteHistory("${item.id}")'>Delete</button>
      </div>
    `;
    historyList.appendChild(div);
  });
}

window.resend = async function (id) {
  const snap = await get(ref(db, `adminNotifications/${id}`));
  if (!snap.exists()) return alert("History not found");
  const h = snap.val();
  if (h.target === "ALL") {
    if (!confirm("Resend to ALL members?")) return;
    const result = await sendToAllMembers(h.message, auth.currentUser?.uid);
    await writeAdminHistory("ALL (resend)", h.message, result.sent);
    alert(`Resent to ${result.sent}/${result.total}`);
  } else {
    if (!confirm(`Resend to ${h.target}?`)) return;
    await sendNotificationToMember(h.target, h.message, auth.currentUser?.uid);
    await writeAdminHistory(h.target, h.message, 1);
    alert("Resent to " + h.target);
  }
  loadHistory();
};

window.deleteHistory = async function (id) {
  if (!confirm("Delete this history entry?")) return;
  await remove(ref(db, `adminNotifications/${id}`));
  loadHistory();
};

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}
