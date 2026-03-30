import { ValueTransformer } from 'typeorm';

export const bigintTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) =>
    value !== null && value !== undefined ? parseInt(String(value), 10) : null,
};
