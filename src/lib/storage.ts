import { readdir, stat } from 'fs/promises';
import { join } from 'path';

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Configurable via env — see .env.example. Defaults keep the old behaviour:
// 100MB max per file, 20GB total across public/uploads (uploads + archived
// Facebook / POV / TikTok videos all count toward the total).
export const MAX_FILE_SIZE_MB = parsePositiveNumber(process.env.MAX_UPLOAD_FILE_MB, 100);
export const MAX_VOLUME_SIZE_GB = parsePositiveNumber(process.env.MAX_UPLOAD_TOTAL_GB, 20);
export const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
export const MAX_VOLUME_SIZE = MAX_VOLUME_SIZE_GB * 1024 * 1024 * 1024;

export async function getUploadsSize(): Promise<number> {
  const uploadDir = join(process.cwd(), 'public', 'uploads');
  try {
    const files = await readdir(uploadDir);
    let total = 0;
    for (const file of files) {
      try {
        const s = await stat(join(uploadDir, file));
        total += s.size;
      } catch { /* skip */ }
    }
    return total;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
