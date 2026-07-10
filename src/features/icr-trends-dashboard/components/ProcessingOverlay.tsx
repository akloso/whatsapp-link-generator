type Props = { active: boolean; message: string };

export function ProcessingOverlay({ active, message }: Props) {
  if (!active) return null;
  return (
    <div className="icr-processing" role="status" aria-live="polite">
      <div className="icr-spinner" aria-hidden="true" />
      <p className="font-semibold text-slate-950">{message || 'Processing workbook locally…'}</p>
      <p className="mt-1 text-sm text-slate-600">No workbook data is uploaded.</p>
    </div>
  );
}
