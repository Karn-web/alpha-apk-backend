const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// ======================
// SUPABASE
// ======================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APK_BUCKET = "apks";
const IMAGE_BUCKET = "images";
const TABLE = "apks";

// ======================
// MULTER MEMORY STORAGE
// ======================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const uploadFields = upload.fields([
  { name: "apkFile", maxCount: 1 },
  { name: "imageFile", maxCount: 1 }
]);

// ======================
// SLUG FUNCTION
// ======================

function makeSlug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-") +
    "-" +
    Date.now()
  );
}

// ======================
// ADMIN AUTH
// ======================

app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }
  res.status(401).json({ error: "Wrong code" });
});

// ======================
// GET ALL APKS
// ======================

app.get("/api/apks", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json(error);

  res.json(data);
});

// ======================
// GET SINGLE APK
// ======================

app.get("/api/apk/:slug", async (req, res) => {
  const { slug } = req.params;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return res.status(404).json({ error: "No APK found" });

  res.json(data);
});

// ======================
// UPLOAD APK (FIXED)
// ======================

app.post("/api/upload-apk", uploadFields, async (req, res) => {
  try {
    const { name, description, category } = req.body;

    const apkFile = req.files?.apkFile?.[0];
    const imageFile = req.files?.imageFile?.[0];

    if (!apkFile || !imageFile) {
      return res.status(400).json({ error: "Files missing" });
    }

    const slug = makeSlug(name);

    const apkPath = `${Date.now()}-${apkFile.originalname}`;
    const imagePath = `${Date.now()}-${imageFile.originalname}`;

    // upload apk
    const { error: apkError } = await supabase.storage
      .from(APK_BUCKET)
      .upload(apkPath, apkFile.buffer, {
        contentType: apkFile.mimetype
      });

    if (apkError) return res.status(500).json(apkError);

    // upload image
    const { error: imageError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(imagePath, imageFile.buffer, {
        contentType: imageFile.mimetype
      });

    if (imageError) return res.status(500).json(imageError);

    const apkUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${APK_BUCKET}/${apkPath}`;
    const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${imagePath}`;

    const { error: dbError } = await supabase.from(TABLE).insert([
      {
        name,
        description,
        category,
        apk_url: apkUrl,
        image_url: imageUrl,
        slug,
        created_at: new Date()
      }
    ]);

    if (dbError) return res.status(500).json(dbError);

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ======================
// DELETE APK
// ======================

app.delete("/api/delete-apk/:id", async (req, res) => {
  const { id } = req.params;

  const { data } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return res.status(404).json({ error: "Not found" });

  await supabase.from(TABLE).delete().eq("id", id);

  res.json({ success: true });
});

// ======================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
