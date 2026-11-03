/**
 * TwinForge Studio - Deterministic Cryptographic Evidence Fingerprint
 * Computes reproducible SHA-256 signatures for Factory Acceptance Test records.
 */

export interface EvidenceFingerprintResult {
  payloadString: string;
  hexFingerprint: string;
}

/**
 * Recursively sort object keys for deterministic canonical JSON stringification
 */
export function canonicalStringify(obj: any): string {
  if (obj === null || obj === undefined) {
    return JSON.stringify(obj);
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(obj[k]));
  return '{' + entries.join(',') + '}';
}

/**
 * Computes deterministic SHA-256 digest of an evidence payload.
 * Supports both Web Crypto API (browser / Electron) and Node.js crypto (Vitest / CLI).
 */
export async function computeEvidenceFingerprint(payloadObject: any): Promise<EvidenceFingerprintResult> {
  const payloadString = canonicalStringify(payloadObject);

  // 1. Web Crypto API
  if (typeof crypto !== 'undefined' && crypto?.subtle?.digest) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return { payloadString, hexFingerprint: hex };
  }

  // 2. Node.js crypto fallback for headless environments
  try {
    const nodeCrypto = await import('node:crypto');
    const hex = nodeCrypto.createHash('sha256').update(payloadString, 'utf8').digest('hex');
    return { payloadString, hexFingerprint: hex };
  } catch (err: any) {
    throw new Error(`Cryptographic SHA-256 digest unavailable in this runtime environment: ${err?.message || String(err)}`);
  }
}
