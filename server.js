const express = require("express");
const cors = require("cors");
const path = require("path");
const crypto = require("crypto");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

try {
  require("dotenv").config();
} catch {
  console.log("dotenv not installed — using environment variables");
}

const { createClient } = require("@supabase/supabase-js");
const Razorpay = require("razorpay");

const app = express();

// Render/proxy fix for express-rate-limit behind hosted proxies
app.set("trust proxy", 1);

// ====================================
// SECURITY & PERFORMANCE
// ====================================
app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://pagead2.googlesyndication.com",
          "https://www.googletagmanager.com",
          "https://checkout.razorpay.com",
          "https://www.paypal.com",
          "https://www.paypalobjects.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://alpha-apk-backend.onrender.com",
          "https://*.supabase.co",
          "https://api.razorpay.com",
          "https://api-m.razorpay.com",
          "https://api-m.sandbox.paypal.com",
          "https://api-m.paypal.com",
        ],
        frameSrc: [
          "https://pagead2.googlesyndication.com",
          "https://api.razorpay.com",
          "https://checkout.razorpay.com",
          "https://www.paypal.com",
        ],
      },
    },
  })
);

// ====================================
// RATE LIMITING
// ====================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: "Too many requests, please try again later" },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { success: false, error: "Upload limit reached" },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: "Too many payment attempts, please try again later" },
});

app.use("/api/", apiLimiter);
app.use("/api/upload-apk", uploadLimiter);
app.use("/api/create-premium-order", paymentLimiter);
app.use("/api/verify-premium-payment", paymentLimiter);
app.use("/api/create-paypal-order", paymentLimiter);
app.use("/api/capture-paypal-order", paymentLimiter);

// ====================================
// CORS
// ====================================
const allowedOrigins =
  process.env.NODE_ENV === "production"
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
// PAYMENT CONFIG
// ====================================
const PREMIUM_PLANS = {
  bronze: {
    name: "Bronze",
    inrAmount: 17000, // ₹170.00 in paise
    usdAmount: "1.99", // normal display price
    usdMinorAmount: 199, // $1.99 in cents/minor unit for Razorpay USD orders
    days: 30,
  },
  silver: {
    name: "Silver",
    inrAmount: 43000, // ₹430.00 in paise
    usdAmount: "4.99", // normal display price
    usdMinorAmount: 499, // $4.99 in cents/minor unit for Razorpay USD orders
    days: 30,
  },
  diamond: {
    name: "Diamond",
    inrAmount: 86000, // ₹860.00 in paise
    usdAmount: "9.99", // normal display price
    usdMinorAmount: 999, // $9.99 in cents/minor unit for Razorpay USD orders
    days: 30,
  },
};

const razorpay =
  process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

const PAYPAL_MODE = process.env.PAYPAL_MODE === "live" ? "live" : "sandbox";
const PAYPAL_BASE_URL =
  PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

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

async function requireUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.replace("Bearer ", "")
      : null;

    if (!token) {
      return res.status(401).json({ success: false, error: "Login required" });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }

    req.user = data.user;
    next();
  } catch (error) {
    console.log("AUTH CHECK ERROR:", error);
    return res.status(401).json({ success: false, error: "Auth failed" });
  }
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
// HELPERS
// ====================================
function makeSlug(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getValidPlan(plan) {
  const cleanPlan = String(plan || "").toLowerCase().trim();
  return PREMIUM_PLANS[cleanPlan] ? cleanPlan : null;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function savePaymentRecord(record) {
  try {
    await supabase.from("premium_payments").insert([record]);
  } catch (error) {
    // This should not break premium activation if you have not created premium_payments table yet.
    console.log("PAYMENT RECORD SKIPPED:", error?.message || error);
  }
}

async function activatePremiumForUser({ user, plan, provider, providerPaymentId, providerOrderId, providerCurrency }) {
  const selectedPlan = PREMIUM_PLANS[plan];
  const now = new Date();
  const subscriptionEnd = addDays(now, selectedPlan.days);

  const profileUpdate = {
    email: user.email,
    plan,
    subscription_status: "active",
    subscription_start: now.toISOString(),
    subscription_end: subscriptionEnd.toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        ...profileUpdate,
      },
      { onConflict: "id" }
    )
    .select()
    .single();

  if (error) {
    console.log("PROFILE UPDATE ERROR:", error);
    throw new Error(error.message || "Failed to activate premium");
  }

  await savePaymentRecord({
    user_id: user.id,
    email: user.email,
    plan,
    provider,
    provider_order_id: providerOrderId || null,
    provider_payment_id: providerPaymentId || null,
    amount_inr:
      provider === "razorpay" && providerCurrency === "INR"
        ? Number((selectedPlan.inrAmount / 100).toFixed(2))
        : null,
    amount_usd:
      provider === "paypal" || providerCurrency === "USD"
        ? selectedPlan.usdAmount
        : null,
    status: "success",
    created_at: now.toISOString(),
  });

  return data;
}

async function getPayPalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal environment variables missing");
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();

  if (!response.ok) {
    console.log("PAYPAL TOKEN ERROR:", data);
    throw new Error("Failed to get PayPal access token");
  }

  return data.access_token;
}

