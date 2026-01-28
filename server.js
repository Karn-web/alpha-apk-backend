const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// CORS (CLOUDFLARE SAFE)
// =======================
app.use(cors({
  origin: "https://alphaapkstore.pages.dev",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
}));
app.options("*", cors());

app.use(express.json());

// =======================
// CLOUDINARY CONFIG
// =======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =======================
// STORAGE DEFINITIONS
// =======================
const apkStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "alpha-apk-store/apks",
    resource_type: "raw",
  },
});

const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "alpha-apk-store/images",
    resource_type: "image",
  },
});

const uploadApk = multer({ storage: apkStorage });
const uploadImage = multer({ storage: imageStorage });

// =======================
// DATA FILE
// =======================
const dataFile = path.join(__dirname, "apks.json");
if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// =======================
// ADMIN AUTH
// =======================
app.post("/api/admin-auth", (req, res) => {
  if (req.body.code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

// =======================
// GET APKS
// =======================
app.get("/api/apks", (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  res.json(data);
});

// =======================
// UPLOAD APK (SAFE)
// =======================
app.post(
  "/api/upload",
  uploadApk.single("apk"),
  uploadImage.single("image"),
  (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!req.file || !req.files) {
        return res.status(400).json({ message: "Files missing" });
      }

      const apkUrl = req.file.path;
      const imageUrl = req.files.image[0].path;

      const data = JSON.parse(fs.readFileSync(dataFile));

      const newApk = {
        id: Date.now(),
        name,
        description,
        category,
        apkUrl,
        imageUrl,
      };

      data.push(newApk);
      fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

      res.json({ success: true });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ success: false });
    }
  }
);

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
  console.log("Backend running on", PORT);
});


