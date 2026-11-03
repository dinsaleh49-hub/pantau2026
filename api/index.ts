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
const DELETED_SCHEDULES_FILE = path.join(DATA_DIR, "deleted_schedules.json");
const DELETED_RECORDS_FILE = path.join(DATA_DIR, "deleted_records.json");
const INITIAL_RECORDS_FILE = path.join(DATA_DIR, "initial_records.json");
const INITIAL_SCHEDULES_FILE = path.join(DATA_DIR, "initial_schedules.json");
const INITIAL_LECTURERS_FILE = path.join(DATA_DIR, "initial_lecturers.json");
const INITIAL_SIGNATURES_FILE = path.join(DATA_DIR, "initial_signatures.json");

if (!fs.existsSync(DATA_DIR) && !process.env.VERCEL) {
  try { 
    fs.mkdirSync(DATA_DIR, { recursive: true }); 
    console.log(`[API] Created data directory: ${DATA_DIR}`);
  } catch (e: any) {
    console.error(`[API] Failed to create data directory: ${e.message}`);
  }
}

// Initialize default files if they don't exist
if (!process.env.VERCEL) {
  try {
    if (!fs.existsSync(RECORDS_FILE) && fs.existsSync(INITIAL_RECORDS_FILE)) {
      fs.copyFileSync(INITIAL_RECORDS_FILE, RECORDS_FILE);
    } else if (!fs.existsSync(RECORDS_FILE)) {
      fs.writeFileSync(RECORDS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(SCHEDULES_FILE) && fs.existsSync(INITIAL_SCHEDULES_FILE)) {
      fs.copyFileSync(INITIAL_SCHEDULES_FILE, SCHEDULES_FILE);
    } else if (!fs.existsSync(SCHEDULES_FILE)) {
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(LECTURERS_FILE) && fs.existsSync(INITIAL_LECTURERS_FILE)) {
      fs.copyFileSync(INITIAL_LECTURERS_FILE, LECTURERS_FILE);
    } else if (!fs.existsSync(LECTURERS_FILE)) {
      fs.writeFileSync(LECTURERS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(SIGNATURES_FILE) && fs.existsSync(INITIAL_SIGNATURES_FILE)) {
      fs.copyFileSync(INITIAL_SIGNATURES_FILE, SIGNATURES_FILE);
    } else if (!fs.existsSync(SIGNATURES_FILE)) {
      fs.writeFileSync(SIGNATURES_FILE, JSON.stringify({}, null, 2));
    }
    if (!fs.existsSync(DELETED_SCHEDULES_FILE)) {
      fs.writeFileSync(DELETED_SCHEDULES_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(DELETED_RECORDS_FILE)) {
      fs.writeFileSync(DELETED_RECORDS_FILE, JSON.stringify([], null, 2));
    }
  } catch (initErr: any) {
    console.warn(`[API] Could not initialize default JSON files:`, initErr.message);
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

// Helper functions for deleted records tombstone persistence across all devices
const getDeletedRecordsList = async (): Promise<string[]> => {
  if (supabase) {
    try {
      const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'deleted_records').maybeSingle();
      if (Array.isArray(data?.content)) {
        if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
          try { fs.writeFileSync(DELETED_RECORDS_FILE, JSON.stringify(data.content, null, 2)); } catch {}
        }
        return data.content;
      }
    } catch (e) {
      console.warn("[API] Supabase read error for deleted_records:", e);
    }
  }
  if (fs.existsSync(DELETED_RECORDS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DELETED_RECORDS_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

const saveDeletedRecordsList = async (ids: string[]): Promise<void> => {
  const uniqueIds = Array.from(new Set(ids));
  if (supabase) {
    try {
      await supabase.from('epantau_storage').upsert({ id: 'deleted_records', content: uniqueIds, updated_at: new Date() });
    } catch (e) {
      console.error("[API] Supabase write error for deleted_records:", e);
    }
  }
  if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
    try {
      fs.writeFileSync(DELETED_RECORDS_FILE, JSON.stringify(uniqueIds, null, 2));
    } catch {}
  }
};

const getDeletedRecords = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const ids = await getDeletedRecordsList();
  res.json(ids);
};

const postDeletedRecords = async (req: any, res: any) => {
  const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : (Array.isArray(req.body) ? req.body : []);
  if (incomingIds.length === 0) {
    return res.json({ success: true, count: 0 });
  }
  const current = await getDeletedRecordsList();
  const merged = Array.from(new Set([...current, ...incomingIds]));
  await saveDeletedRecordsList(merged);
  res.json({ success: true, count: merged.length, deletedIds: merged });
};

const getRecords = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const deletedIds = new Set(await getDeletedRecordsList());

  if (supabase) {
    try {
      const { data, error } = await supabase.from('epantau_storage').select('content').eq('id', 'records').maybeSingle();
      if (error) {
        console.error("[API] Supabase error fetching records:", error);
        throw error;
      }
      const recs = data?.content;
      if (Array.isArray(recs) && recs.length > 0) {
        const cleaned = recs.filter((r: any) => r && r.id && !deletedIds.has(r.id) && r.id !== '9x1p9rsg7');
        if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
          try {
            fs.writeFileSync(RECORDS_FILE, JSON.stringify(cleaned, null, 2));
          } catch {}
        }
        return res.json(cleaned);
      }
      // If Supabase returned empty, restore from initial_records.json (73 records)
      if (fs.existsSync(INITIAL_RECORDS_FILE)) {
        const initial = JSON.parse(fs.readFileSync(INITIAL_RECORDS_FILE, "utf-8"));
        if (Array.isArray(initial) && initial.length > 0) {
          const cleaned = initial.filter((r: any) => r && r.id && !deletedIds.has(r.id) && r.id !== '9x1p9rsg7');
          console.log("[API] Seeding Supabase records with initial records (excluding deleted)...");
          try {
            await supabase.from('epantau_storage').upsert({ id: 'records', content: cleaned, updated_at: new Date() });
          } catch (upsertErr) {
            console.error("[API] Error seeding Supabase records:", upsertErr);
          }
          return res.json(cleaned);
        }
      }
      return res.json([]);
    } catch (err: any) {
      console.error("[API] Exception fetching records from Supabase:", err);
      if (fs.existsSync(RECORDS_FILE)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(RECORDS_FILE, "utf-8"));
          if (Array.isArray(parsed)) {
            return res.json(parsed.filter((r: any) => r && r.id && !deletedIds.has(r.id)));
          }
        } catch {}
      }
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(RECORDS_FILE)) {
        const content = fs.readFileSync(RECORDS_FILE, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return res.json(parsed.filter((r: any) => r && r.id && !deletedIds.has(r.id)));
        }
      }
      if (fs.existsSync(INITIAL_RECORDS_FILE)) {
        const initial = JSON.parse(fs.readFileSync(INITIAL_RECORDS_FILE, "utf-8"));
        return res.json(initial.filter((r: any) => r && r.id && !deletedIds.has(r.id)));
      }
      res.json([]);
    } catch (e: any) { 
      console.error("[API] Error reading local records file:", e);
      res.json([]); 
    }
  }
};

