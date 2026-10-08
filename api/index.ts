import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from "@google/genai";

const app = express();

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

app.use(cors());
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper for local file paths (only used in local dev)
const DATA_DIR = path.join(process.cwd(), "data");
console.log(`[API] Data directory: ${DATA_DIR}`);
const RECORDS_FILE = path.join(DATA_DIR, "records.json");
const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");
const LECTURERS_FILE = path.join(DATA_DIR, "lecturers.json");
const SIGNATURES_FILE = path.join(DATA_DIR, "signatures.json");

if (!fs.existsSync(DATA_DIR) && !process.env.VERCEL) {
  try { 
    fs.mkdirSync(DATA_DIR, { recursive: true }); 
    console.log(`[API] Created data directory: ${DATA_DIR}`);
  } catch (e: any) {
    console.error(`[API] Failed to create data directory: ${e.message}`);
  }
}

// Verify write permissions
if (!process.env.VERCEL) {
  try {
    const testFile = path.join(DATA_DIR, ".write_test");
    fs.writeFileSync(testFile, "ok");
    console.log(`[API] Write test successful in ${DATA_DIR}`);
  } catch (e: any) {
    console.error(`[API] WRITE TEST FAILED in ${DATA_DIR}: ${e.message}`);
  }
}

// Route Handlers
const getHealth = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  let supabaseStatus = "not_configured";
  let supabaseError = null;
  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').select('id').limit(1);
      if (error) {
        supabaseStatus = "error";
        supabaseError = error.message;
      } else {
        supabaseStatus = "connected";
      }
    } catch (e: any) {
      supabaseStatus = "exception";
      supabaseError = e.message;
    }
  }
  let writeTest = "not_tested";
  if (!process.env.VERCEL) {
    try {
      const testFile = path.join(DATA_DIR, ".write_test");
      fs.writeFileSync(testFile, "ok");
      writeTest = "ok";
    } catch (e: any) {
      writeTest = `failed: ${e.message}`;
    }
  }

  res.json({ 
    status: "ok", 
    persistence: supabase ? "supabase" : "local_file",
    supabase_status: supabaseStatus,
    supabase_error: supabaseError,
    write_test: writeTest,
    is_vercel: !!process.env.VERCEL,
    url: req.url,
    path: req.path
  });
};

const getRecords = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (supabase) {
    try {
      const { data, error } = await supabase.from('epantau_storage').select('content').eq('id', 'records').maybeSingle();
      if (error) {
        console.error("[API] Supabase error fetching records:", error);
        throw error;
      }
      return res.json(data?.content || []);
    } catch (err: any) {
      console.error("[API] Exception fetching records from Supabase:", err);
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(RECORDS_FILE)) {
        const content = fs.readFileSync(RECORDS_FILE, "utf-8");
        return res.json(JSON.parse(content));
      }
      res.json([]);
    } catch (e: any) { 
      console.error("[API] Error reading local records file:", e);
      res.json([]); 
    }
  }
};

const postRecords = async (req: any, res: any) => {
  const records = req.body;
  const count = Array.isArray(records) ? records.length : 0;
  console.log(`[API] POST /api/records - Saving ${count} records...`);
  
  if (!Array.isArray(records)) {
    console.error("[API] Invalid records payload: not an array");
    return res.status(400).json({ error: "Payload must be an array of records" });
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'records', content: records, updated_at: new Date() });
      if (error) {
        console.error("[API] Supabase error saving records:", error);
        return res.status(500).json({ error: error.message });
      }
      console.log("[API] Records saved to Supabase.");
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] Exception saving records to Supabase:", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    try {
      fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
      console.log(`[API] Records saved to local file: ${RECORDS_FILE}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] Error writing local records file:", err);
      res.status(500).json({ error: `Failed to write file: ${err.message}` });
    }
  }
};

const getSchedules = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (supabase) {
    try {
      const { data, error } = await supabase.from('epantau_storage').select('content').eq('id', 'schedules').maybeSingle();
      if (error) throw error;
      return res.json(data?.content || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(SCHEDULES_FILE)) {
        return res.json(JSON.parse(fs.readFileSync(SCHEDULES_FILE, "utf-8")));
      }
      res.json([]);
    } catch (e) { res.json([]); }
  }
};

const postSchedules = async (req: any, res: any) => {
  const schedules = req.body;
  const count = Array.isArray(schedules) ? schedules.length : 0;
  console.log(`[API] POST /api/schedules - Saving ${count} schedules...`);

  if (!Array.isArray(schedules)) {
    return res.status(400).json({ error: "Payload must be an array of schedules" });
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'schedules', content: schedules, updated_at: new Date() });
      if (error) {
        console.error("[API] Supabase error saving schedules:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] Exception saving schedules to Supabase:", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    try {
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
      console.log(`[API] Schedules saved to local file: ${SCHEDULES_FILE}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] Error writing local schedules file:", err);
      res.status(500).json({ error: err.message });
    }
  }
};

