const state = {
  token: localStorage.getItem("sf_token") || "",
  user: null,
  crops: [],
  payments: [],
  lang: localStorage.getItem("sf_lang") || "en",
  authMode: "login",
  authRole: "farmer",
  aiAnswer: ""
};

const app = document.getElementById("app");
const nav = document.getElementById("nav");
const modalRoot = document.getElementById("modalRoot");
const toast = document.getElementById("toast");

const i18n = {
  en: {
    home: "Home",
    login: "Login",
    register: "Register",
    dashboard: "Dashboard",
    market: "Market",
    profile: "Profile",
    payments: "Payments",
    logout: "Logout",
    farmer: "Farmer",
    buyer: "Buyer",
    uploadCrop: "Upload crop",
    myCrops: "My crops",
    guide: "Guide",
    save: "Save",
    submit: "Submit",
    search: "Search",
    call: "Call",
    whatsapp: "WhatsApp",
    location: "Location",
    pay: "UPI Pay",
    feedback: "Feedback",
    delete: "Delete",
    quantity: "Quantity",
    price: "Price",
    cropName: "Crop name",
    cropPhoto: "Crop photo",
    name: "Name",
    phone: "Contact number",
    email: "Email",
    password: "Password",
    forgot: "Forgot password",
    noCrops: "No crops uploaded yet.",
    askAi: "Ask AI",
    language: "Language"
  },
  kn: {
    home: "ಮುಖಪುಟ",
    login: "ಲಾಗಿನ್",
    register: "ನೋಂದಣಿ",
    dashboard: "ಡ್ಯಾಶ್ಬೋರ್ಡ್",
    market: "ಮಾರುಕಟ್ಟೆ",
    profile: "ಪ್ರೊಫೈಲ್",
    payments: "ಪಾವತಿಗಳು",
    logout: "ಲಾಗೌಟ್",
    farmer: "ರೈತ",
    buyer: "ಖರೀದಿದಾರ",
    uploadCrop: "ಬೆಳೆ ಅಪ್ಲೋಡ್",
    myCrops: "ನನ್ನ ಬೆಳೆಗಳು",
    guide: "ಮಾರ್ಗದರ್ಶನ",
    save: "ಸೇವ್",
    submit: "ಸಲ್ಲಿಸಿ",
    search: "ಹುಡುಕಿ",
    call: "ಕರೆ",
    whatsapp: "WhatsApp",
    location: "ಸ್ಥಳ",
    pay: "UPI ಪಾವತಿ",
    feedback: "ಪ್ರತಿಕ್ರಿಯೆ",
    delete: "ಅಳಿಸಿ",
    quantity: "ಪ್ರಮಾಣ",
    price: "ಬೆಲೆ",
    cropName: "ಬೆಳೆ ಹೆಸರು",
    cropPhoto: "ಬೆಳೆ ಫೋಟೋ",
    name: "ಹೆಸರು",
    phone: "ಸಂಪರ್ಕ ಸಂಖ್ಯೆ",
    email: "ಇಮೇಲ್",
    password: "ಪಾಸ್ವರ್ಡ್",
    forgot: "ಪಾಸ್ವರ್ಡ್ ಮರೆತಿರಾ",
    noCrops: "ಇನ್ನೂ ಬೆಳೆ ಅಪ್ಲೋಡ್ ಆಗಿಲ್ಲ.",
    askAi: "AI ಕೇಳಿ",
    language: "ಭಾಷೆ"
  }
};

function t(key) {
  return i18n[state.lang]?.[key] || i18n.en[key] || key;
}

function bi(en, kn) {
  return state.lang === "kn" ? `${en} / ${kn}` : en;
}

function guideBlock(title, englishItems, kannadaItems = []) {
  const enList = englishItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const knList = kannadaItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `
    <aside class="card guide">
      <strong>${escapeHtml(title)}</strong>
      <p><b>English guidance</b></p>
      <ul>${enList}</ul>
      ${
        state.lang === "kn"
          ? `<p><b>Kannada guidance</b></p><ul>${knList}</ul>`
          : ""
      }
    </aside>
  `;
}

async function api(path, options = {}) {
  const headers = options.headers || {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });
  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data.error || data || "Request failed");
  return data;
}

