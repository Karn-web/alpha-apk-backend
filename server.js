const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));

/* ================= MONGODB ================= */
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ Mongo Error:", err));

/* ================= SCHEMA ================= */
const ApkSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  category: String,
  apkUrl: { type: String, required: true },
  imageUrl: String,
  createdAt: { type: Date, default: Date.now },
});

const Apk = mongoose.model("Apk", ApkSchema);

/* ================= ADMIN AUTH (FIXED) ================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;

  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }

  return res.status(401).json({ success: false });
});

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 300 }, // 🔥 300MB
});

/* ================= ROUTES ================= */

// GET APKS
app.get("/api/apks", async (req, res) => {
  try {
    const apks = await Apk.find().sort({ createdAt: -1 });
    res.json(apks);
  } catch {
    res.status(500).json({ error: "Failed to fetch APKs" });
  }
});

// UPLOAD APK
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!req.files || !req.files.apk) {
        return res.status(400).json({ error: "APK file missing" });
      }

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image?.[0];

      const apkUrl = `${req.protocol}://${req.get("host")}/uploads/${apkFile.filename}`;
      const imageUrl = imageFile
        ? `${req.protocol}://${req.get("host")}/uploads/${imageFile.filename}`
        : "";

      const apk = new Apk({
        name,
        description,
        category,
        apkUrl,
        imageUrl,
      });

      const saved = await apk.save(); // 🔥 DB SAVE FIXED
      res.json(saved);
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// DELETE APK
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    await Apk.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ================= STATIC ================= */
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= START ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on ${PORT}`)
);











