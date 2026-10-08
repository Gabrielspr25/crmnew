import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {readBusinessRules} from '../src/services/businessRules.js';

test('Audiencia muestra la regla vigente de cuotas vacias en Reglas del negocio',()=>{
 const context={window:{}};
 const source=readFileSync(new URL('../../frontend/audiencia.js',import.meta.url),'utf8').replace('}());','window.renderRules = data => renderCrmGuide(data,"rules"); }());');
 vm.runInNewContext(source,context);
 const html=context.window.renderRules({tracking:{nodes:[],agents:[],history:[]},business_rules:readBusinessRules()});
 assert.match(html,/Reglas del negocio/);assert.match(html,/8 de octubre/);
 assert.match(html,/cuotas efectivas vacías/);assert.match(html,/solo para elegibilidad móvil de Asana/);
 assert.doesNotMatch(html,/Pagos vacíos no equivalen a cero/);
 assert.match(html,/sin modificar datos originales/);
});
