import { db } from '../services/dbService';

export async function purgeExpiredScans() {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const records = await db.getAll();
  const expired = records.filter((item) => new Date(item.scannedAt) < sixMonthsAgo);

  if (expired.length === 0) {
    return { removed: 0 };
  }

  await db.removeMany(expired.map((item) => item.id));
  return { removed: expired.length };
}

export function shouldRecheck(lastCheckedAt?: number) {
  if (!lastCheckedAt) {
    return true;
  }

  const now = new Date();
  const lastCheck = new Date(lastCheckedAt);
  const months =
    (now.getFullYear() - lastCheck.getFullYear()) * 12 + (now.getMonth() - lastCheck.getMonth());

  return months >= 1;
}
