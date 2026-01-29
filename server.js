const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("trust proxy", 1);

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* =========================
   MongoDB
========================= */
mongoose.connect(
  "mongodb+srv://alphaadmin:<.SECn9Xura4PZQD>@cluster0.xiqttcr.mongodb.net/alphaapkstore",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

const ApkSchema = new mongoose.Schema({
  name: String,
  description: String,
  category: String,
  image: String,
  apkFile: String
});

const Apk = mongoose.model("Apk", ApkSchema);

/* =========================
   Multer (200MB+ support)
========================= */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 500 } // 500MB
});

/* =========================
   Admin Auth (OLD FEATURE)
========================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* =========================
   Upload APK (OLD FEATURE)
========================= */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apkFile", maxCount: 1 },
    { name: "image", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const host = req.get("host");
      const protocol = "https";

      const newApk = new Apk({
        name: req.body.name,
        description: req.body.description,
        category: req.body.category,
        image: `${protocol}://${host}/uploads/${req.files.image[0].filename}`,
        apkFile: `${protocol}://${host}/uploads/${req.files.apkFile[0].filename}`
      });

      await newApk.save();
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(400).json({ success: false });
    }
  }
);

/* =========================
   Get APKs (OLD FEATURE)
========================= */
app.get("/api/apks", async (req, res) => {
  const apks = await Apk.find();
  res.json(apks);
});

/* =========================
   DELETE APK (OLD ROUTE)
========================= */
app.delete("/api/delete/:id", async (req, res) => {
  await Apk.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   DELETE APK (NEW ROUTE)
========================= */
app.delete("/api/delete-apk/:id", async (req, res) => {
  await Apk.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

/* =========================
   Server
========================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
