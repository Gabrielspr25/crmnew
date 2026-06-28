import vision from '@google-cloud/vision';

let cachedClient = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = new vision.ImageAnnotatorClient();
  }
  return cachedClient;
}

// mode: 'text' (default, para escenas/letreros — usado por /api/ocr/preview)
//       'document' (para tablas y documentos densos — usado por OCR Sync BAN)
export async function extractTextWithVision(buffer, options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Buffer de imagen inválido');
  }

  const mode = options.mode === 'document' ? 'document' : 'text';
  const client = getClient();
  const [result] = mode === 'document'
    ? await client.documentTextDetection({ image: { content: buffer } })
    : await client.textDetection({ image: { content: buffer } });

  if (result.error) {
    throw new Error(result.error.message || 'Vision API error');
  }

  const fromAnnotations = (result.textAnnotations && result.textAnnotations[0]?.description) || '';
  const fromFull = result.fullTextAnnotation?.text || '';
  const rawText = String(fromAnnotations || fromFull || '');
  return { rawText };
}
