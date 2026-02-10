const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

try {
  require("dotenv").config();
} catch {
  console.log("dotenv not installed — using render env");
}

const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());


// ======================
// SUPABASE
// ======================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE = "apks";
const APK_BUCKET = "apk-files";
const IMAGE_BUCKET = "apk-images";


// ======================
// SECURITY CODE
// ======================

const ADMIN_CODE = "GURJANTSANDHU";

app.post("/api/admin-auth", (req, res) => {
  if (req.body.code === ADMIN_CODE) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});


// ======================
// MULTER CONFIG
// ======================

const storage = multer.memoryStorage();

const upload = multer({ storage });

const uploadFields = upload.fields([
  { name: "apkFile", maxCount: 1 },
  { name: "imageFile", maxCount: 1 }
]);


// ======================
// SLUG MAKER
// ======================

function makeSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}


// ======================
// UPLOAD APK
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

    await supabase.storage
      .from(APK_BUCKET)
      .upload(apkPath, apkFile.buffer, {
        contentType: apkFile.mimetype
      });

    await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(imagePath, imageFile.buffer, {
        contentType: imageFile.mimetype
      });

    const apkUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${APK_BUCKET}/${apkPath}`;
    const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${imagePath}`;

    await supabase.from(TABLE).insert([
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

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Upload failed" });
  }
});


// ======================
// GET ALL APKS
// ======================

app.get("/api/apks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Fetch failed" });
  }
});


// ======================
// DELETE APK
// ======================

app.delete("/api/apks/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Delete failed" });
  }
});


// ======================
// SERVE FRONTEND
// ======================

const buildPath = path.join(__dirname, "../frontend/build");

app.use(express.static(buildPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});


// ======================
// START SERVER
// ======================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

