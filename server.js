import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();

/* ===============================
   BASIC MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   ADMIN SECURITY CODE
================================ */
const ADMIN_SECURITY_CODE = "GURJANTSANDHU";

/* ===============================
   SUPABASE CONFIG
================================ */
const SUPABASE_URL = "https://ihboelpgtrzswkanahom.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY missing");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* ===============================
   CONSTANTS
================================ */
const APK_BUCKET = "apks";
const IMAGE_BUCKET = "images";
const TABLE_NAME = "apks";

/* ===============================
   MULTER (MEMORY STORAGE)
================================ */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

/* ===============================
   ADMIN AUTH
================================ */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;

  if (code === ADMIN_SECURITY_CODE) {
    return res.json({ success: true });
  }

  res.status(401).json({ error: "Invalid security code" });
});

/* ===============================
   UPLOAD APK + IMAGE
================================ */
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

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image[0];

      const apkFileName = `${Date.now()}_${apkFile.originalname}`;
      const imageFileName = `${Date.now()}_${imageFile.originalname}`;

      /* Upload APK */
      const { error: apkError } = await supabase.storage
        .from(APK_BUCKET)
        .upload(apkFileName, apkFile.buffer, {
          contentType: apkFile.mimetype,
        });

      if (apkError) throw apkError;

      /* Upload Image */
      const { error: imageError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(imageFileName, imageFile.buffer, {
          contentType: imageFile.mimetype,
        });

      if (imageError) throw imageError;

      const apk_url = `${SUPABASE_URL}/storage/v1/object/public/${APK_BUCKET}/${apkFileName}`;
      const image_url = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${imageFileName}`;

      const { error: dbError } = await supabase
        .from(TABLE_NAME)
        .insert([
          { name, description, category, apk_url, image_url },
        ]);

      if (dbError) throw dbError;

      res.json({ success: true });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ===============================
   GET ALL APKS
================================ */
app.get("/api/apks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: "Fetch failed" });
  }
});

/* ===============================
   DELETE APK
================================ */
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data } = await supabase
      .from(TABLE_NAME)
      .select("apk_url, image_url")
      .eq("id", id)
      .single();

    if (!data) {
      return res.status(404).json({ error: "Not found" });
    }

    await supabase.storage
      .from(APK_BUCKET)
      .remove([data.apk_url.split("/").pop()]);

    await supabase.storage
      .from(IMAGE_BUCKET)
      .remove([data.image_url.split("/").pop()]);

    await supabase.from(TABLE_NAME).delete().eq("id", id);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("✅ Backend API running on port", PORT);
});






