export type LocationFields = {
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
};

export function withLocationFields<T extends object>(row: T): T & LocationFields {
  const record = row as T & Partial<LocationFields>;
  return {
    ...record,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    neighborhood: record.neighborhood ?? null,
  };
}

export function withLocationFieldsList<T extends object>(
  rows: T[],
): Array<T & LocationFields> {
  return rows.map(withLocationFields);
}
