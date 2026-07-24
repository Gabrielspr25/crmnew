// Beneficios y Reglas: almacen editable (archivo JSON, sin BD) que alimenta al
// constructor. Los montos y condiciones NO viven en el codigo: se editan aqui y
// se reemplazan con lo que suba/edite el usuario. Aditivo; no toca el motor.
import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { requireAuth } from '../auth.js';

export const beneficiosReglasRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = process.env.PLANES_UPLOAD_DIR || path.resolve(__dirname, '../../uploads/pdf-planes');
const STORE = path.join(STORE_DIR, 'beneficios-reglas.json');
try { fs.mkdirSync(STORE_DIR, { recursive: true }); } catch {}

function leer() {
  try {
    const raw = fs.readFileSync(STORE, 'utf8');
    const doc = JSON.parse(raw);
    return doc && typeof doc === 'object' ? doc : {};
  } catch {
    return {}; // sin reglas cargadas todavia: el constructor lo indica
  }
}

// GET /api/beneficios-reglas  — lo consume el constructor. Sin reglas => {}.
beneficiosReglasRouter.get('/', (_req, res) => {
  res.json({ ok: true, reglas: leer() });
});

// PUT /api/beneficios-reglas  — editar/reemplazar las reglas (admin/supervisor via sesion).
beneficiosReglasRouter.put('/', requireAuth, (req, res) => {
  const reglas = req.body && typeof req.body === 'object' ? (req.body.reglas ?? req.body) : null;
  if (!reglas || typeof reglas !== 'object' || Array.isArray(reglas)) {
    return res.status(400).json({ ok: false, error: 'Cuerpo invalido: se espera un objeto de reglas.' });
  }
  const doc = {
    reglas,
    actualizado_por: req.user?.nick || req.user?.email || 'admin',
    actualizado_en: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(STORE, JSON.stringify(doc, null, 2), 'utf8');
    return res.json({ ok: true, reglas, actualizado_en: doc.actualizado_en });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'No se pudo guardar: ' + String(err.message || err) });
  }
});
