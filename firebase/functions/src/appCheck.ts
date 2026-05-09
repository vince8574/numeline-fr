import * as admin from 'firebase-admin';

// Minimal structural types: we only need `header(name)` on the request and
// `status(code).json(body)` on the response. Avoids pulling in @types/express.
type AppCheckRequest = { header(name: string): string | undefined };
type AppCheckResponse = { status(code: number): { json(body: unknown): unknown } };

// Mode controlled by the APP_CHECK_ENFORCE env var on the function:
//   - 'true'  -> reject requests without a valid token (HTTP 401)
//   - other   -> monitor only: log and let the request through
//
// Start in monitor mode after deploy to confirm legitimate clients are
// sending valid tokens, then flip to enforce.
export async function checkAppCheck(req: AppCheckRequest, res: AppCheckResponse): Promise<boolean> {
  const enforce = process.env.APP_CHECK_ENFORCE === 'true';
  const token = req.header('X-Firebase-AppCheck');

  if (!token) {
    if (enforce) {
      console.warn('[AppCheck] Rejected: missing X-Firebase-AppCheck header');
      res.status(401).json({ error: 'App Check token required' });
      return false;
    }
    console.warn('[AppCheck] MONITOR: missing X-Firebase-AppCheck header (would reject in enforce mode)');
    return true;
  }

  try {
    await admin.appCheck().verifyToken(token);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    if (enforce) {
      console.warn('[AppCheck] Rejected: invalid token —', message);
      res.status(401).json({ error: 'Invalid App Check token' });
      return false;
    }
    console.warn('[AppCheck] MONITOR: invalid token (would reject in enforce mode) —', message);
    return true;
  }
}
