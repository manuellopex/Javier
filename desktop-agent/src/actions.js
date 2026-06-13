import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { resolveSafePath, expandHome, isSafeUrl } from './security.js';

const exec = promisify(execFile);

/**
 * Allowed actions. Hard rules:
 *  - never delete files (no delete action exists)
 *  - never execute arbitrary commands (only named entries from config.allowedCommands)
 *  - file operations confined to config.allowedFolders
 */
export const actions = {
  /** Open a URL in the default browser. */
  async open_url({ url }) {
    if (!isSafeUrl(url)) throw new Error('Only http/https URLs are allowed');
    const platform = os.platform();
    if (platform === 'darwin') await exec('open', [url]);
    else if (platform === 'win32') await exec('cmd', ['/c', 'start', '', url]);
    else await exec('xdg-open', [url]);
    return { opened: url };
  },

  /** Open an app from the allowlist. */
  async open_app({ app }, config) {
    const platform = os.platform();
    const allowed = config.allowedApps?.[platform] ?? [];
    if (!allowed.includes(app)) {
      throw new Error(`App "${app}" is not in the allowlist for ${platform}`);
    }
    if (platform === 'darwin') await exec('open', ['-a', app]);
    else if (platform === 'win32') await exec('cmd', ['/c', 'start', '', app]);
    else await exec(app, []);
    return { opened: app };
  },

  /** Create a text file inside an allowed folder. Fails if the file exists. */
  async create_text_file({ path: filePath, content }, config) {
    const safe = resolveSafePath(filePath, config.allowedFolders);
    await fs.mkdir(path.dirname(safe), { recursive: true });
    await fs.writeFile(safe, String(content ?? ''), { flag: 'wx' });
    return { created: safe };
  },

  /** List the contents of an allowed folder. */
  async read_folder({ path: folderPath }, config) {
    const safe = resolveSafePath(folderPath, config.allowedFolders);
    const entries = await fs.readdir(safe, { withFileTypes: true });
    return {
      path: safe,
      entries: entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })),
    };
  },

  /** Move a file between locations inside the allowed folders. Never overwrites. */
  async move_file({ from, to }, config) {
    const safeFrom = resolveSafePath(from, config.allowedFolders);
    const safeTo = resolveSafePath(to, config.allowedFolders);
    try {
      await fs.access(safeTo);
      throw new Error('Destination already exists — refusing to overwrite');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    await fs.mkdir(path.dirname(safeTo), { recursive: true });
    await fs.rename(safeFrom, safeTo);
    return { moved: safeFrom, to: safeTo };
  },

  /** Run a pre-registered command from config.allowedCommands by name. */
  async run_command({ name }, config) {
    const entry = config.allowedCommands?.[name];
    if (!entry) throw new Error(`Command "${name}" is not in the allowlist`);
    const cwd = entry.cwd ? expandHome(entry.cwd) : undefined;
    const { stdout, stderr } = await exec(entry.cmd, entry.args ?? [], {
      cwd,
      timeout: 15_000,
      maxBuffer: 256 * 1024,
    });
    return { name, stdout: stdout.slice(0, 8000), stderr: stderr.slice(0, 2000) };
  },
};
