import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 5000;

/* =======================
   FORCE CORS (VERY IMPORTANT)
======================= */
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors());
app.use(express.json());

/* =======================
   SUPABASE CONFIG
======================= */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

const APK_BUCKET = "apks";
const IMAGE_BUCKET = "images";
const TABLE_NAME = "apks";

/* =======================
   MULTER (200MB)
======================= */
const upload = multer({
  limits: { fileSize: 200 * 1024 * 1024 },
});

/* =======================
   ADMIN AUTH
======================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* =======================
   UPLOAD APK
======================= */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!req.files?.apk) {
        return res.status(400).json({ error: "APK missing" });
      }

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image?.[0];

      const apkPath = `${Date.now()}-${apkFile.originalname}`;

      const { error: apkError } = await supabase.storage
        .from(APK_BUCKET)
        .upload(apkPath, apkFile.buffer, {
          contentType: apkFile.mimetype,
        });

      if (apkError) throw apkError;

      const apkUrl = `${SUPABASE_URL}/storage/v1/object/public/${APK_BUCKET}/${apkPath}`;

      let imageUrl = null;

      if (imageFile) {
        const imagePath = `${Date.now()}-${imageFile.originalname}`;

        const { error: imgError } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(imagePath, imageFile.buffer, {
            contentType: imageFile.mimetype,
          });

        if (imgError) throw imgError;

        imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${imagePath}`;
      }

      const { error: dbError } = await supabase
        .from(TABLE_NAME)
        .insert([
          {
            name,
            description,
            category,
            apk_url: apkUrl,
            image_url: imageUrl,
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

/* =======================
   GET APKs
======================= */
app.get("/api/apks", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    return res.status(500).json({ error: "Fetch failed" });
  }

  res.json(data);
});

/* =======================
   DELETE APK
======================= */
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .single();

    if (!data) return res.status(404).json({ error: "Not found" });

    const apkPath = data.apk_url.split("/").pop();
    const imgPath = data.image_url?.split("/").pop();

    await supabase.storage.from(APK_BUCKET).remove([apkPath]);
    if (imgPath) {
      await supabase.storage.from(IMAGE_BUCKET).remove([imgPath]);
    }

    await supabase.from(TABLE_NAME).delete().eq("id", id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});









