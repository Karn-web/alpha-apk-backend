const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const slugify = require("slugify");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

/* ===========================
   SUPABASE CONFIG
=========================== */
const supabase = createClient(
  "https://ihboelpgtrzswkanahom.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloYm9lbHBndHJ6c3drYW5haG9tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc3OTc4MiwiZXhwIjoyMDg1MzU1NzgyfQ.6fjjeTKYQGe6Ap9PjOHx7Umnyi5DWe0PJmugc1l6d-4"
);

/* ===========================
   MEMORY DB (JSON STYLE)
=========================== */
let apks = [];

/* ===========================
   MULTER MEMORY STORAGE
=========================== */
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ===========================
   ADMIN SECURITY CODE
=========================== */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;

  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }

  res.status(401).json({ success: false });
});

/* ===========================
   UPLOAD APK
=========================== */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apkFile", maxCount: 1 },
    { name: "imageFile", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, description, category } = req.body;

      const apkFile = req.files.apkFile[0];
      const imageFile = req.files.imageFile[0];

      const id = Date.now();

      const slug = slugify(name + "-" + id, {
        lower: true,
        strict: true
      });

      /* UPLOAD APK */
      const apkPath = `apks/${id}-${apkFile.originalname}`;

      await supabase.storage
        .from("apks")
        .upload(apkPath, apkFile.buffer, {
          contentType: apkFile.mimetype
        });

      const apkUrl =
        "https://ihboelpgtrzswkanahom.supabase.co/storage/v1/object/public/apks/" +
        apkPath;

      /* UPLOAD IMAGE */
      const imagePath = `images/${id}-${imageFile.originalname}`;

      await supabase.storage
        .from("images")
        .upload(imagePath, imageFile.buffer, {
          contentType: imageFile.mimetype
        });

      const imageUrl =
        "https://ihboelpgtrzswkanahom.supabase.co/storage/v1/object/public/images/" +
        imagePath;

      const newApk = {
        id,
        name,
        slug,
        description,
        category,
        apkUrl,
        imageUrl,
        createdAt: new Date().toISOString()
      };

      apks.unshift(newApk);

      res.json({ success: true, apk: newApk });
    } catch (err) {
  console.error("UPLOAD ERROR:", err);
  res.status(500).json({ error: err.message || "Upload failed" });
}
  }
);

/* ===========================
   GET ALL APKS
=========================== */
app.get("/api/apks", (req, res) => {
  res.json(apks);
});

/* ===========================
   GET SINGLE APK (DETAIL PAGE)
=========================== */
app.get("/api/apk/:id", (req, res) => {
  const apk = apks.find(a => a.id == req.params.id);
  res.json(apk || {});
});

/* ===========================
   DELETE APK
=========================== */
app.delete("/api/delete-apk/:id", (req, res) => {
  apks = apks.filter(a => a.id != req.params.id);
  res.json({ success: true });
});

/* ===========================
   AUTO SITEMAP
=========================== */
app.get("/sitemap.xml", (req, res) => {
  let urls = apks
    .map(
      a =>
        `<url><loc>https://alphaapkstore.xyz/apk/${a.id}</loc></url>`
    )
    .join("");

  res.header("Content-Type", "application/xml");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?><urlset>${urls}</urlset>`
  );
});

/* ===========================
   START SERVER
=========================== */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Alpha APK Server Running on", PORT);
});













