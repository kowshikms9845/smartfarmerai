const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const DATA_DIR = path.join(ROOT, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

loadEnv();

const PORT = Number(process.env.PORT || 3000);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || "smart-farmer-ai-dev-secret";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || "";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

function loadEnv() {
  const envPaths = [path.join(ROOT, ".env"), path.join(ROOT, ".env.example")];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const clean = line.trim();
      if (!clean || clean.startsWith("#")) continue;
      const index = clean.indexOf("=");
      if (index === -1) continue;
      const key = clean.slice(0, index).trim();
      const value = clean.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function ensureStorage() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    await writeDb({
      users: [],
      sessions: {},
      crops: [],
      feedback: [],
      payments: [],
      resetTokens: {}
    });
  }
}

async function readDb() {
  await ensureStorage();
  const raw = await fsp.readFile(DB_FILE, "utf8");
  return JSON.parse(raw || "{}");
}

async function writeDb(db) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(text);
}

async function parseBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 14 * 1024 * 1024) {
      throw createHttpError(413, "Uploaded data is too large. Use a smaller photo.");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw createHttpError(400, "Invalid JSON request.");
  }
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function sanitizeText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function required(value, name) {
  if (!sanitizeText(value)) throw createHttpError(400, `${name} is required.`);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const candidate = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone,
    location: user.location,
    locationLink: user.locationLink || "",
    language: user.language || "en",
    upiId: user.upiId || "",
    photoUrl: user.photoUrl || "",
    createdAt: user.createdAt
  };
}

