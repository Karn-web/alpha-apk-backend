const express = require("express");
const cors = require("cors");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

try {
  require("dotenv").config();
} catch {
  console.log("dotenv not installed — using environment variables");
}

const { createClient } = require("@supabase/supabase-js");

const app = express();

// ====================================
// SECURITY & PERFORMANCE
// ====================================
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://pagead2.googlesyndication.com", "https://www.googletagmanager.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://alpha-apk-backend.onrender.com", "https://*.supabase.co"],
      frameSrc: ["https://pagead2.googlesyndication.com"],
    },
  },
}));

// ====================================
// RATE LIMITING
// ====================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: "Too many requests, please try again later" }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Upload limit reached" }
});

app.use("/api/", apiLimiter);
app.use("/api/upload-apk", uploadLimiter);

// ====================================
// CORS
// ====================================
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [
      "https://www.alphaapkstore.xyz",
      "https://alphaapkstore.xyz",
      "https://www.alphaapkstore.com",
      "https://alphaapkstore.com",
    ]
  : [
      "https://www.alphaapkstore.xyz",
      "https://alphaapkstore.xyz",
      "https://www.alphaapkstore.com",
      "https://alphaapkstore.com",
      "http://localhost:3000",
    ];

app.use(
  cors({
    origin: allowedOrigins,
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
// ADMIN SECURITY
// ====================================
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error("FATAL: ADMIN_SECRET environment variable is required");
  process.exit(1);
}

function requireAdmin(req, res, next) {
  const secret = req.headers["x-admin-secret"];
  if (secret !== ADMIN_SECRET) {
    return res.status(403).json({ success: false, error: "Forbidden" });
  }
  next();
}

app.post("/api/admin-auth", (req, res) => {
  try {
    const { code } = req.body;
    if (code === ADMIN_SECRET) {
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false, message: "Invalid security code" });
  } catch (error) {
    console.log("ADMIN AUTH ERROR:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get("/api/admin-auth-test", (req, res) => {
  res.json({ success: true, message: "Admin auth route working" });
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
app.post("/api/upload-apk", requireAdmin, uploadLimiter, async (req, res) => {
  try {
    const {
      name, description, category, apk_url, image_url,
      version, size, updated_date, rating, screenshots,
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
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.log("UPLOAD ERROR:", error);
    return res.status(500).json({ success: false, error: "Upload failed" });
  }
});

// ====================================
// GET ALL APKS
// ====================================
app.options("/api/apks", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res.sendStatus(200);
});

app.get("/api/apks", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.log("FETCH ERROR:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.log("GET APKS ERROR:", error);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

// ====================================
// GET SINGLE APK BY SLUG
// ====================================
app.get("/api/apk/:slug", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  try {
    const { slug } = req.params;
    
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("slug", slug)
      .single();

    if (error) {
      console.log("FETCH SINGLE APK ERROR:", error);
      return res.status(404).json({ success: false, error: "APK not found" });
    }

    return res.json(data);
  } catch (error) {
    console.log("GET SINGLE APK ERROR:", error);
    return res.status(500).json({ success: false, error: "Fetch failed" });
  }
});

// ====================================
// DELETE APK
// ====================================
app.delete("/api/delete-apk/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "APK id required" });
    }

    const { error } = await supabase.from(TABLE).delete().eq("id", id);

    if (error) {
      console.log("DELETE ERROR:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    console.log("DELETE SERVER ERROR:", error);
    return res.status(500).json({ success: false, error: "Delete failed" });
  }
});

// ====================================
// SEO FILES
// ====================================
app.get("/robots.txt", (req, res) => {
  res.type("text/plain");
  res.send(`User-agent: *\nAllow: /\n\nSitemap: https://www.alphaapkstore.com/sitemap.xml`);
});

app.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = "https://www.alphaapkstore.com";
    
    const { data: apks, error: apkError } = await supabase
      .from(TABLE)
      .select("slug, updated_date");
    
    if (apkError) throw apkError;

    const staticUrls = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/about", priority: "0.8", changefreq: "monthly" },
      { loc: "/contact", priority: "0.8", changefreq: "monthly" },
      { loc: "/privacy-policy", priority: "0.7", changefreq: "yearly" },
      { loc: "/terms", priority: "0.7", changefreq: "yearly" },
      { loc: "/dmca", priority: "0.7", changefreq: "yearly" },
      { loc: "/faq", priority: "0.7", changefreq: "monthly" },
      { loc: "/security-trust", priority: "0.7", changefreq: "monthly" },
      { loc: "/blog", priority: "0.9", changefreq: "daily" },
      { loc: "/blog/how-to-install-apk-files-android-2026", priority: "0.8", changefreq: "monthly" },
      { loc: "/blog/best-open-source-android-apps-2026", priority: "0.8", changefreq: "monthly" },
      { loc: "/blog/best-android-file-managers-2026", priority: "0.8", changefreq: "monthly" },
    ];

    const apkUrls = (apks || []).map(apk => ({
      loc: `/apk/${apk.slug}`,
      priority: "0.9",
      changefreq: "weekly",
      lastmod: apk.updated_date || new Date().toISOString().split('T')[0]
    }));

    const allUrls = [...staticUrls, ...apkUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.log("SITEMAP ERROR:", error);
    res.status(500).send("Error generating sitemap");
  }
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