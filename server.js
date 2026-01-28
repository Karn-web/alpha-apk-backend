const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();

/* ===================== CORS ===================== */
app.use(
  cors({
    origin: /^https:\/\/.*\.pages\.dev$/,
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
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB error:", err));

/* ===================== CLOUDINARY (ENV SAFE) ===================== */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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

/* ===================== ADMIN ===================== */
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
    try {
      if (!req.files || !req.files.apk || !req.files.image) {
        return res.status(400).json({ message: "Files missing" });
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
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

/* ===================== FETCH ===================== */
app.get("/api/apks", async (req, res) => {
  res.json(await Apk.find().sort({ createdAt: -1 }));
});

/* ===================== DELETE ===================== */
app.delete("/api/delete-apk/:id", async (req, res) => {
  await Apk.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ===================== START ===================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Backend running"));







