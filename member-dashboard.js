// member-dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, onValue, get, update
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

// ---------- DOM refs ----------
const profileNameEl = document.getElementById("profileName");
const profilePhoneEl = document.getElementById("profilePhone");
const profileEmailEl = document.getElementById("profileEmail");
const receiptsListEl = document.getElementById("receiptsList");
const notificationsListEl = document.getElementById("notificationsList");
const logoutBtn = document.getElementById("logoutBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const refreshBtn = document.getElementById("refreshBtn");

// Trainer/Diet elements
const selectCard = document.getElementById("selectTrainerDietCard");
const selectTrainerEl = document.getElementById("selectTrainer");
const selectDietEl = document.getElementById("selectDiet");
const customDietContainer = document.getElementById("customDietContainer");
const customDietEl = document.getElementById("customDiet");
const saveTrainerDietBtn = document.getElementById("saveTrainerDietBtn");
const skipTrainerDietBtn = document.getElementById("skipTrainerDietBtn");

let currentUser = null;
let currentUid = null;

// ========== AUTH STATE ==========
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    return window.location.href = "index1.html"; // not logged in
  }
  currentUser = user;
  currentUid = user.uid;
  await loadProfile();
  await checkTrainerDietSelection();
  subscribeReceipts();
  subscribeNotifications();
});

// ========== LOGOUT ==========
logoutBtn.addEventListener("click", () => {
  signOut(auth).then(() => window.location.href = "index1.html");
});

// ========== PROFILE ==========
refreshBtn.addEventListener("click", async () => {
  await loadProfile();
  await checkTrainerDietSelection();
});

async function loadProfile() {
  if (!currentUid) return;
  try {
    const snap = await get(ref(db, "members/" + currentUid));
    if (snap.exists()) {
      const data = snap.val();
      profileNameEl.value = data.name || "";
      profilePhoneEl.value = data.phone || "";
      profileEmailEl.textContent = data.email || (currentUser.email || "");
    } else {
      // If no members entry, fallback
      profileNameEl.value = currentUser.displayName || "";
      profilePhoneEl.value = "";
      profileEmailEl.textContent = currentUser.email || "";
    }
  } catch (err) {
    console.error(err);
    alert("Failed to load profile.");
  }
}

saveProfileBtn.addEventListener("click", async () => {
  if (!currentUid) return;
  const name = profileNameEl.value.trim();
  const phone = profilePhoneEl.value.trim();
  if (!name) return alert("Name cannot be empty.");
  try {
    await update(ref(db, "members/" + currentUid), { name, phone });
    alert("Profile updated.");
  } catch (err) {
    console.error(err);
    alert("Update failed: " + err.message);
  }
});

// ========== RECEIPTS ==========
function subscribeReceipts() {
  if (!currentUid) return;
  const rRef = ref(db, "receipts/" + currentUid);
  onValue(rRef, (snap) => {
    receiptsListEl.innerHTML = "";
    if (!snap.exists()) {
      receiptsListEl.innerHTML = "<div class='muted'>No receipts yet.</div>";
      return;
    }
    snap.forEach(child => {
      const id = child.key;
      const r = child.val();
      receiptsListEl.appendChild(createReceiptNode(id, r));
    });
  });
}

function createReceiptNode(id, r) {
  const wrapper = document.createElement("div");
  wrapper.className = "receipt-item";

  const left = document.createElement("div");
  left.innerHTML = `<div style="font-weight:700">₹${r.amount}</div>
                    <div class="muted">Date: ${r.date || r.createdAt || ""}</div>
                    <div class="muted">Status: ${r.status || ""}</div>`;

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.gap = "8px";

  const btnPrint = document.createElement("button");
  btnPrint.className = "btn-small btn-download";
  btnPrint.textContent = "Download / Print";
  btnPrint.onclick = () => openPrintableReceipt(id, r);

  right.appendChild(btnPrint);

  wrapper.appendChild(left);
  wrapper.appendChild(right);
  return wrapper;
}