const getLecturers = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (supabase) {
    try {
      const { data, error } = await supabase.from('epantau_storage').select('content').eq('id', 'lecturers').maybeSingle();
      if (error) throw error;
      return res.json(data?.content || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(LECTURERS_FILE)) {
        return res.json(JSON.parse(fs.readFileSync(LECTURERS_FILE, "utf-8")));
      }
      res.json([]);
    } catch (e) { res.json([]); }
  }
};

const postLecturers = async (req: any, res: any) => {
  const lecturers = req.body;
  const count = Array.isArray(lecturers) ? lecturers.length : 0;
  console.log(`[API] POST /api/lecturers - Saving ${count} lecturers...`);

  if (!Array.isArray(lecturers)) {
    return res.status(400).json({ error: "Payload must be an array of lecturers" });
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'lecturers', content: lecturers, updated_at: new Date() });
      if (error) {
        console.error("[API] Supabase error saving lecturers:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] Exception saving lecturers to Supabase:", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    try {
      fs.writeFileSync(LECTURERS_FILE, JSON.stringify(lecturers, null, 2));
      console.log(`[API] Lecturers saved to local file: ${LECTURERS_FILE}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[API] Error writing local lecturers file:", err);
      res.status(500).json({ error: err.message });
    }
  }
};

const getSignatures = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (supabase) {
    try {
      const { data, error } = await supabase.from('epantau_storage').select('content').eq('id', 'signatures').maybeSingle();
      if (error) throw error;
      return res.json(data?.content || {});
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(SIGNATURES_FILE)) {
        return res.json(JSON.parse(fs.readFileSync(SIGNATURES_FILE, "utf-8")));
      }
      res.json({});
    } catch (e) { res.json({}); }
  }
};

const postSignatures = async (req: any, res: any) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: "Payload must be a signatures object map" });
  }

  // Load existing signatures
  let current: Record<string, string> = {};
  if (supabase) {
    try {
      const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'signatures').maybeSingle();
      if (data?.content && typeof data.content === 'object') {
        current = data.content;
      }
    } catch (e) {
      console.warn("[API] Could not fetch existing signatures from Supabase for merge:", e);
    }
  } else {
    try {
      if (fs.existsSync(SIGNATURES_FILE)) {
        current = JSON.parse(fs.readFileSync(SIGNATURES_FILE, "utf-8"));
      }
    } catch (e) {
      console.warn("[API] Could not fetch existing signatures from local file for merge:", e);
    }
  }

  // Merge updates or remove deleted keys
  const merged: Record<string, string> = { ...current };
  for (const [key, val] of Object.entries(incoming)) {
    if (val === null || val === '' || val === undefined) {
      delete merged[key];
    } else {
      merged[key] = val as string;
    }
  }

  const count = Object.keys(merged).length;
  console.log(`[API] POST /api/signatures - Saved ${count} signatures in library...`);

  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'signatures', content: merged, updated_at: new Date() });
      if (error) {
        console.error("[API] Supabase error saving signatures:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, signatures: merged });
    } catch (err: any) {
      console.error("[API] Exception saving signatures to Supabase:", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    try {
      fs.writeFileSync(SIGNATURES_FILE, JSON.stringify(merged, null, 2));
      console.log(`[API] Signatures saved to local file: ${SIGNATURES_FILE}`);
      res.json({ success: true, signatures: merged });
    } catch (err: any) {
      console.error("[API] Error writing local signatures file:", err);
      res.status(500).json({ error: err.message });
    }
  }
};

const postGeminiSummary = async (req: any, res: any) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[API] GEMINI_API_KEY is not defined in environment variables.");
    return res.status(500).json({ 
      error: "Sila tetapkan GEMINI_API_KEY di bahagian Settings > Secrets untuk membolehkan analisis AI." 
    });
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "Rumusan gagal dijana oleh Gemini.";
    res.json({ text });
  } catch (err: any) {
    console.error("[API] Error calling Gemini API:", err);
    res.status(500).json({ error: `Ralat menjana rumusan AI: ${err.message || err}` });
  }
};

// Register routes with and without /api prefix
app.get("/api/health", getHealth);
app.get("/health", getHealth);

app.post("/api/gemini/summary", postGeminiSummary);
app.post("/gemini/summary", postGeminiSummary);

app.get("/api/records", getRecords);
app.get("/records", getRecords);
app.post("/api/records", postRecords);
app.post("/records", postRecords);

app.get("/api/schedules", getSchedules);
app.get("/schedules", getSchedules);
app.post("/api/schedules", postSchedules);
app.post("/schedules", postSchedules);

app.get("/api/lecturers", getLecturers);
app.get("/lecturers", getLecturers);
app.post("/api/lecturers", postLecturers);
app.post("/lecturers", postLecturers);

app.get("/api/signatures", getSignatures);
app.get("/signatures", getSignatures);
app.post("/api/signatures", postSignatures);
app.post("/signatures", postSignatures);

// Catch-all for unknown /api routes only
app.use('/api', (req, res) => {
  res.status(404).json({ 
    error: "API Route not found",
    url: req.url,
    path: req.path,
    method: req.method
  });
});

export default app;
