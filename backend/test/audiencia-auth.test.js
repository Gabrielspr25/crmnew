import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudienceAccess, createPasswordHash } from '../src/services/audienciaAccess.js';

test('Audiencia solo autoriza al nick exacto configurado y entrega una sesión temporal', async () => {
  const hash = await createPasswordHash('clave-de-prueba');
  const access = createAudienceAccess({requireSecondPassword:true, ownerNick: 'gabriel', passwordHash: hash, tokenSecret: 'test-secret' });

  assert.equal(access.isOwner({ nick: 'otra-cuenta' }), false);
  assert.equal(access.isOwner({ nick: 'Gabriel' }), true);
  await assert.rejects(() => access.unlock({ nick: 'otra-cuenta' }, 'clave-de-prueba'), (error) => error.status === 404);

  const token = await access.unlock({ nick: 'Gabriel' }, 'clave-de-prueba');
  assert.equal(access.verify({ nick: 'Gabriel' }, token).nick, 'Gabriel');
  assert.throws(() => access.verify({ nick: 'otra-cuenta' }, token), (error) => error.status === 404);
});

test('Audiencia no acepta una segunda clave incorrecta', async () => {
  const hash = await createPasswordHash('clave-de-prueba');
  const access = createAudienceAccess({requireSecondPassword:true, ownerNick: 'gabriel', passwordHash: hash, tokenSecret: 'test-secret' });
  await assert.rejects(() => access.unlock({ nick: 'Gabriel' }, 'otra-clave'), (error) => error.status === 401);
});

test('Audiencia permite configurar la segunda contraseña una sola vez para la cuenta propietaria', async () => {
  let storedHash = '';
  const access = createAudienceAccess({requireSecondPassword:true,
    ownerNick: 'gabriel',
    tokenSecret: 'test-secret',
    credentialStore: {
      readHash: async () => storedHash,
      initializeHash: async (hash) => {
        if (storedHash) {
          const error = new Error('Ya configurada');
          error.status = 409;
          throw error;
        }
        storedHash = hash;
      },
    },
  });

  assert.deepEqual(await access.status({ nick: 'gabriel' }), { available: true, setupRequired: true });
  await access.setup({ nick: 'gabriel' }, 'segunda-clave-segura');
  assert.deepEqual(await access.status({ nick: 'gabriel' }), { available: true, setupRequired: false });
  await assert.rejects(() => access.setup({ nick: 'otra-cuenta' }, 'segunda-clave-segura'), (error) => error.status === 404);
  await assert.rejects(() => access.setup({ nick: 'gabriel' }, 'otra-clave-segura'), (error) => error.status === 409);
});

test('Audiencia puede restringirse a una identidad de CRM verificada por nombre cuando el nick no existe en el perfil', async () => {
  const access = createAudienceAccess({requireSecondPassword:true, ownerName: 'Gabriel Sanchez', passwordHash: await createPasswordHash('clave-de-prueba'), tokenSecret: 'test-secret' });
  assert.equal(access.isOwner({ nick: 'desconocido', nombre: 'Gabriel Sanchez' }), true);
  assert.equal(access.isOwner({ nick: 'gabriel', nombre: 'Otra persona' }), false);
});
