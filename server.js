const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS FIX (VERY IMPORTANT)
app.use(
  cors({
    origin: [
      "https://alphaapkstore.pages.dev",
      "https://alphaapkstore.xyz",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "DELETE"],
  })
);

// Paths
const DATA_FILE = path.join(__dirname, "data.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");
const IMAGES_DIR = path.join(__dirname, "images");

// Ensure folders exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// Middleware
app.use(express.json());
app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/images", express.static(IMAGES_DIR));

// Multer APK
const apkStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const uploadApk = multer({ storage: apkStorage });

// Multer Image
const imgStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const uploadImage = multer({ storage: imgStorage });

// Helpers
function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Admin login
app.post("/api/admin/login", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

// Get APKs
app.get("/api/apks", (req, res) => {
  res.json(readData());
});

// Upload APK
app.post(
  "/api/apks/upload",
  uploadApk.single("apk"),
  uploadImage.single("image"),
  (req, res) => {
    const data = readData();

    const newApk = {
      id: Date.now(),
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      apkFile: `/uploads/${req.file.filename}`,
      image: req.file ? `/images/${req.file.filename}` : null,
      downloads: 0,
    };

    data.push(newApk);
    writeData(data);

    res.json({ success: true });
  }
);

// Delete APK
app.delete("/api/apks/:id", (req, res) => {
  let data = readData();
  const id = parseInt(req.params.id);

  data = data.filter((apk) => apk.id !== id);
  writeData(data);

  res.json({ success: true });
});

// Download APK
app.get("/api/apks/download/:id", (req, res) => {
  const data = readData();
  const apk = data.find((a) => a.id === parseInt(req.params.id));
  if (!apk) return res.status(404).send("Not found");

  apk.downloads += 1;
  writeData(data);

  res.download(path.join(__dirname, apk.apkFile));
});

app.listen(PORT, () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);

















