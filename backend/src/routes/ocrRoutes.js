// OCR: subir/pegar imagen de la lista de suscriptores -> filas parseadas.
// Motor: Google Vision (principal) + Tesseract (fallback opcional). Copiado del viejo.
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../auth.js';
import { extractTextForSync, parseLocalOcrText, rowsToClipboardText, ocrImageBuffer } from '../services/ocrParser.js';

export const ocrRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

// POST /api/subscribers/extract-image  (file o image_base64) -> { rows:[{subscriber,type,status,pricePlan}] }
ocrRouter.post('/subscribers/extract-image', requireAuth, upload.single('file'), async (req, res) => {
  try {
    let buf = null, mime = '';
    if (req.file?.buffer) { buf = req.file.buffer; mime = String(req.file.mimetype || '').toLowerCase(); }
    else if (req.body?.image_base64) {
      const b64 = String(req.body.image_base64).trim().replace(/^data:.*;base64,/, '');
      if (!b64) return res.status(400).json({ error: 'image_base64 inválido' });
      buf = Buffer.from(b64, 'base64'); mime = String(req.body?.mime_type || 'image/png').toLowerCase();
    } else return res.status(400).json({ error: 'Subí una imagen (file) o image_base64' });

    if (mime.includes('pdf')) return res.status(422).json({ error: 'Por ahora subí una imagen (no PDF). Recortá la tabla y subila como foto.' });

    const { text, engine, ocr_warnings } = await extractTextForSync(buf);
    let parsed = parseLocalOcrText(text);
    // Si Vision dio texto pero el parser no detectó filas, reintento con Tesseract (si está)
    if (engine === 'google' && parsed.rows.length === 0 && String(process.env.OCR_ENGINE || '').toLowerCase().trim() !== 'google') {
      try { const tt = await ocrImageBuffer(buf); const tp = parseLocalOcrText(tt); if (tp.rows.length > 0) parsed = tp; } catch (e) {}
    }
    const rows = parsed.rows.map((r) => ({ subscriber: r.subscriber, type: r.type, status: r.status, pricePlan: r.pricePlan }));
    res.json({ ok: true, engine, rows, text: rowsToClipboardText(rows), warnings: parsed.warnings, ocr_warnings });
  } catch (e) {
    console.error('[ocr extract-image]', e.message);
    res.status(500).json({ error: e.message });
  }
});