const postRecords = async (req: any, res: any) => {
  const body = req.body;

  // Case A: Chunked upload of records (guarantees payload stays well under Vercel's 4.5MB limit)
  if (body && body.action === 'chunk') {
    const { batchId, chunkIndex, totalChunks, records: chunkRecords } = body;
    console.log(`[API] POST /api/records - Processing chunk ${chunkIndex + 1}/${totalChunks} (batch: ${batchId}, items: ${chunkRecords?.length || 0})`);

    if (!Array.isArray(chunkRecords)) {
      return res.status(400).json({ error: "Chunk records must be an array" });
    }

    if (supabase) {
      try {
        const chunkRowId = `records_chunk_${batchId}_${chunkIndex}`;
        const { error: chunkErr } = await supabase.from('epantau_storage').upsert({
          id: chunkRowId,
          content: chunkRecords,
          updated_at: new Date()
        });
        if (chunkErr) throw chunkErr;

        // If this is the final chunk, assemble all chunks into the canonical 'records' row
        if (chunkIndex === totalChunks - 1) {
          console.log(`[API] Final chunk received. Assembling all ${totalChunks} chunks for batch ${batchId}...`);
          const { data: chunkRows, error: fetchErr } = await supabase
            .from('epantau_storage')
            .select('id, content')
            .like('id', `records_chunk_${batchId}_%`);
          
          if (fetchErr) throw fetchErr;

          const sortedChunks = (chunkRows || []).sort((a: any, b: any) => {
            const idxA = parseInt(a.id.split('_').pop() || '0', 10);
            const idxB = parseInt(b.id.split('_').pop() || '0', 10);
            return idxA - idxB;
          });

          const assembledRecords: any[] = [];
          for (const c of sortedChunks) {
            if (Array.isArray(c.content)) {
              assembledRecords.push(...c.content);
            }
          }

          if (assembledRecords.length > 0) {
            await supabase.from('epantau_storage').upsert({
              id: 'records',
              content: assembledRecords,
              updated_at: new Date()
            });

            if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
              try {
                fs.writeFileSync(RECORDS_FILE, JSON.stringify(assembledRecords, null, 2));
              } catch {}
            }

            // Cleanup temp chunk rows asynchronously
            const idsToDelete = sortedChunks.map((c: any) => c.id);
            if (idsToDelete.length > 0) {
              try {
                await supabase.from('epantau_storage').delete().in('id', idsToDelete);
              } catch (cleanErr) {
                console.warn("[API] Could not delete temp chunks:", cleanErr);
              }
            }

            console.log(`[API] Successfully assembled and saved ${assembledRecords.length} records into Supabase.`);
            return res.json({ success: true, count: assembledRecords.length, completed: true });
          }
        }

        return res.json({ success: true, chunkIndex, totalChunks, completed: false });
      } catch (sbErr: any) {
        console.error("[API] Error in Supabase chunk processing:", sbErr);
        return res.status(500).json({ error: sbErr.message });
      }
    } else {
      // Local dev file-based chunking
      try {
        const tempChunkFile = path.join(DATA_DIR, `.chunk_${batchId}_${chunkIndex}.json`);
        fs.writeFileSync(tempChunkFile, JSON.stringify(chunkRecords));

        if (chunkIndex === totalChunks - 1) {
          const assembledRecords: any[] = [];
          for (let i = 0; i < totalChunks; i++) {
            const f = path.join(DATA_DIR, `.chunk_${batchId}_${i}.json`);
            if (fs.existsSync(f)) {
              try {
                assembledRecords.push(...JSON.parse(fs.readFileSync(f, 'utf-8')));
                fs.unlinkSync(f);
              } catch {}
            }
          }
          if (assembledRecords.length > 0) {
            fs.writeFileSync(RECORDS_FILE, JSON.stringify(assembledRecords, null, 2));
            console.log(`[API] Successfully assembled ${assembledRecords.length} records locally.`);
            return res.json({ success: true, count: assembledRecords.length, completed: true });
          }
        }
        return res.json({ success: true, chunkIndex, totalChunks, completed: false });
      } catch (localErr: any) {
        console.error("[API] Error in local chunk processing:", localErr);
        return res.status(500).json({ error: localErr.message });
      }
    }
  }

  // Case B: Upsert single record (super fast and lightweight)
  if (body && body.action === 'upsert_record' && body.record) {
    const singleRecord = body.record;
    console.log(`[API] POST /api/records - Upserting single record ID: ${singleRecord.id} (${singleRecord.lecturerName})`);

    let currentRecords: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'records').maybeSingle();
        if (Array.isArray(data?.content)) {
          currentRecords = [...data.content];
        }
      } catch (err: any) {
        console.warn("[API] Could not fetch current records for single upsert:", err);
      }
    }
    if (currentRecords.length === 0 && fs.existsSync(RECORDS_FILE)) {
      try {
        currentRecords = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
      } catch {}
    }
    if (currentRecords.length === 0 && fs.existsSync(INITIAL_RECORDS_FILE)) {
      try {
        currentRecords = JSON.parse(fs.readFileSync(INITIAL_RECORDS_FILE, 'utf-8'));
      } catch {}
    }

    // If this record was previously marked as deleted, unmark it so it can be saved/updated
    const currentDeleted = await getDeletedRecordsList();
    if (currentDeleted.includes(singleRecord.id)) {
      await saveDeletedRecordsList(currentDeleted.filter(id => id !== singleRecord.id));
    }

    const recIdx = currentRecords.findIndex((r: any) => r.id === singleRecord.id);
    if (recIdx !== -1) {
      currentRecords[recIdx] = singleRecord;
    } else {
      currentRecords.unshift(singleRecord);
    }

    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'records', content: currentRecords, updated_at: new Date() });
      } catch (err: any) {
        console.error("[API] Error saving upserted record to Supabase:", err);
        return res.status(500).json({ error: err.message });
      }
    }
    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      try {
        fs.writeFileSync(RECORDS_FILE, JSON.stringify(currentRecords, null, 2));
      } catch {}
    }
    return res.json({ success: true, count: currentRecords.length });
  }

  // Case C: Delete single or multiple records
  if (body && ((body.action === 'delete_record' && body.id) || (body.action === 'delete_records' && Array.isArray(body.ids)))) {
    const idsToDelete = new Set<string>(
      body.action === 'delete_records' && Array.isArray(body.ids) ? body.ids : [body.id]
    );
    console.log(`[API] POST /api/records - Deleting ${idsToDelete.size} records and updating tombstones...`);

    // Persist deleted IDs to deleted_records tombstone so they never resurrect across devices
    const currentDeleted = await getDeletedRecordsList();
    const updatedDeleted = Array.from(new Set([...currentDeleted, ...Array.from(idsToDelete)]));
    await saveDeletedRecordsList(updatedDeleted);

    let currentRecords: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'records').maybeSingle();
        if (Array.isArray(data?.content)) {
          currentRecords = [...data.content];
        }
      } catch (err: any) {}
    }
    if (currentRecords.length === 0 && fs.existsSync(RECORDS_FILE)) {
      try {
        currentRecords = JSON.parse(fs.readFileSync(RECORDS_FILE, 'utf-8'));
      } catch {}
    }

    const filtered = currentRecords.filter((r: any) => !idsToDelete.has(r.id));

    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'records', content: filtered, updated_at: new Date() });
      } catch (err: any) {}
    }
    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      try {
        fs.writeFileSync(RECORDS_FILE, JSON.stringify(filtered, null, 2));
      } catch {}
    }
    return res.json({ success: true, count: filtered.length, deletedCount: idsToDelete.size });
  }

  // Case D: Standard array of records
  const deletedIds = new Set(await getDeletedRecordsList());
  const incomingRecords = Array.isArray(body) ? body : [];
  const records = incomingRecords.filter((r: any) => r && r.id && !deletedIds.has(r.id));
  const count = records.length;
  console.log(`[API] POST /api/records - Saving ${count} records (full array, excluding deleted tombstones)...`);
  
  if (!Array.isArray(records)) {
    console.error("[API] Invalid records payload: not an array");
    return res.status(400).json({ error: "Payload must be an array of records or chunk object" });
  }

  // Prevent accidental wipe with empty array
  if (count === 0) {
    console.warn("[API] Ignored empty records save request to protect existing 73 records");
    return res.json({ success: true, message: "Ignored empty payload to protect existing data" });
  }

  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'records', content: records, updated_at: new Date() });
      if (error) {
        console.error("[API] Supabase error saving records:", error);
        return res.status(500).json({ error: error.message });
      }
      console.log("[API] Records saved to Supabase.");
      if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
        try {
          fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
        } catch {}
      }
      res.json({ success: true, count });
    } catch (err: any) {
      console.error("[API] Exception saving records to Supabase:", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    try {
      fs.writeFileSync(RECORDS_FILE, JSON.stringify(records, null, 2));
      console.log(`[API] Records saved to local file: ${RECORDS_FILE}`);
      res.json({ success: true, count });
    } catch (err: any) {
      console.error("[API] Error writing local records file:", err);
      res.status(500).json({ error: `Failed to write file: ${err.message}` });
    }
  }
};

