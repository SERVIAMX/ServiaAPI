import { ValueTransformer } from 'typeorm';

/** Normaliza TINYINT 0/1 desde MySQL (a veces llega como boolean o string). */
export const tinyint01Transformer: ValueTransformer = {
  to: (value: number | null | undefined) =>
    value === null || value === undefined ? null : value,
  from: (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') {
      if (value === 0 || value === 1) return value;
      const n = Math.trunc(value);
      return n === 0 || n === 1 ? n : null;
    }
    const s = String(value).trim();
    if (s === '0' || s === '1') return Number(s);
    const n = Number(s);
    if (n === 0 || n === 1) return n;
    return null;
  },
};
