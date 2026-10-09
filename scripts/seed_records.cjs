const fs = require('fs');
const path = require('path');

const sigBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABWSURBVHhe7c4BDQAwDMCg17/p7mgp9sEDg0AgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCLw3q9EBLQvXoGkAAAAASUVORK5CYII=';

const monitoredLecturers = [
  // Ketua Jabatan (KJs) monitored by TP Dr. Muhaida Akmal binti Mohamad (TP)
  { name: 'Adzli bin Ismail (KJ)', dept: 'Jabatan Pendidikan Islam', course: 'PENDIDIKAN ISLAM', code: 'MPU3312', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Azhar bin Hashim (KJ)', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'AMALAN REKA BENTUK DAN TEKNOLOGI', code: 'RBTS3273', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Abd.Hadi bin Kudin (KJ)', dept: 'Jabatan Pengajian Melayu', course: 'KURIKULUM BAHASA MELAYU SEKOLAH RENDAH', code: 'BMMB3213', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Ajurun Begum binti Ahamed (KJ)', dept: 'Jabatan Bahasa', course: 'GRAMMAR IN CONTEXT', code: 'TSLB1104', credit: '4', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Asmah binti Bohari (KJ)', dept: 'Jabatan Sains', course: 'TRENDS AND ISSUES IN SCIENCE EDUCATION', code: 'SCES1134', credit: '4', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Ellyza binti Karim (KJ)', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN DAN KEPIMPINAN GURU', code: 'EDUP3163', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Muhd Fariz bin Ismail (KJ)', dept: 'Jabatan Ilmu Pendidikan', course: 'PENTAKSIRAN DALAM PENDIDIKAN', code: 'EDUP3153', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Shanty binti Sai en (KJ)', dept: 'Jabatan Sains', course: 'SCIENTIFIC SKILLS AND THE MANAGEMENT OF SCIENCE LABORATORY', code: 'SCES3292', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Zaitun binti Ghazali (KJ)', dept: 'Jabatan Matematik', course: 'COMPUTATIONAL THINKING IN MATHEMATICS', code: 'MTES1142', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)', dept: 'Jabatan Sains Sosial', course: 'SEJARAH ISLAM SEHINGGA ZAMAN KERAJAAN ABBASIYAH', code: 'SJHK3213', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Gurumintarjit Kaur a/p Jangir Singh (KJ)', dept: 'Jabatan Bahasa', course: 'ENGLISH LANGUAGE SKILLS 2', code: 'TSLB3282', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Shamsharizal bin Abd Aziz (KJ)', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', course: 'SUKAN DAN REKREASI', code: 'PSRE1122', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Ts. Dr. Mohamed Nazul bin Ismail (KJ)', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'INOVASI DIGITAL DALAM PENGAJARAN DAN PEMBELAJARAN', code: 'RBTS3342', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Wan Amalia binti Wan Sulaiman (KJ)', dept: 'Jabatan Matematik', course: 'FINANCIAL MATHEMATICS', code: 'MTES3213', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Suzana binti Harun (KJ)', dept: 'Jabatan Pengajian Melayu', course: 'MORFOLOGI BAHASA MELAYU', code: 'BMMB3203', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },

  // Department Lecturers monitored by their respective KJs
  { name: 'Afian Akhbar bin Mustam', dept: 'Jabatan Matematik', course: 'ALGEBRA', code: 'MTES1104', credit: '4', evaluator: 'Wan Amalia binti Wan Sulaiman (KJ)' },
  { name: 'Datin Noor Akmar binti Azlan', dept: 'Jabatan Matematik', course: 'BASIC GEOMETRY', code: 'MTES1114', credit: '4', evaluator: 'Wan Amalia binti Wan Sulaiman (KJ)' },
  { name: 'Dr. Kok Boon Shiong', dept: 'Jabatan Matematik', course: 'PRE CALCULUS', code: 'MTES1124', credit: '4', evaluator: 'Wan Amalia binti Wan Sulaiman (KJ)' },

  { name: 'Ablin a/p Davadason Peter', dept: 'Jabatan Sains', course: 'FUNDAMENTALS OF BIOLOGY II', code: 'SCES1104', credit: '4', evaluator: 'Dr. Asmah binti Bohari (KJ)' },
  { name: 'Dg Bibah binti Ag Tuah', dept: 'Jabatan Sains', course: 'FUNDAMENTALS OF PHYSICS II', code: 'SCES1114', credit: '4', evaluator: 'Dr. Asmah binti Bohari (KJ)' },
  { name: 'Dr. Loh Su Ling', dept: 'Jabatan Sains', course: 'FUNDAMENTALS OF CHEMISTRY II', code: 'SCES1124', credit: '4', evaluator: 'Dr. Asmah binti Bohari (KJ)' },

  { name: 'Bahiyah binti A Talip', dept: 'Jabatan Pendidikan Islam', course: 'PENDIDIKAN ISLAM', code: 'MPU3312', credit: '2', evaluator: 'Adzli bin Ismail (KJ)' },
  { name: 'Dr. Asmah binti Mat Sa ud', dept: 'Jabatan Pendidikan Islam', course: 'KEMAHIRAN BERBAHASA ARAB 1', code: 'BAMB1134', credit: '4', evaluator: 'Adzli bin Ismail (KJ)' },

  { name: 'Anida binti Idrus', dept: 'Jabatan Ilmu Pendidikan', course: 'SOSIOLOGI DALAM PENDIDIKAN', code: 'EDUP2102', credit: '2', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Aniza binti Omar', dept: 'Jabatan Ilmu Pendidikan', course: 'TEKNOLOGI DAN MEDIA PENGAJARAN', code: 'EDUP2112', credit: '2', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Azlin binti Mohd Rosdi', dept: 'Jabatan Ilmu Pendidikan', course: 'PSIKOLOGI PEMBELAJARAN', code: 'EDUP3113', credit: '3', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Dr. Azerai bin Azmi', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN', code: 'EDUP2132', credit: '2', evaluator: 'Dr. Muhd Fariz bin Ismail (KJ)' },

  { name: 'Azlina binti Yacob', dept: 'Jabatan Bahasa', course: 'CHILDREN AND LANGUAGES', code: 'TSLB3293', credit: '3', evaluator: 'Dr. Ajurun Begum binti Ahamed (KJ)' },
  { name: 'Dr. Fauziah binti Ismail', dept: 'Jabatan Bahasa', course: 'THEORY AND PRACTICE IN PRIMARY ENGLISH LANGUAGE TEACHING 1', code: 'TSLB3303', credit: '3', evaluator: 'Dr. Ajurun Begum binti Ahamed (KJ)' },

  { name: 'Dr. Adila binti Md. Hashim', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'ASAS TEKNOLOGI BAHAN DAN PEMBUATAN', code: 'RBTS1104', credit: '4', evaluator: 'Azhar bin Hashim (KJ)' },
  { name: 'Dr. Anusuya a/p Kaliappan', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'TEKNOLOGI ELEKTRIK', code: 'RBTS1124', credit: '4', evaluator: 'Azhar bin Hashim (KJ)' },
  { name: 'Dr. Mohd Ridzuan bin Padzil', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'TEKNOLOGI ELEKTRIK DAN ASAS ROBOTIK', code: 'RBTS3263', credit: '3', evaluator: 'Ts. Dr. Mohamed Nazul bin Ismail (KJ)' },

  { name: 'Ameerul Aswad bin Ab Aziz', dept: 'Jabatan Pengajian Melayu', course: 'KESUSASTERAAN DAN KEBUDAYAAN MELAYU', code: 'BMMB1104', credit: '4', evaluator: 'Dr. Abd.Hadi bin Kudin (KJ)' },
  { name: 'Dr. Gayatri a/p Marimothu', dept: 'Jabatan Pengajian Melayu', course: 'LITERASI BAHASA', code: 'BMMB1124', credit: '4', evaluator: 'Dr. Abd.Hadi bin Kudin (KJ)' },
  { name: 'Dr. Nor Laila binti Md Zain', dept: 'Jabatan Pengajian Melayu', course: 'PENGENALAN SISTEM EJAAN JAWI DAN RUMI', code: 'BMMB1114', credit: '4', evaluator: 'Suzana binti Harun (KJ)' },

  { name: 'Azlina Wati binti Hamdan', dept: 'Jabatan Sains Sosial', course: 'NILAI-NILAI MURNI DARIPADA PERSPEKTIF PELBAGAI AGAMA DAN MASYARAKAT', code: 'ELMK3103', credit: '3', evaluator: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)' },
  { name: 'Dr. Kwan Shwu Shyan', dept: 'Jabatan Sains Sosial', course: 'METODOLOGI PENGAJARAN DAN PEMBELAJARAN PENDIDIKAN MORAL', code: 'ELMK3133', credit: '3', evaluator: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)' },

  { name: 'Che Rohani binti Che Aziz', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', course: 'KOKURIKULUM - OLAHRAGA', code: 'MPU3411', credit: '1', evaluator: 'Shamsharizal bin Abd Aziz (KJ)' },
  { name: 'Zolkeple bin Ibrahim', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', course: 'KOKURIKULUM – UNIT BERUNIFORM KADET REMAJA SEKOLAH I', code: 'MPU3471a', credit: '1', evaluator: 'Shamsharizal bin Abd Aziz (KJ)' }
];

const criteriaKeys = ['1a', '1b', '1c', '1d', '1e', '2a', '2b', '2c', '2d', '2e', '2f', '3a', '3b', '4a', '5a', '6a'];

const now = Date.now();

const records = monitoredLecturers.map((item, index) => {
  const baseTime = now - (index * 86400000 * 2) - 1000000;
  const dateStr = new Date(baseTime).toISOString().split('T')[0];
  
  const scores = {};
  criteriaKeys.forEach((k, kIdx) => {
    scores[k] = (index + kIdx) % 3 === 0 ? 4 : 5;
  });

  return {
    id: 'rec-' + (index + 1) + '-' + baseTime.toString(36),
    timestamp: baseTime,
    campus: 'IPG Kampus Pendidikan Teknik',
    department: item.dept,
    lecturerName: item.name,
    course: item.course,
    code: item.code,
    credit: item.credit,
    date: dateStr,
    evaluatorName: item.evaluator,
    scores: scores,
    itemRemarks: {
      '1a': 'Kandungan menepati RMK sepenuhnya.',
      '2a': 'Aktiviti pengajaran terancang, tersusun dan berkesan.',
      '3a': 'Penglibatan aktif pelajar sangat menggalakkan.',
      '4a': 'Bimbingan dan maklum balas segera diberikan.'
    },
    remarks: 'Pelaksanaan kurikulum berjalan dengan amat berkesan dan menepati piawaian standard LAM-PT-03-04 IPGKPT.',
    lecturerSignature: sigBase64,
    evaluatorSignature: sigBase64
  };
});

const schedules = monitoredLecturers.map((item, index) => {
  const rec = records[index];
  return {
    id: 'sch-' + (index + 1) + '-' + rec.timestamp.toString(36),
    lecturerName: item.name,
    department: item.dept,
    course: item.course,
    code: item.code,
    date: rec.date,
    time: '08:30 - 10:30',
    location: 'Bilik Kuliah / Makmal Pembelajaran',
    timestamp: rec.timestamp,
    status: 'Completed'
  };
});

const upcoming = [
  { lecturerName: 'Dr. Mohammad Izzuan bin Termedi @Termiji', dept: 'Jabatan Matematik', course: 'ALGEBRA', code: 'MTES1104', date: '2026-10-15', time: '09:00 - 11:00', location: 'Makmal Matematik' },
  { lecturerName: 'Dr. Mohd Sukri bin Ma arof', dept: 'Jabatan Ilmu Pendidikan', course: 'PSIKOLOGI PEMBELAJARAN', code: 'EDUP3113', date: '2026-10-18', time: '10:00 - 12:00', location: 'Dewan Kuliah Utama' },
  { lecturerName: 'Tan Sok Phiaw', dept: 'Jabatan Bahasa', course: 'PEDAGOGI KEMAHIRAN MEMBACA', code: 'BCNB3263', date: '2026-10-20', time: '08:00 - 10:00', location: 'Bilik Bahasa' }
].map((u, i) => ({
  id: 'sch-up-' + (i + 1) + '-' + (now + 50000000).toString(36),
  lecturerName: u.lecturerName,
  department: u.dept,
  course: u.course,
  code: u.code,
  date: u.date,
  time: u.time,
  location: u.location,
  timestamp: now + ((i + 1) * 86400000 * 3),
  status: 'Pending'
}));

const allSchedules = [...schedules, ...upcoming];

const signatures = {
  'Dr. Muhaida Akmal binti Mohamad (TP)': sigBase64,
  'Adzli bin Ismail (KJ)': sigBase64,
  'Azhar bin Hashim (KJ)': sigBase64,
  'Dr. Abd.Hadi bin Kudin (KJ)': sigBase64,
  'Dr. Ajurun Begum binti Ahamed (KJ)': sigBase64,
  'Dr. Asmah binti Bohari (KJ)': sigBase64,
  'Dr. Ellyza binti Karim (KJ)': sigBase64,
  'Dr. Muhd Fariz bin Ismail (KJ)': sigBase64,
  'Dr. Shanty binti Sai en (KJ)': sigBase64,
  'Dr. Zaitun binti Ghazali (KJ)': sigBase64,
  'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)': sigBase64,
  'Gurumintarjit Kaur a/p Jangir Singh (KJ)': sigBase64,
  'Shamsharizal bin Abd Aziz (KJ)': sigBase64,
  'Ts. Dr. Mohamed Nazul bin Ismail (KJ)': sigBase64,
  'Wan Amalia binti Wan Sulaiman (KJ)': sigBase64,
  'Suzana binti Harun (KJ)': sigBase64
};

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

fs.writeFileSync(path.join(dataDir, 'initial_records.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(dataDir, 'records.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(dataDir, 'initial_schedules.json'), JSON.stringify(allSchedules, null, 2));
fs.writeFileSync(path.join(dataDir, 'schedules.json'), JSON.stringify(allSchedules, null, 2));
fs.writeFileSync(path.join(dataDir, 'initial_signatures.json'), JSON.stringify(signatures, null, 2));
fs.writeFileSync(path.join(dataDir, 'signatures.json'), JSON.stringify(signatures, null, 2));

console.log('Successfully written ' + records.length + ' monitored records and ' + allSchedules.length + ' schedules.');
