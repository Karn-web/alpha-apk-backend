import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 5000;
const ADMIN_CODE = process.env.ADMIN_CODE || "GURJANTSANDHU";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Middleware ----------
app.use(express.json());

app.use(
  cors({
    origin: [
      "https://alphaapkstore.xyz",
      "https://www.alphaapkstore.xyz",
      "https://alphaapkstore.pages.dev",
      "http://localhost:3000",
    ],
    methods: ["GET", "POST", "DELETE"],
  })
);

// ---------- Ensure folders/files ----------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const dataFile = path.join(__dirname, "apks.json");
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, "[]");

// ---------- Serve uploads ----------
app.use("/uploads", express.static(uploadDir));

// ---------- Multer (200MB support) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ---------- Helpers ----------
const readApks = () => JSON.parse(fs.readFileSync(dataFile));
const writeApks = (data) =>
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));

// ---------- ROUTES ----------

// ✅ Admin Auth
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === ADMIN_CODE) return res.json({ success: true });
  res.status(401).json({ success: false, message: "Invalid code" });
});

// ✅ Upload APK
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { name, description, category } = req.body;
      if (!req.files?.apk || !req.files?.image) {
        return res.status(400).json({ error: "Files missing" });
      }

      const apks = readApks();

      const newApk = {
        id: Date.now().toString(),
        name,
        description,
        category,
        apkUrl: `/uploads/${req.files.apk[0].filename}`,
        imageUrl: `/uploads/${req.files.image[0].filename}`,
        createdAt: new Date(),
      };

      apks.unshift(newApk);
      writeApks(apks);

      res.json({ success: true, apk: newApk });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Upload failed" });
    }
  }
);

// ✅ Get all APKs
app.get("/api/apks", (req, res) => {
  res.json(readApks());
});

// ✅ Delete APK
app.delete("/api/delete-apk/:id", (req, res) => {
  try {
    const apks = readApks();
    const apk = apks.find((a) => a.id === req.params.id);
    if (!apk) return res.status(404).json({ error: "Not found" });

    fs.unlinkSync(path.join(__dirname, apk.apkUrl));
    fs.unlinkSync(path.join(__dirname, apk.imageUrl));

    writeApks(apks.filter((a) => a.id !== req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


