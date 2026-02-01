import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

/* ===================== MIDDLEWARE ===================== */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ===================== SUPABASE ===================== */
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/* ===================== ADMIN AUTH (FIXES 404) ===================== */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;

  if (code === process.env.ADMIN_CODE) {
    return res.json({ success: true });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid admin code"
  });
});

/* ===================== MULTER (200MB SUPPORT) ===================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

/* ===================== UPLOAD APK ===================== */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const { name, description, category } = req.body;

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image[0];

      const apkPath = `${Date.now()}-${apkFile.originalname}`;
      const imagePath = `${Date.now()}-${imageFile.originalname}`;

      // Upload APK
      await supabase.storage
        .from("apks")
        .upload(apkPath, fs.createReadStream(apkFile.path));

      // Upload Image
      await supabase.storage
        .from("images")
        .upload(imagePath, fs.createReadStream(imageFile.path));

      const apkUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/apks/${apkPath}`;
      const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/images/${imagePath}`;

      const { error } = await supabase.from("apks").insert([
        { name, description, category, apkUrl, imageUrl }
      ]);

      if (error) throw error;

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

/* ===================== GET APKS ===================== */
app.get("/api/apks", async (req, res) => {
  const { data, error } = await supabase
    .from("apks")
    .select("*")
    .order("id", { ascending: false });

  if (error) return res.status(500).json({ error });
  res.json(data);
});

/* ===================== DELETE APK ===================== */
app.delete("/api/delete-apk/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("apks")
    .delete()
    .eq("id", id);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

/* ===================== START SERVER ===================== */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});

