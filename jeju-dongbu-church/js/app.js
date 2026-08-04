import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const DEFAULT_MENU = [
  { label: "홈", href: "#home" },
  { label: "교회소개", href: "#about" },
  { label: "예배안내", href: "#worship" },
  { label: "소식", href: "#board" },
  { label: "오시는길", href: "#location" },
];

const DEMO_POSTS = [
  {
    id: "demo-1",
    title: "예시 게시글입니다",
    content: "Firebase 설정을 마치면 이 자리에 실제로 등록한 소식이 표시됩니다. js/firebase-config.js에 프로젝트 값을 채워주세요.",
    imageData: null,
    createdAtLabel: "예시",
  },
];

let app = null, db = null, auth = null;
let currentUser = null;
let menuTabs = DEFAULT_MENU;
let posts = DEMO_POSTS;
let editingPostId = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  document.getElementById("configBanner").classList.add("show");
}

/* ---------- helpers ---------- */
function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------- theme ---------- */
(function initTheme() {
  const root = document.documentElement;
  const btn = document.getElementById("themeToggle");
  const icon = document.getElementById("themeIcon");
  const sun = '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/>';
  const moon = '<path d="M20 14.5A8.5 8.5 0 119.5 4a7 7 0 1010.5 10.5z"/>';
  function apply(mode) {
    if (mode) root.setAttribute("data-theme", mode);
    const isDark = mode ? mode === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    icon.innerHTML = isDark ? moon : sun;
  }
  apply(localStorage.getItem("jdc-theme"));
  btn.addEventListener("click", () => {
    const current = root.getAttribute("data-theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem("jdc-theme", next);
    apply(next);
  });
})();

/* ---------- mobile nav / scrollspy / reveal / to-top ---------- */
(function initChrome() {
  const menuToggle = document.getElementById("menuToggle");
  const mobilePanel = document.getElementById("mobilePanel");
  menuToggle.addEventListener("click", () => mobilePanel.classList.toggle("open"));

  const toTop = document.getElementById("toTop");
  window.addEventListener("scroll", () => toTop.classList.toggle("show", window.scrollY > 560));
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in"));
  }
})();

/* ---------- menu rendering ---------- */
function renderMenu() {
  const primary = document.getElementById("primaryNav");
  const mobile = document.getElementById("mobilePanel");
  primary.innerHTML = "";
  mobile.innerHTML = "";
  menuTabs.forEach((tab) => {
    const a1 = el("a", null, escapeHTML(tab.label));
    a1.href = tab.href;
    primary.appendChild(a1);
    const a2 = el("a", null, escapeHTML(tab.label));
    a2.href = tab.href;
    a2.addEventListener("click", () => mobile.classList.remove("open"));
    mobile.appendChild(a2);
  });
  const navLinks = primary.querySelectorAll("a");
  const sections = Array.from(navLinks).map((a) => document.querySelector(a.getAttribute("href")));
  window.onscroll = window.onscroll || (() => {});
  document.addEventListener("scroll", () => {
    const y = window.scrollY + 120;
    let activeIndex = 0;
    sections.forEach((sec, i) => { if (sec && sec.offsetTop <= y) activeIndex = i; });
    navLinks.forEach((a, i) => a.classList.toggle("active", i === activeIndex && window.scrollY > 200));
  });
}
renderMenu();

if (db) {
  const menuRef = doc(db, "settings", "menu");
  onSnapshot(menuRef, (snap) => {
    if (snap.exists() && Array.isArray(snap.data().tabs) && snap.data().tabs.length) {
      menuTabs = snap.data().tabs;
    } else {
      menuTabs = DEFAULT_MENU;
    }
    renderMenu();
  }, () => { menuTabs = DEFAULT_MENU; renderMenu(); });
}

/* ---------- posts rendering ---------- */
function renderPosts() {
  const grid = document.getElementById("postGrid");
  const empty = document.getElementById("postEmpty");
  grid.innerHTML = "";
  if (!posts.length) { empty.style.display = "block"; return; }
  empty.style.display = "none";

  posts.forEach((post) => {
    const card = el("div", "post-card reveal in");
    const thumb = post.imageData
      ? Object.assign(document.createElement("img"), { className: "thumb", src: post.imageData, alt: "" })
      : el("div", "thumb empty", "사진 없음");
    card.appendChild(thumb);

    const body = el("div", "body");
    body.appendChild(el("div", "date tabular", post.createdAtLabel || formatDate(post.createdAt)));
    body.appendChild(el("h3", null, escapeHTML(post.title)));
    body.appendChild(el("p", "excerpt", escapeHTML(post.content)));
    card.appendChild(body);

    card.addEventListener("click", (e) => {
      if (e.target.closest(".admin-row")) return;
      openPostDetail(post);
    });

    if (currentUser) {
      const row = el("div", "admin-row");
      const editBtn = el("button", "mini-btn", "수정");
      editBtn.addEventListener("click", (e) => { e.stopPropagation(); openPostEditor(post); });
      const delBtn = el("button", "mini-btn danger", "삭제");
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("이 게시글을 삭제할까요?")) return;
        await deleteDoc(doc(db, "posts", post.id));
      });
      row.appendChild(editBtn); row.appendChild(delBtn);
      body.appendChild(row);
    }
    grid.appendChild(card);
  });
}
renderPosts();

