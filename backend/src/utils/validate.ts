// Input validation utilities

export function sanitizeString(input: unknown, maxLength = 1000): string {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength).replace(/[<>&"']/g, (c) => {
    const map: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return map[c] || c;
  });
}

export function sanitizeEmail(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().toLowerCase().slice(0, 255);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidUUID(id: string | string[]): boolean {
  if (Array.isArray(id)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function sanitizeInt(input: unknown, min = 0, max = 999999): number {
  const num = parseInt(String(input), 10);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function sanitizeArray(input: unknown, maxItems = 100): string[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, maxItems).map(item => sanitizeString(item, 500)).filter(Boolean);
}

export function validateRequired(fields: Record<string, unknown>): string | null {
  for (const [name, value] of Object.entries(fields)) {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
      return `Поле "${name}" обязательно`;
    }
  }
  return null;
}
