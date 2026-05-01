const express = require("express");
const cors = require("cors");
const path = require("path");

try {
  require("dotenv").config();
} catch {
  console.log("dotenv not installed — using render env");
}

const { createClient } = require("@supabase/supabase-js");

const app = express();

/* ======================
   CORS
====================== */
app.use(
  cors({
    origin: [
      "https://alphaapkstore.xyz",
      "https://www.alphaapkstore.xyz",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));

/* ======================
   SUPABASE
====================== */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE = "apks";

/* ======================
   SECURITY CODE
====================== */

const ADMIN_CODE = "GURJANTSANDHU";

app.post("/api/admin-auth", (req, res) => {
  if (req.body.code === ADMIN_CODE) {
    return res.json({ success: true });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid security code",
  });
});

/* ======================
   SLUG MAKER
====================== */

function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ======================
   UPLOAD APK (URL BASED)
====================== */

app.post("/api/upload-apk", async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      apk_url,
      image_url
    } = req.body;

    if (!name || !apk_url || !image_url) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const slug = makeSlug(name);

    const { data, error } = await supabase
      .from(TABLE)
      .insert([
        {
          name,
          description,
          category,
          apk_url,
          image_url,
          slug,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.log("INSERT ERROR:", error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.log("UPLOAD ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
    });
  }
});

/* ======================
   GET ALL APKS
====================== */

app.get("/api/apks", async (req, res) => {
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

    return res.json(data || []);
  } catch (err) {
    console.log("SERVER FETCH ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Fetch failed",
    });
  }
});

/* ======================
   DELETE APK
====================== */

app.delete("/api/delete-apk/:id", async (req, res) => {
  try {
    const id = req.params.id;

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

    return res.json({
      success: true,
      message: "APK deleted successfully",
    });
  } catch (err) {
    console.log("DELETE SERVER ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Delete failed",
    });
  }
});

/* ======================
   SERVE FRONTEND
====================== */

const buildPath = path.join(__dirname, "../frontend/build");

/* Static files FIRST */
app.use(express.static(buildPath));

/* Force sitemap.xml */
app.get("/sitemap.xml", (req, res) => {
  res.sendFile(path.join(buildPath, "sitemap.xml"));
});

/* Force robots.txt */
app.get("/robots.txt", (req, res) => {
  res.sendFile(path.join(buildPath, "robots.txt"));
});

/* React routes LAST */
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

/* ======================
   START SERVER
====================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});