if (db) {
  const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  onSnapshot(postsQuery, (snap) => {
    posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderPosts();
  }, () => { posts = DEMO_POSTS; renderPosts(); });
}

/* ---------- post detail modal ---------- */
const detailOverlay = document.getElementById("detailOverlay");
function openPostDetail(post) {
  document.getElementById("detailTitle").textContent = post.title;
  document.getElementById("detailMeta").textContent = post.createdAtLabel || formatDate(post.createdAt);
  document.getElementById("detailContent").textContent = post.content;
  const img = document.getElementById("detailImage");
  if (post.imageData) { img.src = post.imageData; img.style.display = "block"; }
  else { img.style.display = "none"; }
  detailOverlay.classList.add("open");
}
document.getElementById("detailClose").addEventListener("click", () => detailOverlay.classList.remove("open"));
detailOverlay.addEventListener("click", (e) => { if (e.target === detailOverlay) detailOverlay.classList.remove("open"); });

/* ---------- auth ---------- */
const adminBar = document.getElementById("adminBar");
const loginOverlay = document.getElementById("loginOverlay");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

document.getElementById("adminEntry").addEventListener("click", () => {
  loginError.classList.remove("show");
  if (!isFirebaseConfigured) {
    loginError.textContent = "Firebase 설정이 아직 완료되지 않았습니다. README.md를 참고해 설정을 마쳐주세요.";
    loginError.classList.add("show");
  }
  loginOverlay.classList.add("open");
});
document.getElementById("loginClose").addEventListener("click", () => loginOverlay.classList.remove("open"));
loginOverlay.addEventListener("click", (e) => { if (e.target === loginOverlay) loginOverlay.classList.remove("open"); });

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isFirebaseConfigured) return;
  loginError.classList.remove("show");
  const email = document.getElementById("loginEmail").value.trim();
  const pw = document.getElementById("loginPassword").value;
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    loginOverlay.classList.remove("open");
    loginForm.reset();
  } catch (err) {
    loginError.textContent = "로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.";
    loginError.classList.add("show");
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => signOut(auth));

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    adminBar.classList.toggle("on", !!user);
    renderPosts();
    updateHeroHint();
  });
}

/* ---------- hero photo ---------- */
const heroSection = document.getElementById("heroSection");
const heroPhotoEl = document.getElementById("heroPhoto");
const heroPhotoOverlay = document.getElementById("heroPhotoOverlay");
const heroPhotoForm = document.getElementById("heroPhotoForm");
let heroImageSet = false;

function updateHeroHint() {
  heroSection.classList.toggle("show-hint", !!currentUser && !heroImageSet);
}

if (db) {
  onSnapshot(doc(db, "settings", "hero"), (snap) => {
    const data = snap.exists() ? snap.data() : null;
    if (data && data.imageData) {
      heroPhotoEl.style.backgroundImage = `url("${data.imageData}")`;
      heroSection.classList.add("has-photo");
      heroImageSet = true;
    } else {
      heroPhotoEl.style.backgroundImage = "";
      heroSection.classList.remove("has-photo");
      heroImageSet = false;
    }
    updateHeroHint();
  });
}

document.getElementById("heroPhotoBtn").addEventListener("click", () => {
  document.getElementById("heroPhotoError").classList.remove("show");
  heroPhotoForm.reset();
  heroPhotoOverlay.classList.add("open");
});
document.getElementById("heroPhotoClose").addEventListener("click", () => heroPhotoOverlay.classList.remove("open"));
heroPhotoOverlay.addEventListener("click", (e) => { if (e.target === heroPhotoOverlay) heroPhotoOverlay.classList.remove("open"); });

document.getElementById("heroPhotoRemove").addEventListener("click", async () => {
  if (!confirm("대표사진을 제거할까요?")) return;
  await setDoc(doc(db, "settings", "hero"), { imageData: null });
  heroPhotoOverlay.classList.remove("open");
});

heroPhotoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const heroPhotoError = document.getElementById("heroPhotoError");
  heroPhotoError.classList.remove("show");
  const file = document.getElementById("heroPhotoInput").files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    heroPhotoError.textContent = "이미지 용량은 8MB 이하로 올려주세요.";
    heroPhotoError.classList.add("show");
    return;
  }
  const submitBtn = heroPhotoForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "저장 중...";
  try {
    const imageData = await compressImage(file, 1600, 0.75);
    await setDoc(doc(db, "settings", "hero"), { imageData });
    heroPhotoOverlay.classList.remove("open");
  } catch (err) {
    heroPhotoError.textContent = "저장에 실패했습니다: " + err.message;
    heroPhotoError.classList.add("show");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "저장";
  }
});

/* ---------- menu editor ---------- */
const menuOverlay = document.getElementById("menuOverlay");
const tabRows = document.getElementById("tabRows");
let draftTabs = [];

