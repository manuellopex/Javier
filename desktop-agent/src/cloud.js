import os from 'node:os';
import { actions } from './actions.js';

/**
 * Cloud connector — Fase 4.
 *
 * Outbound-only polling: the agent asks the AURA backend for APPROVED desktop
 * commands every few seconds, executes them locally (the local allowlist in
 * actions.js / security.js still applies — double layer), and reports results.
 *
 * No inbound connections, no open ports, works behind NAT without tunnels.
 * Only commands the user manually approved in the AURA UI ever arrive here.
 */
export function startCloudConnector(config, log) {
  const { url, agentKey, pollSeconds = 7 } = config.backend;
  const base = url.replace(/\/$/, '');
  let failures = 0;
  let stopped = false;

  async function poll() {
    if (stopped) return;
    try {
      const res = await fetch(`${base}/api/desktop/poll`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-aura-agent-key': agentKey },
        body: JSON.stringify({
          hostname: os.hostname(),
          version: '0.2.0',
          actions: Object.keys(actions),
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 401) {
        log({ event: 'cloud_auth_failed' });
        console.error('Backend rejected the agent key — check config.backend.agentKey.');
        scheduleNext(60); // slow down hard on auth failure
        return;
      }
      if (!res.ok) throw new Error(`poll ${res.status}`);

      failures = 0;
      const data = await res.json();
      for (const command of data.commands ?? []) {
        await execute(command);
      }
      scheduleNext(pollSeconds);
    } catch (err) {
      failures += 1;
      if (failures === 1 || failures % 10 === 0) {
        log({ event: 'cloud_poll_error', error: err.message, failures });
      }
      // Exponential backoff up to 60s on repeated failures.
      scheduleNext(Math.min(pollSeconds * 2 ** Math.min(failures, 4), 60));
    }
  }

  async function execute({ id, action, params }) {
    log({ event: 'cloud_command_received', id, action, params });
    const handler = actions[action];
    let report;
    if (!handler) {
      report = { commandId: id, ok: false, error: `Unknown action "${action}"` };
    } else {
      try {
        const result = await handler(params ?? {}, config);
        report = { commandId: id, ok: true, result };
        log({ event: 'cloud_command_executed', id, action });
      } catch (err) {
        report = { commandId: id, ok: false, error: err.message };
        log({ event: 'cloud_command_failed', id, action, error: err.message });
      }
    }

    try {
      await fetch(`${base}/api/desktop/result`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-aura-agent-key': agentKey },
        body: JSON.stringify(report),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      // The backend re-delivers after the claim TTL; execution may repeat.
      log({ event: 'cloud_report_failed', id, error: err.message });
    }
  }

  function scheduleNext(seconds) {
    if (!stopped) setTimeout(poll, seconds * 1000);
  }

  log({ event: 'cloud_connector_started', backend: base, pollSeconds });
  console.log(`Cloud connector polling ${base} every ${pollSeconds}s`);
  poll();

  return () => {
    stopped = true;
  };
}