async function getAuthUser(req, db) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !db.sessions[token]) throw createHttpError(401, "Please login again.");
  const user = db.users.find((item) => item.id === db.sessions[token].userId);
  if (!user) throw createHttpError(401, "Account was not found.");
  return { user, token };
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function saveDataUrl(dataUrl, prefix) {
  if (!dataUrl) return "";
  const match = String(dataUrl).match(/^data:(image\/(png|jpeg|jpg|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw createHttpError(400, "Photo must be PNG, JPG, JPEG, or WEBP.");
  const extension = match[2] === "jpeg" ? "jpg" : match[2];
  const buffer = Buffer.from(match[3], "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    throw createHttpError(413, "Photo is too large. Please choose an image below 5 MB.");
  }
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  const fileName = `${prefix}-${crypto.randomUUID()}.${extension}`;
  await fsp.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
  return `/uploads/${fileName}`;
}

function cropWithOwner(crop, db) {
  const farmer = db.users.find((item) => item.id === crop.farmerId);
  const cropFeedback = db.feedback.filter((item) => item.farmerId === crop.farmerId);
  const rating =
    cropFeedback.length === 0
      ? 0
      : Number((cropFeedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / cropFeedback.length).toFixed(1));
  return {
    ...crop,
    farmer: publicUser(farmer),
    farmerRating: rating,
    feedbackCount: cropFeedback.length
  };
}

function buildUpiLink({ pa, pn, amount, note }) {
  const params = new URLSearchParams();
  params.set("pa", pa);
  params.set("pn", pn || "Smart Farmer AI");
  params.set("am", Number(amount || 0).toFixed(2));
  params.set("cu", "INR");
  params.set("tn", note || "Smart Farmer AI crop payment");
  return `upi://pay?${params.toString()}`;
}

async function routeApi(req, res, url) {
  const db = await readDb();
  const method = req.method;
  const pathname = url.pathname;

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await parseBody(req);
    const role = sanitizeText(body.role);
    const email = normalizeEmail(body.email);
    required(body.name, "Name");
    required(email, "Email");
    required(body.password, "Password");
    required(body.phone, "Contact number");
    required(body.location, "Location");
    if (!["farmer", "buyer"].includes(role)) throw createHttpError(400, "Choose Farmer or Buyer.");
    if (String(body.password).length < 6) throw createHttpError(400, "Password must be at least 6 characters.");
    if (db.users.some((item) => item.email === email)) throw createHttpError(409, "This email is already registered.");

    const photoUrl = body.photoData ? await saveDataUrl(body.photoData, "profile") : "";
    const user = {
      id: newId("user"),
      role,
      name: sanitizeText(body.name, 120),
      email,
      phone: sanitizeText(body.phone, 30),
      location: sanitizeText(body.location, 180),
      locationLink: sanitizeText(body.locationLink, 500),
      language: sanitizeText(body.language, 10) || "en",
      upiId: sanitizeText(body.upiId, 80),
      photoUrl,
      passwordHash: hashPassword(body.password),
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    const token = crypto.randomBytes(32).toString("hex");
    db.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };
    await writeDb(db);
    return sendJson(res, 201, { token, user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const user = db.users.find((item) => item.email === email);
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      throw createHttpError(401, "Wrong email or password.");
    }
    if (body.role && body.role !== user.role) {
      throw createHttpError(403, `This account is registered as ${user.role}.`);
    }
    const token = crypto.randomBytes(32).toString("hex");
    db.sessions[token] = { userId: user.id, createdAt: new Date().toISOString() };
    await writeDb(db);
    return sendJson(res, 200, { token, user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    const { token } = await getAuthUser(req, db);
    delete db.sessions[token];
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const { user } = await getAuthUser(req, db);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/auth/forgot") {
    const body = await parseBody(req);
    const email = normalizeEmail(body.email);
    const user = db.users.find((item) => item.email === email);
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      db.resetTokens[token] = {
        userId: user.id,
        expiresAt: Date.now() + 1000 * 60 * 30,
        createdAt: new Date().toISOString()
      };
      await writeDb(db);
      const resetLink = `${APP_BASE_URL}/#reset?token=${token}`;
      console.log(`Password reset link for ${email}: ${resetLink}`);
      return sendJson(res, 200, {
        ok: true,
        resetLink,
        message: "Reset link created. For hackathon demo it is shown here and printed in the server terminal."
      });
    }
    return sendJson(res, 200, {
      ok: true,
      message: "If this email exists, a reset link will be created."
    });
  }

  if (method === "POST" && pathname === "/api/auth/reset") {
    const body = await parseBody(req);
    const record = db.resetTokens[body.token];
    if (!record || record.expiresAt < Date.now()) throw createHttpError(400, "Reset link expired. Please request again.");
    if (String(body.password || "").length < 6) throw createHttpError(400, "Password must be at least 6 characters.");
    const user = db.users.find((item) => item.id === record.userId);
    if (!user) throw createHttpError(404, "Account not found.");
    user.passwordHash = hashPassword(body.password);
    delete db.resetTokens[body.token];
    await writeDb(db);
    return sendJson(res, 200, { ok: true, message: "Password changed. Login with your new password." });
  }

  if (method === "PUT" && pathname === "/api/users/me") {
    const { user } = await getAuthUser(req, db);
    const body = await parseBody(req);
    const allowed = ["name", "phone", "location", "locationLink", "language", "upiId"];
    for (const key of allowed) {
      if (body[key] !== undefined) user[key] = sanitizeText(body[key], key === "locationLink" ? 500 : 180);
    }
    if (body.photoData) user.photoUrl = await saveDataUrl(body.photoData, "profile");
    await writeDb(db);
    return sendJson(res, 200, { user: publicUser(user) });
  }

  if (method === "GET" && pathname === "/api/crops") {
    const search = sanitizeText(url.searchParams.get("search"), 80).toLowerCase();
    const location = sanitizeText(url.searchParams.get("location"), 80).toLowerCase();
    let crops = db.crops.filter((crop) => crop.status !== "deleted");
    if (search) {
      crops = crops.filter((crop) =>
        [crop.cropName, crop.description, crop.quality, crop.location]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }
    if (location) crops = crops.filter((crop) => crop.location.toLowerCase().includes(location));
    crops.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { crops: crops.map((crop) => cropWithOwner(crop, db)) });
  }

  if (method === "POST" && pathname === "/api/crops") {
    const { user } = await getAuthUser(req, db);
    if (user.role !== "farmer") throw createHttpError(403, "Only farmers can upload crops.");
    const body = await parseBody(req);
    required(body.cropName, "Crop name");
    required(body.quantity, "Quantity");
    required(body.price, "Price");
    required(body.location, "Crop location");
    const photoUrl = body.photoData ? await saveDataUrl(body.photoData, "crop") : "";
    const crop = {
      id: newId("crop"),
      farmerId: user.id,
      cropName: sanitizeText(body.cropName, 120),
      photoUrl,
      quantity: sanitizeText(body.quantity, 80),
      unit: sanitizeText(body.unit, 40) || "kg",
      price: Number(body.price || 0),
      quality: sanitizeText(body.quality, 120),
      harvestDate: sanitizeText(body.harvestDate, 40),
      description: sanitizeText(body.description, 700),
      location: sanitizeText(body.location, 180),
      locationLink: sanitizeText(body.locationLink || user.locationLink, 500),
      organic: Boolean(body.organic),
      negotiable: Boolean(body.negotiable),
      status: "available",
      createdAt: new Date().toISOString()
    };
    db.crops.push(crop);
    await writeDb(db);
    return sendJson(res, 201, { crop: cropWithOwner(crop, db) });
  }

  const cropDeleteMatch = pathname.match(/^\/api\/crops\/([^/]+)$/);
  if (method === "DELETE" && cropDeleteMatch) {
    const { user } = await getAuthUser(req, db);
    const crop = db.crops.find((item) => item.id === cropDeleteMatch[1]);
    if (!crop || crop.status === "deleted") throw createHttpError(404, "Crop not found.");
    if (crop.farmerId !== user.id) throw createHttpError(403, "Only the crop owner can delete this crop.");
    crop.status = "deleted";
    crop.deletedAt = new Date().toISOString();
    await writeDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (method === "GET" && pathname === "/api/users/me/crops") {
    const { user } = await getAuthUser(req, db);
    const crops = db.crops
      .filter((crop) => crop.farmerId === user.id && crop.status !== "deleted")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { crops: crops.map((crop) => cropWithOwner(crop, db)) });
  }

  if (method === "POST" && pathname === "/api/feedback") {
    const { user } = await getAuthUser(req, db);
    if (user.role !== "buyer") throw createHttpError(403, "Only buyers can send farmer feedback.");
    const body = await parseBody(req);
    const crop = db.crops.find((item) => item.id === body.cropId && item.status !== "deleted");
    if (!crop) throw createHttpError(404, "Crop not found.");
    if (crop.farmerId === user.id) throw createHttpError(400, "You cannot review your own crop.");
    const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
    const item = {
      id: newId("feedback"),
      cropId: crop.id,
      farmerId: crop.farmerId,
      buyerId: user.id,
      buyerName: user.name,
      rating,
      comment: sanitizeText(body.comment, 500),
      createdAt: new Date().toISOString()
    };
    db.feedback.push(item);
    await writeDb(db);
    return sendJson(res, 201, { feedback: item });
  }

  const feedbackMatch = pathname.match(/^\/api\/feedback\/([^/]+)$/);
  if (method === "GET" && feedbackMatch) {
    const farmerId = feedbackMatch[1];
    const feedback = db.feedback
      .filter((item) => item.farmerId === farmerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { feedback });
  }

  if (method === "POST" && pathname === "/api/payments") {
    const { user } = await getAuthUser(req, db);
    if (user.role !== "buyer") throw createHttpError(403, "Only buyers can create payment receipts.");
    const body = await parseBody(req);
    const crop = db.crops.find((item) => item.id === body.cropId && item.status !== "deleted");
    if (!crop) throw createHttpError(404, "Crop not found.");
    const farmer = db.users.find((item) => item.id === crop.farmerId);
    if (!farmer) throw createHttpError(404, "Farmer not found.");
    const amount = Number(body.amount || crop.price || 0);
    if (!amount || amount <= 0) throw createHttpError(400, "Enter a valid amount.");
    const receiverUpi = sanitizeText(farmer.upiId || MERCHANT_UPI_ID, 80);
    if (!receiverUpi) throw createHttpError(400, "Farmer UPI ID is missing. Ask farmer to add UPI ID in profile.");
    const receipt = {
      id: newId("pay"),
      cropId: crop.id,
      cropName: crop.cropName,
      farmerId: farmer.id,
      farmerName: farmer.name,
      farmerPhone: farmer.phone,
      buyerId: user.id,
      buyerName: user.name,
      buyerPhone: user.phone,
      amount,
      method: sanitizeText(body.method, 80) || "UPI",
      receiverUpi,
      payerUpi: sanitizeText(body.payerUpi, 80),
      transactionId: sanitizeText(body.transactionId, 120),
      note: sanitizeText(body.note, 300),
      createdAt: new Date().toISOString()
    };
    receipt.upiLink = buildUpiLink({
      pa: receiverUpi,
      pn: farmer.name,
      amount,
      note: `Smart Farmer AI - ${crop.cropName}`
    });
    db.payments.push(receipt);
    await writeDb(db);
    return sendJson(res, 201, { receipt });
  }

  if (method === "GET" && pathname === "/api/payments") {
    const { user } = await getAuthUser(req, db);
    const payments = db.payments
      .filter((item) => item.buyerId === user.id || item.farmerId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sendJson(res, 200, { payments });
  }

  const paymentMatch = pathname.match(/^\/api\/payments\/([^/]+)\/receipt$/);
  if (method === "GET" && paymentMatch) {
    const { user } = await getAuthUser(req, db);
    const receipt = db.payments.find((item) => item.id === paymentMatch[1]);
    if (!receipt) throw createHttpError(404, "Receipt not found.");
    if (![receipt.buyerId, receipt.farmerId].includes(user.id)) throw createHttpError(403, "This receipt is private.");
    return sendText(res, 200, renderReceiptHtml(receipt), "text/html; charset=utf-8");
  }

  if (method === "POST" && pathname === "/api/ai/ask") {
    const { user } = await getAuthUser(req, db);
    const body = await parseBody(req);
    const answer = await askGemini({
      question: sanitizeText(body.question, 1200),
      language: sanitizeText(body.language, 20) || user.language || "en",
      role: user.role,
      name: user.name
    });
    return sendJson(res, 200, { answer });
  }

  return sendJson(res, 404, { error: "API route not found." });
}

async function askGemini({ question, language, role, name }) {
  if (!question) throw createHttpError(400, "Ask a question first.");
  if (!process.env.GEMINI_API_KEY) {
    return fallbackGuidance(question, language, role);
  }
  const languageName = language === "kn" ? "Kannada and simple English" : "simple English";
  const prompt = [
    `You are Smart Farmer AI, helping Indian ${role}s use a crop marketplace app.`,
    `User name: ${name}. Reply in ${languageName}.`,
    "Be practical, short, step-by-step, and avoid medical or financial guarantees.",
    `Question: ${question}`
  ].join("\n");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 450 }
    })
  });
  if (!response.ok) {
    return fallbackGuidance(question, language, role);
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text).join("\n").trim() || fallbackGuidance(question, language, role);
}

