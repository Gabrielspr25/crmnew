import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
const DEFAULT_SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');
const DEFAULT_TIMEOUT_MS = Number(process.env.PARSER_TIMEOUT_MS || 60_000);
const DEFAULT_MAX_OUTPUT_BYTES = Number(process.env.PARSER_MAX_OUTPUT_BYTES || 10 * 1024 * 1024);

export class ParserExecutionError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'ParserExecutionError';
    this.code = code;
    this.details = details;
  }
}

function safePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function runParser(script, filePath, options = {}) {
  const command = options.command || DEFAULT_PYTHON;
  const scriptsDir = options.scriptsDir || DEFAULT_SCRIPTS_DIR;
  const timeoutMs = safePositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
  const maxOutputBytes = safePositiveInteger(options.maxOutputBytes, DEFAULT_MAX_OUTPUT_BYTES);
  const logger = options.logger || null;
  const scriptPath = path.join(scriptsDir, script);

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let timeoutReached = false;
    let outputLimitReached = false;
    let timer = null;

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (logger?.error) logger.error('[parser-runner]', { code: error.code, details: error.details });
      reject(error);
    };

    const child = spawn(command, [scriptPath, filePath], {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    timer = setTimeout(() => {
      timeoutReached = true;
      child.kill();
    }, timeoutMs);

    const trackChunk = (stream, chunk) => {
      const bytes = Buffer.byteLength(chunk);
      if (stream === 'stdout') {
        stdoutBytes += bytes;
        if (stdoutBytes <= maxOutputBytes) stdout += chunk.toString();
      } else {
        stderrBytes += bytes;
        if (stderrBytes <= maxOutputBytes) stderr += chunk.toString();
      }
      if (stdoutBytes + stderrBytes > maxOutputBytes) {
        outputLimitReached = true;
        child.kill();
      }
    };

    child.stdout.on('data', (chunk) => trackChunk('stdout', chunk));
    child.stderr.on('data', (chunk) => trackChunk('stderr', chunk));

    child.on('error', (error) => {
      rejectOnce(new ParserExecutionError('parser_process_error', { cause: error.code || error.message }));
    });

    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      if (timeoutReached) return rejectOnce(new ParserExecutionError('parser_timeout', { timeoutMs }));
      if (outputLimitReached) return rejectOnce(new ParserExecutionError('parser_output_too_large', { maxOutputBytes }));
      if (code !== 0) return rejectOnce(new ParserExecutionError('parser_exit_error', { exitCode: code, stderrBytes }));
      try {
        const parsed = JSON.parse(stdout);
        settled = true;
        resolve(parsed);
      } catch {
        rejectOnce(new ParserExecutionError('parser_json_invalido', { stdoutBytes }));
      }
    });
  });
}
