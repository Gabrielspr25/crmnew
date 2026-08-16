import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runParser } from '../src/services/secureParserRunner.js';

function makeScripts() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-runner-'));
  return {
    dir,
    write(name, source) {
      fs.writeFileSync(path.join(dir, name), source);
    },
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

test('runParser ejecuta sin shell y parsea JSON valido', async () => {
  const scripts = makeScripts();
  try {
    scripts.write('ok.js', 'console.log(JSON.stringify({ ok: true, file: process.argv[2] }))');
    const parsed = await runParser('ok.js', 'archivo.pdf', {
      command: process.execPath,
      scriptsDir: scripts.dir,
      timeoutMs: 1000,
      maxOutputBytes: 1024,
    });
    assert.deepEqual(parsed, { ok: true, file: 'archivo.pdf' });
  } finally {
    scripts.cleanup();
  }
});

test('runParser corta por timeout con error sanitizado', async () => {
  const scripts = makeScripts();
  try {
    scripts.write('slow.js', 'setTimeout(() => console.log(JSON.stringify({ ok: true })), 5000)');
    await assert.rejects(
      () => runParser('slow.js', 'archivo.pdf', {
        command: process.execPath,
        scriptsDir: scripts.dir,
        timeoutMs: 50,
        maxOutputBytes: 1024,
      }),
      (error) => {
        assert.equal(error.code, 'parser_timeout');
        assert.doesNotMatch(error.message, /archivo\.pdf|stderr|slow\.js/);
        return true;
      }
    );
  } finally {
    scripts.cleanup();
  }
});

test('runParser corta por salida demasiado grande', async () => {
  const scripts = makeScripts();
  try {
    scripts.write('large.js', 'process.stdout.write("x".repeat(2048))');
    await assert.rejects(
      () => runParser('large.js', 'archivo.pdf', {
        command: process.execPath,
        scriptsDir: scripts.dir,
        timeoutMs: 1000,
        maxOutputBytes: 100,
      }),
      (error) => {
        assert.equal(error.code, 'parser_output_too_large');
        assert.doesNotMatch(error.message, /x{20}/);
        return true;
      }
    );
  } finally {
    scripts.cleanup();
  }
});

test('runParser maneja exit code invalido, error de proceso y JSON invalido', async () => {
  const scripts = makeScripts();
  try {
    scripts.write('exit.js', 'console.error("stderr secreto"); process.exit(7)');
    await assert.rejects(
      () => runParser('exit.js', 'archivo.pdf', {
        command: process.execPath,
        scriptsDir: scripts.dir,
        timeoutMs: 1000,
        maxOutputBytes: 1024,
      }),
      (error) => {
        assert.equal(error.code, 'parser_exit_error');
        assert.doesNotMatch(error.message, /stderr secreto|archivo\.pdf/);
        return true;
      }
    );

    scripts.write('bad-json.js', 'console.log("no-json")');
    await assert.rejects(
      () => runParser('bad-json.js', 'archivo.pdf', {
        command: process.execPath,
        scriptsDir: scripts.dir,
        timeoutMs: 1000,
        maxOutputBytes: 1024,
      }),
      { code: 'parser_json_invalido' }
    );

    await assert.rejects(
      () => runParser('ok.js', 'archivo.pdf', {
        command: process.platform === 'win32' ? 'C:\\definitely-missing-parser-command.exe' : '/definitely-missing-parser-command',
        scriptsDir: scripts.dir,
        timeoutMs: 1000,
        maxOutputBytes: 1024,
      }),
      (error) => {
        assert.equal(error.code, 'parser_process_error');
        assert.doesNotMatch(error.message, /archivo\.pdf/);
        return true;
      }
    );
  } finally {
    scripts.cleanup();
  }
});
