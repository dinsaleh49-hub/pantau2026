
import { EvaluationRecord } from '../types';

/**
 * Nota: Integrasi Google Drive sebenar memerlukan OAuth2 Access Token.
 * Servis ini menyediakan simulasi proses muat naik ke folder Admin IPGKPT.
 */

export const uploadToGoogleDrive = async (record: EvaluationRecord, pdfBlob: Blob): Promise<boolean> => {
  console.log(`Memulakan muat naik fail untuk: ${record.lecturerName}`);
  
  // Simulasi metadata fail mengikut format API Drive v3
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
