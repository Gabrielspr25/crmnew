import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const importSource = readFileSync(new URL('../scripts/importSeguimientoClean.mjs', import.meta.url), 'utf8');

test('import limpio normaliza PYMES con dos servicios a CONVERGENTE', () => {
  assert.match(importSource, /function normalizeAccountTypes/);
  assert.match(importSource, /accountType === 'pymes'/);
  assert.match(importSource, /lines\.some\(isMobileLine\) && lines\.some\(isFixedLine\)/);
  assert.match(importSource, /ban\.account_type = 'CONVERGENTE'/);
});

test('clasificacion de oportunidad usa line_kind explicito cuando existe', () => {
  const classifyProduct = importSource.match(/function classifyProduct\(line\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(classifyProduct, /lineKind\.includes\('fijo'\)/);
  assert.match(classifyProduct, /lineKind\.includes\('movil'\)/);
  assert.match(classifyProduct, /return 'fijo_ren'/);
  assert.match(classifyProduct, /return 'movil_ren'/);
});

test('clasificacion reconoce prefijos especiales de servicios', () => {
  const classifyProduct = importSource.match(/function classifyProduct\(line\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(classifyProduct, /phone\.startsWith\('989'\)/);
  assert.match(classifyProduct, /return 'cloud'/);
  assert.match(classifyProduct, /phone\.startsWith\('130'\)/);
  assert.match(classifyProduct, /return 'mpls'/);
});

test('lineas sin plan ni tipo quedan marcadas para revision Tango', () => {
  assert.match(importSource, /function classificationNote/);
  assert.match(importSource, /REQUIERE_REVISION_TANGO/);
  assert.match(importSource, /sin plan\/tipo de venta/);
});

test('codigos de numero corto se clasifican como fijo aunque tengan inicial', () => {
  assert.match(importSource, /function isShortFixedCode/);
  assert.match(importSource, /currentPlan/);
  assert.match(importSource, /return 'fijo_ren'/);
});

test('import limpio copia pasos preparados desde workflow templates', () => {
  assert.match(importSource, /crm_workflow_templates/);
  assert.match(importSource, /crm_workflow_template_steps/);
  assert.match(importSource, /productKeyParts/);
  assert.doesNotMatch(importSource, /'Contactar cliente','Paso inicial del import limpio'/);
});