// Helper functions for deleted schedules tombstone persistence
const getDeletedSchedulesList = async (): Promise<string[]> => {
  if (supabase) {
    try {
      const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'deleted_schedules').maybeSingle();
      if (Array.isArray(data?.content)) {
        if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
          try { fs.writeFileSync(DELETED_SCHEDULES_FILE, JSON.stringify(data.content, null, 2)); } catch {}
        }
        return data.content;
      }
    } catch (e) {
      console.warn("[API] Supabase read error for deleted_schedules:", e);
    }
  }
  if (fs.existsSync(DELETED_SCHEDULES_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DELETED_SCHEDULES_FILE, 'utf-8'));
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
};

const saveDeletedSchedulesList = async (ids: string[]): Promise<void> => {
  const uniqueIds = Array.from(new Set(ids));
  if (supabase) {
    try {
      await supabase.from('epantau_storage').upsert({ id: 'deleted_schedules', content: uniqueIds, updated_at: new Date() });
    } catch (e) {
      console.error("[API] Supabase write error for deleted_schedules:", e);
    }
  }
  if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
    try {
      fs.writeFileSync(DELETED_SCHEDULES_FILE, JSON.stringify(uniqueIds, null, 2));
    } catch {}
  }
};

const getDeletedSchedules = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const ids = await getDeletedSchedulesList();
  res.json(ids);
};

