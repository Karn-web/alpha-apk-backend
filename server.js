import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import path from "path";

const app = express();

/* ===============================
   BASIC MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   SUPABASE CONFIG
   ⚠️ PUT REAL SERVICE ROLE KEY
================================ */
const SUPABASE_URL = "https://ihboelpgtrzswkanahom.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // REQUIRED

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
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
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

      /* Public URLs */
      const apk_url = `${SUPABASE_URL}/storage/v1/object/public/${APK_BUCKET}/${apkFileName}`;
      const image_url = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${imageFileName}`;

      /* Insert DB row */
      const { error: dbError } = await supabase
        .from(TABLE_NAME)
        .insert([
          {
            name,
            description,
            category,
            apk_url,
            image_url,
          },
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
   GET ALL APKS (HOME PAGE)
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
    res.status(500).json({ error: "Failed to fetch APKs" });
  }
});

/* ===============================
   DELETE APK (FULL CLEAN)
================================ */
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const { id } = req.params;

    /* Get APK record */
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("apk_url, image_url")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "APK not found" });
    }

    /* Extract file names */
    const apkFileName = data.apk_url.split("/").pop();
    const imageFileName = data.image_url.split("/").pop();

    /* Delete from storage */
    await supabase.storage.from(APK_BUCKET).remove([apkFileName]);
    await supabase.storage.from(IMAGE_BUCKET).remove([imageFileName]);

    /* Delete DB row */
    await supabase.from(TABLE_NAME).delete().eq("id", id);

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ===============================
   STATIC FRONTEND (KEEP OLD)
================================ */
app.use(express.static(path.join(process.cwd(), "frontend", "build")));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(process.cwd(), "frontend", "build", "index.html")
  );
});

/* ===============================
   START SERVER
================================ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});