function routeInfo() {
  const raw = location.hash.replace(/^#/, "") || "home";
  const [page, query = ""] = raw.split("?");
  return { page, params: new URLSearchParams(query) };
}

async function boot() {
  try {
    if (state.token) {
      const data = await api("/api/auth/me");
      state.user = data.user;
      state.lang = state.user.language || state.lang;
      localStorage.setItem("sf_lang", state.lang);
    }
  } catch {
    localStorage.removeItem("sf_token");
    state.token = "";
    state.user = null;
  }
  await loadCrops();
  if (state.user) await loadPayments();
  render();
  if (!localStorage.getItem("sf_lang_chosen")) openLanguagePrompt();
}

async function loadCrops() {
  try {
    const data = await api("/api/crops");
    state.crops = data.crops || [];
  } catch {
    state.crops = [];
  }
}

async function loadPayments() {
  try {
    const data = await api("/api/payments");
    state.payments = data.payments || [];
  } catch {
    state.payments = [];
  }
}

function render() {
  renderNav();
  const { page, params } = routeInfo();
  if (page === "home") return renderHome();
  if (page === "auth") return renderAuth();
  if (page === "dashboard") return requireAuth(renderDashboard);
  if (page === "market") return renderMarket();
  if (page === "profile") return requireAuth(renderProfile);
  if (page === "payments") return requireAuth(renderPayments);
  if (page === "reset") return renderReset(params.get("token"));
  if (page === "thankyou") return renderThankYou();
  renderHome();
}

function requireAuth(renderer) {
  if (!state.user) {
    location.hash = "auth";
    return;
  }
  renderer();
}

function renderNav() {
  const logged = Boolean(state.user);
  nav.innerHTML = `
    <a href="#home">${t("home")}</a>
    <a href="#market">${t("market")}</a>
    ${logged ? `<a href="#dashboard">${t("dashboard")}</a>` : ""}
    ${logged ? `<a href="#profile">${t("profile")}</a>` : ""}
    ${logged ? `<a href="#payments">${t("payments")}</a>` : ""}
    <select aria-label="${t("language")}" data-action="change-language">
      <option value="en" ${state.lang === "en" ? "selected" : ""}>English</option>
      <option value="kn" ${state.lang === "kn" ? "selected" : ""}>Kannada</option>
    </select>
    ${
      logged
        ? `<button data-action="logout">${t("logout")}</button>`
        : `<a href="#auth">${t("login")} / ${t("register")}</a>`
    }
  `;
}

function renderHome() {
  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <span class="eyebrow">Prototype for farmer and buyer selection round</span>
        <h1>Welcome to Smart Farmer AI</h1>
        <p>Agriculture is the backbone of India. This platform connects farmers directly with buyers, keeps crop data in one backend, guides users in English and Kannada, and supports UPI receipts.</p>
        <div class="hero-actions">
          <a class="btn sun" href="${state.user ? "#dashboard" : "#auth"}">${state.user ? t("dashboard") : t("register")}</a>
          <a class="btn ghost" href="#market">${t("market")}</a>
        </div>
      </div>
    </section>
    <section class="band light">
      <div class="section">
        <div class="section-title">
          <div>
            <h2>Built for future farmers</h2>
            <p>Shared server storage, crop uploads, farmer ownership, buyer contact, profile photos, UPI payment receipts, feedback, and AI guidance are included.</p>
          </div>
        </div>
        <div class="grid three">
          <article class="card">
            <h3>Shared backend data</h3>
            <p>Uploads are saved on the server, so buyers on other phones can see the farmer's crops when they open the same server link.</p>
          </article>
          <article class="card">
            <h3>Guided every step</h3>
            <p>Every major screen gives simple instructions. Kannada guidance appears when Kannada is selected.</p>
          </article>
          <article class="card">
            <h3>UPI ready flow</h3>
            <p>Buyers can open any UPI app, enter transaction details, and download a receipt for farmer and buyer records.</p>
          </article>
        </div>
      </div>
    </section>
    ${aiPanel()}
  `;
}

function renderAuth() {
  app.innerHTML = `
    <section class="page">
      <div class="section auth-layout">
        <div class="panel">
          <div class="tabs">
            <button class="${state.authMode === "login" ? "active" : ""}" data-action="auth-mode" data-mode="login">${t("login")}</button>
            <button class="${state.authMode === "register" ? "active" : ""}" data-action="auth-mode" data-mode="register">${t("register")}</button>
          </div>
          <div class="segmented">
            <button class="${state.authRole === "farmer" ? "active" : ""}" data-action="auth-role" data-role="farmer">${t("farmer")}</button>
            <button class="${state.authRole === "buyer" ? "active" : ""}" data-action="auth-role" data-role="buyer">${t("buyer")}</button>
          </div>
          ${state.authMode === "login" ? loginForm() : registerForm()}
        </div>
        ${guideBlock(
          "Login and register guide",
          [
            "Use Farmer role to upload crops and receive buyer calls.",
            "Use Buyer role to view crops, call farmers, pay by UPI, and give feedback.",
            "Data is stored on the backend, not only inside your phone browser."
          ],
          [
            "ಬೆಳೆ ಅಪ್ಲೋಡ್ ಮಾಡಲು Farmer ಆಯ್ಕೆ ಮಾಡಿ.",
            "ಬೆಳೆ ನೋಡಲು, ಕರೆ ಮಾಡಲು, UPI ಪಾವತಿ ಮಾಡಲು Buyer ಆಯ್ಕೆ ಮಾಡಿ.",
            "ಡೇಟಾ ಫೋನ್ browser ಒಳಗೆ ಮಾತ್ರ ಅಲ್ಲ, server backend ನಲ್ಲಿ ಉಳಿಯುತ್ತದೆ."
          ]
        )}
      </div>
    </section>
  `;
}

function loginForm() {
  return `
    <form class="form-grid" data-form="login">
      <div class="field full">
        <label>${bi(t("email"), "ಇಮೇಲ್")}</label>
        <input name="email" type="email" autocomplete="email" required placeholder="name@example.com">
      </div>
      <div class="field full">
        <label>${bi(t("password"), "ಪಾಸ್ವರ್ಡ್")}</label>
        <input name="password" type="password" autocomplete="current-password" required placeholder="Minimum 6 characters">
        <span class="hint">${bi("Enter the password you used during registration.", "ನೋಂದಣಿ ಸಮಯದಲ್ಲಿ ಹಾಕಿದ ಪಾಸ್ವರ್ಡ್ ನಮೂದಿಸಿ.")}</span>
      </div>
      <div class="field full button-row">
        <button class="btn primary" type="submit">${t("login")}</button>
        <button class="btn soft" type="button" data-action="forgot">${t("forgot")}</button>
      </div>
    </form>
  `;
}

function registerForm() {
  return `
    <form class="form-grid" data-form="register">
      <div class="field">
        <label>${bi(t("name"), "ಹೆಸರು")}</label>
        <input name="name" required placeholder="Your full name">
      </div>
      <div class="field">
        <label>${bi(t("phone"), "ಸಂಪರ್ಕ ಸಂಖ್ಯೆ")}</label>
        <input name="phone" required placeholder="9876543210">
      </div>
      <div class="field">
        <label>${bi(t("email"), "ಇಮೇಲ್")}</label>
        <input name="email" type="email" required placeholder="name@example.com">
      </div>
      <div class="field">
        <label>${bi(t("password"), "ಪಾಸ್ವರ್ಡ್")}</label>
        <input name="password" type="password" minlength="6" required placeholder="Minimum 6 characters">
      </div>
      <div class="field">
        <label>${bi("Village / city", "ಗ್ರಾಮ / ನಗರ")}</label>
        <input name="location" required placeholder="Mandya, Karnataka">
      </div>
      <div class="field">
        <label>${bi("Google Maps link", "Google Maps ಲಿಂಕ್")}</label>
        <input name="locationLink" placeholder="https://maps.google.com/...">
      </div>
      <div class="field">
        <label>${bi("UPI ID", "UPI ID")}</label>
        <input name="upiId" placeholder="yourname@okaxis">
        <span class="hint">${bi("Farmers should add UPI ID to receive crop payments.", "ಪಾವತಿ ಪಡೆಯಲು ರೈತರು UPI ID ಹಾಕಬೇಕು.")}</span>
      </div>
      <div class="field">
        <label>${bi("Profile photo", "ಪ್ರೊಫೈಲ್ ಫೋಟೋ")}</label>
        <input name="photo" type="file" accept="image/png,image/jpeg,image/webp">
      </div>
      <div class="field full">
        <button class="btn primary" type="submit">${t("register")}</button>
      </div>
    </form>
  `;
}

function renderDashboard() {
  const myCrops = state.crops.filter((crop) => crop.farmerId === state.user.id);
  const myFeedback = state.crops
    .filter((crop) => crop.farmerId === state.user.id)
    .flatMap((crop) => []);
  app.innerHTML = `
    <section class="page">
      <div class="section">
        <div class="section-title">
          <div>
            <h2>${bi(`Hello, ${state.user.name}`, `ನಮಸ್ಕಾರ, ${state.user.name}`)}</h2>
            <p>${state.user.role === "farmer" ? "Manage your profile, upload crops, and receive buyer contact." : "Find crops, contact farmers, create UPI receipts, and give feedback."}</p>
          </div>
          <a class="btn primary" href="#profile">${t("profile")}</a>
        </div>
        ${profileSummary()}
        <div class="stats">
          <div class="stat"><strong>${state.crops.length}</strong><span>Total live crops</span></div>
          <div class="stat"><strong>${myCrops.length}</strong><span>${state.user.role === "farmer" ? "Your crops" : "Available crops"}</span></div>
          <div class="stat"><strong>${state.payments.length}</strong><span>Receipts</span></div>
          <div class="stat"><strong>${state.lang === "kn" ? "KN" : "EN"}</strong><span>Guidance language</span></div>
        </div>
      </div>

      <div class="section dashboard-layout">
        <div class="grid">
          ${state.user.role === "farmer" ? cropUploadPanel() + myCropsPanel(myCrops) : buyerMarketPanel()}
        </div>
        <div class="grid">
          ${roleGuide()}
          ${aiPanel()}
        </div>
      </div>
    </section>
  `;
}

function profileSummary() {
  return `
    <article class="card profile-strip">
      ${avatar(state.user, "avatar")}
      <div>
        <h3>${escapeHtml(state.user.name)} <span class="pill">${state.user.role}</span></h3>
        <div class="meta">
          <span class="pill">${escapeHtml(state.user.phone)}</span>
          <span class="pill">${escapeHtml(state.user.location)}</span>
          <span class="pill sunny">${escapeHtml(state.user.upiId || "UPI not added")}</span>
        </div>
      </div>
    </article>
  `;
}

function cropUploadPanel() {
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2>${t("uploadCrop")}</h2>
          <p>${bi("Add clear crop details so buyers can trust and contact you quickly.", "ಖರೀದಿದಾರರು ನಂಬಲು ಬೆಳೆ ವಿವರಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹಾಕಿ.")}</p>
        </div>
      </div>
      <form class="form-grid" data-form="crop">
        <div class="field">
          <label>${bi(t("cropName"), "ಬೆಳೆ ಹೆಸರು")}</label>
          <input name="cropName" required placeholder="Tomato">
        </div>
        <div class="field">
          <label>${bi(t("cropPhoto"), "ಬೆಳೆ ಫೋಟೋ")}</label>
          <input name="photo" type="file" accept="image/png,image/jpeg,image/webp">
        </div>
        <div class="field">
          <label>${bi(t("quantity"), "ಪ್ರಮಾಣ")}</label>
          <input name="quantity" required placeholder="500">
        </div>
        <div class="field">
          <label>${bi("Unit", "ಘಟಕ")}</label>
          <select name="unit">
            <option value="kg">kg</option>
            <option value="quintal">quintal</option>
            <option value="ton">ton</option>
            <option value="bag">bag</option>
            <option value="box">box</option>
          </select>
        </div>
        <div class="field">
          <label>${bi("Price per unit", "ಪ್ರತಿ ಘಟಕದ ಬೆಲೆ")}</label>
          <input name="price" type="number" min="1" required placeholder="25">
        </div>
        <div class="field">
          <label>${bi("Harvest date", "ಕೊಯ್ಲು ದಿನಾಂಕ")}</label>
          <input name="harvestDate" type="date">
        </div>
        <div class="field">
          <label>${bi("Quality grade", "ಗುಣಮಟ್ಟ")}</label>
          <input name="quality" placeholder="Fresh, A grade">
        </div>
        <div class="field">
          <label>${bi("Crop location", "ಬೆಳೆ ಸ್ಥಳ")}</label>
          <input name="location" required value="${escapeAttr(state.user.location)}">
        </div>
        <div class="field full">
          <label>${bi("Location link", "ಸ್ಥಳದ ಲಿಂಕ್")}</label>
          <input name="locationLink" value="${escapeAttr(state.user.locationLink || "")}" placeholder="Google Maps link">
        </div>
        <div class="field full">
          <label>${bi("Description", "ವಿವರಣೆ")}</label>
          <textarea name="description" placeholder="Tell buyers about crop condition, pickup, delivery, and timing"></textarea>
        </div>
        <div class="field">
          <label><input type="checkbox" name="organic"> ${bi("Organic / natural farming", "ಸಾವಯವ / ನೈಸರ್ಗಿಕ ಕೃಷಿ")}</label>
        </div>
        <div class="field">
          <label><input type="checkbox" name="negotiable"> ${bi("Price negotiable", "ಬೆಲೆ ಮಾತುಕತೆ ಸಾಧ್ಯ")}</label>
        </div>
        <div class="field full">
          <button class="btn primary" type="submit">${t("uploadCrop")}</button>
        </div>
      </form>
    </section>
  `;
}

function myCropsPanel(myCrops) {
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2>${t("myCrops")}</h2>
          <p>${bi("Only you can delete crops uploaded by your farmer account.", "ನಿಮ್ಮ farmer account ಅಪ್ಲೋಡ್ ಮಾಡಿದ ಬೆಳೆಗಳನ್ನು ನೀವು ಮಾತ್ರ ಅಳಿಸಬಹುದು.")}</p>
        </div>
      </div>
      ${myCrops.length ? `<div class="crop-grid">${myCrops.map(cropCard).join("")}</div>` : `<div class="empty">${t("noCrops")}</div>`}
    </section>
  `;
}

function buyerMarketPanel() {
  return `
    <section class="panel">
      <div class="section-title">
        <div>
          <h2>${t("market")}</h2>
          <p>${bi("Search live crops uploaded by farmers and contact them directly.", "ರೈತರು ಅಪ್ಲೋಡ್ ಮಾಡಿದ ಬೆಳೆಗಳನ್ನು ಹುಡುಕಿ, ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ.")}</p>
        </div>
      </div>
      ${marketContent()}
    </section>
  `;
}

function roleGuide() {
  if (state.user.role === "farmer") {
    return guideBlock(
      "Farmer guide",
      [
        "Add UPI ID and phone number in profile before sharing the app link.",
        "Upload real crop photo, exact quantity, expected price, and location.",
        "After a crop is sold, delete it so buyers see only available crops."
      ],
      [
        "App link ಹಂಚುವ ಮೊದಲು profile ನಲ್ಲಿ UPI ID ಮತ್ತು phone number ಹಾಕಿ.",
        "ನಿಜವಾದ crop photo, ಪ್ರಮಾಣ, ಬೆಲೆ, ಸ್ಥಳ ಹಾಕಿ.",
        "ಬೆಳೆ ಮಾರಾಟವಾದ ನಂತರ ಅದನ್ನು ಅಳಿಸಿ."
      ]
    );
  }
  return guideBlock(
    "Buyer guide",
    [
      "Check crop photo, quantity, price, location, farmer rating, and upload time.",
      "Call or WhatsApp the farmer before payment to confirm quality and delivery.",
      "Use UPI, enter transaction ID, download receipt, and give honest feedback."
    ],
    [
      "Crop photo, ಪ್ರಮಾಣ, ಬೆಲೆ, ಸ್ಥಳ, farmer rating, upload time ಪರಿಶೀಲಿಸಿ.",
      "ಪಾವತಿ ಮೊದಲು ರೈತನಿಗೆ call ಅಥವಾ WhatsApp ಮಾಡಿ.",
      "UPI ಪಾವತಿ ಮಾಡಿ, transaction ID ಹಾಕಿ, receipt download ಮಾಡಿ, feedback ನೀಡಿ."
    ]
  );
}

function aiPanel() {
  if (!state.user) {
    return `
      <section class="card">
        <h3>${t("askAi")}</h3>
        <div class="ai-box">
          <p>${bi("Login or register to ask AI for crop help, pricing, and marketplace guidance.", "ಬೆಳೆ ಸಹಾಯ, ಬೆಲೆ, ಮಾರುಕಟ್ಟೆ ಮಾರ್ಗದರ್ಶನಕ್ಕಾಗಿ AI ಕೇಳಲು login ಅಥವಾ register ಮಾಡಿರಿ.")}</p>
          <a class="btn primary" href="#auth">${t("login")}</a>
        </div>
      </section>
    `;
  }
  return `
    <section class="card">
      <h3>${t("askAi")}</h3>
      <div class="ai-box">
        <p>${bi("Ask for help about crop upload, buying steps, pricing, or app usage.", "ಬೆಳೆ ಅಪ್ಲೋಡ್, ಖರೀದಿ ಹಂತಗಳು, ಬೆಲೆ ಅಥವಾ app ಬಳಕೆ ಬಗ್ಗೆ ಕೇಳಿ.")}</p>
        <form data-form="ai">
          <textarea name="question" required placeholder="${state.user.role === "farmer" ? "How should I price 500 kg tomato?" : "How do I safely buy tomato from a farmer?"}"></textarea>
          <button class="btn primary" type="submit">${t("askAi")}</button>
        </form>
        ${state.aiAnswer ? `<div class="ai-answer">${escapeHtml(state.aiAnswer)}</div>` : ""}
      </div>
    </section>
  `;
}

function renderMarket() {
  app.innerHTML = `
    <section class="page">
      <div class="section">
        <div class="section-title">
          <div>
            <h2>${t("market")}</h2>
            <p>${bi("Live crop listings from farmers. Login as buyer to pay, download receipts, and give feedback.", "ರೈತರ live crop listings. ಪಾವತಿ, receipt, feedback ಗಾಗಿ Buyer login ಮಾಡಿ.")}</p>
          </div>
        </div>
        ${marketContent()}
        ${aiPanel()}
      </div>
    </section>
  `;
}

function marketContent() {
  return `
    <form class="market-toolbar" data-form="search">
      <div class="field">
        <label>${bi("Search crop", "ಬೆಳೆ ಹುಡುಕಿ")}</label>
        <input name="search" placeholder="Tomato, onion, rice">
      </div>
      <div class="field">
        <label>${bi("Location", "ಸ್ಥಳ")}</label>
        <input name="location" placeholder="Mandya">
      </div>
      <button class="btn primary" type="submit">${t("search")}</button>
    </form>
    ${state.crops.length ? `<div class="crop-grid">${state.crops.map(cropCard).join("")}</div>` : `<div class="empty">${t("noCrops")}</div>`}
  `;
}

function cropCard(crop) {
  const ownCrop = state.user && crop.farmerId === state.user.id;
  const farmer = crop.farmer || {};
  const phone = farmer.phone || "";
  const maps = crop.locationLink || farmer.locationLink || mapSearch(crop.location || farmer.location);
  const canBuy = state.user && state.user.role === "buyer" && !ownCrop;
  return `
    <article class="crop-card">
      ${crop.photoUrl ? `<img class="crop-media" src="${escapeAttr(crop.photoUrl)}" alt="${escapeAttr(crop.cropName)}">` : `<div class="crop-media"></div>`}
      <div class="crop-body">
        <div class="crop-title">
          <h3>${escapeHtml(crop.cropName)}</h3>
          <span class="price">Rs. ${Number(crop.price || 0).toFixed(0)} / ${escapeHtml(crop.unit || "kg")}</span>
        </div>
        <div class="meta">
          <span class="pill">${escapeHtml(crop.quantity)} ${escapeHtml(crop.unit || "kg")}</span>
          <span class="pill sunny">${escapeHtml(crop.quality || "Fresh")}</span>
          ${crop.organic ? `<span class="pill">Organic</span>` : ""}
          ${crop.negotiable ? `<span class="pill clay">Negotiable</span>` : ""}
        </div>
        <p class="crop-desc">${escapeHtml(crop.description || "Fresh crop available for direct buyer contact.")}</p>
        <div class="profile-strip">
          ${avatar(farmer, "avatar small")}
          <div>
            <b>${escapeHtml(farmer.name || "Farmer")}</b>
            <div class="hint">${escapeHtml(crop.location || farmer.location || "Location not added")} | Rating ${crop.farmerRating || 0}/5 | ${formatDate(crop.createdAt)}</div>
          </div>
        </div>
        <div class="actions">
          <a class="btn soft" href="${phoneHref(phone)}">${t("call")}</a>
          <a class="btn soft" target="_blank" rel="noreferrer" href="${whatsappHref(phone, crop)}">${t("whatsapp")}</a>
          <a class="btn soft" target="_blank" rel="noreferrer" href="${escapeAttr(maps)}">${t("location")}</a>
          ${canBuy ? `<button class="btn primary" data-action="open-pay" data-id="${escapeAttr(crop.id)}">${t("pay")}</button>` : ""}
          ${canBuy ? `<button class="btn" data-action="open-feedback" data-id="${escapeAttr(crop.id)}">${t("feedback")}</button>` : ""}
          ${ownCrop ? `<button class="btn danger" data-action="delete-crop" data-id="${escapeAttr(crop.id)}">${t("delete")}</button>` : ""}
          ${!state.user ? `<a class="btn primary" href="#auth">${t("login")}</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function renderProfile() {
  app.innerHTML = `
    <section class="page">
      <div class="section auth-layout">
        <div class="panel">
          <div class="section-title">
            <div>
              <h2>${t("profile")}</h2>
              <p>${bi("This profile is shown with your activity in the marketplace.", "ಈ profile ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ನಿಮ್ಮ ಕೆಲಸಗಳ ಜೊತೆ ಕಾಣಿಸುತ್ತದೆ.")}</p>
            </div>
          </div>
          <form class="form-grid" data-form="profile">
            <div class="field">
              <label>${bi(t("name"), "ಹೆಸರು")}</label>
              <input name="name" value="${escapeAttr(state.user.name)}" required>
            </div>
            <div class="field">
              <label>${bi(t("phone"), "ಸಂಪರ್ಕ ಸಂಖ್ಯೆ")}</label>
              <input name="phone" value="${escapeAttr(state.user.phone)}" required>
            </div>
            <div class="field">
              <label>${bi("Village / city", "ಗ್ರಾಮ / ನಗರ")}</label>
              <input name="location" value="${escapeAttr(state.user.location)}" required>
            </div>
            <div class="field">
              <label>${bi("UPI ID", "UPI ID")}</label>
              <input name="upiId" value="${escapeAttr(state.user.upiId || "")}" placeholder="yourname@okaxis">
            </div>
            <div class="field full">
              <label>${bi("Google Maps link", "Google Maps ಲಿಂಕ್")}</label>
              <input name="locationLink" value="${escapeAttr(state.user.locationLink || "")}">
            </div>
            <div class="field">
              <label>${bi("Guidance language", "ಮಾರ್ಗದರ್ಶನ ಭಾಷೆ")}</label>
              <select name="language">
                <option value="en" ${state.lang === "en" ? "selected" : ""}>English</option>
                <option value="kn" ${state.lang === "kn" ? "selected" : ""}>Kannada</option>
              </select>
            </div>
            <div class="field">
              <label>${bi("Change profile photo", "ಪ್ರೊಫೈಲ್ ಫೋಟೋ ಬದಲಿಸಿ")}</label>
              <input name="photo" type="file" accept="image/png,image/jpeg,image/webp">
            </div>
            <div class="field full">
              <button class="btn primary" type="submit">${t("save")}</button>
            </div>
          </form>
        </div>
        ${guideBlock(
          "Profile guide",
          [
            "Keep phone number correct for direct call and WhatsApp buttons.",
            "Farmers must add UPI ID before buyers can pay using UPI.",
            "Add a Maps link so buyers can view crop location quickly."
          ],
          [
            "Direct call ಮತ್ತು WhatsApp ಗಾಗಿ phone number ಸರಿಯಾಗಿರಲಿ.",
            "UPI payment ಪಡೆಯಲು farmer UPI ID ಹಾಕಬೇಕು.",
            "Buyers ಸ್ಥಳ ನೋಡಲು Maps link ಹಾಕಿ."
          ]
        )}
      </div>
    </section>
  `;
}

function renderPayments() {
  app.innerHTML = `
    <section class="page">
      <div class="section">
        <div class="section-title">
          <div>
            <h2>${t("payments")}</h2>
            <p>${bi("Receipts created after UPI payment attempts. Download them for buyer and farmer records.", "UPI ಪಾವತಿ ನಂತರ ಸೃಷ್ಟಿಯಾದ receipt ಗಳು. Record ಗಾಗಿ download ಮಾಡಿ.")}</p>
          </div>
        </div>
        <div class="grid two">
          ${
            state.payments.length
              ? state.payments.map(receiptCard).join("")
              : `<div class="empty">${bi("No payment receipts yet.", "ಇನ್ನೂ payment receipt ಇಲ್ಲ.")}</div>`
          }
        </div>
      </div>
    </section>
  `;
}

function receiptCard(receipt) {
  return `
    <article class="receipt">
      <strong>${escapeHtml(receipt.cropName)} - Rs. ${Number(receipt.amount).toFixed(2)}</strong>
      <span class="hint">Receipt: ${escapeHtml(receipt.id)}</span>
      <span>${bi("Buyer", "ಖರೀದಿದಾರ")}: ${escapeHtml(receipt.buyerName)} | ${bi("Farmer", "ರೈತ")}: ${escapeHtml(receipt.farmerName)}</span>
      <span>${bi("Date", "ದಿನಾಂಕ")}: ${formatDate(receipt.createdAt)}</span>
      <div class="actions">
        <button class="btn primary" data-action="download-receipt" data-id="${escapeAttr(receipt.id)}">${bi("Download receipt", "Receipt download")}</button>
      </div>
    </article>
  `;
}

function renderReset(token) {
  app.innerHTML = `
    <section class="page">
      <div class="section auth-layout">
        <div class="panel">
          <h2>${bi("Reset password", "ಪಾಸ್ವರ್ಡ್ ಬದಲಿಸಿ")}</h2>
          <form class="form-grid" data-form="reset">
            <input type="hidden" name="token" value="${escapeAttr(token || "")}">
            <div class="field full">
              <label>${bi("New password", "ಹೊಸ ಪಾಸ್ವರ್ಡ್")}</label>
              <input name="password" type="password" minlength="6" required>
            </div>
            <div class="field full">
              <button class="btn primary" type="submit">${bi("Change password", "ಪಾಸ್ವರ್ಡ್ ಬದಲಿಸಿ")}</button>
            </div>
          </form>
        </div>
        ${guideBlock(
          "Reset guide",
          ["Use the newest reset link. It expires in 30 minutes.", "After reset, login with your new password."],
          ["ಹೊಸ reset link ಬಳಸಿ. ಅದು 30 ನಿಮಿಷದಲ್ಲಿ expire ಆಗುತ್ತದೆ.", "Reset ನಂತರ ಹೊಸ password ಬಳಸಿ login ಮಾಡಿ."]
        )}
      </div>
    </section>
  `;
}

function renderThankYou() {
  app.innerHTML = `
    <section class="thankyou">
      <div class="panel">
        <h1>${bi("Thank you for using Smart Farmer AI", "Smart Farmer AI ಬಳಸಿದಕ್ಕೆ ಧನ್ಯವಾದಗಳು")}</h1>
        <p>${bi("You have logged out safely. Come back to connect farmers and buyers again.", "ನೀವು ಸುರಕ್ಷಿತವಾಗಿ logout ಆಗಿದ್ದೀರಿ. ಮತ್ತೆ ರೈತರು ಮತ್ತು ಖರೀದಿದಾರರನ್ನು ಸಂಪರ್ಕಿಸಲು ಬನ್ನಿ.")}</p>
        <div class="button-row" style="justify-content:center">
          <a class="btn primary" href="#home">${t("home")}</a>
          <a class="btn soft" href="#auth">${t("login")}</a>
        </div>
      </div>
    </section>
  `;
}

function openLanguagePrompt() {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="modal-head">
          <div>
            <h2>Choose your guidance language</h2>
            <p class="hint">English will remain available. Kannada guidance appears when Kannada is selected.</p>
          </div>
        </div>
        <div class="language-choice">
          <button class="btn soft" data-action="choose-language" data-lang="en">
            <b>English</b>
            <span>Use simple English guidance.</span>
          </button>
          <button class="btn soft" data-action="choose-language" data-lang="kn">
            <b>Kannada</b>
            <span>ಕನ್ನಡ ಮಾರ್ಗದರ್ಶನ ಬಳಸಿ.</span>
          </button>
        </div>
      </section>
    </div>
  `;
}

function openForgotModal() {
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="modal-head">
          <h2>${t("forgot")}</h2>
          <button class="icon-button" data-action="close-modal" aria-label="Close">x</button>
        </div>
        <form class="form-grid" data-form="forgot">
          <div class="field full">
            <label>${bi(t("email"), "ಇಮೇಲ್")}</label>
            <input name="email" type="email" required placeholder="name@example.com">
            <span class="hint">${bi("A real reset token will be created by the backend. For this prototype, the link is shown here and printed in the server terminal.", "Backend real reset token ಸೃಷ್ಟಿಸುತ್ತದೆ. Prototype ನಲ್ಲಿ link ಇಲ್ಲಿ ಮತ್ತು server terminal ನಲ್ಲಿ ಕಾಣುತ್ತದೆ.")}</span>
          </div>
          <div class="field full">
            <button class="btn primary" type="submit">${bi("Create reset link", "Reset link ರಚಿಸಿ")}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function openPayModal(cropId) {
  const crop = state.crops.find((item) => item.id === cropId);
  if (!crop) return showToast("Crop not found.");
  if (!crop.farmer?.upiId) {
    showToast("Farmer UPI ID is missing. Ask farmer to update profile.");
    return;
  }
  const upiLink = buildUpiLink(crop.farmer.upiId, crop.farmer.name, crop.price, crop.cropName);
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="modal-head">
          <div>
            <h2>${t("pay")} - ${escapeHtml(crop.cropName)}</h2>
            <p class="hint">${bi("Open any UPI app, complete payment, then enter the transaction ID for receipt.", "ಯಾವುದೇ UPI app open ಮಾಡಿ, ಪಾವತಿ ಮಾಡಿ, ನಂತರ receipt ಗಾಗಿ transaction ID ಹಾಕಿ.")}</p>
          </div>
          <button class="icon-button" data-action="close-modal" aria-label="Close">x</button>
        </div>
        <div class="actions">
          <a class="btn primary" href="${escapeAttr(upiLink)}">Google Pay</a>
          <a class="btn primary" href="${escapeAttr(upiLink)}">PhonePe</a>
          <a class="btn primary" href="${escapeAttr(upiLink)}">Paytm</a>
          <a class="btn sun" href="${escapeAttr(upiLink)}">Any UPI</a>
        </div>
        <form class="form-grid" data-form="payment">
          <input type="hidden" name="cropId" value="${escapeAttr(crop.id)}">
          <div class="field">
            <label>${bi("Amount", "ಮೊತ್ತ")}</label>
            <input name="amount" type="number" min="1" value="${Number(crop.price || 0)}" required>
          </div>
          <div class="field">
            <label>${bi("Payment app", "ಪಾವತಿ app")}</label>
            <select name="method">
              <option>Google Pay</option>
              <option>PhonePe</option>
              <option>Paytm</option>
              <option>BHIM</option>
              <option>Other UPI</option>
            </select>
          </div>
          <div class="field">
            <label>${bi("Your UPI ID", "ನಿಮ್ಮ UPI ID")}</label>
            <input name="payerUpi" placeholder="buyer@okbank">
          </div>
          <div class="field">
            <label>${bi("Transaction ID", "Transaction ID")}</label>
            <input name="transactionId" placeholder="Enter after UPI payment">
          </div>
          <div class="field full">
            <label>${bi("Note", "ಟಿಪ್ಪಣಿ")}</label>
            <textarea name="note" placeholder="Pickup or delivery note"></textarea>
          </div>
          <div class="field full">
            <button class="btn primary" type="submit">${bi("Generate receipt", "Receipt ಸೃಷ್ಟಿಸಿ")}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function openFeedbackModal(cropId) {
  const crop = state.crops.find((item) => item.id === cropId);
  if (!crop) return showToast("Crop not found.");
  modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal">
        <div class="modal-head">
          <div>
            <h2>${t("feedback")} - ${escapeHtml(crop.farmer?.name || "Farmer")}</h2>
            <p class="hint">${bi("Give honest feedback after speaking with or buying from the farmer.", "ರೈತನೊಂದಿಗೆ ಮಾತನಾಡಿದ ನಂತರ ಅಥವಾ ಖರೀದಿ ಮಾಡಿದ ನಂತರ ನಿಷ್ಠಾವಂತ feedback ನೀಡಿ.")}</p>
          </div>
          <button class="icon-button" data-action="close-modal" aria-label="Close">x</button>
        </div>
        <form class="form-grid" data-form="feedback">
          <input type="hidden" name="cropId" value="${escapeAttr(crop.id)}">
          <div class="field">
            <label>${bi("Rating", "ರೇಟಿಂಗ್")}</label>
            <select name="rating">
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Average</option>
              <option value="2">2 - Needs improvement</option>
              <option value="1">1 - Poor</option>
            </select>
          </div>
          <div class="field full">
            <label>${bi("Comment", "ಅಭಿಪ್ರಾಯ")}</label>
            <textarea name="comment" required placeholder="Crop quality, communication, delivery"></textarea>
          </div>
          <div class="field full">
            <button class="btn primary" type="submit">${t("feedback")}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const submitter = form.querySelector("button[type='submit']");
  if (submitter) submitter.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.dataset.form === "login") await login(data);
    if (form.dataset.form === "register") await register(form, data);
    if (form.dataset.form === "crop") await uploadCrop(form, data);
    if (form.dataset.form === "profile") await updateProfile(form, data);
    if (form.dataset.form === "search") await searchCrops(data);
    if (form.dataset.form === "forgot") await forgotPassword(data);
    if (form.dataset.form === "reset") await resetPassword(data);
    if (form.dataset.form === "payment") await createPayment(data);
    if (form.dataset.form === "feedback") await createFeedback(data);
    if (form.dataset.form === "ai") await askAi(data);
  } catch (error) {
    showToast(error.message);
  } finally {
    if (submitter) submitter.disabled = false;
  }
}

async function login(data) {
  const result = await api("/api/auth/login", {
    method: "POST",
    body: { ...data, role: state.authRole }
  });
  state.token = result.token;
  state.user = result.user;
  state.lang = result.user.language || state.lang;
  localStorage.setItem("sf_token", state.token);
  localStorage.setItem("sf_lang", state.lang);
  await loadCrops();
  await loadPayments();
  location.hash = "dashboard";
  showToast("Login successful.");
  render();
}

async function register(form, data) {
  const photoData = await imageInputToDataUrl(form.elements.photo);
  const result = await api("/api/auth/register", {
    method: "POST",
    body: {
      ...data,
      role: state.authRole,
      language: state.lang,
      photoData
    }
  });
  state.token = result.token;
  state.user = result.user;
  localStorage.setItem("sf_token", state.token);
  await loadCrops();
  await loadPayments();
  location.hash = "dashboard";
  showToast("Registration successful.");
  render();
}

async function uploadCrop(form, data) {
  const photoData = await imageInputToDataUrl(form.elements.photo);
  await api("/api/crops", {
    method: "POST",
    body: {
      ...data,
      photoData,
      organic: form.elements.organic.checked,
      negotiable: form.elements.negotiable.checked
    }
  });
  form.reset();
  await loadCrops();
  showToast("Crop uploaded. Buyers can now see it from other devices.");
  render();
}

async function updateProfile(form, data) {
  const photoData = await imageInputToDataUrl(form.elements.photo);
  const result = await api("/api/users/me", {
    method: "PUT",
    body: { ...data, photoData }
  });
  state.user = result.user;
  state.lang = result.user.language || state.lang;
  localStorage.setItem("sf_lang", state.lang);
  showToast("Profile updated.");
  render();
}

async function searchCrops(data) {
  const query = new URLSearchParams();
  if (data.search) query.set("search", data.search);
  if (data.location) query.set("location", data.location);
  const result = await api(`/api/crops?${query.toString()}`);
  state.crops = result.crops || [];
  render();
}

async function forgotPassword(data) {
  const result = await api("/api/auth/forgot", { method: "POST", body: data });
  if (result.resetLink) {
    modalRoot.innerHTML = `
      <div class="modal-backdrop">
        <section class="modal">
          <div class="modal-head">
            <h2>${bi("Reset link created", "Reset link ರಚಿಸಲಾಗಿದೆ")}</h2>
            <button class="icon-button" data-action="close-modal" aria-label="Close">x</button>
          </div>
          <p class="hint">${escapeHtml(result.message)}</p>
          <input readonly value="${escapeAttr(result.resetLink)}">
          <div class="button-row" style="margin-top:12px">
            <a class="btn primary" href="${escapeAttr(result.resetLink)}">${bi("Open reset page", "Reset page open ಮಾಡಿ")}</a>
          </div>
        </section>
      </div>
    `;
  } else {
    showToast(result.message || "Reset request created.");
  }
}

async function resetPassword(data) {
  await api("/api/auth/reset", { method: "POST", body: data });
  showToast("Password changed. Please login.");
  location.hash = "auth";
  state.authMode = "login";
  render();
}

async function createPayment(data) {
  const result = await api("/api/payments", { method: "POST", body: data });
  await loadPayments();
  modalRoot.innerHTML = "";
  showToast("Receipt generated.");
  downloadReceipt(result.receipt);
  location.hash = "payments";
  render();
}

async function createFeedback(data) {
  await api("/api/feedback", { method: "POST", body: data });
  modalRoot.innerHTML = "";
  await loadCrops();
  showToast("Feedback submitted.");
  render();
}

async function askAi(data) {
  const result = await api("/api/ai/ask", {
    method: "POST",
    body: { question: data.question, language: state.lang }
  });
  state.aiAnswer = result.answer;
  render();
}

async function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("sf_lang", lang);
  localStorage.setItem("sf_lang_chosen", "yes");
  modalRoot.innerHTML = "";
  if (state.user) {
    try {
      const result = await api("/api/users/me", { method: "PUT", body: { language: lang } });
      state.user = result.user;
    } catch {
      // The visible language can still change even if profile sync fails.
    }
  }
  render();
}

async function deleteCrop(cropId) {
  const ok = confirm("Delete this crop? Only crop owner can do this.");
  if (!ok) return;
  await api(`/api/crops/${cropId}`, { method: "DELETE" });
  await loadCrops();
  showToast("Crop deleted.");
  render();
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch {
    // Local logout is still safe if the server token was already gone.
  }
  state.token = "";
  state.user = null;
  state.payments = [];
  localStorage.removeItem("sf_token");
  location.hash = "thankyou";
  render();
}

async function downloadServerReceipt(id) {
  const res = await fetch(`/api/payments/${id}/receipt`, {
    headers: { Authorization: `Bearer ${state.token}` }
  });
  if (!res.ok) throw new Error("Could not download receipt.");
  const html = await res.text();
  const blob = new Blob([html], { type: "text/html" });
  downloadBlob(blob, `smart-farmer-receipt-${id}.html`);
}

function downloadReceipt(receipt) {
  const html = `
<!doctype html>
<html>
<head><meta charset="utf-8"><title>Smart Farmer AI Receipt</title></head>
<body style="font-family:Arial,sans-serif;background:#f6f8f1;color:#203225;padding:32px">
  <section style="max-width:760px;margin:auto;background:#fff;border:1px solid #d8e2c9;border-radius:16px;padding:28px">
    <h1 style="color:#27633a">Smart Farmer AI Payment Receipt</h1>
    <p>Agriculture is the backbone of India.</p>
    <table style="width:100%;border-collapse:collapse">
      ${[
        ["Receipt ID", receipt.id],
        ["Crop", receipt.cropName],
        ["Amount", `Rs. ${Number(receipt.amount).toFixed(2)}`],
        ["Buyer", receipt.buyerName],
        ["Farmer", receipt.farmerName],
        ["Receiver UPI", receipt.receiverUpi],
        ["Payer UPI", receipt.payerUpi || "Not entered"],
        ["Method", receipt.method],
        ["Transaction ID", receipt.transactionId || "Not entered"],
        ["Date & Time", formatDate(receipt.createdAt)]
      ]
        .map(([key, value]) => `<tr><th style="text-align:left;border-bottom:1px solid #edf2e7;padding:10px">${escapeHtml(key)}</th><td style="border-bottom:1px solid #edf2e7;padding:10px">${escapeHtml(value)}</td></tr>`)
        .join("")}
    </table>
  </section>
</body>
</html>`;
  downloadBlob(new Blob([html], { type: "text/html" }), `smart-farmer-receipt-${receipt.id}.html`);
}

function downloadBlob(blob, fileName) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

async function imageInputToDataUrl(input) {
  const file = input?.files?.[0];
  if (!file) return "";
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be below 5 MB.");
  return resizeImage(file, 1200, 0.82);
}

function resizeImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(image.src);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    image.onerror = () => reject(new Error("Could not read image."));
    image.src = URL.createObjectURL(file);
  });
}

