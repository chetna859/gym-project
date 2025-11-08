// reports.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, get, query, orderByChild } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

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
const statsGrid = document.getElementById("statsGrid");
const revenueByMonthDiv = document.getElementById("revenueByMonth");
const topMembersDiv = document.getElementById("topMembers");
const recentReceiptsDiv = document.getElementById("recentReceipts");
const fromDateEl = document.getElementById("fromDate");
const toDateEl = document.getElementById("toDate");

// store last generated report data (for CSV export)
let lastReport = {
  type: null,
  payload: null
};

// admin guard
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

// generate reports entrypoint
window.generateReports = async function () {
  // read all bills index
  try {
    const billsSnap = await get(ref(db, "bills"));
    if (!billsSnap.exists()) {
      statsGrid.innerHTML = "<div class='small-muted'>No billing data (bills index empty)</div>";
      revenueByMonthDiv.innerHTML = "";
      topMembersDiv.innerHTML = "";
      recentReceiptsDiv.innerHTML = "";
      return;
    }

    // prepare range filters
    const fromDate = fromDateEl.value ? new Date(fromDateEl.value) : null;
    const toDate = toDateEl.value ? new Date(toDateEl.value) : null;
    if (toDate) {
      // include entire day
      toDate.setHours(23,59,59,999);
    }

    const bills = [];
    billsSnap.forEach(s => bills.push({ id: s.key, ...s.val() }));

    // filter by createdAt or date field if provided
    const filtered = bills.filter(b => {
      const t = b.createdAt || b.date || "";
      const dt = t ? new Date(t) : null;
      if (!dt) return true;
      if (fromDate && dt < fromDate) return false;
      if (toDate && dt > toDate) return false;
      return true;
    });

    // compute summary
    const totalReceipts = filtered.length;
    const totalRevenue = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const paidCount = filtered.filter(r => r.status === "Paid").length;
    const pendingCount = filtered.filter(r => r.status !== "Paid").length;

    // render stat cards
    statsGrid.innerHTML = `
      <div class="stat-card"><div class="small-muted">Total Receipts</div><div style="font-weight:700;font-size:20px"> ${totalReceipts} </div></div>
      <div class="stat-card"><div class="small-muted">Total Revenue</div><div style="font-weight:700;font-size:20px"> ₹${totalRevenue.toFixed(2)} </div></div>
      <div class="stat-card"><div class="small-muted">Paid</div><div style="font-weight:700;font-size:20px"> ${paidCount} </div></div>
      <div class="stat-card"><div class="small-muted">Pending</div><div style="font-weight:700;font-size:20px"> ${pendingCount} </div></div>
    `;

    // revenue by month
    const revenueByMonth = {}; // key = YYYY-MM
    filtered.forEach(r => {
      const dt = r.createdAt ? new Date(r.createdAt) : (r.date ? new Date(r.date) : null);
      const key = dt ? `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}` : 'unknown';
      revenueByMonth[key] = (revenueByMonth[key] || 0) + (Number(r.amount) || 0);
    });

    const months = Object.keys(revenueByMonth).sort();
    let htmlMonth = `<table class="report-table"><thead><tr><th>Month</th><th>Revenue (₹)</th></tr></thead><tbody>`;
    months.forEach(m => htmlMonth += `<tr><td>${m}</td><td>₹${revenueByMonth[m].toFixed(2)}</td></tr>`);
    htmlMonth += `</tbody></table>`;
    revenueByMonthDiv.innerHTML = htmlMonth;
    lastReport = { type: 'revenueByMonth', payload: months.map(m => ({ month: m, revenue: revenueByMonth[m] })) };

    // top members by revenue
    const byMember = {}; // memberUid -> { total, count }
    filtered.forEach(r => {
      const mu = r.memberUid || r.member || 'unknown';
      if (!byMember[mu]) byMember[mu] = { total: 0, count: 0 };
      byMember[mu].total += (Number(r.amount) || 0);
      byMember[mu].count += 1;
    });

    const topN = Number(document.getElementById("topN").value) || 10;
    const membersArr = Object.keys(byMember).map(uid => ({ uid, total: byMember[uid].total, count: byMember[uid].count }));
    membersArr.sort((a,b) => b.total - a.total);
    const top = membersArr.slice(0, topN);
    let htmlTop = `<table class="report-table"><thead><tr><th>Member UID</th><th>Total (₹)</th><th>Receipts</th></tr></thead><tbody>`;
    top.forEach(m => htmlTop += `<tr><td>${m.uid}</td><td>₹${m.total.toFixed(2)}</td><td>${m.count}</td></tr>`);
    htmlTop += `</tbody></table>`;
    topMembersDiv.innerHTML = htmlTop;
    lastReport.topMembers = top;

    // recent receipts list (show latest N)
    const recent = filtered.slice().sort((a,b) => {
      const ta = new Date(a.createdAt || a.date || 0).getTime();
      const tb = new Date(b.createdAt || b.date || 0).getTime();
      return tb - ta;
    }).slice(0, 50);

    let htmlRecent = `<table class="report-table"><thead><tr><th>Receipt ID</th><th>Member</th><th>Amount</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>`;
    recent.forEach(r => {
      htmlRecent += `<tr>
        <td>${r.receiptId || r.id}</td>
        <td>${r.memberUid}</td>
        <td>₹${(Number(r.amount) || 0).toFixed(2)}</td>
        <td>${r.date || r.createdAt || ''}</td>
        <td>${r.status || ''}</td>
        <td>${(r.notes||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
      </tr>`;
    });
    htmlRecent += `</tbody></table>`;
    recentReceiptsDiv.innerHTML = htmlRecent;
    lastReport.recent = recent;

  } catch (err) {
    console.error(err);
    alert("Failed to load billing data: " + err.message);
  }
};

// export the currently generated report (lastReport) as CSV
window.exportCurrentReportCSV = function () {
  if (!lastReport || !lastReport.type) return alert("No report generated yet. Click 'Generate Reports' first.");
  try {
    let csv = "";
    if (lastReport.type === 'revenueByMonth') {
      csv += "Month,Revenue\n";
      lastReport.payload.forEach(r => csv += `${r.month},${r.revenue}\n`);
    } else {
      // fallback: export recent
      const rows = lastReport.recent || [];
      csv += "ReceiptID,MemberUID,Amount,Date,Status,Notes\n";
      rows.forEach(r => {
        const rid = r.receiptId || r.id || '';
        csv += `"${rid}","${r.memberUid || ''}","${r.amount || ''}","${r.date || r.createdAt || ''}","${r.status || ''}","${(r.notes||'').replace(/"/g,'""')}"\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${lastReport.type}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Export failed: " + e.message);
  }
};

// helper: get all bills (if you need it separately)
async function getAllBills() {
  const snap = await get(ref(db, "bills"));
  const arr = [];
  if (!snap.exists()) return arr;
  snap.forEach(s => arr.push({ id: s.key, ...s.val() }));
  return arr;
}
