import {readFileSync} from 'node:fs';
const document=JSON.parse(readFileSync(new URL('../../../docs/audiencia/reglas-negocio.json',import.meta.url),'utf8'));
if(document.version!==1||!Array.isArray(document.rules)||!document.rules.every(rule=>['title','text','source'].every(key=>typeof rule[key]==='string'&&rule[key].trim())))throw Error('Resumen de reglas inválido.');
export const readBusinessRules=()=>structuredClone(document);