const postDeletedSchedules = async (req: any, res: any) => {
  const incomingIds = Array.isArray(req.body?.ids) ? req.body.ids : (Array.isArray(req.body) ? req.body : []);
  if (incomingIds.length === 0) {
    return res.json({ success: true, count: 0 });
  }
  const current = await getDeletedSchedulesList();
  const merged = Array.from(new Set([...current, ...incomingIds]));
  await saveDeletedSchedulesList(merged);
  res.json({ success: true, count: merged.length, deletedIds: merged });
};

const getSchedules = async (req: any, res: any) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const deletedIds = new Set(await getDeletedSchedulesList());

  if (supabase) {
    try {
      const { data, error } = await supabase.from('epantau_storage').select('content').eq('id', 'schedules').maybeSingle();
      if (error) throw error;
      
      // If the row exists in Supabase (even if empty []), respect user deletion!
      if (data && Array.isArray(data.content)) {
        const cleaned = data.content.filter((s: any) => s && s.id && !deletedIds.has(s.id));
        if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
          try {
            fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(cleaned, null, 2));
          } catch {}
        }
        return res.json(cleaned);
      }
      
      // Only seed initial if row has NEVER been created in Supabase
      if (!data && fs.existsSync(INITIAL_SCHEDULES_FILE)) {
        const initial = JSON.parse(fs.readFileSync(INITIAL_SCHEDULES_FILE, "utf-8"));
        if (Array.isArray(initial) && initial.length > 0) {
          const cleaned = initial.filter((s: any) => s && s.id && !deletedIds.has(s.id));
          try {
            await supabase.from('epantau_storage').upsert({ id: 'schedules', content: cleaned, updated_at: new Date() });
          } catch (upsertErr) {
            console.error("[API] Error seeding Supabase schedules:", upsertErr);
          }
          return res.json(cleaned);
        }
      }
      return res.json([]);
    } catch (err: any) {
      if (fs.existsSync(SCHEDULES_FILE)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(SCHEDULES_FILE, "utf-8"));
          if (Array.isArray(parsed)) {
            return res.json(parsed.filter((s: any) => s && s.id && !deletedIds.has(s.id)));
          }
        } catch {}
      }
      return res.status(500).json({ error: err.message });
    }
  } else {
    try {
      if (fs.existsSync(SCHEDULES_FILE)) {
        const content = fs.readFileSync(SCHEDULES_FILE, "utf-8");
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return res.json(parsed.filter((s: any) => s && s.id && !deletedIds.has(s.id)));
        }
      }
      if (fs.existsSync(INITIAL_SCHEDULES_FILE)) {
        const initial = JSON.parse(fs.readFileSync(INITIAL_SCHEDULES_FILE, "utf-8"));
        return res.json(initial.filter((s: any) => s && s.id && !deletedIds.has(s.id)));
      }
      res.json([]);
    } catch (e) { res.json([]); }
  }
};

