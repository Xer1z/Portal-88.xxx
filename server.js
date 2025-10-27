// server.js
const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const fs = require("fs");
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.json());

app.use(session({
  secret: "portal88secret",        // zmień na silniejszy w produkcji
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 dzień
}));

const USERS_FILE = "users.json";
const POSTS_FILE = "posts.json";
const REPORTS_FILE = "reports.json";

// helpery
function loadJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file);
    return data.length ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Błąd wczytywania ${file}:`, e);
    return [];
  }
}
function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let users = loadJSON(USERS_FILE);
let posts = loadJSON(POSTS_FILE);
let reports = loadJSON(REPORTS_FILE);

// online map (sessionID -> lastActive timestamp)
const onlineMap = new Map();

// middleware: aktualizuj active dla zalogowanych sesji
app.use((req, res, next) => {
  if (req.session && req.session.username) {
    onlineMap.set(req.sessionID, Date.now());
  }
  // usuń sesje, które były nieaktywne >5 min
  for (let [id, t] of onlineMap.entries()) {
    if (Date.now() - t > 5 * 60 * 1000) onlineMap.delete(id);
  }
  next();
});

// ---- AUTH: register / login / logout / me ----
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Brak danych" });
  if (users.find(u => u.username === username)) return res.status(400).json({ error: "Użytkownik istnieje" });
  const hash = await bcrypt.hash(password, 10);
  users.push({ username, password: hash });
  saveJSON(USERS_FILE, users);
  res.json({ success: true });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Brak danych" });
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: "Niepoprawne dane" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Niepoprawne dane" });
  req.session.username = username;
  onlineMap.set(req.sessionID, Date.now());
  res.json({ success: true, username });
});

app.get("/api/logout", (req, res) => {
  if (req.session) {
    onlineMap.delete(req.sessionID);
    req.session.destroy(() => {});
  }
  res.json({ success: true });
});

app.get("/api/me", (req, res) => {
  if (req.session && req.session.username) {
    return res.json({ username: req.session.username });
  }
  res.json({ username: null });
});

// ---- ONLINE count ----
app.get("/api/online", (req, res) => {
  res.json({ online: onlineMap.size });
});

// ---- POSTS ----
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

app.post("/api/post", (req, res) => {
  if (!req.session || !req.session.username) return res.status(401).json({ error: "Zaloguj się" });
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: "Brak treści" });
  const id = Date.now();
  const post = { id, content: content.trim(), username: req.session.username, created_at: new Date().toLocaleString() };
  posts.unshift(post);
  saveJSON(POSTS_FILE, posts);
  res.json({ success: true, post });
});

app.delete("/api/post/:id", (req, res) => {
  if (!req.session || !req.session.username) return res.status(401).json({ error: "Zaloguj się" });
  const id = parseInt(req.params.id);
  const post = posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post nie istnieje" });
  if (post.username !== req.session.username) return res.status(403).json({ error: "Nie możesz usuwać cudzych postów" });
  posts = posts.filter(p => p.id !== id);
  saveJSON(POSTS_FILE, posts);
  res.json({ success: true });
});

// ---- REPORTS ----
app.post("/api/report/:id", (req, res) => {
  if (!req.session || !req.session.username) return res.status(401).json({ error: "Zaloguj się" });
  const id = parseInt(req.params.id);
  const post = posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: "Post nie istnieje" });
  const { reason } = req.body;
  reports.push({ postId: id, reportedBy: req.session.username, reason: reason || "", reportedAt: new Date().toLocaleString() });
  saveJSON(REPORTS_FILE, reports);
  res.json({ success: true });
});

// fallback for SPA routes (optional)
app.get("*", (req, res, next) => {
  // pozwól na serwowanie plików statycznych bez interferencji
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Portal88 Auth działa na porcie ${PORT}`));
