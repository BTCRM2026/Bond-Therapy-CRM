import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const parameters = { N: 16384, r: 8, p: 1 } as const;

function derive(password: string, salt: Buffer, length: number, options: ScryptOptions) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, length, options, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64, parameters);
  return `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, n, r, p, saltValue, hashValue] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64');
  const actual = await derive(password, Buffer.from(saltValue, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
