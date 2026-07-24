// Boletin espejo: recibe un PDF, corre pdfplumber y devuelve el TEXTO tal cual.
// Espejo fiel — no interpreta montos ni condiciones, no memoriza nada del boletin.
// Aditivo: no toca el motor de ofertas ni /api/planes-modulos.
import { Router } from 'express';
import multer from 'multer';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../auth.js';

export const boletinRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(__dirname, '../../../scripts');
const UPLOAD_DIR = process.env.PLANES_UPLOAD_DIR || path.resolve(__dirname, '../../uploads/pdf-planes');
const PYTHON = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}

const uploadPdf = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf')
      ? cb(null, true)
      : cb(new Error('Solo se aceptan archivos PDF')),
});

function extraerTexto(filePath) {
  return new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    const proc = spawn(PYTHON, [path.join(SCRIPTS_DIR, 'extract_pdf_text.py'), filePath]);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', e => reject(new Error(`No se pudo ejecutar ${PYTHON}: ${e.message}`)));
    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`extract_pdf_text.py fallo (exit ${code}): ${stderr.slice(0, 400)}`));
      try { resolve(JSON.parse(stdout)); } catch { reject(new Error('extract_pdf_text.py: salida no es JSON valido')); }
    });
  });
}

// POST /api/boletin/extraer-texto  (multipart, campo "pdf")
boletinRouter.post('/extraer-texto', requireAuth, uploadPdf.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Falta el archivo PDF (campo "pdf").' });
  const filePath = req.file.path;
  try {
    const data = await extraerTexto(filePath);
    if (!data || data.ok === false) {
      return res.status(422).json({ ok: false, error: (data && data.error) || 'No se pudo extraer el texto del PDF.' });
    }
    return res.json({
      ok: true,
      archivo: req.file.originalname,
      total_paginas: data.total_paginas,
      paginas: data.paginas,
      texto_completo: data.texto_completo,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || 'Error interno al leer el PDF.') });
  } finally {
    fs.unlink(filePath, () => {}); // no conservamos el PDF: es espejo, no almacen
  }
});
