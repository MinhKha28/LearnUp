/** Keep selected rows from earlier pages even if the table only supplies the current page. */
export function retainAssignmentSelection<T extends { id: string }>(
  current: Record<string, T>,
  keys: readonly (string | number | bigint)[],
  rows: T[],
): Record<string, T> {
  const available = {
    ...current,
    ...Object.fromEntries(rows.map((row) => [row.id, row])),
  };
  return Object.fromEntries(
    keys
      .map(String)
      .filter((id) => available[id])
      .map((id) => [id, available[id]]),
  );
}
