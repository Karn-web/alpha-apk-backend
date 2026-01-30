import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// 🔥 SUPABASE CONFIG
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ======================
// UPLOAD APK + IMAGE
// ======================
app.post("/api/upload-apk", upload.fields([
  { name: "apk", maxCount: 1 },
  { name: "image", maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, description, category } = req.body;

    const apkFile = req.files.apk[0];
    const imageFile = req.files.image?.[0];

    // Upload APK
    const apkPath = `apk/${Date.now()}-${apkFile.originalname}`;
    await supabase.storage.from("uploads").upload(apkPath, apkFile.buffer);

    const apkUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads/${apkPath}`;

    // Upload Image
    let imageUrl = "";
    if (imageFile) {
      const imgPath = `images/${Date.now()}-${imageFile.originalname}`;
      await supabase.storage.from("uploads").upload(imgPath, imageFile.buffer);
      imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/uploads/${imgPath}`;
    }

    // Insert DB
    const { error } = await supabase.from("apks").insert([{
      name,
      description,
      category,
      apk_url: apkUrl,
      image_url: imageUrl
    }]);

    if (error) throw error;

    res.json({ success: true, message: "APK uploaded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// GET APK LIST
// ======================
app.get("/api/apks", async (req, res) => {
  const { data, error } = await supabase
    .from("apks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ======================
// DELETE APK
// ======================
app.delete("/api/delete-apk/:id", async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase.from("apks").delete().eq("id", id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("🚀 Server running on", PORT));
