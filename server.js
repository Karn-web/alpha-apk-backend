const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ================== FILE PATHS ==================
const DATA_FILE = path.join(__dirname, "apks.json");
const APK_DIR = path.join(__dirname, "uploads/apks");
const IMAGE_DIR = path.join(__dirname, "uploads/images");

// ================== ENSURE DIRS ==================
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync(APK_DIR)) fs.mkdirSync(APK_DIR, { recursive: true });
if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

// ================== STATIC ==================
app.use("/uploads", express.static("uploads"));

// ================== READ / WRITE ==================
const readApks = () =>
  JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));

const writeApks = (data) =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

// ================== ADMIN AUTH ==================
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;

  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }

  res.status(401).json({ success: false, message: "Invalid code" });
});

// ================== GET APKs ==================
app.get("/api/apks", (req, res) => {
  try {
    res.json(readApks());
  } catch {
    res.status(500).json([]);
  }
});

// ================== MULTER ==================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "apk") cb(null, APK_DIR);
    else cb(null, IMAGE_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ================== UPLOAD APK ==================
app.post(
  "/api/upload",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { name, description } = req.body;

      if (!req.files.apk) {
        return res.status(400).json({ message: "APK required" });
      }

      const apks = readApks();

      const newApk = {
        id: Date.now(),
        name,
        description,
        apkPath: `uploads/apks/${req.files.apk[0].filename}`,
        imagePath: req.files.image
          ? `uploads/images/${req.files.image[0].filename}`
          : "",
      };

      apks.push(newApk);
      writeApks(apks);

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ success: false });
    }
  }
);

// ================== DELETE APK ==================
app.delete("/api/apks/:id", (req, res) => {
  const id = Number(req.params.id);
  let apks = readApks();

  const apk = apks.find((a) => a.id === id);
  if (!apk) return res.json({ success: true });

  if (apk.apkPath) fs.unlinkSync(apk.apkPath);
  if (apk.imagePath) fs.unlinkSync(apk.imagePath);

  apks = apks.filter((a) => a.id !== id);
  writeApks(apks);

  res.json({ success: true });
});

// ================== START ==================
app.listen(PORT, () => {
  console.log("Server running on", PORT);
});




















