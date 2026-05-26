/**
 * GET /api/debug/jxr
 *
 * Diagnostic endpoint — tells you exactly what is available in the container
 * for JXR conversion. Remove this file once the JXR pipeline is confirmed working.
 *
 * Visit this URL in your browser (while logged in) to see the report.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

async function run(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string; error?: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 15_000 });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (e: any) {
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? '', error: e.message };
  }
}

async function runShell(cmd: string): Promise<{ ok: boolean; out: string; error?: string }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 10_000 });
    return { ok: true, out: (stdout + stderr).trim() };
  } catch (e: any) {
    return { ok: false, out: (e.stdout ?? '') + (e.stderr ?? ''), error: e.message };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const report: Record<string, any> = {};

  // 1. Which binaries exist?
  const binaries = [
    '/usr/local/bin/JxrDecApp',
    '/usr/local/bin/JxrEncApp',
    '/usr/bin/convert',
    '/usr/bin/magick',
    '/usr/bin/mv',
    '/bin/mv',
    '/usr/bin/ffmpeg',
  ];
  report.binaries = {};
  for (const b of binaries) {
    if (existsSync(b)) {
      const stat = statSync(b);
      report.binaries[b] = { exists: true, size: stat.size, executable: !!(stat.mode & 0o111) };
    } else {
      report.binaries[b] = { exists: false };
    }
  }

  // 2. JxrDecApp version / help output
  report.JxrDecApp_help = await run('/usr/local/bin/JxrDecApp', []);

  // 3. ImageMagick version
  report.convert_version = await run('convert', ['-version']);

  // 4. ImageMagick delegates list — does it mention jxr?
  report.convert_delegates = await run('convert', ['-list', 'delegate']);

  // 5. Can ImageMagick list formats? Does jxr appear?
  const fmtResult = await runShell('convert -list format 2>&1 | grep -i jxr || echo "JXR not found in format list"');
  report.convert_jxr_format = fmtResult;

  // 6. PATH as seen by node
  report.PATH = process.env.PATH;

  // 7. Which convert does `which` find?
  report.which_convert = await runShell('which convert 2>&1');
  report.which_JxrDecApp = await runShell('which JxrDecApp 2>&1');

  // 8. Try a real JXR decode smoke test using a tiny synthetic JXR-like file
  //    (We can't generate a real JXR from scratch here, but we can confirm
  //    that JxrDecApp at least starts and exits with a meaningful error,
  //    not ENOENT or permission denied)
  const fakePath = join(tmpdir(), 'test_smoke.jxr');
  const pnmPath = join(tmpdir(), 'test_smoke.pnm');
  try {
    writeFileSync(fakePath, Buffer.from('FAKE'));
    const decodeResult = await run('/usr/local/bin/JxrDecApp', ['-i', fakePath, '-o', pnmPath]);
    report.JxrDecApp_smoke = {
      note: 'Expected to fail (fake input) but should NOT be ENOENT or permission error',
      result: decodeResult,
    };
  } finally {
    try { unlinkSync(fakePath); } catch {}
    try { unlinkSync(pnmPath); } catch {}
  }

  // 9. ldd on JxrDecApp — are shared libs satisfied?
  report.ldd_JxrDecApp = await runShell('ldd /usr/local/bin/JxrDecApp 2>&1 || echo "ldd not available"');

  // 10. Node.js and OS info
  report.node_version = process.version;
  report.platform = process.platform;
  report.arch = process.arch;
  report.cwd = process.cwd();

  return NextResponse.json(report, { status: 200 });
}
