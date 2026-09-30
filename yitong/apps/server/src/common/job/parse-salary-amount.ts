export function parseSalaryAmount(salary: string): number | null {
  const match = salary.match(/\d+/);
  const rawAmount = match?.[0];
  if (!rawAmount) return null;
  const amount = Number.parseInt(rawAmount, 10);
  return Number.isFinite(amount) ? amount : null;
}
