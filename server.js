import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = process.env.PORT || 5000;

/* =======================
   CONFIG
======================= */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const APK_BUCKET = "apks";
const IMAGE_BUCKET = "images";
const TABLE = "apks";
const ADMIN_CODE = "GURJANTSANDHU";

/* =======================
   SUPABASE
======================= */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

/* =======================
   MIDDLEWARE
======================= */
app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

/* =======================
   SLUG FUNCTION
======================= */
function createSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* =======================
   ADMIN AUTH
======================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === ADMIN_CODE) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
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
      if (!name || !req.files?.apk) {
        return res.status(400).json({ error: "Missing data" });
      }

      const slug = createSlug(name);
      const apkFile = req.files.apk[0];
      const imageFile = req.files.image?.[0];

      const apkPath = `${slug}/${Date.now()}-${apkFile.originalname}`;

      const { error: apkErr } = await supabase.storage
        .from(APK_BUCKET)
        .upload(apkPath, apkFile.buffer, {
          contentType: apkFile.mimetype,
        });

      if (apkErr) throw apkErr;

      const apk_url = `${SUPABASE_URL}/storage/v1/object/public/${APK_BUCKET}/${apkPath}`;

      let image_url = null;
      if (imageFile) {
        const imagePath = `${slug}/${Date.now()}-${imageFile.originalname}`;
        const { error: imgErr } = await supabase.storage
          .from(IMAGE_BUCKET)
          .upload(imagePath, imageFile.buffer, {
            contentType: imageFile.mimetype,
          });
        if (imgErr) throw imgErr;
        image_url = `${SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${imagePath}`;
      }

      const { error: dbErr } = await supabase.from(TABLE).insert([
        {
          name,
          slug,
          description,
          category,
          apk_url,
          image_url,
        },
      ]);

      if (dbErr) throw dbErr;

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* =======================
   GET ALL APKs
======================= */
app.get("/api/apks", async (req, res) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json([]);
  res.json(data);
});

/* =======================
   GET APK BY SLUG
======================= */
app.get("/api/apk/:slug", async (req, res) => {
  const { slug } = req.params;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) return res.status(404).json(null);
  res.json(data);
});

/* =======================
   AUTO SITEMAP (SEO)
======================= */
app.get("/sitemap.xml", async (req, res) => {
  try {
    const SITE_URL = "https://alphaapkstore.pages.dev";

    const { data, error } = await supabase
      .from(TABLE)
      .select("slug");

    if (error) throw error;

    let urls = `
  <url>
    <loc>${SITE_URL}/</loc>
    <priority>1.0</priority>
  </url>`;

    data.forEach((apk) => {
      if (apk.slug) {
        urls += `
  <url>
    <loc>${SITE_URL}/apk/${apk.slug}</loc>
    <priority>0.9</priority>
  </url>`;
      }
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (err) {
    console.error(err);
    res.status(500).send("Sitemap error");
  }
});

/* =======================
   DELETE APK
======================= */
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Not found" });
    }

    if (data.apk_url) {
      const apkPath = data.apk_url.split(`/${APK_BUCKET}/`)[1];
      await supabase.storage.from(APK_BUCKET).remove([apkPath]);
    }

    if (data.image_url) {
      const imgPath = data.image_url.split(`/${IMAGE_BUCKET}/`)[1];
      await supabase.storage.from(IMAGE_BUCKET).remove([imgPath]);
    }

    await supabase.from(TABLE).delete().eq("id", id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

/* =======================
   START SERVER
======================= */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});











