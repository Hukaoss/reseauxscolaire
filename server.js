const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
  secret: "grossecretvoilà",
  resave: false,
  saveUninitialized: true
}));

const usersFile = "data/users.json";
const postsFile = "data/posts.json";
if (!fs.existsSync("data")) fs.mkdirSync("data");
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, "[]");
if (!fs.existsSync(postsFile)) fs.writeFileSync(postsFile, "[]");

const upload = multer({ dest: "public/avatars/" });

let users = JSON.parse(fs.readFileSync(usersFile));
let posts = JSON.parse(fs.readFileSync(postsFile));

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users));
}
function savePosts() {
  fs.writeFileSync(postsFile, JSON.stringify(posts));
}

app.get("/", (req, res) => {
  res.render("index", { user: req.session.user, posts });
});

app.get("/register", (req, res) => res.render("register"));
app.post("/register", upload.single("avatar"), async (req, res) => {
  const { username, password } = req.body;
  const avatar = req.file ? `/avatars/${req.file.filename}` : "/avatars/default.png";
  
  const adminSecret = req.body.admin_secret;
  const isAdmin = username === "admin" && adminSecret === "MOD-PASS-1337";
  if (username === "admin" && adminSecret !== "MOD-PASS-1337") return res.send("Code admin incorrect");

  const hashed = await bcrypt.hash(password, 10);
  if (users.find(u => u.username === username)) return res.send("User exists");
  users.push({ username, password: hashed, avatar, isAdmin });
  saveUsers();
  res.redirect("/login");
});

app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (user && await bcrypt.compare(password, user.password)) {
    req.session.user = user;
    res.redirect("/");
  } else res.send("Bad login");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.post("/post", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  posts.push({
    id: Date.now(),
    user: req.session.user.username,
    avatar: req.session.user.avatar,
    content: req.body.content,
    comments: [],
    likes: []
  });
  savePosts();
  res.redirect("/");
});

app.post("/comment/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const post = posts.find(p => p.id == req.params.id);
  if (post) {
    post.comments.push({ user: req.session.user.username, text: req.body.comment });
    savePosts();
  }
  res.redirect("/");
});

app.post("/like/:id", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  const post = posts.find(p => p.id == req.params.id);
  if (post && !post.likes.includes(req.session.user.username)) {
    post.likes.push(req.session.user.username);
    savePosts();
  }
  res.redirect("/");
});

app.post("/delete/:id", (req, res) => {
  if (!req.session.user || !req.session.user.isAdmin) return res.redirect("/");
  posts = posts.filter(p => p.id != req.params.id);
  savePosts();
  res.redirect("/");
});

app.listen(3000, () => console.log("Serveur lancé sur http://localhost:3000"));