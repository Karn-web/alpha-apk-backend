// ======================
// Alpha APK Store Backend
// ======================

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

app.use(
  cors({
    origin: [
      "https://alphaapkstore.pages.dev",
      "http://localhost:3000"
    ],
    credentials: true
  })
);

// ======================
// SUPABASE CONFIG
// ======================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APK_BUCKET = "apks";
const IMAGE_BUCKET = "images";
const TABLE = "apks";

// ======================
// ADMIN SECURITY
// ======================

const ADMIN_CODE = "GURJANTSANDHU";

app.post("/api/admin-auth", (req, res) => {
  if (req.body.code === ADMIN_CODE) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

// ======================
// MULTER MEMORY STORAGE
// ======================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }
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
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") +
    "-" +
    Date.now()
  );
}

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
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", req.params.slug)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json(data);
});

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

    // upload apk
    await supabase.storage
      .from(APK_BUCKET)
      .upload(apkPath, apkFile.buffer, {
        contentType: apkFile.mimetype
      });

    // upload image
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
// DELETE APK
// ======================

app.delete("/api/delete-apk/:slug", async (req, res) => {
  try {
    const { data } = await supabase
      .from(TABLE)
      .select("*")
      .eq("slug", req.params.slug)
      .single();

    if (!data) return res.status(404).json({ error: "Not found" });

    const apkFile = data.apk_url.split("/").pop();
    const imageFile = data.image_url.split("/").pop();

    await supabase.storage.from(APK_BUCKET).remove([apkFile]);
    await supabase.storage.from(IMAGE_BUCKET).remove([imageFile]);

    await supabase.from(TABLE).delete().eq("slug", req.params.slug);

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ======================
// SEO SITEMAP
// ======================

app.get("/sitemap.xml", async (req, res) => {
  const { data } = await supabase.from(TABLE).select("slug");

  let urls = data
    .map(
      (a) =>
        `<url><loc>https://alphaapkstore.xyz/apk/${a.slug}</loc></url>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  res.header("Content-Type", "application/xml");
  res.send(xml);
});

// ======================
// START SERVER
// ======================

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});














