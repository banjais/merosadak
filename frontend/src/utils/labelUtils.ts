export function resolveLabel(value: any, lang: string = 'en'): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && lang in value) {
    return value[lang] || Object.values(value)[0] || '';
  }
  return String(value);
}