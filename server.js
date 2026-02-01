const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= CONFIG ================= */
const SUPABASE_URL = "https://ihboelpgtrzswkanahom.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloYm9lbHBndHJ6c3drYW5haG9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3Nzk3ODIsImV4cCI6MjA4NTM1NTc4Mn0.T0pVvICEavuonRuen6vXKcgPR-rnpOtDk_pRwdf5raU";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= MULTER (MEMORY, 200MB) ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

/* ================= TEMP STORE ================= */
let apks = [];

/* ================= ADMIN AUTH ================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

/* ================= UPLOAD APK (PERMANENT) ================= */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, description, category } = req.body;

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image?.[0];

      const apkPath = `apks/${Date.now()}-${apkFile.originalname}`;
      const imgPath = imageFile
        ? `images/${Date.now()}-${imageFile.originalname}`
        : null;

      await supabase.storage
        .from("alpha-apks")
        .upload(apkPath, apkFile.buffer, {
          contentType: apkFile.mimetype,
        });

      let imageUrl = "";
      if (imgPath) {
        await supabase.storage
          .from("alpha-apks")
          .upload(imgPath, imageFile.buffer, {
            contentType: imageFile.mimetype,
          });

        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/alpha-apks/${imgPath}`;
      }

      const apkUrl = `${SUPABASE_URL}/storage/v1/object/public/alpha-apks/${apkPath}`;

      const newApk = {
        id: Date.now(),
        name,
        description,
        category,
        apkUrl,
        imageUrl,
      };

      apks.unshift(newApk);
      res.json({ success: true, apk: newApk });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

/* ================= GET APKS ================= */
app.get("/api/apks", (req, res) => {
  res.json(apks);
});

/* ================= DELETE APK ================= */
app.delete("/api/delete-apk/:id", (req, res) => {
  const id = Number(req.params.id);
  apks = apks.filter((a) => a.id !== id);
  res.json({ success: true });
});

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Alpha APK Backend (Permanent Storage) ✅");
});

app.listen(PORT, () => {
  console.log("Server running on", PORT);
});



