import crypto from "node:crypto";

/**
 * Ed25519 cryptographic utilities for MEMEX decentralized auth.
 *
 * Auth flow:
 *   1. Agent generates Ed25519 keypair locally
 *   2. Agent registers public_key via faucet (or auth/rotate-key)
 *   3. Every request is signed: sign(timestamp + method + path + sha256(body))
 *   4. Server verifies signature using stored public key — no secrets on server
 */

export interface KeyPair {
  publicKey: string;   // hex-encoded 32 bytes
  privateKey: string;  // hex-encoded 64 bytes (seed + public)
}

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  const pubRaw = extractEd25519PublicRaw(publicKey);
  const privRaw = extractEd25519PrivateRaw(privateKey);

  return {
    publicKey: pubRaw.toString("hex"),
    privateKey: privRaw.toString("hex"),
  };
}

export function buildSignatureMessage(
  timestamp: string,
  method: string,
  path: string,
  body: string | Buffer | null,
): string {
  const bodyHash = body
    ? crypto.createHash("sha256").update(body).digest("hex")
    : "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"; // sha256 of empty string
  return `${timestamp}\n${method.toUpperCase()}\n${path}\n${bodyHash}`;
}

export function signRequest(
  privateKeyHex: string,
  timestamp: string,
  method: string,
  path: string,
  body: string | Buffer | null,
): string {
  const message = buildSignatureMessage(timestamp, method, path, body);
  const privKeyObj = crypto.createPrivateKey({
    key: wrapEd25519PrivateDer(Buffer.from(privateKeyHex, "hex")),
    format: "der",
    type: "pkcs8",
  });
  const signature = crypto.sign(null, Buffer.from(message), privKeyObj);
  return signature.toString("hex");
}

export function verifySignature(
  publicKeyHex: string,
  timestamp: string,
  method: string,
  path: string,
  body: string | Buffer | null,
  signatureHex: string,
): boolean {
  try {
    const message = buildSignatureMessage(timestamp, method, path, body);
    const pubKeyObj = crypto.createPublicKey({
      key: wrapEd25519PublicDer(Buffer.from(publicKeyHex, "hex")),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(message), pubKeyObj, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

export function isValidPublicKey(hex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  try {
    crypto.createPublicKey({
      key: wrapEd25519PublicDer(Buffer.from(hex, "hex")),
      format: "der",
      type: "spki",
    });
    return true;
  } catch {
    return false;
  }
}

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function isTimestampValid(timestamp: string, windowMs: number = TIMESTAMP_WINDOW_MS): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Date.now();
  return Math.abs(now - ts) <= windowMs;
}

// ── DER helpers ──
// Ed25519 raw keys are 32 bytes (public) / 32 bytes seed (private).
// Node.js crypto needs them wrapped in DER/SPKI/PKCS8 format.

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex"); // 12 bytes
const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex"); // 16 bytes

function wrapEd25519PublicDer(raw32: Buffer): Buffer {
  return Buffer.concat([ED25519_SPKI_PREFIX, raw32]);
}

function wrapEd25519PrivateDer(raw32: Buffer): Buffer {
  return Buffer.concat([ED25519_PKCS8_PREFIX, raw32]);
}

function extractEd25519PublicRaw(spkiDer: Buffer): Buffer {
  return spkiDer.subarray(ED25519_SPKI_PREFIX.length);
}

function extractEd25519PrivateRaw(pkcs8Der: Buffer): Buffer {
  return pkcs8Der.subarray(ED25519_PKCS8_PREFIX.length);
}
