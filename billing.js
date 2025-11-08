// billing.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, push, set, update, get, child, onValue, remove, query, orderByChild, limitToLast
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
const receiptsContainer = document.getElementById("receiptsContainer");
const viewMemberUidInput = document.getElementById("viewMemberUid");

// ---------- Admin guard ----------
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "index1.html";
  try {
    const snap = await get(ref(db, "members/" + user.uid));
    const me = snap.exists() ? snap.val() : null;
    if (!me || me.role !== "admin") {
      alert("Access denied — admin only");
      return window.location.href = "index1.html";
    }
  } catch (err) {
    console.error(err);
    alert("Auth check failed");
    window.location.href = "index1.html";
  }
});

window.logout = function () {
  signOut(auth).then(() => window.location.href = "index1.html");
};

// ---------- Logging helper ----------
async function writeLog(actorUid, action, targetId = null, details = {}) {
  try {
    const lRef = push(ref(db, "logs"));
    await set(lRef, { actorUid, action, targetId, details, createdAt: new Date().toISOString() });
  } catch (e) {
    console.error("Log failed:", e);
  }
}

// ---------- Create Bill ----------
window.createBill = async function () {
  const memberUid = document.getElementById("billMemberUid").value.trim();
  const amount = Number(document.getElementById("billAmount").value);
  const date = document.getElementById("billDate").value || new Date().toISOString().split("T")[0];
  const status = document.getElementById("billStatus").value;
  const notes = document.getElementById("billNotes").value.trim();

  if (!memberUid) return alert("Enter member UID");
  if (!amount || amount <= 0) return alert("Enter valid amount");

  try {
    const receiptRef = push(ref(db, `receipts/${memberUid}`));
    const receiptData = {
      amount,
      date,
      status,
      notes,
      createdAt: new Date().toISOString()
    };
    await set(receiptRef, receiptData);

    // optional global index for easy queries & exports
    const billIndexRef = push(ref(db, "bills"));
    await set(billIndexRef, { memberUid, receiptId: receiptRef.key, ...receiptData });

    await writeLog(auth.currentUser?.uid || "system", "CREATE_BILL", receiptRef.key, { memberUid, amount, status });

    alert("✅ Bill created");
    document.getElementById("billMemberUid").value = "";
    document.getElementById("billAmount").value = "";
    document.getElementById("billNotes").value = "";
    loadReceiptsForMember(); // refresh view
  } catch (err) {
    console.error(err);
    alert("Create failed: " + err.message);
  }
};

// ---------- Load receipts for a member ----------
window.loadReceiptsForMember = async function () {
  const memberUid = viewMemberUidInput.value.trim();
  receiptsContainer.innerHTML = "<div class='small-muted'>Loading receipts...</div>";
  if (!memberUid) {
    receiptsContainer.innerHTML = "<div class='small-muted'>No member UID provided. You can click 'Load Recent All' to view recent receipts.</div>";
    return;
  }
  try {
    const snap = await get(ref(db, `receipts/${memberUid}`));
    receiptsContainer.innerHTML = "";
    if (!snap.exists()) {
      receiptsContainer.innerHTML = "<div class='small-muted'>No receipts for this member.</div>";
      return;
    }
    snap.forEach(childSnap => {
      const id = childSnap.key;
      const r = childSnap.val();
      const node = renderReceiptRow(memberUid, id, r);
      receiptsContainer.appendChild(node);
    });
  } catch (err) {
    console.error(err);
    receiptsContainer.innerHTML = "<div class='small-muted'>Failed to load receipts.</div>";
  }
};

// ---------- Load recent receipts across all members (shows last N from bills index) ----------
window.loadRecentReceipts = async function (limit = 50) {
  receiptsContainer.innerHTML = "<div class='small-muted'>Loading recent receipts...</div>";
  try {
    const q = query(ref(db, "bills"), orderByChild("createdAt"), limitToLast(limit));
    onValue(q, (snap) => {
      receiptsContainer.innerHTML = "";
      if (!snap.exists()) {
        receiptsContainer.innerHTML = "<div class='small-muted'>No recent receipts.</div>";
        return;
      }
      // bills index entries contain memberUid + receiptId
      const items = [];
      snap.forEach(s => items.push({ id: s.key, ...s.val() }));
      // show newest first
      items.reverse().forEach(it => {
        const node = renderReceiptRow(it.memberUid, it.receiptId, it);
        receiptsContainer.appendChild(node);
      });
    }, { onlyOnce: false });
  } catch (err) {
    console.error(err);
    receiptsContainer.innerHTML = "<div class='small-muted'>Failed to load recent receipts.</div>";
  }
};

