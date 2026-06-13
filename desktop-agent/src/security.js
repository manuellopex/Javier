import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

/** Folders the agent must NEVER touch, even if misconfigured. */
const FORBIDDEN_SEGMENTS = [
  '.ssh',
  '.gnupg',
  '.aws',
  '.config',
  '.kube',
  'Library/Keychains',
  'AppData',
  '/etc',
  '/var',
  '/usr',
  '/System',
  '/Windows',
];

export function expandHome(p) {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1));
  return p;
}

/**
 * Resolves `target` and verifies it lives inside one of the allowed folders
 * and not inside any forbidden location. Throws on violation.
 */
export function resolveSafePath(target, allowedFolders) {
  const resolved = path.resolve(expandHome(target));

  for (const segment of FORBIDDEN_SEGMENTS) {
    if (resolved.includes(path.sep + segment + path.sep) || resolved.endsWith(path.sep + segment)) {
      throw new Error(`Path touches a forbidden location: ${segment}`);
    }
  }

  const allowed = allowedFolders
    .map((f) => path.resolve(expandHome(f)))
    .some((folder) => resolved === folder || resolved.startsWith(folder + path.sep));

  if (!allowed) {
    throw new Error(`Path is outside the allowed folders: ${resolved}`);
  }
  return resolved;
}

export function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function isSafeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