function openPrintableReceipt(id, r) {
  const doc = `
  <html>
  <head>
    <title>Receipt ${id}</title>
    <style>
      body { font-family: Arial, sans-serif; padding:20px; color:#111; }
      .card { border:1px solid #ddd; padding:20px; border-radius:8px; max-width:600px; }
      h2 { margin-top:0; }
      .row { display:flex; justify-content:space-between; margin:8px 0; }
      .muted { color:#666; font-size:13px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>GYM Receipt</h2>
      <div class="row"><div><strong>Receipt ID:</strong></div><div>${escapeHtml(id)}</div></div>
      <div class="row"><div><strong>Member:</strong></div><div>${escapeHtml(profileNameEl.value || profileEmailEl.textContent)}</div></div>
      <div class="row"><div><strong>Amount:</strong></div><div>₹${escapeHtml(r.amount)}</div></div>
      <div class="row"><div><strong>Date:</strong></div><div>${escapeHtml(r.date || r.createdAt || new Date().toISOString())}</div></div>
      <div class="row"><div><strong>Status:</strong></div><div>${escapeHtml(r.status)}</div></div>
      ${r.notes ? `<div style="margin-top:10px;"><strong>Notes:</strong><div class="muted">${escapeHtml(r.notes)}</div></div>` : ""}
      <hr>
      <div class="muted">Generated: ${new Date().toLocaleString()}</div>
    </div>
    <script>window.onload = ()=>{ window.print(); }</script>
  </body>
  </html>
  `;
  const w = window.open("", "_blank", "width=700,height=800");
  w.document.write(doc);
  w.document.close();
}

// ========== NOTIFICATIONS ==========
function subscribeNotifications() {
  if (!currentUid) return;
  const nRef = ref(db, "memberNotifications/" + currentUid);
  onValue(nRef, (snap) => {
    notificationsListEl.innerHTML = "";
    if (!snap.exists()) {
      notificationsListEl.innerHTML = "<div class='muted'>No notifications.</div>";
      return;
    }
    snap.forEach(child => {
      const val = child.val();
      const div = document.createElement("div");
      div.className = "notif-item";
      const text = typeof val === "string" ? val : (val.message || JSON.stringify(val));
      div.innerHTML = `<div>${escapeHtml(text)}</div>`;
      notificationsListEl.appendChild(div);
    });
  });
}

// ========== TRAINER & DIET SELECTION ==========
async function loadTrainerOptions() {
  try {
    selectTrainerEl.innerHTML = `<option value="">-- Select a trainer --</option>`;
    const snap = await get(ref(db, "trainers"));
    if (!snap.exists()) {
      selectTrainerEl.innerHTML = `<option value="">No trainers available</option>`;
      return;
    }
    snap.forEach(child => {
      const t = child.val();
      const id = child.key;
      const name = t.name || id;
      const specialty = t.specialty ? ` (${t.specialty})` : "";
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = `${name}${specialty}`;
      selectTrainerEl.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to load trainers:", err);
    selectTrainerEl.innerHTML = `<option value="">Error loading</option>`;
  }
}

function onDietChange() {
  const v = selectDietEl.value;
  customDietContainer.style.display = v === "custom" ? "block" : "none";
}
selectDietEl?.addEventListener("change", onDietChange);

async function saveTrainerDietSelection(skip=false) {
  if (!currentUid) return alert("Not authenticated.");
  const trainerId = selectTrainerEl.value;
  const dietVal = selectDietEl.value;
  const customDiet = (customDietEl?.value || "").trim();

  if (!skip) {
    if (!trainerId) return alert("Please select a trainer.");
    if (!dietVal) return alert("Please select a diet.");
    if (dietVal === "custom" && !customDiet) return alert("Please describe your custom diet.");
  }

  const updates = {};
  updates[`members/${currentUid}/trainer`] = trainerId || "";
  updates[`members/${currentUid}/diet`] = dietVal === "custom" ? customDiet : (dietVal || "");
  updates[`members/${currentUid}/trainerSelectedAt`] = new Date().toISOString();
  updates[`members/${currentUid}/trainerSelectionSkipped`] = skip ? true : false;

  try {
    await update(ref(db), updates);
    alert("✅ Trainer & diet selection saved.");
    selectCard.style.display = "none";
    await loadProfile();
  } catch (err) {
    console.error("Save selection failed:", err);
    alert("Save failed: " + err.message);
  }
}

saveTrainerDietBtn?.addEventListener("click", () => saveTrainerDietSelection(false));
skipTrainerDietBtn?.addEventListener("click", () => saveTrainerDietSelection(true));

async function checkTrainerDietSelection() {
  if (!currentUid) return;
  try {
    const snap = await get(ref(db, `members/${currentUid}`));
    const me = snap.exists() ? snap.val() : null;
    const hasSelection = me && (me.trainer || me.diet);
    const skipped = me && me.trainerSelectionSkipped;

    if (!hasSelection || skipped) {
      await loadTrainerOptions();
      selectCard.style.display = "block";
    } else {
      selectCard.style.display = "none";
    }
  } catch (err) {
    console.error("checkTrainerDietSelection:", err);
  }
}

// ========== HELPERS ==========
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
