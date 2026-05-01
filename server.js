// backend/server.js

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

  res.status(401).json({ success: false });
});

/* ======================
   SLUG MAKER
====================== */

function makeSlug(text) {
  return text
    .toLowerCase()
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
      image_url,
    } = req.body;

    if (!name || !apk_url || !image_url) {
      return res.status(400).json({
        error: "Missing fields",
      });
    }

    const slug = makeSlug(name);

    // full safe image url
    let finalImageUrl = image_url;

    if (
      image_url &&
      !image_url.startsWith("http")
    ) {
      finalImageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/apk-images/${image_url}`;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert([
        {
          name,
          description,
          category,
          apk_url,
          image_url: finalImageUrl,
          slug,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) {
      console.log("INSERT ERROR:", error);
      return res.status(500).json({
        error: error.message,
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    console.log("UPLOAD ERROR:", err);

    res.status(500).json({
      error: "Upload failed",
    });
  }
});

/* ======================
   GET APKS
====================== */

app.get("/api/apks", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.log("FETCH ERROR:", error);

      return res.status(500).json({
        error: error.message,
      });
    }

    res.json(data || []);
  } catch (err) {
    console.log("FETCH ERROR:", err);

    res.status(500).json({
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

    if (error) throw error;

    res.json({
      success: true,
    });
  } catch (err) {
    console.log("DELETE ERROR:", err);

    res.status(500).json({
      error: "Delete failed",
    });
  }
});

/* ======================
   SERVE FRONTEND
====================== */

const buildPath = path.join(
  __dirname,
  "..",
  "frontend",
  "build"
);

app.use(express.static(buildPath));

app.get("*", (req, res) => {
  res.sendFile(
    path.join(buildPath, "index.html")
  );
});

/* ======================
   START SERVER
====================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    "Server running on port",
    PORT
  );
});