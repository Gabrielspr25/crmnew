import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function error(message, status = 500) {
  const result = new Error(message);
  result.status = status;
  return result;
}

export function createAudienciaCredentialStore({ directory }) {
  const file = path.join(directory, 'audiencia-credentials.json');

  async function readHash() {
    try {
      const data = JSON.parse(await readFile(file, 'utf8'));
      return typeof data?.passwordHash === 'string' ? data.passwordHash : '';
    } catch (caught) {
      if (caught?.code === 'ENOENT') return '';
      throw error('No se pudo leer la configuración privada de Audiencia; no se modificó nada.');
    }
  }

  async function initializeHash(passwordHash) {
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(file, JSON.stringify({ passwordHash, createdAt: new Date().toISOString() }, null, 2), { encoding: 'utf8', flag: 'wx' });
    } catch (caught) {
      if (caught?.code === 'EEXIST') throw error('Audiencia ya tiene una segunda contraseña configurada. Inicia sesión con ella.', 409);
      throw caught;
    }
  }

  return { readHash, initializeHash };
}
