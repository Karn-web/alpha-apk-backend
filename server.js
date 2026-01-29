const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* ===================== CORS (FIXED FOR ALL DOMAINS) ===================== */
const allowedOrigins = [
  "https://alphaapkstore.pages.dev",
  "https://alphaapkstore.xyz",
  "https://www.alphaapkstore.xyz",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("CORS not allowed"));
    },
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.options("*", cors());

/* ===================== MIDDLEWARE ===================== */
app.use(express.json());

/* ===================== MONGODB ===================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

/* ===================== CLOUDINARY ===================== */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ===================== MULTER STORAGE ===================== */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder:
      file.mimetype === "application/vnd.android.package-archive"
        ? "alpha-apk-store/apks"
        : "alpha-apk-store/images",
    resource_type: "auto",
  }),
});

/* ===================== MULTER (LARGE FILE SAFE) ===================== */
const upload = multer({
  storage,
  limits: {
    fileSize: 150 * 1024 * 1024, // 150 MB (WhatsApp safe)
  },
});

/* ===================== MODEL ===================== */
const Apk = mongoose.model(
  "Apk",
  new mongoose.Schema(
    {
      name: String,
      description: String,
      category: String,
      apkUrl: String,
      imageUrl: String,
    },
    { timestamps: true }
  )
);

/* ===================== ADMIN AUTH ===================== */
app.post("/api/admin-auth", (req, res) => {
  if (req.body.code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

/* ===================== UPLOAD APK (CRASH-PROOF) ===================== */
app.post(
  "/api/upload-apk",
  (req, res, next) => {
    upload.fields([
      { name: "apk", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ])(req, res, function (err) {
      if (err) {
        console.error("❌ MULTER ERROR:", err);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.files?.apk || !req.files?.image) {
        return res.status(400).json({ message: "APK or image missing" });
      }

      const apk = new Apk({
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        apkUrl: req.files.apk[0].path,
        imageUrl: req.files.image[0].path,
      });

      await apk.save();
      res.json({ success: true });
    } catch (err) {
      console.error("❌ UPLOAD ERROR:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

/* ===================== FETCH APKS ===================== */
app.get("/api/apks", async (req, res) => {
  try {
    const apks = await Apk.find().sort({ createdAt: -1 });
    res.json(apks);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch APKs" });
  }
});

/* ===================== DELETE APK ===================== */
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    await Apk.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

/* ===================== START SERVER ===================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));