function fallbackGuidance(question, language, role) {
  if (language === "kn") {
    return role === "farmer"
      ? "ಹಂತಗಳು: 1. ನಿಮ್ಮ ಪ್ರೊಫೈಲ್ ಮತ್ತು UPI ID ಪೂರ್ಣಗೊಳಿಸಿ. 2. ಬೆಳೆ ಹೆಸರು, ಫೋಟೋ, ಪ್ರಮಾಣ, ಬೆಲೆ ಮತ್ತು ಸ್ಥಳವನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ಹಾಕಿ. 3. ಖರೀದಿದಾರರ ಕರೆ/WhatsApp ಸಂದೇಶಕ್ಕೆ ಉತ್ತರಿಸಿ. 4. ಮಾರಾಟವಾದ ಬೆಳೆಗಳನ್ನು ಅಳಿಸಿ ಅಥವಾ ನವೀಕರಿಸಿ."
      : "ಹಂತಗಳು: 1. ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಬೆಳೆ ಹುಡುಕಿ. 2. ರೈತನ ಹೆಸರು, ಸ್ಥಳ, ಬೆಲೆ ಮತ್ತು ರೇಟಿಂಗ್ ನೋಡಿ. 3. ಕರೆ/WhatsApp ಮೂಲಕ ದೃಢೀಕರಿಸಿ. 4. UPI ಪಾವತಿ ಮಾಡಿ ರಸೀದಿಯನ್ನು ಡೌನ್ಲೋಡ್ ಮಾಡಿ. 5. ರೈತನಿಗೆ ಪ್ರತಿಕ್ರಿಯೆ ನೀಡಿ.";
  }
  return role === "farmer"
    ? "Steps: complete your profile and UPI ID, upload a clear crop photo, add quantity, price, location, and harvest date, then respond to buyer calls or WhatsApp messages quickly."
    : "Steps: search crops, check farmer details and rating, call or WhatsApp to confirm quality and delivery, pay with UPI, download the receipt, and leave feedback.";
}

