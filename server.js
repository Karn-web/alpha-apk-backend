const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* ===================== CORS (CLOUDFLARE + RENDER) ===================== */
app.use(
  cors({
    origin: [
      /^https:\/\/.*\.pages\.dev$/, // allow all Cloudflare Pages
      "https://alpha-apk-backend.onrender.com"
    ],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// IMPORTANT: handle preflight
app.options("*", cors());

/* ===================== MIDDLEWARE ===================== */
app.use(express.json());

/* ===================== MONGODB ===================== */
mongoose
  .connect(
    "mongodb+srv://alphaadmin:.SECn9Xura4PZQD@cluster0.xiqttcr.mongodb.net/?appName=Cluster0"
  )
  .then(() => console.log("MongoDB Connected"))
  .catch(console.error);

/* ===================== CLOUDINARY ===================== */
cloudinary.config({
  cloud_name: "dousxvfmx",
  api_key: "134438671712261",
  api_secret: "-hb1GOMRrTdmwHrAPwsQd-Y8YYs",
});

/* ===================== MULTER ===================== */
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

const upload = multer({ storage });

/* ===================== SCHEMA ===================== */
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

/* ===================== UPLOAD APK ===================== */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    const apk = new Apk({
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      apkUrl: req.files.apk[0].path,
      imageUrl: req.files.image[0].path,
    });

    await apk.save();
    res.json({ success: true });
  }
);

/* ===================== FETCH APKS ===================== */
app.get("/api/apks", async (req, res) => {
  res.json(await Apk.find().sort({ createdAt: -1 }));
});

/* ===================== DELETE APK ===================== */
app.delete("/api/delete-apk/:id", async (req, res) => {
  await Apk.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ===================== START ===================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Render backend running"));






