import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseStripeSignature, verifyStripeSignature } from '../src/modules/payments/stripe/stripe-signature.util';

const SECRET = 'whsec_test_1234567890';

function sign(payload: string, opts: { secret?: string; timestamp?: number } = {}) {
  const timestamp = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const secret = opts.secret ?? SECRET;
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return { header: `t=${timestamp},v1=${signature}`, timestamp, signature };
}

describe('stripe-signature.util', () => {
  const payload = JSON.stringify({
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_1' } },
  });

  it('verifies a valid signature', () => {
    const { header } = sign(payload);
    expect(verifyStripeSignature({ payload, header, secret: SECRET })).toBe(true);
  });

  it('rejects when the secret does not match', () => {
    const { header } = sign(payload, { secret: 'whsec_other_secret' });
    expect(verifyStripeSignature({ payload, header, secret: SECRET })).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const { header } = sign(payload);
    expect(verifyStripeSignature({ payload: `${payload}x`, header, secret: SECRET })).toBe(false);
  });

  it('rejects an expired timestamp', () => {
    const { header } = sign(payload, { timestamp: Math.floor(Date.now() / 1000) - 600 });
    expect(verifyStripeSignature({ payload, header, secret: SECRET })).toBe(false);
  });

  it('rejects malformed headers', () => {
    expect(verifyStripeSignature({ payload, header: 'garbage', secret: SECRET })).toBe(false);
    expect(verifyStripeSignature({ payload, header: 't=0,v1=deadbeef', secret: SECRET })).toBe(false);
    expect(verifyStripeSignature({ payload, header: '', secret: SECRET })).toBe(false);
  });

  it('parses the timestamp and signatures', () => {
    const { header, timestamp, signature } = sign(payload);
    expect(parseStripeSignature(header)).toEqual({ timestamp, signatures: [signature] });
  });
});