function buildUpiLink(upiId, name, amount, cropName) {
  const params = new URLSearchParams({
    pa: upiId,
    pn: name || "Smart Farmer AI",
    am: Number(amount || 0).toFixed(2),
    cu: "INR",
    tn: `Smart Farmer AI - ${cropName || "crop"}`
  });
  return `upi://pay?${params.toString()}`;
}

function avatar(user, className) {
  if (user?.photoUrl) {
    return `<img class="${className}" src="${escapeAttr(user.photoUrl)}" alt="${escapeAttr(user.name || "Profile")}">`;
  }
  const initial = String(user?.name || "S").trim().charAt(0).toUpperCase();
  return `<span class="${className}">${escapeHtml(initial)}</span>`;
}

function phoneHref(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : "#profile";
}

function whatsappHref(phone, crop) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `91${digits}`;
  const text = `Hello, I saw your ${crop.cropName} on Smart Farmer AI. Is it available?`;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : "#profile";
}

function mapSearch(location) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location || "India farm")}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 4200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.addEventListener("submit", handleSubmit);

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  try {
    if (action === "auth-mode") {
      state.authMode = target.dataset.mode;
      render();
    }
    if (action === "auth-role") {
      state.authRole = target.dataset.role;
      render();
    }
    if (action === "forgot") openForgotModal();
    if (action === "close-modal") modalRoot.innerHTML = "";
    if (action === "choose-language") await setLanguage(target.dataset.lang);
    if (action === "logout") await logout();
    if (action === "open-pay") openPayModal(target.dataset.id);
    if (action === "open-feedback") openFeedbackModal(target.dataset.id);
    if (action === "delete-crop") await deleteCrop(target.dataset.id);
    if (action === "download-receipt") await downloadServerReceipt(target.dataset.id);
  } catch (error) {
    showToast(error.message);
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("[data-action='change-language']")) {
    await setLanguage(event.target.value);
  }
});

window.addEventListener("hashchange", render);

boot();
