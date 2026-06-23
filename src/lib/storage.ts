import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export const MAX_FILE_SIZE = 300 * 1024 * 1024;       // 300MB per file
export const MAX_VOLUME_SIZE = 20 * 1024 * 1024 * 1024; // 20GB total

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