// ---------- Render a receipt DOM node ----------
function renderReceiptRow(memberUid, receiptId, r) {
  const wrapper = document.createElement("div");
  wrapper.className = "receipt-row";

  const meta = document.createElement("div");
  meta.className = "receipt-meta";
  meta.innerHTML = `<strong>Member:</strong> <span class="small-muted">${memberUid}</span>
                    <br><strong>Receipt ID:</strong> <span class="small-muted">${receiptId}</span>
                    <br><strong>Amount:</strong> ₹${r.amount} • <strong>Date:</strong> ${r.date}
                    <br><strong>Status:</strong> <span class="small-muted">${r.status}</span>
                    ${r.notes ? `<br><strong>Notes:</strong> <span class="small-muted">${escape(r.notes)}</span>` : ""}`;

  const actions = document.createElement("div");
  actions.className = "receipt-actions";

  // Mark as Paid (if not already)
  const markBtn = document.createElement("button");
  markBtn.className = "btn-success";
  markBtn.textContent = r.status === "Paid" ? "Paid ✓" : "Mark as Paid";
  markBtn.disabled = r.status === "Paid";
  markBtn.onclick = () => markReceiptPaid(memberUid, receiptId, markBtn, wrapper);
  actions.appendChild(markBtn);

  // Delete
  const delBtn = document.createElement("button");
  delBtn.className = "btn-primary";
  delBtn.style.background = "#e74c3c";
  delBtn.textContent = "Delete";
  delBtn.onclick = () => deleteReceipt(memberUid, receiptId, wrapper);
  actions.appendChild(delBtn);

  wrapper.appendChild(meta);
  wrapper.appendChild(actions);
  return wrapper;
}

// ---------- Mark a receipt Paid ----------
async function markReceiptPaid(memberUid, receiptId, markBtn, wrapper) {
  if (!confirm("Mark this receipt as PAID?")) return;
  try {
    await update(ref(db, `receipts/${memberUid}/${receiptId}`), { status: "Paid", paidAt: new Date().toISOString() });
    // update corresponding bill index if exists
    // find bills entry with receiptId and memberUid
    const billsSnap = await get(ref(db, "bills"));
    if (billsSnap.exists()) {
      billsSnap.forEach(b => {
        const val = b.val();
        if (val.receiptId === receiptId && val.memberUid === memberUid) {
          update(ref(db, `bills/${b.key}`), { status: "Paid", paidAt: new Date().toISOString() });
        }
      });
    }
    await writeLog(auth.currentUser?.uid || "system", "MARK_PAID", receiptId, { memberUid });
    // update UI
    markBtn.textContent = "Paid ✓";
    markBtn.disabled = true;
    // optionally highlight
    wrapper.style.background = "rgba(76,175,80,0.08)";
  } catch (err) {
    console.error(err);
    alert("Failed to mark as paid: " + err.message);
  }
}

// ---------- Delete a receipt ----------
async function deleteReceipt(memberUid, receiptId, wrapper) {
  if (!confirm("Delete this receipt? This action cannot be undone.")) return;
  try {
    // remove from receipts
    await remove(ref(db, `receipts/${memberUid}/${receiptId}`));
    // remove from bills index (if present)
    const billsSnap = await get(ref(db, "bills"));
    if (billsSnap.exists()) {
      billsSnap.forEach(b => {
        const val = b.val();
        if (val.receiptId === receiptId && val.memberUid === memberUid) {
          remove(ref(db, `bills/${b.key}`)).catch(e => console.warn("Failed to remove bill index", e));
        }
      });
    }
    await writeLog(auth.currentUser?.uid || "system", "DELETE_RECEIPT", receiptId, { memberUid });
    // remove from UI
    wrapper.remove();
    alert("Receipt deleted.");
  } catch (err) {
    console.error(err);
    alert("Delete failed: " + err.message);
  }
}

// ---------- Export receipts to CSV (all or for a single member) ----------
window.exportReceiptsCSV = async function () {
  const memberUid = document.getElementById("exportMemberUid").value.trim();
  try {
    let rows = [];
    if (memberUid) {
      const snap = await get(ref(db, `receipts/${memberUid}`));
      if (!snap.exists()) return alert("No receipts for this member");
      snap.forEach(child => {
        const d = child.val();
        rows.push({ id: child.key, memberUid, ...d });
      });
    } else {
      const snap = await get(ref(db, "bills"));
      if (!snap.exists()) return alert("No bills found");
      snap.forEach(child => {
        rows.push({ id: child.key, ...child.val() });
      });
    }
    const headers = ["Receipt ID","Member UID","Amount","Date","Status","Notes","CreatedAt"];
    const csvRows = [headers.join(",")];
    rows.forEach(r => {
      const line = [
        `"${(r.receiptId || r.id) || ''}"`,
        `"${r.memberUid || ''}"`,
        `"${r.amount || ''}"`,
        `"${r.date || ''}"`,
        `"${r.status || ''}"`,
        `"${(r.notes||'').replace(/"/g,'""')}"`,
        `"${r.createdAt || ''}"`
      ].join(",");
      csvRows.push(line);
    });
    const csv = csvRows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipts_${memberUid || "all"}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert("Export failed: " + err.message);
  }
};

// ---------- Utilities ----------
function escape(s){ return String(s||'').replace(/"/g,'""'); }
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
