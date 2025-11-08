// manage-trainers.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  update,
  remove,
  get,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

// ---- Firebase config (use your config and include databaseURL) ----
const firebaseConfig = {
  apiKey: "AIzaSyAwgtQa3u_g5H79XdxzxI9KBlh8PE0yXZQ",
  authDomain: "gym-management-project-5fc39.firebaseapp.com",
  databaseURL: "https://gym-management-project-5fc39-default-rtdb.firebaseio.com", // <- important
  projectId: "gym-management-project-5fc39",
  storageBucket: "gym-management-project-5fc39.firebasestorage.app",
  messagingSenderId: "621076096063",
  appId: "1:621076096063:web:33f65f2102e0ea6277448a",
  measurementId: "G-763KCFL1TF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// elements
const trainersList = document.getElementById("trainersList");
const searchTrainer = document.getElementById("searchTrainer");

// ensure only admin uses page (client-side check)
onAuthStateChanged(auth, async (user) => {
  if (!user) return window.location.href = "index1.html";
  // check user's role
  try {
    const snap = await get(ref(db, "members/" + user.uid));
    const me = snap.exists() ? snap.val() : null;
    if (!me || me.role !== "admin") {
      alert("Access denied — admin only");
      return window.location.href = "index1.html";
    }
    loadTrainers();
  } catch (err) {
    console.error(err);
    alert("Auth check failed");
    window.location.href = "index1.html";
  }
});

window.logout = function () {
  signOut(auth).then(() => window.location.href = "index1.html");
};

// add or update trainer
window.saveTrainer = async function () {
  const name = document.getElementById("trainerName").value.trim();
  const specialty = document.getElementById("trainerSpecialty").value.trim();
  const experience = document.getElementById("trainerExperience").value.trim();
  const phone = document.getElementById("trainerPhone").value.trim();
  const photoUrlInputEl = document.getElementById("trainerPhotoUrl");
  const photoUrlInput = photoUrlInputEl ? photoUrlInputEl.value.trim() : "";
  const editId = document.getElementById("editTrainerId").value;

  if (!name || !specialty) return alert("Please enter name and specialty.");

  try {
    let photoURL = "";

    // 1) Prefer explicit URL if provided
    if (photoUrlInput) {
      if (!isValidImageUrl(photoUrlInput)) {
        return alert("Please paste a valid image URL (jpg/png/gif/webp/svg).");
      }
      photoURL = photoUrlInput;
    }

    if (editId) {
      // update existing trainer
      const updates = {
        name,
        specialty,
        experience,
        phone
      };
      if (photoURL) updates.photo = photoURL;
      await update(ref(db, "trainers/" + editId), updates);
      alert("Trainer updated.");
    } else {
      // create new - use push() to generate id
      const newRef = push(ref(db, "trainers"));
      await set(newRef, {
        name,
        specialty,
        experience,
        phone,
        photo: photoURL || "",
        createdAt: new Date().toISOString()
      });
      alert("Trainer added.");
    }

    resetForm();
    loadTrainers();
  } catch (err) {
    console.error(err);
    alert("Save failed: " + err.message);
  }
};

// load trainers and render
export async function loadTrainers() {
  if (!trainersList) return;
  trainersList.innerHTML = "<div style='color:#ddd'>Loading...</div>";
  const trRef = ref(db, "trainers");
  onValue(trRef, (snapshot) => {
    trainersList.innerHTML = "";
    if (!snapshot.exists()) {
      trainersList.innerHTML = "<div style='color:#ddd'>No trainers yet.</div>";
      return;
    }
    const q = (searchTrainer?.value || "").toLowerCase().trim();
    snapshot.forEach(childSnap => {
      const id = childSnap.key;
      const t = childSnap.val();
      const combined = `${t.name || ""} ${t.specialty || ""}`.toLowerCase();
      if (q && !combined.includes(q)) return;

      const photoSrc = t.photo && t.photo.length ? t.photo : "https://via.placeholder.com/80";

      const block = document.createElement("div");
      block.className = "card-small";
      block.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${escapeHtml(photoSrc)}" alt="Trainer Photo" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #ff9800;">
            <div>
              <div style="font-weight:700">${escapeHtml(t.name)}</div>
              <div style="font-size:13px;color:#ddd">${escapeHtml(t.specialty)} • ${escapeHtml(t.experience || '')}</div>
              <div style="font-size:12px;color:#bbb;margin-top:6px">${escapeHtml(t.phone || '')}</div>
            </div>
          </div>
          <div class="actions">
            <button class="action-btn copy-btn" title="Copy ID" onclick="copyText('${id}', this)">Copy ID</button>
            <button class="action-btn promote-btn" onclick="editTrainer('${id}')">Edit</button>
            <button class="action-btn delete-btn" onclick="deleteTrainer('${id}')">Delete</button>
          </div>
        </div>
      `;
      trainersList.appendChild(block);
    });
  }, { onlyOnce: false });
}
window.loadTrainers = loadTrainers;

// helper: copy ID
window.copyText = (txt, btn) => {
  navigator.clipboard.writeText(txt).then(() => {
    const old = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(()=> btn.textContent = old, 1000);
  });
};

// edit trainer: populate form with data
window.editTrainer = async function (id) {
  try {
    const sn = await get(ref(db, "trainers/" + id));
    if (!sn.exists()) return alert("Trainer not found.");
    const t = sn.val();
    document.getElementById("trainerName").value = t.name || "";
    document.getElementById("trainerSpecialty").value = t.specialty || "";
    document.getElementById("trainerExperience").value = t.experience || "";
    document.getElementById("trainerPhone").value = t.phone || "";
    if (document.getElementById("trainerPhotoUrl")) {
      document.getElementById("trainerPhotoUrl").value = t.photo || "";
    }
    document.getElementById("editTrainerId").value = id;
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error(err);
    alert("Failed to load trainer.");
  }
};

// delete trainer
window.deleteTrainer = function (id) {
  if (!confirm("Delete this trainer? This cannot be undone.")) return;
  remove(ref(db, "trainers/" + id)).then(() => {
    alert("Trainer removed.");
  }).catch(err => alert("Delete failed: " + err.message));
};

// reset form
window.resetForm = function () {
  const els = ["trainerName","trainerSpecialty","trainerExperience","trainerPhone","editTrainerId","trainerPhotoUrl"];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
};

// escape helper to avoid injecting html
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// basic image URL checker
function isValidImageUrl(url) {
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(u.pathname);
  } catch (e) {
    return false;
  }
}