// ====================================
// PAYMENT ROUTES - ALPH PREMIUM
// ====================================
app.get("/api/premium-plans", (req, res) => {
  return res.json({
    success: true,
    plans: Object.entries(PREMIUM_PLANS).map(([id, plan]) => ({
      id,
      name: plan.name,
      inrAmount: plan.inrAmount / 100,
      usdAmount: plan.usdAmount,
      days: plan.days,
    })),
  });
});

// Razorpay order creation.
// paymentCurrency:
// - "inr" = Indian checkout with UPI/cards/netbanking
// - "usd" = International checkout; Razorpay can show PayPal only for non-INR currencies
app.post("/api/create-premium-order", requireUser, async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        error: "Razorpay is not configured on server",
      });
    }

    const plan = getValidPlan(req.body.plan);

    if (!plan) {
      return res.status(400).json({ success: false, error: "Invalid premium plan" });
    }

    const selectedPlan = PREMIUM_PLANS[plan];
    const paymentCurrency = String(req.body.paymentCurrency || "inr").toLowerCase();

    let amount = selectedPlan.inrAmount;
    let currency = "INR";
    let displayAmount = `₹${(selectedPlan.inrAmount / 100).toFixed(0)}`;

    if (paymentCurrency === "usd") {
      amount = selectedPlan.usdMinorAmount;
      currency = "USD";
      displayAmount = `$${selectedPlan.usdAmount}`;
    }

    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `alph_${plan}_${currency.toLowerCase()}_${Date.now()}`,
      notes: {
        plan,
        currency,
        user_id: req.user.id,
        email: req.user.email || "",
        product: "ALPH Premium",
      },
    });

    return res.json({
      success: true,
      provider: "razorpay",
      key: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      displayAmount,
      plan,
      planName: selectedPlan.name,
      paymentCurrency,
      user: {
        id: req.user.id,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.log("RAZORPAY ORDER ERROR:", error);
    return res.status(500).json({ success: false, error: "Order creation failed" });
  }
});

// Razorpay verification. This is what actually grants premium.
app.post("/api/verify-premium-payment", requireUser, async (req, res) => {
  try {
    const {
      plan: rawPlan,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      currency: rawCurrency,
    } = req.body;

    const plan = getValidPlan(rawPlan);

    if (!plan) {
      return res.status(400).json({ success: false, error: "Invalid premium plan" });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Missing Razorpay payment data" });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: "Invalid payment signature" });
    }

    const profile = await activatePremiumForUser({
      user: req.user,
      plan,
      provider: "razorpay",
      providerOrderId: razorpay_order_id,
      providerPaymentId: razorpay_payment_id,
      providerCurrency: String(rawCurrency || "INR").toUpperCase(),
    });

    return res.json({
      success: true,
      message: `${PREMIUM_PLANS[plan].name} premium activated`,
      profile,
    });
  } catch (error) {
    console.log("RAZORPAY VERIFY ERROR:", error);
    return res.status(500).json({ success: false, error: "Payment verification failed" });
  }
});