function renderReceiptHtml(receipt) {
  const rows = [
    ["Receipt ID", receipt.id],
    ["Crop", receipt.cropName],
    ["Amount", `Rs. ${Number(receipt.amount).toFixed(2)}`],
    ["Buyer", `${receipt.buyerName} (${receipt.buyerPhone || "phone not added"})`],
    ["Farmer", `${receipt.farmerName} (${receipt.farmerPhone || "phone not added"})`],
    ["Receiver UPI", receipt.receiverUpi],
    ["Payer UPI", receipt.payerUpi || "Not entered"],
    ["Payment Method", receipt.method],
    ["Transaction ID", receipt.transactionId || "Entered after UPI app confirmation"],
    ["Date & Time", new Date(receipt.createdAt).toLocaleString("en-IN")]
  ];
  const table = rows
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Smart Farmer AI Receipt</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f6f8f1;color:#203225;padding:32px}
    .receipt{max-width:760px;margin:auto;background:#fff;border:1px solid #d8e2c9;border-radius:18px;padding:28px;box-shadow:0 16px 45px #20322520}
    h1{margin:0 0 8px;color:#27633a} table{width:100%;border-collapse:collapse;margin-top:20px}
    th,td{text-align:left;border-bottom:1px solid #edf2e7;padding:12px} th{width:32%;color:#52705b}
    .seal{display:inline-block;margin-top:20px;padding:10px 14px;border-radius:999px;background:#e8f6df;color:#27633a;font-weight:700}
  </style>
</head>
<body>
  <section class="receipt">
    <h1>Smart Farmer AI Payment Receipt</h1>
    <p>Agriculture is the backbone of India. This receipt is generated for the buyer and farmer record.</p>
    <table>${table}</table>
    <span class="seal">UPI Receipt Generated</span>
  </section>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function serveStatic(req, res, url) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";
  const safePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (safePath !== PUBLIC_DIR && !safePath.startsWith(PUBLIC_DIR + path.sep)) {
    return sendText(res, 403, "Forbidden");
  }
  try {
    const stat = await fsp.stat(safePath);
    if (stat.isDirectory()) return sendText(res, 404, "Not found");
    const ext = path.extname(safePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    fs.createReadStream(safePath).pipe(res);
  } catch {
    const indexFile = path.join(PUBLIC_DIR, "index.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    fs.createReadStream(indexFile).pipe(res);
  }
}

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, APP_BASE_URL);
    if (url.pathname.startsWith("/api/")) {
      await routeApi(req, res, url);
    } else {
      await serveStatic(req, res, url);
    }
  } catch (error) {
    const status = error.status || 500;
    console.error(error);
    sendJson(res, status, { error: error.message || "Server error" });
  }
}

ensureStorage()
  .then(() => {
    http.createServer(handleRequest).listen(PORT, "0.0.0.0", () => {
      console.log(`Smart Farmer AI running on ${APP_BASE_URL}`);
      console.log(`Open on phone using your computer LAN IP, example: http://YOUR-LAPTOP-IP:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Could not start server:", error);
    process.exit(1);
  });
