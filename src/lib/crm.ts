// Envío de solicitudes al sistema de gestión comercial configurado (webhook
// firmado). Todas las solicitudes quedan además en el panel, que funciona como
// CRM interno aunque no haya un sistema externo.
import { createHmac } from 'node:crypto';
import { config } from './config.ts';
import { log } from './log.ts';

export type CrmStatus = 'sent' | 'failed' | 'disabled';

export async function pushToCrm(type: 'quote' | 'contact' | 'order', payload: Record<string, unknown>): Promise<CrmStatus> {
  if (!config.crm.url) return 'disabled';
  let url: URL;
  try {
    url = new URL(config.crm.url);
    if (url.protocol !== 'https:') throw new Error('CRM_WEBHOOK_URL debe usar https');
  } catch (e) {
    log.error('crm.config', e);
    return 'failed';
  }
  const body = JSON.stringify({ type, sentAt: new Date().toISOString(), source: 'moranoeurope.com', data: payload });
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = config.crm.secret ? createHmac('sha256', config.crm.secret).update(`${ts}.${body}`).digest('hex') : '';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Morano-Timestamp': ts,
        ...(sig ? { 'X-Morano-Signature': `sha256=${sig}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(6_000),
      redirect: 'error',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return 'sent';
  } catch (e) {
    log.warn('crm.push', { type, error: e instanceof Error ? e.message : String(e) });
    return 'failed';
  }
}
