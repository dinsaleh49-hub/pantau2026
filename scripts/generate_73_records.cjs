const fs = require('fs');
const path = require('path');

const sigBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABWSURBVHhe7c4BDQAwDMCg17/p7mgp9sEDg0AgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCAQCgUAgEAgEAoFAIBAIBAKBQCAQCLw3q9EBLQvXoGkAAAAASUVORK5CYII=';

// Read all lecturers
const allLecturers = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/lecturers.json'), 'utf8'));

// Existing 39 monitored lecturers from seed_records
const existingMonitored = [
  { name: 'Adzli bin Ismail (KJ)', dept: 'Jabatan Pendidikan Islam', course: 'PENDIDIKAN ISLAM', code: 'MPU3312', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Azhar bin Hashim (KJ)', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'AMALAN REKA BENTUK DAN TEKNOLOGI', code: 'RBTS3273', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Abd.Hadi bin Kudin (KJ)', dept: 'Jabatan Pengajian Melayu', course: 'KURIKULUM BAHASA MELAYU SEKOLAH RENDAH', code: 'BMMB3213', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Ajurun Begum binti Ahamed (KJ)', dept: 'Jabatan Bahasa', course: 'GRAMMAR IN CONTEXT', code: 'TSLB1104', credit: '4', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Asmah binti Bohari (KJ)', dept: 'Jabatan Sains', course: 'TRENDS AND ISSUES IN SCIENCE EDUCATION', code: 'SCES1134', credit: '4', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Ellyza binti Karim (KJ)', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN DAN KEPIMPINAN GURU', code: 'EDUP3163', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Muhd Fariz bin Ismail (KJ)', dept: 'Jabatan Ilmu Pendidikan', course: 'PENTAKSIRAN DALAM PENDIDIKAN', code: 'EDUP3153', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Shanty binti Sai en (KJ)', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'INOVASI DIGITAL DALAM PENGAJARAN DAN PEMBELAJARAN', code: 'RBTS3342', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Zaitun binti Ghazali (KJ)', dept: 'Jabatan Sains', course: 'SCIENTIFIC SKILLS AND THE MANAGEMENT OF SCIENCE LABORATORY', code: 'SCES3292', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)', dept: 'Jabatan Pendidikan Islam', course: 'PENGANTAR ULUM AL-QURAN DAN ULUM AL-HADIS', code: 'PIMK1104', credit: '4', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Gurumintarjit Kaur a/p Jangir Singh (KJ)', dept: 'Jabatan Sains Sosial', course: 'SEJARAH ISLAM SEHINGGA ZAMAN KERAJAAN ABBASIYAH', code: 'SJHK3213', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Shamsharizal bin Abd Aziz (KJ)', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', course: 'SUKAN DAN REKREASI', code: 'PSRE1122', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Ts. Dr. Mohamed Nazul bin Ismail (KJ)', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN DAN KEPIMPINAN GURU', code: 'EDUP3163', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Wan Amalia binti Wan Sulaiman (KJ)', dept: 'Jabatan Matematik', course: 'FINANCIAL MATHEMATICS', code: 'MTES3213', credit: '3', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Suzana binti Harun (KJ)', dept: 'Jabatan Pendidikan Islam', course: 'PENDIDIKAN ISLAM', code: 'MPU3312', credit: '2', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
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

// 34 Additional monitored lecturers across departments to reach 73
const additionalMonitored = [
  // Jabatan Pendidikan Islam (5 more -> 8 total)
  { name: 'Dr. Zurina binti Mustaffa', dept: 'Jabatan Pendidikan Islam', course: 'AKIDAH ISLAMIAH', code: 'PIMK3423', credit: '3', evaluator: 'Adzli bin Ismail (KJ)' },
  { name: 'Khairullah bin Mokhtar', dept: 'Jabatan Pendidikan Islam', course: 'PENGAJIAN AKHLAK ISLAMIAH', code: 'PIMK3243', credit: '3', evaluator: 'Adzli bin Ismail (KJ)' },
  { name: 'Mohamad Raffe bin Ghalil Abbas', dept: 'Jabatan Pendidikan Islam', course: 'PENGANTAR ULUM AL-QURAN DAN ULUM AL-HADIS', code: 'PIMK1104', credit: '4', evaluator: 'Dr. Muhaida Akmal binti Mohamad (TP)' },
  { name: 'Mohd Zainal Abidin bin Che Mood', dept: 'Jabatan Pendidikan Islam', course: 'PENGAJIAN HADIS', code: 'PIMK3253', credit: '3', evaluator: 'Adzli bin Ismail (KJ)' },
  { name: 'Noor Aziah binti Mohd Noor', dept: 'Jabatan Pendidikan Islam', course: 'PENGAJIAN KURIKULUM DAN PENTAKSIRAN PENDIDIKAN ISLAM SEKOLAH RENDAH', code: 'PIMK3263', credit: '3', evaluator: 'Adzli bin Ismail (KJ)' },

  // Jabatan Sains (3 more -> 8 total)
  { name: 'Dr. Syakima Ilyana binti Ibrahim', dept: 'Jabatan Sains', course: 'FUNDAMENTALS OF RESEARCH IN SCIENCE EDUCATION', code: 'SCES3283', credit: '3', evaluator: 'Dr. Asmah binti Bohari (KJ)' },
  { name: 'Fawarni binti Ahmad', dept: 'Jabatan Sains', course: 'FUNDAMENTALS OF BIOLOGY II', code: 'SCES1104', credit: '4', evaluator: 'Dr. Asmah binti Bohari (KJ)' },
  { name: 'Govindan a/l Kanapathy', dept: 'Jabatan Sains', course: 'SCIENTIFIC SKILLS AND THE MANAGEMENT OF SCIENCE LABORATORY', code: 'SCES3292', credit: '2', evaluator: 'Dr. Asmah binti Bohari (KJ)' },

  // Jabatan Matematik (3 more -> 8 total)
  { name: 'Dr. Mohammad Izzuan bin Termedi @Termiji', dept: 'Jabatan Matematik', course: 'TEACHING AND ASSESSMENT OF NUMBERS AND OPERATIONS, RELATIONSHIP AND ALGEBRA', code: 'MTES3243', credit: '3', evaluator: 'Wan Amalia binti Wan Sulaiman (KJ)' },
  { name: 'Dr. Shamila Dewi a/p Davadas', dept: 'Jabatan Matematik', course: 'FUNDAMENTALS OF MATHEMATICS EDUCATIONAL RESEARCH', code: 'MTES3263', credit: '3', evaluator: 'Wan Amalia binti Wan Sulaiman (KJ)' },
  { name: 'Dr. Vani a/p Perumal', dept: 'Jabatan Matematik', course: 'APPRECIATION OF MATHEMATICS', code: 'MTES1132', credit: '2', evaluator: 'Wan Amalia binti Wan Sulaiman (KJ)' },

  // Jabatan Pengajian Melayu (2 more -> 7 total)
  { name: 'Dr. Siti Rahayu binti Muhammad', dept: 'Jabatan Pengajian Melayu', course: 'KESANTUNAN BERBAHASA', code: 'BMMB1144', credit: '4', evaluator: 'Dr. Abd.Hadi bin Kudin (KJ)' },
  { name: 'Faridah binti Mohamad Saad', dept: 'Jabatan Pengajian Melayu', course: 'PENGAJARAN KEMAHIRAN BAHASA DALAM BAHASA MELAYU', code: 'BMMB3223', credit: '3', evaluator: 'Dr. Abd.Hadi bin Kudin (KJ)' },

  // Jabatan Ilmu Pendidikan (8 more -> 14 total)
  { name: 'Dr. Baharudin bin Saleh', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN DAN KEPIMPINAN GURU', code: 'EDUP3163', credit: '3', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Dr. Khasturi a/p Ramalingam', dept: 'Jabatan Ilmu Pendidikan', course: 'PENTAKSIRAN DALAM PENDIDIKAN', code: 'EDUP3153', credit: '3', evaluator: 'Dr. Muhd Fariz bin Ismail (KJ)' },
  { name: 'Dr. Mohd Sukri bin Ma arof', dept: 'Jabatan Ilmu Pendidikan', course: 'PSIKOLOGI PEMBELAJARAN', code: 'EDUP3113', credit: '3', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Dr. Noor Haslinda binti Shuib', dept: 'Jabatan Ilmu Pendidikan', course: 'SOSIOLOGI DALAM PENDIDIKAN', code: 'EDUP2102', credit: '2', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Dr. Nur Munirah binti Kamaruzaman', dept: 'Jabatan Ilmu Pendidikan', course: 'TEKNOLOGI DAN MEDIA PENGAJARAN', code: 'EDUP2112', credit: '2', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Dr. Rubiah binti Dalail', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN', code: 'EDUP2132', credit: '2', evaluator: 'Dr. Muhd Fariz bin Ismail (KJ)' },
  { name: 'Dr. Suraya Hani binti Zakaria', dept: 'Jabatan Ilmu Pendidikan', course: 'KESIHATAN MENTAL DALAM PENDIDIKAN', code: 'ELEP4023', credit: '3', evaluator: 'Dr. Ellyza binti Karim (KJ)' },
  { name: 'Mohd Tazli bin Mahat', dept: 'Jabatan Ilmu Pendidikan', course: 'PROFESIONALISME KEGURUAN DAN KEPIMPINAN GURU', code: 'EDUP3163', credit: '3', evaluator: 'Dr. Ellyza binti Karim (KJ)' },

  // Jabatan Pendidikan Teknik dan Vokasional (5 more -> 10 total)
  { name: 'Hanafi bin Khamis', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'PENGENALAN PERNIAGAAN DAN KEUSAHAWANAN', code: 'RBTS1114', credit: '4', evaluator: 'Azhar bin Hashim (KJ)' },
  { name: 'Maznah @ Azmah binti Mersin', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'REKA BENTUK FESYEN', code: 'RBTS3313', credit: '3', evaluator: 'Azhar bin Hashim (KJ)' },
  { name: 'Mohd Asri bin Abdul Aziz', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'ASAS TEKNOLOGI ELEKTRIK DAN ELEKTRONIK', code: 'RBTS3403', credit: '3', evaluator: 'Ts. Dr. Mohamed Nazul bin Ismail (KJ)' },
  { name: 'Mohd Fitri Firdauz bin Mohd Nor', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'PEDAGOGI REKA BENTUK DAN TEKNOLOGI SEKOLAH RENDAH', code: 'RBTS3383', credit: '3', evaluator: 'Azhar bin Hashim (KJ)' },
  { name: 'Norzeha binti Othman', dept: 'Jabatan Pendidikan Teknik dan Vokasional', course: 'TEKNOLOGI TANAMAN SAYURAN DAN HIASAN', code: 'RBTS3283', credit: '3', evaluator: 'Azhar bin Hashim (KJ)' },

  // Jabatan Bahasa (3 more -> 7 total)
  { name: 'Dr. Shamsul Nizam bin Kachi Mohideen', dept: 'Jabatan Bahasa', course: 'LANGUAGE SKILLS IN ACADEMIC CONTEXT', code: 'TSLB1114', credit: '4', evaluator: 'Dr. Ajurun Begum binti Ahamed (KJ)' },
  { name: 'Lee Kim Hong', dept: 'Jabatan Bahasa', course: 'STRATEGI PENGAJARAN DAN PEMBELAJARAN BAHASA CINA', code: 'BCNB3223', credit: '3', evaluator: 'Dr. Ajurun Begum binti Ahamed (KJ)' },
  { name: 'Sharon Vijaya a/p Balakrishnan', dept: 'Jabatan Bahasa', course: 'STORYTELLING IN THE PRIMARY ESL CLASSROOOM', code: 'TSLB3483', credit: '3', evaluator: 'Dr. Ajurun Begum binti Ahamed (KJ)' },

  // Jabatan Sains Sosial (3 more -> 6 total)
  { name: 'Dr. Santhi a/p Letchumanan', dept: 'Jabatan Sains Sosial', course: 'PERANCANGAN DAN PELAKSANAAN PENGAJARAN DAN PEMBELAJARAN DALAM PENDIDIKAN MORAL', code: 'ELMK3142', credit: '2', evaluator: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)' },
  { name: 'Dr. Shasitharan a/l Raman Kutty', dept: 'Jabatan Sains Sosial', course: 'PENTAKSIRAN DALAM PENDIDIKAN MORAL SEKOLAH RENDAH', code: 'ELMK2082R', credit: '2', evaluator: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)' },
  { name: 'Meor Aris bin Meor Hamzah', dept: 'Jabatan Sains Sosial', course: 'PENGAJIAN KURIKULUM DAN PENTAKSIRAN SEJARAH SEKOLAH RENDAH', code: 'SJHK3373', credit: '3', evaluator: 'Dr. Tengku Nor Husna binti Tengku Jamil (KJ)' },

  // Jabatan Pendidikan Jasmani dan Kokurikulum (2 more -> 5 total)
  { name: 'Dr. Vadivelan a/l Lohonathan', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', course: 'PENGURUSAN PENTADBIRAN PENDIDIKAN JASMANI DAN SUKAN', code: 'PJMS3213', credit: '3', evaluator: 'Shamsharizal bin Abd Aziz (KJ)' },
  { name: 'Kamalularifin bin Muhamed', dept: 'Jabatan Pendidikan Jasmani dan Kokurikulum', course: 'KURIKULUM DAN PEDAGOGI PENDIDIKAN JASMANI', code: 'PJMS3263', credit: '3', evaluator: 'Shamsharizal bin Abd Aziz (KJ)' }
];

const totalMonitoredList = [...existingMonitored, ...additionalMonitored];
console.log('Total Monitored Lecturers:', totalMonitoredList.length);

const criteriaKeys = ['1a', '1b', '1c', '1d', '1e', '2a', '2b', '2c', '2d', '2e', '2f', '3a', '3b', '4a', '5a', '6a'];
const targetDateStr = '2026-10-07'; // 7.10.2026
const baseAnchorTime = new Date('2026-10-07T08:30:00+08:00').getTime();

const records = totalMonitoredList.map((item, index) => {
  // Timestamps on 7.10.2026
  const timestamp = baseAnchorTime + (index * 5 * 60 * 1000);
  const dateStr = targetDateStr;

  const scores = {};
  criteriaKeys.forEach((k, kIdx) => {
    scores[k] = (index + kIdx) % 4 === 0 ? 4 : 5;
  });

  return {
    id: 'rec-' + (index + 1) + '-' + timestamp.toString(36),
    timestamp: timestamp,
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
      '1a': 'Kandungan kurikulum menepati RMK/MK sepenuhnya.',
      '2a': 'Penyampaian PdP amat berkesan, teratur dan interaktif.',
      '3a': 'Penglibatan pelajar secara aktif dan berdaya fikir kritis.',
      '4a': 'Maklum balas konstruktif diberikan secara berterusan.'
    },
    remarks: 'Pemantauan pelaksanaan kurikulum (LAM-PT-03-04) menunjukkan tahap kepatuhan dan kualiti penyampaian yang sangat cemerlang.',
    lecturerSignature: sigBase64,
    evaluatorSignature: sigBase64
  };
});

const schedules = totalMonitoredList.map((item, index) => {
  const rec = records[index];
  const hour = 8 + Math.floor((index * 5) / 60);
  const min = (index * 5) % 60;
  const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  return {
    id: 'sch-' + (index + 1) + '-' + rec.timestamp.toString(36),
    lecturerName: item.name,
    department: item.dept,
    course: item.course,
    code: item.code,
    date: '2026-10-07',
    time: timeStr,
    location: 'Bilik Kuliah / Makmal',
    timestamp: rec.timestamp,
    status: 'Completed'
  };
});

// Update data files
fs.writeFileSync(path.join(__dirname, '../data/records.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(__dirname, '../data/initial_records.json'), JSON.stringify(records, null, 2));
fs.writeFileSync(path.join(__dirname, '../data/schedules.json'), JSON.stringify(schedules, null, 2));
fs.writeFileSync(path.join(__dirname, '../data/initial_schedules.json'), JSON.stringify(schedules, null, 2));

console.log('Successfully written records.json and schedules.json with', records.length, 'records');

// Also update initialData.ts
const initialSignatures = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/signatures.json'), 'utf8'));

const initialDataTsContent = `import { EvaluationRecord, MonitoringSchedule } from './types';

export const INITIAL_RECORDS: EvaluationRecord[] = ${JSON.stringify(records, null, 2)};

export const INITIAL_SCHEDULES: MonitoringSchedule[] = ${JSON.stringify(schedules, null, 2)};

export const INITIAL_SIGNATURES: Record<string, string> = ${JSON.stringify(initialSignatures, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, '../initialData.ts'), initialDataTsContent, 'utf8');
console.log('Successfully updated initialData.ts');
