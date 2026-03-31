
export enum Scale {
  SANGAT_TIDAK_SETUJU = 1,
  TIDAK_SETUJU = 2,
  AGAK_SETUJU = 3,
  SETUJU = 4,
  SANGAT_SETUJU = 5
}

export interface Criterion {
  id: string;
  text: string;
  category: string;
}

export interface EvaluationRecord {
  id: string;
  timestamp: number;
  campus: string;
  department: string;
  lecturerName: string;
  course: string;
  code: string;
  credit: string;
  date: string;
  evaluatorName: string;
  scores: Record<string, number>;
  itemRemarks: Record<string, string>;
  remarks: string;
  lecturerSignature?: string; // Base64 image
  evaluatorSignature?: string; // Base64 image
}

export interface MonitoringSchedule {
  id: string;
  lecturerName: string;
  department: string;
  course: string;
  code: string;
  date: string;
  time: string;
  location: string;
  timestamp: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
}

export interface DashboardStats {
  lecturerName: string;
  averageScore: number;
  totalEvaluations: number;
}
