import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectPlan, renderProjectPlanMarkdown } from '../backend/src/services/projectPlanService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const mdPath = path.join(rootDir, 'docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md');

const plan = await loadProjectPlan();
await writeFile(mdPath, renderProjectPlanMarkdown(plan), 'utf8');
console.log(`Plan Maestro generado: ${mdPath}`);
