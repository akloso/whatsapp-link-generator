import { FIELD_BY_KEY, FIELD_DEFS, REQUIRED_FIELD_KEYS } from '../constants/fieldDefinitions';
import type { ColumnMapping, FieldKey } from '../types';
import { headerMatchScore, nkey } from './normalize';

export const autoMap = (headers: string[]): ColumnMapping => {
  const mapping: ColumnMapping = {};
  const usedHeaders = new Set<string>();
  const usedFields = new Set<FieldKey>();

  FIELD_DEFS.forEach((field) => {
    const exactHeader = headers.find((header) => {
      if (usedHeaders.has(header)) return false;
      return [field.label, ...field.aliases].some((alias) => nkey(header) === nkey(alias));
    });
    if (exactHeader) {
      mapping[exactHeader] = { key: field.key, score: 1, status: 'auto' };
      usedHeaders.add(exactHeader);
      usedFields.add(field.key);
    }
  });

  headers.forEach((header) => {
    if (usedHeaders.has(header)) return;
    let bestField: FieldKey | '' = '';
    let bestScore = 0;
    FIELD_DEFS.forEach((field) => {
      if (usedFields.has(field.key)) return;
      [field.label, ...field.aliases].forEach((alias) => {
        const score = headerMatchScore(header, alias);
        if (score > bestScore) {
          bestScore = score;
          bestField = field.key;
        }
      });
    });
    if (bestField && bestScore >= 0.62) {
      mapping[header] = { key: bestField, score: bestScore, status: bestScore >= 0.86 ? 'auto' : 'review' };
      usedFields.add(bestField);
    } else {
      mapping[header] = { key: '', score: 0, status: 'ignore' };
    }
  });

  return mapping;
};

export const requiredMappingsReady = (mapping: ColumnMapping): boolean =>
  REQUIRED_FIELD_KEYS.every((key) => Object.values(mapping).some((entry) => entry.key === key));

export const hasDateMapping = (mapping: ColumnMapping): boolean =>
  Object.values(mapping).some((entry) => entry.key === 'timestamp' && entry.score >= 0.62);

export const duplicateMappingTargets = (mapping: ColumnMapping): FieldKey[] => {
  const counts = new Map<FieldKey, number>();
  Object.values(mapping).forEach((entry) => {
    if (!entry.key) return;
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
  });
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key);
};

export const validateMapping = (mapping: ColumnMapping): string[] => {
  const errors: string[] = [];
  REQUIRED_FIELD_KEYS.forEach((key) => {
    if (!Object.values(mapping).some((entry) => entry.key === key)) {
      errors.push(`Map required field: ${FIELD_BY_KEY[key].label}.`);
    }
  });
  duplicateMappingTargets(mapping).forEach((key) => errors.push(`Only one source column can map to ${FIELD_BY_KEY[key].label}.`));
  if (!hasDateMapping(mapping)) errors.push('Timestamp is not mapped. Date-based reporting will be limited until a review date column is selected.');
  return errors;
};
