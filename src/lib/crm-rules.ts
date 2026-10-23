export const SPECIAL_NOTE_LIMIT = 50;
export const TALENT_LIMIT = 30;

export function limitClientFields<T extends { notes: string; talent?: string }>(client: T): T {
  return {
    ...client,
    notes: client.notes.slice(0, SPECIAL_NOTE_LIMIT),
    talent: (client.talent ?? "").slice(0, TALENT_LIMIT),
  };
}

export function matchesClientSearch(client: object, query: string): boolean {
  const values = (value: unknown): string[] => {
    if (value == null) return [];
    if (Array.isArray(value)) return value.flatMap(values);
    if (typeof value === "object")
      return Object.entries(value)
        .filter(([key]) => key !== "id")
        .flatMap(([, entry]) => values(entry));
    return [String(value)];
  };
  const text = values(client).join(" ").toLowerCase();
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((term) => text.includes(term));
}
