const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());

/* ================= UPLOAD FOLDER ================= */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

/* ================= STATIC FILES ================= */
app.use("/uploads", express.static(uploadDir));

/* ================= MULTER (200MB) ================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

/* ================= IN-MEMORY APK STORE ================= */
let apks = [];

/* ================= ADMIN AUTH ================= */
app.post("/api/admin-auth", (req, res) => {
  const { code } = req.body;
  if (code === "GURJANTSANDHU") {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: "Invalid code" });
});

/* ================= UPLOAD APK ================= */
app.post(
  "/api/upload-apk",
  upload.fields([
    { name: "apk", maxCount: 1 },
    { name: "image", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { name, description, category } = req.body;

      if (!req.files.apk) {
        return res.status(400).json({ message: "APK required" });
      }

      const apkFile = req.files.apk[0];
      const imageFile = req.files.image ? req.files.image[0] : null;

      const backendURL = "https://alpha-apk-backend.onrender.com";

      const newApk = {
        id: Date.now(),
        name,
        description,
        category,
        apkUrl: `${backendURL}/uploads/${apkFile.filename}`,
        imageUrl: imageFile
          ? `${backendURL}/uploads/${imageFile.filename}`
          : "",
      };

      apks.unshift(newApk);
      res.json({ success: true, apk: newApk });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  }
);

/* ================= GET ALL APKS ================= */
app.get("/api/apks", (req, res) => {
  res.json(apks);
});

/* ================= DELETE APK ================= */
app.delete("/api/delete-apk/:id", (req, res) => {
  const id = Number(req.params.id);
  apks = apks.filter((apk) => apk.id !== id);
  res.json({ success: true });
});

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Alpha APK Backend Running ✅");
});

/* ================= START ================= */
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});



