import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SUPABASE ================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================= DATA ================= */
const DATA_FILE = "./apks.json";
let apks = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : [];

const saveApks = () =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(apks, null, 2));

const createSlug = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");

/* ================= MULTER (FIXED) ================= */
// ✅ MEMORY STORAGE IS REQUIRED FOR SUPABASE
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* ================= ADMIN AUTH ================= */
app.post("/api/admin-auth", (req, res) => {
  if (req.body.code === "GURJANTSANDHU")
    return res.json({ success: true });
  res.status(401).json({ success: false });
});

/* ================= UPLOAD APK ================= */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!req.files?.apk || !req.files?.image) {
        return res.status(400).json({ error: "Files missing" });
      }

      const slug = createSlug(name) + "-" + Date.now();

      /* ===== APK ===== */
      const apkFile = req.files.apk[0];
      const apkPath = `apks/${Date.now()}-${apkFile.originalname}`;

      const { error: apkErr } = await supabase.storage
        .from("apks")
        .upload(apkPath, apkFile.buffer, {
          contentType: apkFile.mimetype,
        });

      if (apkErr) throw apkErr;

      const { data: apkUrl } = supabase.storage
        .from("apks")
        .getPublicUrl(apkPath);

      /* ===== IMAGE ===== */
      const imgFile = req.files.image[0];
      const imgPath = `images/${Date.now()}-${imgFile.originalname}`;

      const { error: imgErr } = await supabase.storage
        .from("images")
        .upload(imgPath, imgFile.buffer, {
          contentType: imgFile.mimetype,
        });

      if (imgErr) throw imgErr;

      const { data: imageUrl } = supabase.storage
        .from("images")
        .getPublicUrl(imgPath);

      const apk = {
        id: Date.now(),
        name,
        slug,
        description,
        category,
        apkUrl: apkUrl.publicUrl,
        imageUrl: imageUrl.publicUrl,
        createdAt: new Date().toISOString(),
      };

      apks.unshift(apk);
      saveApks();

      res.json({ success: true, apk });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ================= FETCH ================= */
app.get("/api/apks", (req, res) => res.json(apks));

app.get("/api/apk/:slug", (req, res) => {
  const apk = apks.find((a) => a.slug === req.params.slug);
  if (!apk) return res.status(404).json({ error: "Not found" });
  res.json(apk);
});

/* ================= DELETE ================= */
app.delete("/api/delete-apk/:id", (req, res) => {
  apks = apks.filter((a) => a.id != req.params.id);
  saveApks();
  res.json({ success: true });
});

/* ================= START ================= */
app.listen(5000, () => console.log("Server running on port 5000"));












