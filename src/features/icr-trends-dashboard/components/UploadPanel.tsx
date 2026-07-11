import { FileSpreadsheet, LockKeyhole } from 'lucide-react';

export function UploadPanel() {
  return (
    <section className="icr-dashboard__upload" aria-labelledby="icr-upload-title">
      <div className="icr-dashboard__upload-icon" aria-hidden="true">
        <FileSpreadsheet />
      </div>
      <div className="icr-dashboard__upload-copy">
        <h2 id="icr-upload-title">Upload an ICR workbook</h2>
        <p className="icr-dashboard__format-text">Supported formats: XLSX, XLS, or CSV</p>
        <p className="icr-dashboard__privacy-copy">
          <LockKeyhole aria-hidden="true" /> Files will be processed locally in your browser and will not be uploaded.
        </p>
        <p id="icr-upload-phase-note" className="icr-dashboard__phase-note">
          Phase 2 will enable local workbook processing. Upload and demo data controls are intentionally disabled in this shell.
        </p>
      </div>
      <div className="icr-dashboard__upload-actions" aria-describedby="icr-upload-phase-note">
        <button type="button" className="icr-dashboard__primary-button" disabled aria-describedby="icr-upload-phase-note">
          Upload workbook
        </button>
        <button type="button" className="icr-dashboard__secondary-button" disabled aria-describedby="icr-upload-phase-note">
          Load demo data
        </button>
      </div>
    </section>
  );
}