const postSchedules = async (req: any, res: any) => {
  const body = req.body;
  const deletedIdsList = await getDeletedSchedulesList();
  const deletedSet = new Set(deletedIdsList);

  // Case A: Single schedule upsert/update (fast and direct)
  if (body && body.action === 'upsert_schedule' && body.schedule) {
    const single = body.schedule;
    console.log(`[API] POST /api/schedules - Direct upsert for schedule ID: ${single.id} (${single.lecturerName})`);
    
    // Revive if it was previously in deleted list
    if (deletedSet.has(single.id)) {
      deletedSet.delete(single.id);
      await saveDeletedSchedulesList(Array.from(deletedSet));
    }

    let currentSchedules: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'schedules').maybeSingle();
        if (Array.isArray(data?.content)) currentSchedules = [...data.content];
      } catch (err) {}
    }
    if (currentSchedules.length === 0 && fs.existsSync(SCHEDULES_FILE)) {
      try { currentSchedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8')); } catch {}
    }

    const idx = currentSchedules.findIndex((s: any) => s.id === single.id);
    if (idx !== -1) {
      currentSchedules[idx] = single;
    } else {
      currentSchedules.unshift(single);
    }

    // Filter against tombstones
    currentSchedules = currentSchedules.filter((s: any) => s && s.id && !deletedSet.has(s.id));

    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'schedules', content: currentSchedules, updated_at: new Date() });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      try { fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(currentSchedules, null, 2)); } catch {}
    }
    return res.json({ success: true, count: currentSchedules.length });
  }

  // Case B: Delete single, multiple, or all schedules
  if (body && (
    (body.action === 'delete_schedule' && body.id) || 
    (body.action === 'delete_schedules' && Array.isArray(body.ids)) ||
    (body.action === 'delete_all_schedules' || body.action === 'clear_all_schedules')
  )) {
    let currentSchedules: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'schedules').maybeSingle();
        if (Array.isArray(data?.content)) currentSchedules = [...data.content];
      } catch (err) {}
    }
    if (currentSchedules.length === 0 && fs.existsSync(SCHEDULES_FILE)) {
      try { currentSchedules = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf-8')); } catch {}
    }

    const idsToDelete = new Set<string>();
    if (body.action === 'delete_schedule' && body.id) {
      idsToDelete.add(body.id);
    } else if (body.action === 'delete_schedules' && Array.isArray(body.ids)) {
      body.ids.forEach((id: string) => idsToDelete.add(id));
    } else if (body.action === 'delete_all_schedules' || body.action === 'clear_all_schedules') {
      currentSchedules.forEach((s: any) => { if (s?.id) idsToDelete.add(s.id); });
      if (Array.isArray(body.ids)) {
        body.ids.forEach((id: string) => idsToDelete.add(id));
      }
    }

    console.log(`[API] POST /api/schedules - Registering ${idsToDelete.size} deleted schedules in tombstones...`);

    // Add to persistent deleted_schedules tombstone set
    idsToDelete.forEach(id => deletedSet.add(id));
    await saveDeletedSchedulesList(Array.from(deletedSet));

    const filtered = currentSchedules.filter((s: any) => !idsToDelete.has(s.id));
    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'schedules', content: filtered, updated_at: new Date() });
      } catch (err: any) {}
    }
    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      try { fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(filtered, null, 2)); } catch {}
    }
    return res.json({ success: true, count: filtered.length, deletedCount: idsToDelete.size, deletedIds: Array.from(deletedSet) });
  }

  // Case C: Standard array of schedules
  const schedules = body;
  if (!Array.isArray(schedules)) {
    return res.status(400).json({ error: "Payload must be an array of schedules" });
  }

  // Filter out any schedules that are in the deleted tombstones list
  const sanitizedSchedules = schedules.filter((s: any) => s && s.id && !deletedSet.has(s.id));
  const count = sanitizedSchedules.length;
  console.log(`[API] POST /api/schedules - Saving ${count} active schedules (filtered against ${deletedSet.size} deleted IDs)...`);

  if (supabase) {
    try {
      const { error } = await supabase.from('epantau_storage').upsert({ id: 'schedules', content: sanitizedSchedules, updated_at: new Date() });
      if (error) {
        console.error("[API] Supabase error saving schedules:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true, count });
    } catch (err: any) {
      console.error("[API] Exception saving schedules to Supabase:", err);
      res.status(500).json({ error: err.message });
    }
  } else {
    if (process.env.VERCEL) return res.status(503).json({ error: "Supabase required for Vercel persistence" });
    try {
      fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(sanitizedSchedules, null, 2));
      console.log(`[API] Schedules saved to local file: ${SCHEDULES_FILE}`);
      res.json({ success: true, count });
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
  const body = req.body;

  // Single lecturer upsert/update (fast and direct)
  if (body && body.action === 'upsert_lecturer' && body.lecturer) {
    const single = body.lecturer;
    const oldName = body.oldName || single.name;
    const oldDept = body.oldDept || single.department;
    console.log(`[API] POST /api/lecturers - Direct upsert for lecturer: ${single.name} (${single.department})`);
    let currentLecturers: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'lecturers').maybeSingle();
        if (Array.isArray(data?.content)) currentLecturers = [...data.content];
      } catch (err) {}
    }
    if (currentLecturers.length === 0 && fs.existsSync(LECTURERS_FILE)) {
      try { currentLecturers = JSON.parse(fs.readFileSync(LECTURERS_FILE, 'utf-8')); } catch {}
    }
    if (currentLecturers.length === 0 && fs.existsSync(INITIAL_LECTURERS_FILE)) {
      try { currentLecturers = JSON.parse(fs.readFileSync(INITIAL_LECTURERS_FILE, 'utf-8')); } catch {}
    }

    const idx = currentLecturers.findIndex((l: any) => 
      (l.name.toLowerCase() === oldName.toLowerCase() && l.department === oldDept) ||
      (l.name.toLowerCase() === single.name.toLowerCase() && l.department === single.department)
    );
    if (idx !== -1) {
      currentLecturers[idx] = single;
    } else {
      currentLecturers.push(single);
    }

    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'lecturers', content: currentLecturers, updated_at: new Date() });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      try { fs.writeFileSync(LECTURERS_FILE, JSON.stringify(currentLecturers, null, 2)); } catch {}
    }
    return res.json({ success: true, count: currentLecturers.length });
  }

  // Delete one or multiple lecturers
  if (body && ((body.action === 'delete_lecturers' && Array.isArray(body.lecturers)) || (body.action === 'delete_lecturer' && body.name))) {
    const toDeleteList: any[] = body.action === 'delete_lecturer' 
      ? [{ name: body.name, department: body.department }] 
      : body.lecturers;
    const deleteKeys = new Set(toDeleteList.map((t: any) => `${(t.name || '').trim().toLowerCase()}|${(t.department || '').trim().toLowerCase()}`));
    const deleteNames = new Set(toDeleteList.map((t: any) => (t.name || '').trim().toLowerCase()));

    console.log(`[API] POST /api/lecturers - Deleting ${toDeleteList.length} lecturers...`);
    let currentLecturers: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase.from('epantau_storage').select('content').eq('id', 'lecturers').maybeSingle();
        if (Array.isArray(data?.content)) currentLecturers = [...data.content];
      } catch (err) {}
    }
    if (currentLecturers.length === 0 && fs.existsSync(LECTURERS_FILE)) {
      try { currentLecturers = JSON.parse(fs.readFileSync(LECTURERS_FILE, 'utf-8')); } catch {}
    }
    if (currentLecturers.length === 0 && fs.existsSync(INITIAL_LECTURERS_FILE)) {
      try { currentLecturers = JSON.parse(fs.readFileSync(INITIAL_LECTURERS_FILE, 'utf-8')); } catch {}
    }

    currentLecturers = currentLecturers.filter((l: any) => {
      const key = `${(l.name || '').trim().toLowerCase()}|${(l.department || '').trim().toLowerCase()}`;
      const name = (l.name || '').trim().toLowerCase();
      return !deleteKeys.has(key) && !deleteNames.has(name);
    });

    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'lecturers', content: currentLecturers, updated_at: new Date() });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      try { fs.writeFileSync(LECTURERS_FILE, JSON.stringify(currentLecturers, null, 2)); } catch {}
    }
    return res.json({ success: true, count: currentLecturers.length });
  }

  const lecturers = body;
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

