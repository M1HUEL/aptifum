import { createHmac, timingSafeEqual } from 'node:crypto';

export interface ParsedStripeSignature {
  timestamp: number;
  signatures: string[];
}

export function parseStripeSignature(header: string): ParsedStripeSignature {
  const signatures: string[] = [];
  let timestamp = 0;
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq < 0) {
      continue;
    }
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        timestamp = parsed;
      }
    } else if (key === 'v1') {
      signatures.push(value);
    }
  }
  return { timestamp, signatures };
}

export function verifyStripeSignature(opts: {
  payload: Buffer | string;
  header: string;
  secret: string;
  toleranceSeconds?: number;
  now?: Date;
}): boolean {
  const { payload, header, secret, toleranceSeconds = 300 } = opts;
  const { timestamp, signatures } = parseStripeSignature(header);
  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  if (timestamp <= 0 || Math.abs(now - timestamp) > toleranceSeconds) {
    return false;
  }
  if (signatures.length === 0) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
