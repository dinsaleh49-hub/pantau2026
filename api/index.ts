import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { createClient } from '@supabase/supabase-js';

const app = express();

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper for local file paths (only used in local dev)
const DATA_DIR = path.join(process.cwd(), "data");
const RECORDS_FILE = path.join(DATA_DIR, "records.json");
const SCHEDULES_FILE = path.join(DATA_DIR, "schedules.json");

if (!fs.existsSync(DATA_DIR) && !process.env.VERCEL) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
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
  res.json({ 
    status: "ok", 
    persistence: supabase ? "supabase" : "local_file",
    supabase_status: supabaseStatus,
    supabase_error: supabaseError,
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
      if (error) throw error;
      return res.json(data?.content || []);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(RECORDS_FILE)) {
        return res.json(JSON.parse(fs.readFileSync(RECORDS_FILE, "utf-8")));
      }
      res.json([]);
    } catch (e) { res.json([]); }
  }
};

const postRecords = async (req: any, res: any) => {
  const records = req.body;
  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'records', content: records, updated_at: new Date() });
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
    res.json({ success: true });
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
  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'schedules', content: schedules, updated_at: new Date() });
      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(schedules, null, 2));
    res.json({ success: true });
  }
};

// Register routes with and without /api prefix
app.get("/api/health", getHealth);
app.get("/health", getHealth);

app.get("/api/records", getRecords);
app.get("/records", getRecords);
app.post("/api/records", postRecords);
app.post("/records", postRecords);

app.get("/api/schedules", getSchedules);
app.get("/schedules", getSchedules);
app.post("/api/schedules", postSchedules);
app.post("/schedules", postSchedules);

// Catch-all for API function
app.use((req, res) => {
  res.status(404).json({ 
    error: "API Route not found",
    url: req.url,
    path: req.path,
    method: req.method
  });
});

export default app;
