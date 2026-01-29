const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* 🔥 IMPORTANT: TRUST PROXY (Render HTTPS fix) */
app.set("trust proxy", 1);

/* ================= MONGO ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

/* ================= MULTER ================= */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* ================= MODEL ================= */
const ApkSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  image: String,
  apkFile: String
});

const Apk = mongoose.model("Apk", ApkSchema);

/* ================= ADMIN AUTH ================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* ================= UPLOAD APK ================= */
app.post("/api/upload", upload.fields([
  { name: "image" },
  { name: "apkFile" }
]), async (req, res) => {

  const protocol = req.secure ? "https" : "https"; // 🔥 FORCE HTTPS
  const host = req.get("host");

  const imageUrl = `${protocol}://${host}/uploads/${req.files.image[0].filename}`;
  const apkUrl = `${protocol}://${host}/uploads/${req.files.apkFile[0].filename}`;

  const apk = new Apk({
    name: req.body.name,
    description: req.body.description,
    category: req.body.category,
    image: imageUrl,
    apkFile: apkUrl
  });

  await apk.save();
  res.json({ success: true });
});

/* ================= GET APKs ================= */
app.get("/api/apks", async (req, res) => {
  const apks = await Apk.find();
  res.json(apks);
});

/* ================= DELETE ================= */
app.delete("/api/delete/:id", async (req, res) => {
  await Apk.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* ================= START ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on", PORT));