// PayPal order creation for international users.
app.post("/api/create-paypal-order", requireUser, async (req, res) => {
  try {
    const plan = getValidPlan(req.body.plan);

    if (!plan) {
      return res.status(400).json({ success: false, error: "Invalid premium plan" });
    }

    const selectedPlan = PREMIUM_PLANS[plan];
    const token = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: `alph_${plan}_${req.user.id}`,
            description: `ALPH Premium ${selectedPlan.name} - 30 days`,
            amount: {
              currency_code: "USD",
              value: selectedPlan.usdAmount,
            },
            custom_id: `${req.user.id}:${plan}`,
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log("PAYPAL ORDER ERROR:", data);
      return res.status(500).json({ success: false, error: "PayPal order creation failed" });
    }

    return res.json({
      success: true,
      provider: "paypal",
      orderId: data.id,
      plan,
      planName: selectedPlan.name,
    });
  } catch (error) {
    console.log("PAYPAL CREATE ERROR:", error);
    return res.status(500).json({ success: false, error: "PayPal setup failed" });
  }
});

// PayPal capture. This is what actually grants premium.
app.post("/api/capture-paypal-order", requireUser, async (req, res) => {
  try {
    const { orderId, plan: rawPlan } = req.body;
    const plan = getValidPlan(rawPlan);

    if (!orderId || !plan) {
      return res.status(400).json({ success: false, error: "PayPal order id and plan required" });
    }

    const token = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok || data.status !== "COMPLETED") {
      console.log("PAYPAL CAPTURE ERROR:", data);
      return res.status(400).json({ success: false, error: "PayPal payment not completed" });
    }

    const captureId =
      data?.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.id || null;

    const profile = await activatePremiumForUser({
      user: req.user,
      plan,
      provider: "paypal",
      providerOrderId: orderId,
      providerPaymentId: captureId,
      providerCurrency: "USD",
    });

    return res.json({
      success: true,
      message: `${PREMIUM_PLANS[plan].name} premium activated`,
      profile,
      paypal: data,
    });
  } catch (error) {
    console.log("PAYPAL CAPTURE SERVER ERROR:", error);
    return res.status(500).json({ success: false, error: "PayPal capture failed" });
  }
});

// ====================================
// UPLOAD APK
// ====================================
app.post("/api/upload-apk", requireAdmin, uploadLimiter, async (req, res) => {
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

    const { data, error } = await supabase.from(TABLE).insert([insertData]).select();

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

    const { data, error } = await supabase.from(TABLE).select("*").eq("slug", slug).single();

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
      { loc: "/premium", priority: "0.8", changefreq: "monthly" },
      { loc: "/premium-apks", priority: "0.6", changefreq: "weekly" },
      { loc: "/blog", priority: "0.9", changefreq: "daily" },
      { loc: "/blog/how-to-install-apk-files-android-2026", priority: "0.8", changefreq: "monthly" },
      { loc: "/blog/best-vpn-apps-for-android-2026", priority: "0.8", changefreq: "monthly" },
      { loc: "/blog/best-open-source-android-apps-2026", priority: "0.8", changefreq: "monthly" },
      { loc: "/blog/best-android-file-managers-2026", priority: "0.8", changefreq: "monthly" },
    ];

    const apkUrls = (apks || []).map((apk) => ({
      loc: `/apk/${apk.slug}`,
      priority: "0.9",
      changefreq: "weekly",
      lastmod: apk.updated_date || new Date().toISOString().split("T")[0],
    }));

    const allUrls = [...staticUrls, ...apkUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls
  .map(
    (u) => `  <url>
    <loc>${baseUrl}${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
    ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.log("SITEMAP ERROR:", error);
    res.status(500).send("Error generating sitemap");
  }
});

// ====================================
// SERVE FRONTEND BUILD (optional)
// Your frontend is usually hosted separately on Cloudflare.
// This safe fallback prevents Render backend ENOENT crashes/log spam.
// ====================================
const buildPath = path.join(__dirname, "../frontend/build");
app.use(express.static(buildPath));

app.get("*", (req, res) => {
  const indexPath = path.join(buildPath, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      return res.status(404).json({
        success: false,
        message: "ALPH backend is running. Frontend build not found on this service.",
      });
    }
  });
});

// ====================================
// START SERVER
// ====================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
