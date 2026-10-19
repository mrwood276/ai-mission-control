/**
 * Delivery Tracking & Duplicate Protection Utility
 * Tracks delivery attempts and verified insertions associated with
 * stable scene IDs and project IDs.
 */

export const DELIVERY_HISTORY_STORAGE_KEY = 'aimc_delivery_history_v1';

/**
 * @typedef {Object} DeliveryRecord
 * @property {string} projectId
 * @property {string} sceneId
 * @property {number} sceneNumber
 * @property {string} target - 'flow' | 'gemini'
 * @property {string} status - 'inserted' | 'copied' | 'failed'
 * @property {boolean} verified
 * @property {number} timestamp
 * @property {number} count
 */

/**
 * Retrieves all delivery records from storage.
 * @param {Storage} [storage]
 * @returns {Record<string, DeliveryRecord>}
 */
export function getAllDeliveryRecords(storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return {};

  try {
    const raw = store.getItem(DELIVERY_HISTORY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Generates composite key for tracking.
 * @param {string} projectId
 * @param {string} sceneId
 * @param {string} target
 * @returns {string}
 */
export function makeDeliveryKey(projectId, sceneId, target = 'flow') {
  return `${projectId || 'default'}::${sceneId || 'unknown'}::${target}`;
}

/**
 * Checks if a scene has a previous successful/copied delivery record.
 * @param {string} projectId
 * @param {string} sceneId
 * @param {string} [target='flow']
 * @param {Storage} [storage]
 * @returns {DeliveryRecord|null}
 */
export function getPreviousDelivery(projectId, sceneId, target = 'flow', storage) {
  if (!projectId || !sceneId) return null;
  const records = getAllDeliveryRecords(storage);
  const key = makeDeliveryKey(projectId, sceneId, target);
  const record = records[key];
  if (!record) return null;

  // Only return as previous delivery if status was inserted or copied
  if (record.status === 'inserted' || record.status === 'copied') {
    return record;
  }
  return null;
}

/**
 * Records a delivery event.
 * @param {string} projectId
 * @param {string} sceneId
 * @param {Object} details
 * @param {number} details.sceneNumber
 * @param {string} [details.target='flow']
 * @param {string} details.status
 * @param {boolean} [details.verified=false]
 * @param {Storage} [storage]
 * @returns {DeliveryRecord}
 */
export function recordDelivery(
  projectId,
  sceneId,
  { sceneNumber = 1, target = 'flow', status = 'inserted', verified = false },
  storage
) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  const records = getAllDeliveryRecords(store);
  const key = makeDeliveryKey(projectId, sceneId, target);
  const existing = records[key];

  const now = Date.now();
  const updatedRecord = {
    projectId,
    sceneId,
    sceneNumber,
    target,
    status,
    verified: Boolean(verified),
    timestamp: now,
    count: (existing?.count || 0) + 1,
  };

  records[key] = updatedRecord;

  if (store) {
    try {
      store.setItem(DELIVERY_HISTORY_STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.warn('[DeliveryTracker] Failed to persist delivery history:', err.message);
    }
  }

  return updatedRecord;
}

/**
 * Formats a relative timestamp into a readable string (e.g. "just now", "3m ago").
 * @param {number} timestamp
 * @param {number} [now=Date.now()]
 * @returns {string}
 */
export function formatTimeAgo(timestamp, now = Date.now()) {
  if (!timestamp) return 'recently';
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 45) return 'just now';
  if (diffSec < 90) return '1m ago';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
