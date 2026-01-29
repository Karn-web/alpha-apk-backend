const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ===================== BASIC ===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
  })
);

/* ===================== UPLOADS DIR ===================== */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
app.use("/uploads", express.static(uploadDir));

/* ===================== MULTER (300MB SAFE) ===================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const unique =
      Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 🔥 300MB
  },
});

/* ===================== MONGODB ===================== */
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ Mongo Error:", err));

/* ===================== SCHEMA ===================== */
const ApkSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  apkPath: String,
  imagePath: String,
  createdAt: { type: Date, default: Date.now },
});

const Apk = mongoose.model("Apk", ApkSchema);

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
    try {
      if (!req.files?.apk || !req.files?.image) {
        return res.status(400).json({ error: "Files missing" });
      }

      const { name, description, category } = req.body;
      if (!name || !description || !category) {
        return res.status(400).json({ error: "Fields missing" });
      }

      const apkFile = req.files.apk[0];
      const imgFile = req.files.image[0];

      const apk = new Apk({
        name,
        description,
        category,
        apkPath: apkFile.filename,
        imagePath: imgFile.filename,
      });

      await apk.save();
      res.json({ success: true });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ===================== GET APKS ===================== */
app.get("/api/apks", async (req, res) => {
  const apks = await Apk.find().sort({ createdAt: -1 });
  res.json(apks);
});

/* ===================== DELETE APK ===================== */
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const apk = await Apk.findById(req.params.id);
    if (!apk) return res.status(404).json({ error: "Not found" });

    fs.unlinkSync(path.join(uploadDir, apk.apkPath));
    fs.unlinkSync(path.join(uploadDir, apk.imagePath));

    await Apk.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ===================== START ===================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("🚀 Backend running on", PORT)
);









