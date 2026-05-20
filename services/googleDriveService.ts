
import { EvaluationRecord } from '../types';

/**
 * Nota: Integrasi Google Drive sebenar memerlukan OAuth2 Access Token.
 * Servis ini menyediakan simulasi proses muat naik ke folder Admin IPGKPT.
 */

export const uploadToGoogleDrive = async (record: EvaluationRecord, pdfBlob: Blob): Promise<boolean> => {
  const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL;
  const apiKey = import.meta.env.VITE_APPS_SCRIPT_API_KEY;

  console.log(`Memulakan muat naik fail untuk: ${record.lecturerName}`);
  
  if (appsScriptUrl) {
    try {
      // Tukar Blob ke Base64 untuk penghantaran ke Apps Script
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]); // Ambil bahagian data sahaja
        };
      });
      reader.readAsDataURL(pdfBlob);
      const base64Data = await base64Promise;

      const response = await fetch(appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Apps Script Web App biasanya memerlukan no-cors jika tiada preflight
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: apiKey,
          filename: `LAM-PT-03-04_${record.lecturerName.replace(/\s+/g, '_')}_${record.date}.pdf`,
          data: base64Data,
          lecturer: record.lecturerName,
          department: record.department,
          date: record.date
        })
      });

      console.log('Respons daripada Apps Script dihantar (no-cors mode)');
      return true;
    } catch (error) {
      console.error('Ralat integrasi Apps Script:', error);
      return false;
    }
  }

  // Simulasi metadata fail jika tiada URL Apps Script
  const metadata = {
    name: `LAM-PT-03-04_${record.lecturerName.replace(/\s+/g, '_')}_${record.date}.pdf`,
    mimeType: 'application/pdf',
    parents: ['1I5-K1Yv3SnFMBzUQtQnPzR82AeHWJqNw'] // ID Folder Admin
  };

  return new Promise((resolve) => {
    // Simulasi kependaman rangkaian (network latency)
    setTimeout(() => {
      console.log('Metadata dihantar:', metadata);
      console.log('Saiz fail:', pdfBlob.size, 'bytes');
      resolve(true);
    }, 2500);
  });
};
