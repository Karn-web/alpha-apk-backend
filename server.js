const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;

const app = express();
const PORT = process.env.PORT || 5000;

/* =======================
   MIDDLEWARE
======================= */
app.use(express.json());

app.use(
  cors({
    origin: [
      "https://alphaapkstore.pages.dev",
      "http://localhost:3000"
    ],
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"]
  })
);

/* =======================
   CLOUDINARY CONFIG
======================= */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/* =======================
   FILE + STORAGE SETUP
======================= */
const dataFile = path.join(__dirname, "apks.json");

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

const upload = multer({ dest: "uploads/" });

/* =======================
   ADMIN AUTH
======================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;

  if (code === "GURJANTSANDHU") {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* =======================
   GET ALL APKS
======================= */
app.get("/api/apks", (req, res) => {
  try {
    const data = fs.readFileSync(dataFile, "utf-8");
    res.json(JSON.parse(data || "[]"));
  } catch (err) {
    console.error("READ ERROR:", err);
    res.status(500).json([]);
  }
});

/* =======================
   UPLOAD APK
======================= */
app.post("/api/upload", upload.fields([
  { name: "apk", maxCount: 1 },
  { name: "image", maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!req.files?.apk || !req.files?.image) {
      return res.status(400).json({ success: false });
    }

    const apkUpload = await cloudinary.uploader.upload(
      req.files.apk[0].path,
      { resource_type: "raw", folder: "apks" }
    );

    const imgUpload = await cloudinary.uploader.upload(
      req.files.image[0].path,
      { folder: "apk-images" }
    );

    let data = JSON.parse(fs.readFileSync(dataFile, "utf-8") || "[]");

    const newApk = {
      id: Date.now(),
      name,
      description,
      apkUrl: apkUpload.secure_url,
      imageUrl: imgUpload.secure_url
    };

    data.push(newApk);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =======================
   DELETE APK (500 SAFE)
======================= */
app.delete("/api/apk/:id", (req, res) => {
  try {
    const id = Number(req.params.id);

    let data = [];
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf-8");
      data = raw ? JSON.parse(raw) : [];
    }

    const newData = data.filter(apk => apk.id !== id);
    fs.writeFileSync(dataFile, JSON.stringify(newData, null, 2));

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =======================
   ROOT CHECK
======================= */
app.get("/", (req, res) => {
  res.send("APK Store Backend Running");
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});




