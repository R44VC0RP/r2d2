const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/);
  if (!match) return 0;

  const [, value, unit] = match;
  const unitIndex = UNITS.indexOf(unit);
  if (unitIndex === -1) return 0;

  return parseFloat(value) * Math.pow(1024, unitIndex);
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${UNITS[i]}`;
} 