const fs = require('fs');
const path = require('path');

const recs = fs.readFileSync(path.join(__dirname, '../data/initial_records.json'), 'utf8');
const scheds = fs.readFileSync(path.join(__dirname, '../data/initial_schedules.json'), 'utf8');
const sigs = fs.readFileSync(path.join(__dirname, '../data/initial_signatures.json'), 'utf8');

const content = "import { EvaluationRecord, MonitoringSchedule } from './types';\n\n" +
  "export const INITIAL_RECORDS: EvaluationRecord[] = " + recs + ";\n\n" +
  "export const INITIAL_SCHEDULES: MonitoringSchedule[] = " + scheds + ";\n\n" +
  "export const INITIAL_SIGNATURES: Record<string, string> = " + sigs + ";\n";

fs.writeFileSync(path.join(__dirname, '../initialData.ts'), content);
console.log('Successfully created initialData.ts, size: ' + content.length);