function renderTabRows() {
  tabRows.innerHTML = "";
  draftTabs.forEach((tab, i) => {
    const row = el("div", "tab-row");
    const labelInput = Object.assign(document.createElement("input"), { type: "text", placeholder: "메뉴 이름", value: tab.label });
    labelInput.addEventListener("input", () => (draftTabs[i].label = labelInput.value));
    const hrefInput = Object.assign(document.createElement("input"), { type: "text", placeholder: "#섹션id", value: tab.href });
    hrefInput.addEventListener("input", () => (draftTabs[i].href = hrefInput.value));
    row.appendChild(labelInput);
    row.appendChild(hrefInput);

    const stack = el("div", "stack");
    const up = el("button", null, "↑");
    up.type = "button";
    up.addEventListener("click", () => { if (i > 0) { [draftTabs[i - 1], draftTabs[i]] = [draftTabs[i], draftTabs[i - 1]]; renderTabRows(); } });
    const down = el("button", null, "↓");
    down.type = "button";
    down.addEventListener("click", () => { if (i < draftTabs.length - 1) { [draftTabs[i + 1], draftTabs[i]] = [draftTabs[i], draftTabs[i + 1]]; renderTabRows(); } });
    const remove = el("button", null, "✕");
    remove.type = "button";
    remove.addEventListener("click", () => { draftTabs.splice(i, 1); renderTabRows(); });
    stack.appendChild(up); stack.appendChild(down); stack.appendChild(remove);
    row.appendChild(stack);
    tabRows.appendChild(row);
  });
}

document.getElementById("menuEditBtn").addEventListener("click", () => {
  draftTabs = menuTabs.map((t) => ({ ...t }));
  renderTabRows();
  document.getElementById("menuError").classList.remove("show");
  menuOverlay.classList.add("open");
});
document.getElementById("menuClose").addEventListener("click", () => menuOverlay.classList.remove("open"));
menuOverlay.addEventListener("click", (e) => { if (e.target === menuOverlay) menuOverlay.classList.remove("open"); });
document.getElementById("addTabBtn").addEventListener("click", () => { draftTabs.push({ label: "새 메뉴", href: "#home" }); renderTabRows(); });

document.getElementById("menuForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const menuError = document.getElementById("menuError");
  if (!draftTabs.length) { menuError.textContent = "메뉴는 최소 1개 이상이어야 합니다."; menuError.classList.add("show"); return; }
  try {
    await setDoc(doc(db, "settings", "menu"), { tabs: draftTabs });
    menuOverlay.classList.remove("open");
  } catch (err) {
    menuError.textContent = "저장에 실패했습니다: " + err.message;
    menuError.classList.add("show");
  }
});

/* ---------- post editor ---------- */
const postOverlay = document.getElementById("postOverlay");
const postForm = document.getElementById("postForm");

function openPostEditor(post) {
  editingPostId = post ? post.id : null;
  document.getElementById("postModalTitle").textContent = post ? "게시글 수정" : "새 소식 작성";
  document.getElementById("postTitle").value = post ? post.title : "";
  document.getElementById("postContent").value = post ? post.content : "";
  document.getElementById("postImage").value = "";
  document.getElementById("postError").classList.remove("show");
  postOverlay.dataset.existingImage = post && post.imageData ? post.imageData : "";
  postOverlay.classList.add("open");
}
document.getElementById("writeBtn").addEventListener("click", () => openPostEditor(null));
document.getElementById("postClose").addEventListener("click", () => postOverlay.classList.remove("open"));
postOverlay.addEventListener("click", (e) => { if (e.target === postOverlay) postOverlay.classList.remove("open"); });

function compressImage(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = quality;
        let dataUrl = canvas.toDataURL("image/jpeg", q);
        while (dataUrl.length > 700000 && q > 0.35) {
          q -= 0.1;
          dataUrl = canvas.toDataURL("image/jpeg", q);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const postError = document.getElementById("postError");
  postError.classList.remove("show");
  const title = document.getElementById("postTitle").value.trim();
  const content = document.getElementById("postContent").value.trim();
  const fileInput = document.getElementById("postImage");
  if (!title || !content) { postError.textContent = "제목과 내용을 모두 입력해주세요."; postError.classList.add("show"); return; }

  const submitBtn = postForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = "저장 중...";
  try {
    let imageData = postOverlay.dataset.existingImage || null;
    if (fileInput.files[0]) {
      if (fileInput.files[0].size > 8 * 1024 * 1024) throw new Error("이미지 용량은 8MB 이하로 올려주세요.");
      imageData = await compressImage(fileInput.files[0]);
    }
    if (editingPostId) {
      await updateDoc(doc(db, "posts", editingPostId), { title, content, imageData });
    } else {
      await addDoc(collection(db, "posts"), { title, content, imageData, createdAt: serverTimestamp() });
    }
    postOverlay.classList.remove("open");
    postForm.reset();
  } catch (err) {
    postError.textContent = "저장에 실패했습니다: " + err.message;
    postError.classList.add("show");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "저장";
  }
});
