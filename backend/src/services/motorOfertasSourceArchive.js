import { createHash, randomUUID } from 'node:crypto';
import {
  link,
  lstat,
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

const SOURCE_FIELDS = new Set([
  'rootDir',
  'type',
  'originalName',
  'mimeType',
  'buffer',
]);

const ALLOWED_TYPES = new Set([
  'tabla_financiamiento',
  'lista_precios',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function assertArchiveInput(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('La fuente debe ser un objeto.');
  }

  const unexpectedFields = Object.keys(source).filter(
    (field) => !SOURCE_FIELDS.has(field)
  );
  if (unexpectedFields.length > 0) {
    throw new TypeError('No se aceptan rutas suministradas por el cliente.');
  }

  if (typeof source.rootDir !== 'string' || source.rootDir.trim() === '') {
    throw new TypeError('rootDir es requerido.');
  }
  if (
    typeof source.type !== 'string'
    || !ALLOWED_TYPES.has(source.type)
  ) {
    throw new TypeError('El tipo de fuente es invalido.');
  }
  if (
    typeof source.originalName !== 'string'
    || source.originalName.trim() === ''
  ) {
    throw new TypeError('originalName es requerido.');
  }
  if (typeof source.mimeType !== 'string' || source.mimeType.trim() === '') {
    throw new TypeError('mimeType es requerido.');
  }
  if (!ALLOWED_MIME_TYPES.has(source.mimeType)) {
    throw new TypeError('El MIME de la fuente no esta permitido.');
  }
  if (!Buffer.isBuffer(source.buffer)) {
    throw new TypeError('buffer debe ser un Buffer.');
  }
}

function integrityError(message) {
  const error = new Error(`Error de integridad: ${message}`);
  error.code = 'integridad_fuente_invalida';
  return error;
}

async function verifyArchivedFile(archivedPath, expectedSha256) {
  const fileStat = await lstat(archivedPath);
  if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
    throw integrityError('la ruta existente no es un archivo regular.');
  }

  const actualSha256 = sha256(await readFile(archivedPath));
  if (actualSha256 !== expectedSha256) {
    throw integrityError('el contenido existente no coincide con su SHA-256.');
  }
}

async function archiveAtomically(archivedPath, buffer, digest) {
  try {
    await verifyArchivedFile(archivedPath, digest);
    return;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const temporaryPath = `${archivedPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, buffer, { flag: 'wx' });

  try {
    try {
      await link(temporaryPath, archivedPath);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      await verifyArchivedFile(archivedPath, digest);
    }
  } finally {
    try {
      await unlink(temporaryPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

export async function archiveOfferSource(source) {
  assertArchiveInput(source);

  const digest = sha256(source.buffer);
  const archivedName = `${digest}-${source.type}.xlsx`;
  const typeDir = path.join(source.rootDir, source.type);
  await mkdir(typeDir, { recursive: true });
  await archiveAtomically(path.join(typeDir, archivedName), source.buffer, digest);
  const relativePath = path.join(source.type, archivedName);

  return {
    type: source.type,
    originalName: source.originalName,
    mimeType: source.mimeType,
    sha256: digest,
    archivedName,
    relativePath,
  };
}

export async function readArchivedOfferSource({ rootDir, source }) {
  if (typeof rootDir !== 'string' || !rootDir.trim()) {
    throw new TypeError('rootDir es requerido.');
  }
  if (!source || typeof source !== 'object') {
    throw new TypeError('La fuente archivada es requerida.');
  }
  const relativePath = source.ruta_relativa ?? source.relativePath;
  const expectedSha256 = source.sha256;
  if (typeof relativePath !== 'string' || !relativePath || !SHA256_PATTERN.test(expectedSha256 ?? '')) {
    throw integrityError('la fuente archivada no tiene ruta o SHA valido.');
  }
  const root = path.resolve(rootDir);
  const archivePath = path.resolve(root, relativePath);
  const relative = path.relative(root, archivePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw integrityError('la ruta archivada esta fuera del directorio permitido.');
  }
  await verifyArchivedFile(archivePath, expectedSha256.toLowerCase());
  return readFile(archivePath);
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function buildSourcesManifest(sources) {
  if (!Array.isArray(sources)) {
    throw new TypeError('sources debe ser un arreglo.');
  }

  const seenTypes = new Set();
  const entries = sources.map((source) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new TypeError('Cada fuente del manifiesto debe ser un objeto.');
    }
    if (typeof source.type !== 'string' || !ALLOWED_TYPES.has(source.type)) {
      throw new TypeError('El tipo de fuente del manifiesto es invalido.');
    }
    if (typeof source.sha256 !== 'string' || !SHA256_PATTERN.test(source.sha256)) {
      throw new TypeError('El SHA-256 de la fuente tiene formato invalido.');
    }
    if (seenTypes.has(source.type)) {
      throw new TypeError(`Tipo duplicado en el manifiesto: ${source.type}.`);
    }
    seenTypes.add(source.type);

    return {
      type: source.type,
      sha256: source.sha256.toLowerCase(),
    };
  }).sort(
    (left, right) => compareText(left.type, right.type)
      || compareText(left.sha256, right.sha256)
  );
  const serialized = JSON.stringify(entries);

  return {
    entries,
    sha256: sha256(serialized),
  };
}
