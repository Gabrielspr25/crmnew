import crypto from 'node:crypto';

export function buildManifestHash({ dominio, normalizadorVersion, fuentes }) {
  const manifest = [...fuentes]
    .map(({ tipo, sha256 }) => ({ tipo, sha256: String(sha256).toLowerCase() }))
    .sort((a, b) => `${a.tipo}:${a.sha256}`.localeCompare(`${b.tipo}:${b.sha256}`));
  return crypto.createHash('sha256').update(JSON.stringify({ dominio, normalizadorVersion, fuentes: manifest })).digest('hex');
}
