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
// CORS
// =======================
app.use(cors({
  origin: "https://alphaapkstore.pages.dev",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
}));
app.options("*", cors());

app.use(express.json());

// =======================
// CLOUDINARY
// =======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =======================
// STORAGE
// =======================
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    if (file.fieldname === "apk") {
      return {
        folder: "alpha-apk-store/apks",
        resource_type: "raw",
      };
    }
    return {
      folder: "alpha-apk-store/images",
      resource_type: "image",
    };
  },
});

const upload = multer({ storage });

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
// UPLOAD APK + IMAGE (FINAL FIX)
// =======================
app.post(
  "/api/upload",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!req.files || !req.files.apk || !req.files.image) {
        return res.status(400).json({ message: "Files missing" });
      }

      const apkUrl = req.files.apk[0].path;
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
// START
// =======================
app.listen(PORT, () => {
  console.log("Backend running on", PORT);
});



