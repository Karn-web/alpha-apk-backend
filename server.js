const express = require("express");
const cors = require("cors");
const path = require("path");

try {
  require("dotenv").config();
} catch {
  console.log("dotenv not installed — using environment variables");
}

const { createClient } = require("@supabase/supabase-js");

const app = express();

// ====================================
// CORS (keep all old features + fixed)
// ====================================
app.use(
  cors({
    origin: [
      "https://www.alphaapkstore.xyz",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));

// ====================================
// SUPABASE
// ====================================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE = "apks";

// ====================================
// ADMIN SECURITY CODE
// ====================================
const ADMIN_CODE = "GURJANTSANDHU";

app.post("/api/admin-auth", (req, res) => {
  try {
    const { code } = req.body;

    if (code === ADMIN_CODE) {
      return res.json({ success: true });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid security code",
    });
  } catch (error) {
    console.log("ADMIN AUTH ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});

// ====================================
// SLUG MAKER
// ====================================
function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ====================================
// UPLOAD APK
// ====================================
app.post("/api/upload-apk", async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      apk_url,
      image_url,
      version,
      size,
      updated_date,
      rating,
      screenshots,
    } = req.body;

    if (!name || !apk_url || !image_url) {
      return res.status(400).json({
        success: false,
        error: "Name, APK URL and Image URL are required",
      });
    }

    const slug = makeSlug(name);

    const insertData = {
      name,
      description: description || "",
      category: category || "General",
      apk_url,
      image_url,
      version: version || "Latest",
      size: size || "N/A",
      updated_date: updated_date || "Recently",
      rating: rating || "4.5",
      screenshots: Array.isArray(screenshots) ? screenshots : [],
      slug,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert([insertData])
      .select();

    if (error) {
      console.log("UPLOAD INSERT ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.log("UPLOAD ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Upload failed",
    });
  }
});

// ====================================
// GET ALL APKS
// ====================================
app.options("/api/apks", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.alphaapkstore.xyz");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.sendStatus(200);
});

app.get("/api/apks", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://www.alphaapkstore.xyz");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("FETCH ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.log("GET APKS ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Fetch failed",
    });
  }
});
// ====================================
// DELETE APK
// ====================================
app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "APK id required",
      });
    }

    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      console.log("DELETE ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.log("DELETE SERVER ERROR:", error);
    return res.status(500).json({
      success: false,
      error: "Delete failed",
    });
  }
});

// ====================================
// SIMPLE SEO FILES
// ====================================
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: *\nAllow: /\n\nSitemap: https://alphaapkstore.xyz/sitemap.xml`);
});

app.get("/sitemap.xml", (req, res) => {
  res.header("Content-Type", "application/xml");
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://alphaapkstore.xyz/</loc><priority>1.0</priority></url>
  <url><loc>https://alphaapkstore.xyz/about</loc><priority>0.8</priority></url>
  <url><loc>https://alphaapkstore.xyz/contact</loc><priority>0.8</priority></url>
  <url><loc>https://alphaapkstore.xyz/privacy-policy</loc><priority>0.7</priority></url>
  <url><loc>https://alphaapkstore.xyz/terms</loc><priority>0.7</priority></url>
</urlset>`);
});

// ====================================
// SERVE FRONTEND BUILD
// ====================================
const buildPath = path.join(__dirname, "../frontend/build");

app.use(express.static(buildPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ====================================
// START SERVER
// ====================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
