import { SUPPORTED_WORKBOOK_EXTENSIONS, WORKBOOK_SIZE_LIMIT_BYTES, type WorkbookValidationResult } from '../types/upload';

export function formatFileSize(bytes: number): string { if (!Number.isFinite(bytes) || bytes < 0) return 'unknown size'; const mb=bytes/(1024*1024); return mb>=1?`${mb.toFixed(mb>=10?0:1)} MB`:`${Math.max(1, Math.round(bytes/1024))} KB`; }
export function getWorkbookExtension(name: unknown): string { const safe=typeof name==='string'?name.trim():''; const i=safe.lastIndexOf('.'); return i>=0?safe.slice(i).toLowerCase():''; }
export function validateWorkbookFile(file: Pick<File,'name'|'size'|'lastModified'> | null | undefined): WorkbookValidationResult {
  if (!file) return {ok:false,error:{code:'missing-file',message:'Choose a workbook before continuing.'}};
  if (typeof file.name !== 'string' || !file.name.trim()) return {ok:false,error:{code:'missing-name',message:'The selected file is missing a filename.'}};
  if (typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size < 0) return {ok:false,error:{code:'invalid-size',message:'The selected file has invalid size metadata.'}};
  if (file.size === 0) return {ok:false,error:{code:'empty-file',message:'The selected workbook is empty.'}};
  if (file.size > WORKBOOK_SIZE_LIMIT_BYTES) return {ok:false,error:{code:'file-too-large',message:`Workbook is larger than the ${formatFileSize(WORKBOOK_SIZE_LIMIT_BYTES)} browser safety limit.`}};
  const extension=getWorkbookExtension(file.name);
  if (!SUPPORTED_WORKBOOK_EXTENSIONS.includes(extension as never)) return {ok:false,error:{code:'unsupported-extension',message:'Use a supported Excel workbook: .xlsx, .xls, or .xlsm.'}};
  return {ok:true,file:{name:file.name,size:file.size,extension:extension as never,lastModified:file.lastModified}};
}
