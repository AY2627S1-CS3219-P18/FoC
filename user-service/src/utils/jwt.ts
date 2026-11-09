// AI Assistance Disclosure:
// Tool: Claude Code (claude-sonnet-5), date: 2026-09-25
// 25/09/2026: Stage 4a - JWT verification utility
// Author review:
// 25/09/2026: Stage 4c - JWT signing utility
// Author review:
// 2026-10-17: Stage 13a - sign/verify by `kid` (JWT header) against a current + optional
//   previous key, and add getJwks() for the JWKS endpoint (Stage 13b). Governing decision:
//   instructions.md Stage 13. No requirements, architecture, schema, or API decisions were
//   made by the AI tool.
// Author review:
// 2026-11-09: Stage 27a - access tokens now carry header `typ: at+JWT` and an `sid` claim
//   (the login's refresh_tokens.id); verifyAccessToken rejects any other `typ` and returns
//   `sid` too. Added signElevationToken/verifyElevationToken for the new elevation token
//   (header `typ: ep+JWT`, claims sub/role/sid/iat/exp, same RS256 key/kid handling as the
//   access token). Governing decision: instructions.md Stage 27 (the elevation token table).
//   No requirements, architecture, schema, or API decisions were made by the AI tool.
// Author review:

import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

type SigningKey = { kid: string; publicKey: string; privateKey: string };
type VerificationKey = { kid: string; publicKey: string };

const currentKey: SigningKey = {
  kid: config.jwt.keyId,
  publicKey: readFileSync(config.jwt.publicKeyPath, 'utf8'),
  privateKey: readFileSync(config.jwt.privateKeyPath, 'utf8'),
};

const previousKey: VerificationKey | undefined =
  config.jwt.previousKeyId && config.jwt.previousPublicKeyPath
    ? {
        kid: config.jwt.previousKeyId,
        publicKey: readFileSync(config.jwt.previousPublicKeyPath, 'utf8'),
      }
    : undefined;

const knownKeys: VerificationKey[] = previousKey ? [currentKey, previousKey] : [currentKey];

function findKeyForToken(token: string): VerificationKey {
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded && typeof decoded !== 'string' ? decoded.header.kid : undefined;
  const key = knownKeys.find((k) => k.kid === kid);

  if (!key) {
    throw new Error('Unknown key id');
  }
  return key;
}

// Throws if the token's header `typ` is not exactly `expectedTyp`, so an access token and an
// elevation token (and a plain `JWT`) each reject the other's tokens.
function assertTokenType(token: string, expectedTyp: string): void {
  const decoded = jwt.decode(token, { complete: true });
  const typ = decoded && typeof decoded !== 'string' ? decoded.header.typ : undefined;
  if (typ !== expectedTyp) {
    throw new Error(`Unexpected token type: ${typ}`);
  }
}

export function verifyAccessToken(token: string): { user_id: string; role: string; sid: string } {
  assertTokenType(token, 'at+JWT');
  const key = findKeyForToken(token);
  const payload = jwt.verify(token, key.publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;

  return {
    user_id: payload.sub as string,
    role: payload.role as string,
    sid: payload.sid as string,
  };
}

export function signAccessToken({
  userId,
  role,
  sid,
}: {
  userId: string;
  role: string;
  sid: string;
}): string {
  return jwt.sign({ role, sid }, currentKey.privateKey, {
    algorithm: 'RS256',
    subject: userId,
    expiresIn: `${config.jwt.accessTokenTtlMinutes}m`,
    keyid: currentKey.kid,
    header: { alg: 'RS256', typ: 'at+JWT' },
  });
}

export function verifyElevationToken(token: string): { user_id: string; role: string; sid: string } {
  assertTokenType(token, 'ep+JWT');
  const key = findKeyForToken(token);
  const payload = jwt.verify(token, key.publicKey, { algorithms: ['RS256'] }) as jwt.JwtPayload;

  return {
    user_id: payload.sub as string,
    role: payload.role as string,
    sid: payload.sid as string,
  };
}

export function signElevationToken({
  userId,
  role,
  sid,
}: {
  userId: string;
  role: string;
  sid: string;
}): string {
  return jwt.sign({ role, sid }, currentKey.privateKey, {
    algorithm: 'RS256',
    subject: userId,
    expiresIn: `${config.jwt.elevationTokenTtlMinutes}m`,
    keyid: currentKey.kid,
    header: { alg: 'RS256', typ: 'ep+JWT' },
  });
}

export function getJwks(): { keys: JsonWebKey[] } {
  const keys = knownKeys.map(({ kid, publicKey }) => ({
    ...createPublicKey(publicKey).export({ format: 'jwk' }),
    kid,
    use: 'sig',
    alg: 'RS256',
  }));

  return { keys };
}
