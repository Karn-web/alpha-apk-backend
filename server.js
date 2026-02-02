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

/* ================= YOUR REAL SETUP ================= */
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
  if (req.body.code === ADMIN_CODE) {
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
      if (!req.files?.apk) {
        return res.status(400).json({ error: "APK file required" });
      }

      const { name, category } = req.body;
      const description =
        req.body.description || req.body.descripition || "";

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
        });

      if (apkErr) throw apkErr;

      /* Upload Image */
      if (imagePath) {
        const { error: imgErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(imagePath, imageFile.buffer, {
            contentType: imageFile.mimetype,
          });
        if (imgErr) throw imgErr;
      }

      /* Save DB row */
      const { error: dbErr } = await supabase.from(TABLE_NAME).insert([
        {
          name,
          category,
          description,
          apk_url: apkPath,
          image_url: imagePath,
        },
      ]);

      if (dbErr) throw dbErr;

      res.json({ success: true });
    } catch (err) {
      console.error("UPLOAD ERROR:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

/* ================= GET APKS ================= */
app.get("/api/apks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("id", { ascending: false });

    if (error) throw error;

    const safeData = data.map((apk) => ({
      ...apk,
      apkUrl:
        typeof apk.apk_url === "string"
          ? supabase.storage
              .from(APK_BUCKET)
              .getPublicUrl(apk.apk_url).data.publicUrl
          : null,
      imageUrl:
        typeof apk.image_url === "string"
          ? supabase.storage
              .from(IMAGE_BUCKET)
              .getPublicUrl(apk.image_url).data.publicUrl
          : null,
    }));

    res.json(safeData);
  } catch (err) {
    console.error("FETCH ERROR:", err.message);
    res.status(500).json([]);
  }
});

/* ================= DELETE APK (FULL) ================= */
app.delete("/api/delete-apk/:id", async (req, res) => {
  const { id } = req.params;

  try {
    /* 1️⃣ Get APK row */
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("apk_url, image_url")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "APK not found" });
    }

    /* 2️⃣ Delete APK file */
    if (data.apk_url) {
      await supabase.storage
        .from(APK_BUCKET)
        .remove([data.apk_url]);
    }

    /* 3️⃣ Delete image file */
    if (data.image_url) {
      await supabase.storage
        .from(IMAGE_BUCKET)
        .remove([data.image_url]);
    }

    /* 4️⃣ Delete DB row */
    const { error: delErr } = await supabase
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (delErr) throw delErr;

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err.message);
    res.status(500).json({ error: "Delete failed" });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});



