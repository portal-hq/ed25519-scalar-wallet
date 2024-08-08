/*
 * Modified version of Noble Ed25519 library to support Ed25519-scalar private keys.
 *
 * Pulled from: https://github.com/samkim-crypto/ed25519-scalar
 * Original library: https://github.com/paulmillr/noble-ed25519
 */

import { ExtendedPoint, etc, CURVE } from "@noble/ed25519";

type Bytes = Uint8Array;
type Hex = Bytes | string;

const N = CURVE.n;
const G = ExtendedPoint.BASE;

const err = (m = ""): never => {
  throw new Error(m);
}; // error helper, messes-up stack trace
const padh = (num: number | bigint, pad: number) =>
  num.toString(16).padStart(pad, "0");
const isu8 = (a: unknown): a is Uint8Array =>
  a instanceof Uint8Array ||
  (a != null && typeof a === "object" && a.constructor.name === "Uint8Array");
const au8 = (
  a: unknown,
  l?: number
): Bytes => // is Uint8Array (of specific length)
  !isu8(a) || (typeof l === "number" && l > 0 && a.length !== l)
    ? err("Uint8Array of valid length expected")
    : a;
const u8n = (data?: any) => new Uint8Array(data); // creates Uint8Array
const str = (s: unknown): s is string => typeof s === "string"; // is string
const toU8 = (a: Hex, len?: number) =>
  au8(str(a) ? etc.hexToBytes(a) : u8n(au8(a)), len); // norm(hex/u8a) to u8a
const b2h = (b: Bytes): string =>
  Array.from(b)
    .map((e) => padh(e, 2))
    .join(""); // bytes to hex
const n2b_32LE = (num: bigint) => etc.hexToBytes(padh(num, 32 * 2)).reverse(); // number to bytes LE
const b2n_LE = (b: Bytes): bigint => BigInt("0x" + b2h(u8n(au8(b)).reverse())); // bytes LE to num
const modL_LE = (hash: Bytes): bigint => etc.mod(b2n_LE(hash), N); // modulo L; but little-endian

type ExtK = {
  prefix: Bytes;
  scalar: bigint;
  point: ExtendedPoint;
  pointBytes: Bytes;
};
const getExtendedPublicKeyAsync = (priv: Bytes) =>
  sha512a(priv).then((hashed) => hash2extK(priv, hashed));
const getExtendedPublicKey = (priv: Bytes) => hash2extK(priv, sha512s(priv));

const getPublicKeyAsync = (priv: Hex): Promise<Bytes> =>
  getExtendedPublicKeyAsync(toU8(priv, 32)).then((p) => p.pointBytes);
const getPublicKey = (priv: Hex): Bytes =>
  getExtendedPublicKey(toU8(priv, 32)).pointBytes;

const hash2extK = (priv: Bytes, hashed: Bytes): ExtK => {
  const prefix = hashed.slice(32, 64); // ignore the first 32 bytes generally used to generate scalar
  const scalar = modL_LE(priv); // interpret private key bytes directly as scalar
  const point = G.mul(scalar); // public key point
  const pointBytes = point.toRawBytes(); // point serialized to Uint8Array
  return { prefix, scalar, point, pointBytes };
};

type Finishable<T> = {
  // Reduces logic duplication between
  hashable: Bytes;
  finish: (hashed: Bytes) => T; // sync & async versions of sign(), verify()
}; // hashable=start(); finish(hash(hashable));
type Sha512FnSync = undefined | ((...messages: Bytes[]) => Bytes);
let _shaS: Sha512FnSync;
const sha512a = (...m: Bytes[]) => etc.sha512Async(...m); // Async SHA512
const sha512s = (
  ...m: Bytes[] // Sync SHA512, not set by default
) =>
  typeof _shaS === "function" ? _shaS(...m) : err("etc.sha512Sync not set");

function hashFinish<T>(asynchronous: true, res: Finishable<T>): Promise<T>;
function hashFinish<T>(asynchronous: false, res: Finishable<T>): T;
function hashFinish<T>(asynchronous: boolean, res: Finishable<T>) {
  if (asynchronous) return sha512a(res.hashable).then(res.finish);
  return res.finish(sha512s(res.hashable));
}

const _sign = (e: ExtK, rBytes: Bytes, msg: Bytes): Finishable<Bytes> => {
  const { pointBytes: P, scalar: s } = e;
  const r = modL_LE(rBytes);
  const R = G.mul(r).toRawBytes(); // R = [r]B
  const hashable = etc.concatBytes(R, P, msg); // dom2(F, C) || R || A || PH(M)
  const finish = (hashed: Bytes): Bytes => {
    // k = SHA512(dom2(F, C) || R || A || PH(M))
    const S = etc.mod(r + modL_LE(hashed) * s, N); // S = (r + k * s) mod L; 0 <= s < l
    return au8(etc.concatBytes(R, n2b_32LE(S)), 64); // 64-byte sig: 32b R.x + 32b LE(S)
  };
  return { hashable, finish };
};
const signAsync = async (msg: Hex, privKey: Hex): Promise<Bytes> => {
  const m = toU8(msg); // RFC8032 5.1.6: sign msg with key async
  const e = await getExtendedPublicKeyAsync(toU8(privKey, 32)); // pub,prfx
  const rBytes = await sha512a(e.prefix, m); // r = SHA512(dom2(F, C) || prefix || PH(M))
  return hashFinish(true, _sign(e, rBytes, m)); // gen R, k, S, then 64-byte signature
};
const sign = (msg: Hex, privKey: Hex): Bytes => {
  const m = toU8(msg); // RFC8032 5.1.6: sign msg with key sync
  const e = getExtendedPublicKey(toU8(privKey, 32)); // pub,prfx
  const rBytes = sha512s(e.prefix, m); // r = SHA512(dom2(F, C) || prefix || PH(M))
  return hashFinish(false, _sign(e, rBytes, m)); // gen R, k, S, then 64-byte signature
};

export { getPublicKey, getPublicKeyAsync, sign, signAsync };
