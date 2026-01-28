const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// =====================
// CLOUDINARY CONFIG
// =====================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// =====================
// MULTER STORAGE
// =====================
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

const upload = multer({
  storage: (req, file, cb) => {
    if (file.fieldname === "apk") cb(null, apkStorage);
    else cb(null, imageStorage);
  },
});

// =====================
// DATA FILE
// =====================
const dataFile = path.join(__dirname, "apks.json");

if (!fs.existsSync(dataFile)) {
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// =====================
// ADMIN AUTH
// =====================
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

// =====================
// GET ALL APKS
// =====================
app.get("/api/apks", (req, res) => {
  const data = JSON.parse(fs.readFileSync(dataFile));
  res.json(data);
});

// =====================
// UPLOAD APK
// =====================
app.post(
  "/api/upload",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  (req, res) => {
    const { name, description, category } = req.body;

    if (!req.files.apk || !req.files.image) {
      return res.status(400).json({ message: "Files missing" });
    }

    const apkFile = req.files.apk[0];
    const imageFile = req.files.image[0];

    const data = JSON.parse(fs.readFileSync(dataFile));

    const newApk = {
      id: Date.now(),
      name,
      description,
      category,
      apkUrl: apkFile.path,     // Cloudinary URL
      imageUrl: imageFile.path, // Cloudinary URL
    };

    data.push(newApk);
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

    res.json({ success: true });
  }
);

// =====================
// DELETE APK
// =====================
app.delete("/api/apk/:id", (req, res) => {
  const id = Number(req.params.id);
  let data = JSON.parse(fs.readFileSync(dataFile));

  data = data.filter((apk) => apk.id !== id);
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
