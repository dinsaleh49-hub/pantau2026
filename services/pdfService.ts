
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EvaluationRecord, Criterion } from '../types';
import { EVALUATION_CRITERIA } from '../constants';

const formatDate = (dateStr: string) => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}.${month}.${year}`;
};

const getDisplayBil = (item: Criterion) => {
  if (item.category.startsWith('1.')) return '';
  if (item.category.startsWith('2.')) return '';
  if (item.category.startsWith('3.')) return '';
  if (item.category.startsWith('4.')) return '4';
  if (item.category.startsWith('5.')) return '5';
  if (item.category.startsWith('6.')) return '6';
  return ''; 
};

export const generatePDF = (record: EvaluationRecord, action: 'save' | 'view' | 'blob' = 'save'): any => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const addHeaderInfo = () => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('LAM-PT-03-04', pageWidth - margin, 12, { align: 'right' });
  };

  const addFooterInfo = () => {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Januari 2021', margin, pageHeight - 10, { align: 'left' });
  };

  // --- PAGE 1 ---
  addHeaderInfo();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTRUMEN PEMANTAUAN PELAKSANAAN KURIKULUM', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text('(Pemantauan ini dibuat oleh Ketua Jabatan/Unit terhadap pensyarah', pageWidth / 2, 27, { align: 'center' });
  doc.text('sepanjang semester bagi kursus berkenaan)', pageWidth / 2, 31, { align: 'center' });

  const metaData = [
    ['Institut Pendidikan Guru Kampus', ':', record.campus, '', '', ''],
    ['Jabatan / Unit', ':', record.department, '', '', ''],
    ['Nama Pensyarah', ':', record.lecturerName.toUpperCase(), '', '', ''],
    ['Kursus', ':', record.course, '', '', ''],
    ['Kod', ':', record.code, 'Kredit', ':', record.credit],
    ['Tarikh Pemantauan', ':', formatDate(record.date), '', '', '']
  ];

  autoTable(doc, {
    startY: 37,
    margin: { left: margin, right: margin },
    body: metaData,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: 1, textColor: 0, fontStyle: 'normal' },
    columnStyles: { 
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 4 },
      2: { cellWidth: 75 },
      3: { cellWidth: 15, fontStyle: 'bold' },
      4: { cellWidth: 4 },
      5: { cellWidth: 'auto' }
    }
  } as any);

  const yAfterMeta = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ARAHAN:', margin, yAfterMeta);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('1. Tandakan ( / ) pada ruang-ruang yang berkenaan.', margin, yAfterMeta + 4);
  doc.text('2. Gunakan skala berikut untuk menunjukkan darjah kepuasan anda.', margin, yAfterMeta + 8);

  const scales = ['1 Sangat tidak setuju', '2 Tidak setuju', '3 Agak setuju', '4 Setuju', '5 Sangat setuju'];
  doc.setFont('helvetica', 'bold');
  let scaleY = yAfterMeta + 13;
  scales.forEach(s => { doc.text(s, margin, scaleY); scaleY += 4; });

  const buildTableData = (criteria: Criterion[]) => {
    const rows: any[] = [];
    let currentCategory = '';
    const scaleShadingStyle = { fillColor: [128, 128, 128] as [number, number, number] };

    criteria.forEach(c => {
      const categoryMatch = c.category.match(/^(\d\.)\s*(.*)/);
      const catNum = categoryMatch ? categoryMatch[1] : '';
      
      if (categoryMatch && c.category !== currentCategory) {
        const catText = categoryMatch[2];
        
        if (catNum !== '4.' && catNum !== '5.' && catNum !== '6.') {
          rows.push([
            { content: catNum, styles: { halign: 'center', fontStyle: 'bold' } }, 
            { content: catText, styles: { halign: 'left', fontStyle: 'bold' } },  
            { content: '', styles: scaleShadingStyle },
            { content: '', styles: scaleShadingStyle },
            { content: '', styles: scaleShadingStyle },
            { content: '', styles: scaleShadingStyle },
            { content: '', styles: scaleShadingStyle },
            { content: '', styles: { fillColor: [255, 255, 255] } }      
          ]);
        }
        currentCategory = c.category;
      }

      const score = record.scores[c.id];
      const displayItemText = c.text; 
      
      const isHeaderless = catNum === '4.' || catNum === '5.' || catNum === '6.';
      
      const row = [
        getDisplayBil(c),
        (categoryMatch && !isHeaderless) ? `     ${displayItemText}` : displayItemText,
        score === 1 ? '/' : '',
        score === 2 ? '/' : '',
        score === 3 ? '/' : '',
        score === 4 ? '/' : '',
        score === 5 ? '/' : '',
        record.itemRemarks[c.id] || ''
      ];
      rows.push(row);
    });
    return rows;
  };

  const commonTableConfig = {
    theme: 'grid' as const,
    styles: { 
      fontSize: 8, textColor: 0, cellPadding: 1.5, lineColor: 0, lineWidth: 0.1,
      fontStyle: 'normal' as const, overflow: 'linebreak' as const, fillColor: [255, 255, 255]
    },
    headStyles: { 
      fillColor: [255, 255, 255] as [number, number, number],
      textColor: 0, fontStyle: 'bold' as const, halign: 'center' as const, lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' as const },
      1: { cellWidth: 'auto' as const, halign: 'left' as const },
      2: { cellWidth: 8, halign: 'center' as const },
      3: { cellWidth: 8, halign: 'center' as const },
      4: { cellWidth: 8, halign: 'center' as const },
      5: { cellWidth: 8, halign: 'center' as const },
      6: { cellWidth: 8, halign: 'center' as const },
      7: { cellWidth: 35, fontSize: 7, halign: 'left' as const }
    }
  };

  const p1Criteria = EVALUATION_CRITERIA.slice(0, 11);
  autoTable(doc, {
    startY: scaleY + 4,
    margin: { left: margin, right: margin },
    head: [
      [{ content: 'BIL.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
       { content: 'PERKARA', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
       { content: 'SKALA', colSpan: 5, styles: { halign: 'center' } },
       { content: 'CATATAN', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }],
      ['1', '2', '3', '4', '5']
    ],
    body: buildTableData(p1Criteria),
    ...commonTableConfig
  } as any);

  addFooterInfo();
  doc.addPage();
  addHeaderInfo();
  
  const p2Criteria = EVALUATION_CRITERIA.slice(11);
  autoTable(doc, {
    startY: 20,
    margin: { left: margin, right: margin },
    head: [
      [{ content: 'BIL.', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
       { content: 'PERKARA', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }, 
       { content: 'SKALA', colSpan: 5, styles: { halign: 'center' } },
       { content: 'CATATAN', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }],
      ['1', '2', '3', '4', '5']
    ],
    body: buildTableData(p2Criteria),
    ...commonTableConfig
  } as any);

  const finalTableY = (doc as any).lastAutoTable.finalY;
  const purataY = finalTableY + 8;
  const scoresArray = Object.values(record.scores) as number[];
  const meanValue = (scoresArray.reduce((a, b) => a + b, 0) / scoresArray.length).toFixed(2);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`MIN PURATA KESELURUHAN: ${meanValue}`, margin, purataY);

  const blockStartY = purataY + 5;
  const blockWidth = pageWidth - (margin * 2);
  doc.setLineWidth(0.2);
  doc.rect(margin, blockStartY, blockWidth, 75);
  doc.line(margin, blockStartY + 30, margin + blockWidth, blockStartY + 30);
  doc.line(pageWidth / 2, blockStartY + 30, pageWidth / 2, blockStartY + 75);

  doc.text('Pemerhatian Umum / Ulasan Lanjut :', margin + 3, blockStartY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(record.remarks || 'Tiada ulasan.', margin + 3, blockStartY + 12, { maxWidth: blockWidth - 6 });

  doc.setFontSize(8.5);

  // --- DISPLAY SIGNATURES ---
  if (record.lecturerSignature) {
    try {
      doc.addImage(record.lecturerSignature, 'PNG', margin + 10, blockStartY + 38, 35, 12);
    } catch (e) {
      console.warn('Lecturer signature display failed', e);
    }
  }

  if (record.evaluatorSignature) {
    try {
      doc.addImage(record.evaluatorSignature, 'PNG', pageWidth / 2 + 10, blockStartY + 38, 35, 12);
    } catch (e) {
      console.warn('Evaluator signature display failed', e);
    }
  }

  doc.text('......................................................', margin + 5, blockStartY + 58);
  doc.text(`Nama : ${record.lecturerName.toUpperCase()}`, margin + 5, blockStartY + 64);
  doc.text(`Tarikh : ${formatDate(record.date)}`, margin + 5, blockStartY + 69);

  doc.text('......................................................', pageWidth / 2 + 5, blockStartY + 58);
  doc.text(`Nama : ${record.evaluatorName.toUpperCase()}`, pageWidth / 2 + 5, blockStartY + 64);
  doc.text(`Tarikh : ${formatDate(record.date)}`, pageWidth / 2 + 5, blockStartY + 69);

  addFooterInfo();

  if (action === 'view') {
    window.open(doc.output('bloburl'), '_blank');
  } else if (action === 'blob') {
    return doc.output('blob');
  } else {
    const safeName = record.lecturerName.replace(/\s+/g, '_');
    doc.save(`LAM-PT-03-04_${safeName}_${record.date}.pdf`);
  }
};

export const generateSummaryPDF = (
  lecturerStats: any[], departmentStats: any[], overallMean: string, totalEvaluations: number, action: 'save' | 'view' = 'save'
) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN ANALISIS RUMUSAN PEMANTAUAN PENSYARAH', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(10); doc.text('IPG KAMPUS PENDIDIKAN TEKNIK', pageWidth / 2, 26, { align: 'center' });
  doc.line(margin, 30, pageWidth - margin, 30);

  autoTable(doc, {
    startY: 40, margin: { left: margin },
    body: [
      ['Purata Skor Keseluruhan', ':', overallMean],
      ['Jumlah Penilaian', ':', totalEvaluations.toString()],
      ['Tarikh Laporan', ':', new Date().toLocaleDateString('ms-MY')]
    ],
    theme: 'plain', styles: { fontSize: 10, cellPadding: 1.5 }
  } as any);

  const deptY = (doc as any).lastAutoTable.finalY + 12;
  doc.text('1. ANALISIS MENGIKUT JABATAN', margin, deptY);
  autoTable(doc, {
    startY: deptY + 3, margin: { left: margin, right: margin },
    head: [['BIL', 'JABATAN', 'SKOR PURATA', 'BIL. PENILAIAN']],
    body: departmentStats.map((d: any, i: number) => [(i + 1).toString(), d.name, d.score.toFixed(2), d.evalCount.toString()]),
    theme: 'grid', headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', halign: 'center' }
  } as any);

  if (action === 'view') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`Laporan_Rumusan_Pemantauan_${new Date().getTime()}.pdf`);
  }
};

export const generateFullDepartmentPDF = (records: EvaluationRecord[], action: 'save' | 'view' = 'save') => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN KESELURUHAN REKOD PEMANTAUAN PENSYARAH (IKUT JABATAN)', pageWidth / 2, 20, { align: 'center' });
  doc.setFontSize(10); doc.text('IPG KAMPUS PENDIDIKAN TEKNIK', pageWidth / 2, 26, { align: 'center' });
  doc.line(margin, 30, pageWidth - margin, 30);

  const tableData = records.map((r, i) => {
    const scores = Object.values(r.scores) as number[];
    const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
    return [
      (i + 1).toString(),
      formatDate(r.date),
      r.lecturerName,
      r.department,
      r.code,
      r.course,
      avg,
      r.evaluatorName
    ];
  });

  autoTable(doc, {
    startY: 35,
    margin: { left: margin, right: margin },
    head: [['BIL', 'TARIKH', 'NAMA PENSYARAH', 'JABATAN', 'KOD', 'KURSUS', 'SKOR', 'PEMANTAU']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 45 },
      3: { cellWidth: 40 },
      4: { cellWidth: 20 },
      5: { cellWidth: 'auto' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 40 }
    }
  } as any);

  if (action === 'view') {
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(`Laporan_Keseluruhan_IPGKPT_${new Date().getTime()}.pdf`);
  }
};
