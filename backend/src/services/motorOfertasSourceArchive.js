import { createHash } from 'node:crypto';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE_FIELDS = new Set([
  'rootDir',
  'type',
  'originalName',
  'mimeType',
  'buffer',
]);

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
    || !/^[a-z0-9][a-z0-9_-]*$/i.test(source.type)
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
  if (!Buffer.isBuffer(source.buffer)) {
    throw new TypeError('buffer debe ser un Buffer.');
  }
}

function sanitizeFileName(originalName) {
  const baseName = path.posix.basename(originalName.replaceAll('\\', '/'));
  const safeName = baseName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
    .replace(/[. ]+$/g, '');

  return safeName && safeName !== '.' && safeName !== '..'
    ? safeName
    : 'fuente';
}

export async function archiveOfferSource(source) {
  assertArchiveInput(source);

  const digest = sha256(source.buffer);
  const typeDir = path.join(source.rootDir, source.type);
  await mkdir(typeDir, { recursive: true });

  const hashPrefix = `${digest}-`;
  const existingName = (await readdir(typeDir)).find(
    (name) => name.startsWith(hashPrefix)
  );
  const archivedName = existingName
    ?? `${hashPrefix}${sanitizeFileName(source.originalName)}`;

  if (!existingName) {
    try {
      await writeFile(path.join(typeDir, archivedName), source.buffer, {
        flag: 'wx',
      });
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }

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

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function buildSourcesManifest(sources) {
  const entries = [...sources].sort(
    (left, right) => compareText(left.type, right.type)
      || compareText(left.sha256, right.sha256)
  );
  const serialized = JSON.stringify(entries);

  return {
    entries,
    sha256: sha256(serialized),
  };
}
