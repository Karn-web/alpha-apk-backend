import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

/* ================= SUPABASE ================= */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APK_BUCKET = "apks";
const IMAGE_BUCKET = "images";
const TABLE_NAME = "apks";

/* ================= MULTER ================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

/* ================= ADMIN AUTH ================= */
const ADMIN_CODE = "GURJANTSANDHU";

app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === ADMIN_CODE) {
    return res.json({ success: true });
  }
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

      if (!req.files?.apk) {
        return res.status(400).json({ error: "APK file required" });
      }

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image?.[0];

      const apkPath = `apk/${Date.now()}-${apkFile.originalname}`;
      const imagePath = imageFile
        ? `image/${Date.now()}-${imageFile.originalname}`
        : null;

      /* Upload APK */
      const { error: apkErr } = await supabase.storage
        .from(APK_BUCKET)
        .upload(apkPath, apkFile.buffer, {
          contentType: apkFile.mimetype,
          upsert: false,
        });

      if (apkErr) throw apkErr;

      /* Upload Image (optional) */
      if (imagePath) {
        const { error: imgErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(imagePath, imageFile.buffer, {
            contentType: imageFile.mimetype,
            upsert: false,
          });

        if (imgErr) throw imgErr;
      }

      /* Save metadata */
      const { error: dbErr } = await supabase.from(TABLE_NAME).insert([
        {
          name,
          description,
          category,
          apk_url: apkPath,
          image_url: imagePath,
        },
      ]);

      if (dbErr) throw dbErr;

      res.json({ success: true });
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ================= GET APK LIST ================= */
app.get("/api/apks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;

    const safeData = data.map((apk) => {
      const apkPublic =
        typeof apk.apk_url === "string"
          ? supabase.storage
              .from(APK_BUCKET)
              .getPublicUrl(apk.apk_url).data.publicUrl
          : null;

      const imagePublic =
        typeof apk.image_url === "string"
          ? supabase.storage
              .from(IMAGE_BUCKET)
              .getPublicUrl(apk.image_url).data.publicUrl
          : null;

      return {
        ...apk,
        apkUrl: apkPublic,
        imageUrl: imagePublic,
      };
    });

    res.json(safeData);
  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json([]);
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

