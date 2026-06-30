// POST /api/send-push
//
// PHASE 1 (this file): a secret-gated TEST sender. Given a `uid` in the body,
// it pushes a test notification to every stored subscription for that user and
// prunes any dead endpoints. This is enough to verify the full pipe end-to-end
// (subscribe → store → VAPID send → SW push handler → notification) on a real
// installed PWA before the scheduler and per-user timing logic land in Phase 2.
//
// Auth: requires the `x-cron-secret` header to match CRON_SECRET so the
// endpoint can't be triggered by random callers.
import webpush from 'web-push';
import { getDb } from './_firebaseAdmin.js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:cat@ninthlifeinsights.com',
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { uid } = req.body || {};
  if (!uid) {
    return res.status(400).json({ error: 'uid is required for a test send' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    console.error('firebase-admin init failed:', err);
    return res.status(500).json({ error: 'Server not configured' });
  }

  const subsSnap = await db
    .collection('users').doc(uid)
    .collection('pushSubscriptions').get();

  if (subsSnap.empty) {
    return res.status(200).json({ sent: 0, note: 'no subscriptions for this user' });
  }

  const payload = JSON.stringify({
    title: 'Reminders are on',
    body: 'This is a test push from New Worlds RPG.',
    url: '/home',
    tag: 'test-push',
  });

  let sent = 0;
  let pruned = 0;
  await Promise.all(subsSnap.docs.map(async (docSnap) => {
    const sub = docSnap.data();
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      sent += 1;
    } catch (err) {
      // 404/410 mean the subscription is gone — drop it so we stop trying.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await docSnap.ref.delete();
        pruned += 1;
      } else {
        console.error('web-push send failed:', err.statusCode, err.body);
      }
    }
  }));

  return res.status(200).json({ sent, pruned });
}