const postRestore = async (req: any, res: any) => {
  try {
    console.log("[API] POST /api/restore - Restoring 73 monitored lecturer records dated 7.10.2026...");
    if (!fs.existsSync(INITIAL_RECORDS_FILE)) {
      return res.status(500).json({ error: "Fail initial_records.json tidak ditemui" });
    }
    const initialRecords = JSON.parse(fs.readFileSync(INITIAL_RECORDS_FILE, "utf-8"));
    const initialSchedules = fs.existsSync(INITIAL_SCHEDULES_FILE)
      ? JSON.parse(fs.readFileSync(INITIAL_SCHEDULES_FILE, "utf-8"))
      : [];

    // Clear deleted tombstones so restored schedules and records can be viewed on all devices
    await saveDeletedSchedulesList([]);
    await saveDeletedRecordsList([]);

    if (!process.env.VERCEL && fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(RECORDS_FILE, JSON.stringify(initialRecords, null, 2));
      if (initialSchedules.length > 0) {
        fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(initialSchedules, null, 2));
      }
    }

    if (supabase) {
      try {
        await supabase.from('epantau_storage').upsert({ id: 'records', content: initialRecords, updated_at: new Date() });
        if (initialSchedules.length > 0) {
          await supabase.from('epantau_storage').upsert({ id: 'schedules', content: initialSchedules, updated_at: new Date() });
        }
        await supabase.from('epantau_storage').upsert({ id: 'deleted_schedules', content: [], updated_at: new Date() });
        await supabase.from('epantau_storage').upsert({ id: 'deleted_records', content: [], updated_at: new Date() });
        console.log("[API] Records and schedules successfully restored to Supabase.");
      } catch (sbErr: any) {
        console.error("[API] Error restoring records to Supabase:", sbErr);
      }
    }

    res.json({
      success: true,
      recordsCount: initialRecords.length,
      schedulesCount: initialSchedules.length,
      message: `Berjaya memulihkan ${initialRecords.length} rekod pemantauan pensyarah (7.10.2026).`
    });
  } catch (err: any) {
    console.error("[API] Exception in restore:", err);
    res.status(500).json({ error: err.message });
  }
};

// Register routes with and without /api prefix
app.get("/api/health", getHealth);
app.get("/health", getHealth);

app.post("/api/restore", postRestore);
app.post("/restore", postRestore);

app.post("/api/gemini/summary", postGeminiSummary);
app.post("/gemini/summary", postGeminiSummary);

app.get("/api/records", getRecords);
app.get("/records", getRecords);
app.post("/api/records", postRecords);
app.post("/records", postRecords);

app.get("/api/deleted-records", getDeletedRecords);
app.get("/deleted-records", getDeletedRecords);
app.post("/api/deleted-records", postDeletedRecords);
app.post("/deleted-records", postDeletedRecords);

app.get("/api/schedules", getSchedules);
app.get("/schedules", getSchedules);
app.post("/api/schedules", postSchedules);
app.post("/schedules", postSchedules);

app.get("/api/deleted-schedules", getDeletedSchedules);
app.get("/deleted-schedules", getDeletedSchedules);
app.post("/api/deleted-schedules", postDeletedSchedules);
app.post("/deleted-schedules", postDeletedSchedules);

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
