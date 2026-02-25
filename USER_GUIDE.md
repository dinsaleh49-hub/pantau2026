# User Guide: ePantau v2.0 IPGKPT

## Introduction
**ePantau v2.0** is a digitalized system designed for the **IPG Kampus Pendidikan Teknik (IPGKPT)** to manage and monitor the implementation of the curriculum (LAM-PT-03-04). The system streamlines the evaluation process, provides AI-powered performance analysis, and automates report generation.

---

## 1. Getting Started

### 1.1 Accessing the System
Open the application in your web browser. You will be greeted by the Login screen.

### 1.2 Login Credentials
The system uses role-based access control:

*   **Administrator (Admin):** Full access to all departments and campus-wide analytics.
    *   *Username:* `admin`
    *   *Password:* `admin123`
*   **Director / Deputy Director:** High-level oversight.
    *   *Usernames:* `pengarah`, `tp`
*   **Department Heads (Ketua Jabatan):** Access to their specific department's data.
    *   *Usernames:* `jmate` (Math), `jsains` (Science), `jpi` (Islamic Ed), etc.
*   **Lecturers (Pensyarah):** Restricted access for viewing schedules and registering monitoring slots.
    *   *Universal Account:* 
        *   *Username:* `pensyarah`
        *   *Password:* `pensyarah`
    *   *Legacy Login:* Use `pensyarah` as username and your full name (as registered in the system) as the password.

---

## 2. Dashboard Overview

The Dashboard is the central hub of the application.

### 2.1 Analytics Tab (Admin/KJ Only)
*   **Key Metrics:** View average campus scores, total evaluations completed, and monitoring progress for Department Heads (KJ).
*   **Executive Summary:** Automatically identifies the top 3 strengths and top 3 areas requiring intervention across the campus.
*   **Performance Charts:** Toggle between **Staff** and **Department** views to visualize performance trends.
*   **Quick Search:** Locate specific evaluation records instantly.

### 2.2 Status Monitoring Tab (Admin/KJ Only)
*   **KJ Monitoring Status:** Tracks whether all Department Heads have been monitored by the Deputy Director (TP).
*   **Department Summary:** Shows the percentage of monitored staff in each department.
*   **Staff Status List:** A detailed list of all staff members and their monitoring status (Monitored vs. Not Yet).

### 2.3 Schedule Tab (All Users)
*   **Upcoming Monitoring:** View a list of scheduled monitoring sessions.
*   **Register Schedule:** Lecturers can use the "Daftar Jadual" button to book a monitoring slot.

---

## 3. Performing an Evaluation (LAM-PT-03-04)

Evaluators can create new records by clicking the **"Borang Penilaian"** (or similar action) button.

### 3.1 Evaluation Form Sections
1.  **Monitoring Information:** Select the campus, lecturer name, and course details.
2.  **Evaluation Criteria:** Rate the lecturer on a scale of 1 to 5 across 6 main categories:
    *   RMK Implementation
    *   Teaching Activity
    *   Student Involvement
    *   Feedback
    *   Motivation
    *   Character (Sahsiah)
3.  **Remarks:** Add specific observations or suggestions for improvement.
4.  **Digital Signatures:** Both the **Lecturer** and the **Evaluator** must sign the digital pad before saving.

---

## 4. AI Analysis & Reporting

### 4.1 AI Summary (Sparkles Icon)
Click the **Sparkles** icon next to any record to generate an AI-powered performance summary. This feature uses Gemini AI to analyze scores and provide constructive feedback in Malay.

### 4.2 PDF Reports
*   **Individual Record:** Click "Lihat" or "Muat Turun" to generate a professional PDF of the LAM-PT-03-04 form.
*   **Summary Report:** Admins can print a campus-wide summary report.
*   **Full Department View:** Generate a combined report for all records in a specific department.

### 4.3 CSV Export
Export all raw data to a CSV file for further analysis in Excel or other tools.

---

## 5. Data Management & Cloud Sync

### 5.1 Google Drive Integration
*   **Save to Drive:** Click the **Cloud** icon on a record to upload the PDF directly to the Admin's Google Drive archive.
*   **Bulk Export:** Export an entire department's records to organized sub-folders in Google Drive.
*   **Admin Folder:** Access the digital archive directly via the "Folder Admin" link.

### 5.2 Local Storage
The system automatically saves data to your browser's local storage. However, it is recommended to use the **Google Drive Sync** or **CSV Export** for permanent backups.

---

## 6. Troubleshooting

*   **Login Failed:** Ensure you are using the correct username and password. Remember that passwords are case-sensitive.
*   **Signature Pad Not Working:** Ensure you are using a touch-enabled device or a mouse. Click "Clear" to reset the pad if needed.
*   **Missing Records:** Check if you have a filter applied (e.g., "Hanya KJ" or a specific Department filter).
*   **AI Summary Error:** Ensure you have an active internet connection to reach the AI services.

---
**IPG Kampus Pendidikan Teknik**
*Digitalizing Excellence in Curriculum Monitoring*
© JKA2026
