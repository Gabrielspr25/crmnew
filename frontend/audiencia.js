(function () {
  'use strict';

  const TOKEN_KEY = 'vp_audiencia_token';
  let audienceData = null;
  let selectedWorkspace = '';
  let selectedSection = 'projects';
  let selectedCrmTab = 'tracking';
  let selectedCrmBranch = 'clientes';
  const TREE_STATES = {
    publicado_verificado: 'Publicado y verificado',
    local_pendiente_publicacion: 'Implementado localmente, pendiente de publicación',
    por_corregir: 'Por corregir',
    pendiente_desarrollo: 'Pendiente de desarrollar',
    sin_verificar: 'Sin verificar',
  };
  let selectedTrackingProject = 'newcrm';
  let saving = false;
  let accessRequest = 0;
  const expandedBranches = new Set();
  const trackingAgents = () => audienceData?.tracking?.agents || [];
  const trackingNodes = () => audienceData?.tracking?.nodes || [];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const byId = (id) => document.getElementById(id);
  const reviewDate = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
  const WORK_STATES = {pendiente:'Pendientes',en_curso:'Actuales',completado:'Completados',bloqueado:'Bloqueados'};
  const now = () => new Date().toLocaleString('es');
  function headers() {
    const configured = window.vpAudienciaAuth ? window.vpAudienciaAuth() : {};
    const crmToken = configured.Authorization || (() => {
      try { return localStorage.getItem('vp_token') ? `Bearer ${localStorage.getItem('vp_token')}` : ''; } catch { return ''; }
    })();
    const base = crmToken ? { Authorization: crmToken } : {};
    return base;
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...headers(), ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'No se pudo completar Audiencia.');
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function installStyles() {
    if (byId('audienciaStyles')) return;
    const style = document.createElement('style');
    style.id = 'audienciaStyles';
    style.textContent = `
      .aud-head,.aud-actions,.aud-toolbar,.aud-item-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.aud-head,.aud-toolbar{justify-content:space-between}.aud-head h1{margin:0}.aud-sub{color:var(--txt2);margin:6px 0 0}.aud-project-selector{display:flex;gap:7px;flex-wrap:wrap;margin:18px 0 12px}.aud-project-tab{border:1px solid var(--line);border-radius:7px;background:var(--card2);color:var(--txt2);padding:8px 10px;font:inherit;font-size:12px;cursor:pointer}.aud-project-tab.on{background:var(--primary);border-color:var(--primary);color:var(--on-accent)}.aud-agent-directory{border:1px solid var(--line);border-radius:8px;background:var(--card);padding:14px;margin:0 0 12px}.aud-agent-directory h2{font-size:14px;margin:0}.aud-agent-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px;margin-top:10px}.aud-agent{border-left:3px solid var(--primary);background:var(--card2);padding:10px;border-radius:0 7px 7px 0}.aud-agent h3{font-size:14px;margin:0}.aud-agent p{font-size:12px;margin:5px 0;color:var(--txt2)}.aud-agent .aud-status{font-size:11px}.aud-agent-tasks{display:grid;gap:6px;margin:8px 0;padding:0;list-style:none}.aud-agent-tasks li{border-top:1px solid var(--line);padding-top:6px;font-size:11px;color:var(--txt2)}.aud-agent-tasks li:first-child{border-top:0;padding-top:0}.aud-agent-tasks b{color:var(--txt);font-size:12px}.aud-agent-tasks span,.aud-agent-tasks small{display:block;margin-top:2px}.aud-agent-tasks span{color:var(--primary);font-weight:700}.aud-workspace{min-height:420px;border:1px solid var(--line);border-radius:8px;background:var(--card);padding:16px}.aud-workspace-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid var(--line)}.aud-workspace-head h2{font-size:18px;margin:0}.aud-subproject{display:grid;gap:8px;padding:10px;border:1px solid var(--primary);border-radius:7px;background:var(--primary-soft);margin-bottom:14px}.aud-subproject b{display:block;font-size:13px}.aud-subproject small{display:block;margin-top:3px}.aud-module-list{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.aud-module{background:var(--card2);border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:11px}.aud-counts{display:flex;gap:6px;flex-wrap:wrap}.aud-count{font-size:11px;border:1px solid var(--line);padding:3px 7px;border-radius:999px;color:var(--txt2)}.aud-list{display:grid;gap:10px}.aud-item{border:1px solid var(--line);background:var(--card2);padding:14px;border-radius:8px}.aud-item h3{font-size:15px;margin:0}.aud-item p{margin:8px 0;color:var(--txt2);font-size:13px}.aud-meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--txt3);font-size:12px}.aud-status{font-weight:700;color:var(--primary)}.aud-empty{border:1px dashed var(--line);padding:24px;text-align:center;color:var(--txt2);border-radius:8px}.aud-lock{max-width:480px;margin:28px auto;padding:22px;border:1px solid var(--line);border-radius:8px;background:var(--card)}.aud-lock h2{margin-top:0}.aud-field{display:grid;gap:5px;margin:10px 0}.aud-field label{font-size:12px;color:var(--txt2)}.aud-field textarea{min-height:78px;resize:vertical}.aud-dialog{max-width:620px;width:min(94vw,620px)}.aud-dialog form{display:grid;gap:10px}.aud-dialog .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:620px){.aud-workspace{padding:12px}.aud-dialog .row{grid-template-columns:1fr}.aud-head h1{font-size:24px}}
    `;
    style.textContent += '.aud-tree-row{display:flex;align-items:center}.aud-toggle{width:26px;min-width:26px;border:1px solid var(--line);border-radius:4px;background:var(--card);color:var(--txt);cursor:pointer}.aud-toggle-space{width:26px;min-width:26px}.aud-tree-row .aud-tree-node{flex:1;min-width:0;overflow-wrap:anywhere}.aud-child{display:block;text-align:left;width:100%;background:var(--card);color:var(--txt);border:1px solid var(--line);padding:8px;margin:5px 0;border-radius:5px;cursor:pointer}.aud-tree-detail pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:260px;overflow:auto}.aud-tree-detail li{margin:6px 0;overflow-wrap:anywhere}.aud-tree-nav{max-height:75vh;overflow:auto}.aud-dialog{max-height:90vh;overflow:auto}.aud-agent-directory{margin-top:14px}.aud-tree-detail{min-width:0}.aud-tree-detail h4{margin:16px 0 5px}';
    style.textContent += `.aud-tree{display:grid;grid-template-columns:minmax(220px,32%) minmax(0,1fr);gap:12px;margin:12px 0}.aud-tree-nav{display:grid;align-content:start;gap:4px}.aud-tree-node{display:flex;align-items:center;gap:7px;text-align:left;border:1px solid transparent;background:transparent;color:var(--txt2);padding:7px 8px;border-radius:6px;font:inherit;font-size:12px;cursor:pointer}.aud-tree-node:hover,.aud-tree-node.on{background:var(--primary-soft);border-color:var(--primary);color:var(--txt)}.aud-tree-dot{width:7px;height:7px;border-radius:50%;background:var(--line);flex:0 0 auto}.aud-tree-node.on .aud-tree-dot{background:var(--primary)}.aud-tree-detail{border:1px solid var(--line);background:var(--card2);padding:14px;border-radius:7px}.aud-tree-detail h3{margin:0;font-size:16px}.aud-tree-detail p{font-size:13px;color:var(--txt2);margin:8px 0}.aud-tree-detail h4{font-size:12px;margin:12px 0 4px}.aud-tree-state{display:inline-flex;border:1px solid var(--line);border-radius:999px;padding:3px 7px;font-size:11px;color:var(--txt2)}.aud-tree-evidence{border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin:10px 0;padding:7px 0}.aud-tree-evidence p{margin:3px 0 9px}.aud-tree-steps{margin:10px 0 0;padding-left:18px;color:var(--txt2);font-size:13px}.aud-tree-steps li{margin:5px 0}.aud-tree-legend{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.aud-tree-legend span{font-size:10px;color:var(--txt3);border:1px solid var(--line);border-radius:999px;padding:3px 6px}@media(max-width:760px){.aud-tree{grid-template-columns:1fr}.aud-tree-nav{max-height:260px;overflow:auto}}`;
    style.textContent += '.aud-agent-table-wrap{overflow:auto;max-width:100%}.aud-agent-table{width:100%;min-width:760px;border-collapse:collapse;table-layout:auto}.aud-agent-table th,.aud-agent-table td{padding:9px;vertical-align:top;font-size:12px;overflow-wrap:anywhere}.aud-agent-table small{display:block;margin-top:5px;color:var(--txt2);font-size:11px}.aud-agent-table details{margin-top:7px}.aud-agent-table ul{padding-left:18px}.aud-agent-link{border:0;padding:0;background:transparent;color:var(--txt);text-align:left;text-decoration:underline;cursor:pointer;font:inherit}.aud-agent-table th{min-width:100px}.aud-agent-table th:first-child{min-width:155px}.aud-agent-unassigned{margin-top:12px}.aud-agent-summary{min-width:1000px;table-layout:fixed}.aud-agent-summary th:nth-child(1){width:190px;min-width:190px}.aud-agent-summary th:nth-child(2){width:220px}.aud-agent-summary th:nth-child(3){width:230px}.aud-agent-summary th:nth-child(4){width:240px}.aud-agent-summary th:nth-child(5){width:220px}';
    style.textContent += '.aud-pending-overview{border:1px solid var(--primary);background:var(--card2);padding:12px;border-radius:7px;margin:12px 0}.aud-module-operational small{display:block;color:var(--txt2);font-size:11px;margin:5px 0}.aud-module-operational h4{color:var(--txt);margin-top:12px}.aud-module-brief{display:block;font-size:11px;line-height:1.35;margin-top:5px;color:var(--txt2)}.aud-tree-node:has(.aud-module-brief){display:block}.aud-pending-overview summary{cursor:pointer;color:var(--txt);font-size:12px}.aud-pending-overview h3{margin:0;font-size:16px}.aud-pending-overview .aud-agent-table-wrap{max-height:420px}.aud-pending-overview .aud-agent-link{display:block;margin:7px 0}.aud-pending-overview th{position:sticky;top:0;background:var(--card);z-index:1}.aud-pending-overview td:first-child{min-width:180px}.aud-pending-overview td:nth-child(2),.aud-pending-overview td:nth-child(3){min-width:240px}';
    document.head.append(style);
  }

  function statusCounts(projectId) {
    return audienceData.states.map((state) => ({ state, count: audienceData.items.filter((item) => item.projectId === projectId && item.kind === 'tarea' && item.state === state).length }));
  }

  function renderPendingOverview(data, selected) {
    const nodes = (data.tracking?.nodes || []).filter(n => n.project === selected.project);
    let root = selected;
    while (root.parentId) { const parent = nodes.find(n => n.id === root.parentId); if (!parent) break; root = parent; }
    const ids = new Set([root.id]); let previous = -1;
    while (previous !== ids.size) { previous = ids.size; for (const n of nodes) if (ids.has(n.parentId)) ids.add(n.id); }
    const scope = nodes.filter(n => ids.has(n.id));
    const works = scope.filter(n => ['work','step'].includes(n.kind) && (n.workState !== 'completado' || n.fulfillment !== 'completo'));
    const entries = works.length ? works : scope.filter(n => n.kind === 'function' && (n.missing?.length || n.corrections?.length || n.improvements?.length));
    const readPart = (value, label) => { const at = (value || '').indexOf(label); if (at < 0) return ''; return value.slice(at + label.length).split(/Decisión necesaria:|Evidencias anteriores|Evidencias previas| La evidencia de/)[0].trim(); };
    const corrections = new Set(scope.flatMap(n => n.corrections || []));
    const improvements = new Set(scope.flatMap(n => n.improvements || []));
    const decisions = entries.filter(n => (n.verification || '').includes('Decisión necesaria:'));
    const rows = entries.map(n => {
      const type = n.corrections?.length ? 'Corrección documentada' : n.status === 'pendiente_desarrollo' ? 'Encargo pendiente' : 'Verificación pendiente';
      const agent = data.tracking?.agents?.find(a => a.id === n.assignee);
      const criterion = readPart(n.verification, 'Criterio de cierre:') || readPart(n.verification, 'Cierre:');
      const decision = readPart(n.verification, 'Decisión necesaria:');
      return '<tr><td><strong>' + esc(type) + '</strong><button class="aud-agent-link" data-agent-branch="' + esc(n.id) + '">' + esc(n.title) + '</button><small>' + esc(agent?.name || 'Por definir') + ' · ' + esc(WORK_STATES[n.workState] || 'Sin estado de trabajo registrado') + '</small></td><td>' + esc(n.nextStep || 'Por definir') + '</td><td>' + esc(criterion || 'Criterio específico por documentar; consultar requisitos y evidencia de la rama.') + (decision ? '<small><strong>Decisión necesaria:</strong> ' + esc(decision) + '</small>' : '') + '</td></tr>';
    }).join('');
    return '<section class="aud-pending-overview" aria-label="Pendientes de ' + esc(root.title) + '"><h3>Qué falta en ' + esc(root.title) + '</h3><p class="s">Registro cargado · revisión ' + esc(data.revision) + ' · Evidencia histórica; publicación y cumplimiento separados.</p><div class="aud-tree-legend"><span>Correcciones documentadas: ' + corrections.size + '</span><span>Trabajos por revisar: ' + entries.length + '</span><span>Decisiones registradas: ' + decisions.length + '</span><span>Mejoras propuestas: ' + improvements.size + '</span></div>' + (rows ? '<details><summary>Ver ' + entries.length + ' pendientes con responsable y criterio de cierre</summary><div class="aud-agent-table-wrap"><table class="aud-agent-table"><thead><tr><th>Tipo, pendiente y responsable</th><th>Siguiente paso</th><th>Criterio de cierre y decisión</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p>Sin trabajos pendientes registrados en esta rama. Consultar su evidencia.</p>') + '</section>';
  }

  function renderModuleOperationalDetail(data, selected) {
    const nodes = data.tracking?.nodes || [];
    const ids = new Set([selected.id]); let previous = -1;
    while (previous !== ids.size) { previous = ids.size; for (const n of nodes) if (n.project === selected.project && ids.has(n.parentId)) ids.add(n.id); }
    const scope = nodes.filter(n => ids.has(n.id));
    const works = scope.filter(n => ['work','step'].includes(n.kind) && (n.workState !== 'completado' || n.fulfillment !== 'completo'));
    const groups = [...new Set(works.map(n => n.assignee || ''))].map(id => {
      const assigned = works.filter(n => (n.assignee || '') === id);
      const agent = data.tracking?.agents?.find(a => a.id === id);
      const check = assigned[0]?.verification || '';
      const marker = check.includes('Criterio de cierre:') ? 'Criterio de cierre:' : 'Cierre:';
      const criterion = check.includes(marker) ? check.split(marker)[1].split(/Decisión necesaria:| La evidencia de/)[0].trim() : '';
      return '<li><b>' + esc(agent?.name || 'Responsable pendiente de definir') + '</b>: ' + assigned.length + ' trabajos por revisar. ' + esc(assigned[0]?.nextStep || 'Siguiente acción por definir') + (criterion ? '<small><b>Cierre del primer trabajo:</b> ' + esc(criterion) + '</small>' : '') + (assigned.length > 1 ? '<small>Incluye: ' + esc(assigned.slice(0,2).map(n => n.title).join(' / ')) + '. Resto consultable en los pendientes de esta rama.</small>' : '') + '</li>';
    }).join('');
    const access = (selected.evidence || []).filter(e => e.environment === 'produccion');
    const latest = (data.tracking?.history || []).filter(e => e.entity === 'nodes' && e.entityId === selected.id).slice(-1)[0];
    const children = nodes.filter(n => n.parentId === selected.id && ['area','function'].includes(n.kind));
    const description = children.map(n => n.description).filter(Boolean).slice(0,2).join(' ');
    return '<section class="aud-module-operational" aria-label="Detalle operacional de ' + esc(selected.title) + '"><p>' + esc(description || selected.description) + '</p><h4>Qué está comprobado</h4>' + (access.length ? access.slice(0,2).map(e => '<p>' + esc(e.result) + '<small>Fuente: ' + esc(e.source) + ' · ' + esc(e.date) + '</small></p>').join('') : '<p>Sin evidencia de acceso productivo registrada para este módulo.</p>') + '<p class="s">La evidencia de acceso al menú no acredita que todas las funciones estén completas.</p><h4>Qué falta resolver</h4><ul>' + (selected.missing || []).map(t => '<li>' + esc(t) + '</li>').join('') + (selected.corrections || []).map(t => '<li><b>Corrección documentada:</b> ' + esc(t) + ' Causa y vigencia actual por comprobar en el trabajo correspondiente.</li>').join('') + '</ul><h4>Quién prepara el siguiente paso</h4>' + (groups ? '<ul>' + groups + '</ul>' : '<p>Sin trabajos pendientes con responsable registrado en esta rama.</p>') + '<p class="s">' + esc(selected.assignee ? 'Responsable registrado del módulo: ' + (data.tracking?.agents?.find(a => a.id === selected.assignee)?.name || selected.assignee) + '.' : 'No hay un responsable técnico global del módulo registrado.') + ' Se conservan los responsables de cada trabajo; asignación no equivale a ejecución.</p><h4>Cómo se cierra</h4><p>Completar los criterios específicos de cada trabajo con evidencia fechada, resultado y permisos; resolver las decisiones pendientes antes de pruebas con escrituras. Abrir los pendientes de esta rama para consultar cada criterio de cierre.</p><p class="s">Fecha de revisión de evidencia: ' + esc(selected.reviewedAt || 'Sin registrar') + '. Organización más reciente del seguimiento: ' + esc(latest?.at || 'Sin cambio fechado') + '. La organización reciente no es una nueva prueba de funcionamiento.</p></section>';
  }

  function renderCrmWorkTree(projectName) {
    const nodes = trackingNodes().filter(node => node.project === projectName);
    if (!nodes.length) return '<p class="s">Sin funciones inventariadas todavía. Agrega una rama con evidencia.</p><button class="btn ghost" data-new-kind="module" data-parent="">Agregar módulo de seguimiento</button>';
    if (!nodes.some(node => node.id === selectedCrmBranch)) selectedCrmBranch = nodes[0].id;
    const selected = nodes.find(node => node.id === selectedCrmBranch);
    const renderBranch = (node, depth = 0) => {
      const children = nodes.filter(child => child.parentId === node.id);
      const open = expandedBranches.has(node.id);
      const branchIds = new Set([node.id]); let branchSize = -1;
      while (branchSize !== branchIds.size) { branchSize = branchIds.size; for (const child of nodes) if (branchIds.has(child.parentId)) branchIds.add(child.id); }
      const branchNodes = nodes.filter(n => branchIds.has(n.id));
      const brief = text => text.length > 145 ? text.slice(0,142).replace(/\s+\S*$/, '') + '…' : text;
      const correctionCount = new Set(branchNodes.flatMap(n => n.corrections || [])).size;
      const improvementCount = new Set(branchNodes.flatMap(n => n.improvements || [])).size;
      const decisionCount = branchNodes.filter(n => ['work','step'].includes(n.kind) && (n.verification || '').includes('Decisión necesaria:')).length;
      const pendingCount = branchNodes.filter(n => ['work','step'].includes(n.kind) && (n.workState !== 'completado' || n.fulfillment !== 'completo')).length;
      const categories = [correctionCount ? correctionCount + ' corrección documentada' : '', pendingCount ? pendingCount + ' trabajos por revisar' : '', decisionCount ? decisionCount + ' decisiones pendientes' : '', improvementCount ? improvementCount + ' mejoras propuestas' : ''].filter(Boolean).join(' · ');
      const operational = node.kind === 'module' ? '<small class="aud-module-brief">' + esc(categories || 'Sin pendientes registrados; consultar evidencia') + '</small><small class="aud-module-brief">' + esc(brief(node.missing?.[0] && !node.missing[0].startsWith('Consultar el cumplimiento') ? 'Falta: ' + node.missing[0] : 'Siguiente: ' + (node.nextStep || 'Por definir'))) + '</small>' : '';

      return '<div class="aud-tree-row" style="padding-left:' + depth * 12 + 'px">' +
        (children.length ? '<button class="aud-toggle" aria-label="' + (open ? 'Plegar ' : 'Desplegar ') + esc(node.title) + '" aria-expanded="' + open + '" data-toggle-branch="' + esc(node.id) + '">' + (open ? '−' : '+') + '</button>' : '<span class="aud-toggle-space"></span>') +
        '<button class="aud-tree-node ' + (selected.id === node.id ? 'on' : '') + '" aria-current="' + (selected.id === node.id) + '" data-select-branch="' + esc(node.id) + '">' + '<span>' + esc(node.title) + '</span>' + operational + '</button></div>' +
        (open ? children.map(child => renderBranch(child, depth + 1)).join('') : '');
    };
    const list = (title, values, empty) => '<h4>' + title + '</h4>' + (values?.length ? '<ul>' + values.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>' : '<p class="s">' + empty + '</p>');
    const agent = trackingAgents().find(a => a.id === selected.assignee);
    const evidence = selected.evidence.map(e => '<li><b>' + esc(e.environment) + ' · ' + esc(e.date) + '</b><br>' + esc(e.source) + '<br>' + esc(e.result) + '</li>').join('');
    const decisions = audienceData.tracking.decisions.filter(d => d.nodeId === selected.id);
    const events = historyForBranch(audienceData.tracking.history, decisions, selected.id).slice(-10).reverse();
    const children = nodes.filter(n => n.parentId === selected.id);
    const nextKind = selected.kind === 'module' ? 'area' : selected.kind === 'area' ? 'function' : ['work','step'].includes(selected.kind) ? 'step' : 'work';
    const kindLabel = {module:'Módulo',area:'Área o submódulo',function:'Función',work:'Trabajo de desarrollo',step:'Paso'};
    return '<section aria-label="Árbol de trabajo de ' + esc(projectName) + '"><p class="s">Registro de dirección · los trabajos de desarrollo se mantienen separados de las tareas comerciales. Publicado no equivale a completo.</p>' + renderPendingOverview(audienceData, selected) + '<div class="aud-tree"><nav class="aud-tree-nav" aria-label="Ramas del proyecto">' + nodes.filter(n => !n.parentId).map(n => renderBranch(n)).join('') + '</nav><article class="aud-tree-detail"><div class="aud-toolbar"><h3>' + esc(selected.title) + '</h3><button class="btn ghost" data-edit-branch="' + esc(selected.id) + '">Editar seguimiento</button></div>' + (selected.kind === 'module' ? renderModuleOperationalDetail(audienceData, selected) + '<details><summary>Consultar estado técnico y significado</summary><p>Entrega registrada: ' + esc(TREE_STATES[selected.status]) + '. Cumplimiento: ' + esc(selected.fulfillment) + '. Publicado y verificado del menú acredita el acceso documentado; el cumplimiento depende de las funciones y trabajos pendientes.</p></details>' : '<p>' + esc(kindLabel[selected.kind]) + ' · <b>' + esc(TREE_STATES[selected.status]) + '</b> · Cumplimiento: <b>' + esc(selected.fulfillment) + '</b></p><p>' + esc(selected.description) + '</p><div class="aud-meta"><span>Responsable: ' + esc(agent?.name || 'Por asignar') + '</span><span>Función: ' + esc(selected.role || 'Por asignar') + '</span><span>Revisado: ' + esc(selected.reviewedAt || 'Sin revisión registrada') + '</span></div>') +
      list('Requisitos', selected.requirements, 'Requisitos por documentar; no se declara completo.') +
      '<h4>Evidencia y ambiente</h4><ul>' + (evidence || '<li>Sin evidencia registrada.</li>') + '</ul><h4>Comprobación pendiente</h4><p>' + esc(selected.verification || 'Sin comprobaciones pendientes registradas para el alcance descrito.') + '</p>' +
      list('Faltantes', selected.missing, 'Sin faltantes registrados; consulta el cumplimiento y la evidencia.') + list('Correcciones necesarias', selected.corrections, 'Sin correcciones demostradas registradas.') + list('Mejoras propuestas', selected.improvements, 'Sin propuestas registradas.') +
      (selected.workState ? '<p>Trabajo: ' + esc(WORK_STATES[selected.workState]) + '</p>' : '') + '<h4>Próximo paso</h4><p>' + esc(selected.nextStep || 'Por definir') + '</p>' + (selected.deadline ? '<p>Fecha límite: ' + esc(selected.deadline) + '</p>' : '') + list('Pasos', selected.steps, 'Sin pasos adicionales registrados.') +
      '<h4>' + (selected.kind === 'function' ? 'Trabajos pendientes de desarrollo' : 'Contenido de la rama') + '</h4>' + children.map(child => '<button class="aud-child" data-select-branch="' + esc(child.id) + '">' + esc(child.title) + ' · ' + esc(TREE_STATES[child.status]) + '</button>').join('') + '<button class="btn ghost" data-new-kind="' + nextKind + '" data-parent="' + esc(selected.id) + '">Agregar ' + esc(kindLabel[nextKind].toLowerCase()) + '</button>' +
      '<button class="btn ghost" data-quick-branch="' + esc(selected.id) + '">' + (['work','step'].includes(selected.kind) ? 'Actualizar trabajo / añadir nota' : 'Añadir nota') + '</button><h4>Notas y decisiones</h4>' + decisions.map(d => '<p>' + esc(d.at) + ' · ' + esc(d.text) + '</p>').join('') + '<button class="btn ghost" data-decision-branch="' + esc(selected.id) + '">Registrar decisión</button>' +
      '<h4>Historial de cambios</h4>' + (events.length ? events.map(e => '<details><summary>' + esc(e.at) + ' · ' + esc(e.actor.name) + '</summary><pre>' + esc(JSON.stringify({antes:e.before,despues:e.after},null,2)) + '</pre></details>').join('') : '<p class="s">Sin modificaciones posteriores al inventario.</p>') +
      (selected.id === 'constructor-mapa' ? '<a class="btn ghost" href="/progreso-constructor.html" target="_blank" rel="noopener noreferrer">Abrir mapa del Constructor</a>' : '') + '</article></div></section>';
  }

  function historyForBranch(history, decisions, nodeId) {
    return history.filter(event => event.entityId === nodeId || decisions.some(decision => decision.id === event.entityId));
  }

  function quickTrackingUpdate(tracking, id, state, note, noteId, at) {
    const next = structuredClone(tracking);
    const node = next.nodes.find(n => n.id === id);
    if (!node) throw new Error('La rama ya no existe. Actualiza el registro.');
    if (['work','step'].includes(node.kind)) node.workState = state;
    if (note.trim()) next.decisions.push({id:noteId,nodeId:id,text:'Nota: ' + note.trim(),at,assignee:''});
    return next;
  }

  function openQuickTrackingEditor(id) {
    const current = trackingNodes().find(n => n.id === id);
    if (!current) return;
    const isWork = ['work','step'].includes(current.kind);
    const dialog = document.createElement('dialog'); dialog.className = 'modal aud-dialog';
    dialog.innerHTML = '<form><h2>' + (isWork ? 'Actualizar trabajo' : 'Añadir nota') + '</h2><p>' + esc(current.title) + '</p>' + (isWork ? '<label class="aud-field">Estado del trabajo<select class="inp" name="workState">' + Object.entries(WORK_STATES).map(([key,label]) => '<option value="' + key + '" ' + ((current.workState || 'pendiente')===key ? 'selected' : '') + '>' + label + '</option>').join('') + '</select></label>' : '') + '<label class="aud-field">Nota' + (isWork ? ' (opcional)' : '') + '<textarea class="inp" name="note" rows="3"' + (isWork ? '' : ' required') + '></textarea></label><p class="s">Conserva el historial. Completar un trabajo no certifica publicación ni cumplimiento técnico.</p><p role="alert" id="quickError"></p><div class="aud-actions"><button type="button" class="btn ghost" id="quickCancel">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>';
    document.body.append(dialog);
    dialog.querySelector('#quickCancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      const note = String(values.get('note') || '').trim();
      if (!isWork && !note) return;
      const tracking = quickTrackingUpdate(audienceData.tracking,id,String(values.get('workState') || ''),note,crypto.randomUUID(),reviewDate());
      const button = dialog.querySelector('[type=submit]'); button.disabled = true;
      try { await mutate({...audienceData,tracking}); dialog.close(); }
      catch (error) { dialog.querySelector('#quickError').textContent = error.message; }
      finally { button.disabled = false; }
    };
    dialog.showModal(); dialog.querySelector('[name=note]').focus();
  }

  function openTrackingEditor(id = '', kind = 'work', parentId = '') {
    const current = trackingNodes().find(n => n.id === id);
    const dialog = document.createElement('dialog'); dialog.className = 'modal aud-dialog';
    const field = (name, label, type='textarea') => '<label class="aud-field">' + label + (type === 'textarea' ? '<textarea class="inp" name="' + name + '">' + esc(Array.isArray(current?.[name]) ? current[name].join('\n') : current?.[name] || '') + '</textarea>' : '<input class="inp" name="' + name + '" type="' + type + '" value="' + esc(current?.[name] || '') + '">') + '</label>';
    const states = Object.entries(TREE_STATES).map(([key,label]) => '<option value="' + key + '" ' + (current?.status===key ? 'selected' : '') + '>' + label + '</option>').join('');
    const agents = '<option value="">Por asignar</option>' + trackingAgents().map(a => '<option value="' + esc(a.id) + '" ' + (current?.assignee===a.id ? 'selected' : '') + '>' + esc(a.name) + '</option>').join('');
    const workControl = ['work','step'].includes(current?.kind || kind) ? '<label class="aud-field">Estado del trabajo<select class="inp" name="workState">' + Object.entries(WORK_STATES).map(([key,label]) => '<option value="' + key + '" ' + (current?.workState===key ? 'selected' : '') + '>' + label + '</option>').join('') + '</select></label>' : '';
    dialog.innerHTML = '<form><h2>' + (current ? 'Editar seguimiento' : 'Agregar rama de desarrollo') + '</h2>' + field('title','Título','text') + workControl + field('description','Descripción') + '<label class="aud-field">Estado de entrega<select class="inp" name="status">' + states + '</select></label><label class="aud-field">Cumplimiento<select class="inp" name="fulfillment"><option value="incompleto">Incompleto</option><option value="completo" ' + (current?.fulfillment==='completo' ? 'selected' : '') + '>Completo respecto a los requisitos</option></select></label>' + field('requirements','Requisitos (uno por línea)') + field('missing','Faltantes (uno por línea)') + field('corrections','Correcciones necesarias') + field('improvements','Mejoras propuestas (sin aprobar)') + field('verification','Qué comprobación falta') + '<label class="aud-field">Responsable<select class="inp" name="assignee">' + agents + '</select></label>' + field('role','Función del responsable','text') + field('nextStep','Próximo paso') + field('deadline','Fecha límite, si existe','date') + field('steps','Pasos (uno por línea)') + '<h3>Añadir evidencia (opcional)</h3><label class="aud-field">Ambiente<select class="inp" name="evidenceEnvironment"><option value="local">Local</option><option value="produccion">Producción</option><option value="documentacion">Documentación</option></select></label><label class="aud-field">Fuente<input class="inp" name="evidenceSource"></label><label class="aud-field">Resultado<textarea class="inp" name="evidenceResult"></textarea></label><p class="s" role="alert" id="trackingError"></p><div class="aud-actions"><button type="button" class="btn ghost" id="trackingCancel">Cancelar</button><button class="btn" type="submit">Guardar seguimiento</button></div></form>';
    document.body.append(dialog); dialog.querySelector('[name=title]').required = true;
    dialog.querySelector('#trackingCancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); const values = new FormData(event.currentTarget), today = reviewDate();
      const node = current ? structuredClone(current) : {id:crypto.randomUUID(),project:selectedTrackingProject,parentId,kind,evidence:[]};
      for (const key of ['title','description','status','fulfillment','verification','assignee','role','nextStep','deadline']) node[key] = String(values.get(key) || '').trim();
      for (const key of ['requirements','missing','corrections','improvements','steps']) node[key] = String(values.get(key) || '').split('\n').map(v=>v.trim()).filter(Boolean);
      if (['work','step'].includes(node.kind)) node.workState = String(values.get('workState') || 'pendiente');
      node.reviewedAt = today;
      if(values.get('evidenceSource') || values.get('evidenceResult'))node.evidence.push({environment:values.get('evidenceEnvironment'),source:String(values.get('evidenceSource')).trim(),result:String(values.get('evidenceResult')).trim(),date:today});
      const tracking = structuredClone(audienceData.tracking), idx=tracking.nodes.findIndex(n=>n.id===node.id);
      if(idx<0)tracking.nodes.push(node);else tracking.nodes[idx]=node;
      try { await mutate({...audienceData,tracking}); selectedCrmBranch=node.id; dialog.close(); renderData(); } catch(error) { dialog.querySelector('#trackingError').textContent=error.message; }
    }; dialog.showModal();
  }

  function renderLocked(message = '') {
    const view = byId('view'); if (!view) return;
    view.innerHTML = '<section class="aud-lock"><h1>Audiencia</h1><p class="aud-sub">' + esc(message || 'Información oculta en esta pantalla. El acceso permanece protegido por tu sesión del CRM.') + '</p><button class="btn" id="audienceUnlock">Mostrar Audiencia</button></section>';
    byId('audienceUnlock').onclick = () => window.audienciaInit();
  }


  // Asignaciones persistidas y evidencia histórica; no existe telemetría de ejecución.

  const CRM_VIEWS = {tracking:'Seguimiento',structure:'Cómo funciona el CRM',rules:'Reglas del negocio',plan:'Plan y pendientes',decisions:'Decisiones',proof:'Pruebas y publicación'};
  // Resumen documental local revisado el 2026-10-08. No certifica vigencia comercial.
  const CRM_DOCUMENTATION = {
    structure: [
      {title:'Cliente, cuentas y líneas',text:'Clientes reúne la ficha, los BAN y sus suscriptores. Un cliente, un BAN, una línea y una venta son entidades distintas. Asana organiza el seguimiento; Comisiones consulta las ventas.',source:'AGENTS.md · Reglas sobre datos; CLAUDE.md · Líneas existentes y ventas'},
      {title:'De la oportunidad a la venta',text:'Enviar un cliente con empresa o nombre válido a seguimiento permite revisar oportunidades, productos, tareas, llamadas y notas. Las líneas existentes para renovación no se convierten automáticamente en oportunidades de toda la cartera.',source:'docs/REGLAS_ASANA_SEGUIMIENTO.md · Entrada operativa y Renovaciones'},
      {title:'Fuentes y propuesta comercial',text:'Admin Ofertas mantiene las fuentes por módulo. El Portal consulta lo publicado y aloja Constructor: Nueva propuesta. El mapa de desarrollo del Constructor pertenece al proyecto Constructor en Audiencia.',source:'AGENTS.md · Arquitectura actual; docs/audiencia/README.md · Organización del árbol'},
      {title:'El cerebro del sistema',text:'La pantalla presenta información; las rutas y servicios del backend ejecutan las reglas y validaciones; PostgreSQL conserva los datos operativos. Audiencia tiene su registro privado de proyectos, responsables, decisiones e historial, separado de los datos comerciales.',source:'AGENTS.md · Arquitectura comprobada; CLAUDE.md · Runtime real; docs/audiencia/README.md · Datos y respaldo'},
      {title:'Seguimiento y Katy',text:'Audiencia registra requisitos, estados, evidencias y próximos pasos. El complemento de Katy consulta y actualiza seguimiento mediante permisos del propietario y revisión. Una asignación registrada no demuestra que un agente esté ejecutándose ahora.',source:'docs/audiencia/API-TRACKING-KATY.md · Contrato de versión 1; docs/audiencia/README.md · Responsables'}
    ],
    rules: []
  };
  function renderCrmGuide(data, tab, origin = 'Origen sin registrar') {
    const nodes = (data.tracking?.nodes || []).filter(n => n.project === 'newcrm');
    const agents = data.tracking?.agents || [];
    const history = data.tracking?.history || [];
    const owner = id => agents.find(a => a.id === id)?.name || (id ? 'Responsable no registrado: ' + id : 'Por asignar');
    const branch = n => '<button class="aud-agent-link" data-agent-branch="' + esc(n.id) + '">' + esc(n.title) + '</button><small>' + esc(n.id) + '</small>';
    const table = (head,rows) => '<div class="aud-agent-table-wrap" role="region" aria-label="' + esc(CRM_VIEWS[tab]) + '" tabindex="0"><table class="aud-agent-table"><thead><tr>' + head.map(h=>'<th>'+esc(h)+'</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    const empty = text => '<p class="aud-empty">' + text + '</p>';
    const list = values => values?.length ? '<ul>' + values.map(v=>'<li>'+esc(v)+'</li>').join('') + '</ul>' : 'Sin registrar';
    let content = '';
    if (tab === 'structure' || tab === 'rules') {
      content = '<p class="s">Reglas aprobadas el 8 de octubre de 2026, consultadas desde la API del CRM. Las fuentes se identifican por sección.</p>' + table(['Tema','Explicación y fuente'],(tab==='rules'?(data.business_rules?.rules||[]):CRM_DOCUMENTATION[tab]).map(row=>'<tr><td><b>'+esc(row.title)+'</b></td><td>'+esc(row.text)+'<details><summary>Fuente documental</summary><p>'+esc(row.source)+'</p></details></td></tr>').join(''));
      if(tab==='structure')content += '<h3>Módulos del registro cargado</h3>' + (nodes.some(n=>n.kind==='module') ? table(['Módulo','Descripción registrada','Requisitos'],nodes.filter(n=>n.kind==='module').map(n=>'<tr><td>'+branch(n)+'</td><td>'+esc(n.description||'Sin descripción registrada')+'</td><td>'+list(n.requirements)+'</td></tr>').join('')) : empty('Sin módulos de newcrm registrados.'));
      else content += '<p class="s">Catálogo completo de reglas comerciales y elegibilidad vigente: no verificado en esta vista. Consultar la fuente oficial del módulo y su vigencia antes de aplicar una oferta. Este resumen no modifica ni reemplaza el motor de reglas.</p>';
    } else if(tab==='plan') {
      const works=nodes.filter(n=>['work','step'].includes(n.kind));
      const workRows=group=>group.map(n=>'<tr><td>'+branch(n)+'</td><td>'+esc(WORK_STATES[n.workState]||'Sin estado registrado')+'</td><td>'+esc(owner(n.assignee))+'<small>'+esc(n.role||'Sin función registrada')+'</small></td><td>'+esc(TREE_STATES[n.status]||'Sin verificar')+'<small>Cumplimiento: '+esc(n.fulfillment||'Sin registrar')+'</small></td><td>'+esc(n.nextStep||'Sin registrar')+'<small>Vencimiento: '+esc(n.deadline||'Sin registrar')+'</small></td><td>'+esc(n.verification||'Sin comprobación pendiente registrada')+'<details><summary>Faltantes y correcciones</summary><b>Faltantes</b>'+list(n.missing)+'<b>Correcciones</b>'+list(n.corrections)+'</details>'+'</td></tr>').join('');
      const pending=works.filter(n=>n.workState!=='completado'),completed=works.filter(n=>n.workState==='completado');
      content='<p class="s">Plan derivado de los trabajos y pasos registrados de newcrm. No asigna trabajos ni calcula porcentajes de avance.</p><h3>Pendientes: '+pending.length+'</h3>'+ (pending.length?table(['Trabajo','Estado registrado','Responsable','Entrega y cumplimiento','Próximo paso','Comprobaciones / faltantes / correcciones'],workRows(pending)):empty('Sin trabajos pendientes registrados.')) + '<details><summary>Completados según el registro: '+completed.length+'</summary>'+(completed.length?table(['Trabajo','Estado registrado','Responsable','Entrega y cumplimiento','Próximo paso','Comprobaciones / faltantes / correcciones'],workRows(completed)):empty('Sin trabajos completados registrados.'))+'</details>';
      const gaps=nodes.filter(n=>!['work','step'].includes(n.kind)&&((n.missing||[]).length||(n.corrections||[]).length));
      content+='<details><summary>Faltantes y correcciones de módulos, áreas y funciones: '+gaps.length+'</summary>'+(gaps.length?table(['Rama','Responsable','Faltantes','Correcciones','Próximo paso'],gaps.map(n=>'<tr><td>'+branch(n)+'</td><td>'+esc(owner(n.assignee))+'</td><td>'+list(n.missing)+'</td><td>'+list(n.corrections)+'</td><td>'+esc(n.nextStep||'Sin registrar')+'</td></tr>').join('')):empty('Sin faltantes ni correcciones registrados en estas ramas.'))+'</details>';
    } else if(tab==='decisions') {
      const decisions=(data.tracking?.decisions||[]).filter(d=>nodes.some(n=>n.id===d.nodeId));
      content='<p class="s">Decisiones y notas vinculadas a ramas de newcrm. No incluyen las de otros proyectos.</p>' + (decisions.length?table(['Tipo / fecha','Rama','Texto registrado','Responsable','Autor e historial'],decisions.map(d=>{const n=nodes.find(n=>n.id===d.nodeId),event=history.find(e=>e.entity==='decisions'&&e.entityId===d.id&&e.before===null)||history.find(e=>e.entity==='decisions'&&e.entityId===d.id);return '<tr><td>'+esc(d.text.startsWith('Nota:')?'Nota':'Decisión')+'<small>'+esc(d.at||'Sin fecha registrada')+'</small></td><td>'+branch(n)+'</td><td>'+esc(d.text)+'</td><td>'+esc(owner(d.assignee))+'</td><td>'+ (event?esc(event.actor?.name||'Sin autor registrado')+'<small>'+esc(event.at)+'</small><small>Evento: '+esc(event.id)+'</small>':'Sin evento de auditoría registrado') +'<small>ID: '+esc(d.id)+'</small></td></tr>';}).join('')):empty('Sin decisiones ni notas de newcrm registradas.'));
    } else if(tab==='proof') {
      const evidenceCount=nodes.reduce((sum,n)=>sum+(n.evidence||[]).length,0);
      content='<p class="s">Origen del registro leído: '+esc(origin)+' · Revisión: '+esc(data.revision??'Sin registrar')+'. Evidencia histórica registrada, sin ejecutar pruebas ni consultar producción desde esta pestaña. Publicado, cumplimiento y ambiente se muestran separados.</p>' + (nodes.length?table(['Rama','Entrega / cumplimiento','Evidencia fechada y ambiente','Comprobación pendiente'],nodes.map(n=>'<tr><td>'+branch(n)+'</td><td>'+esc(TREE_STATES[n.status]||'Sin verificar')+'<small>Cumplimiento: '+esc(n.fulfillment||'Sin registrar')+'</small></td><td>'+ ((n.evidence||[]).length?'<details><summary>'+n.evidence.length+' evidencias registradas</summary><ul>'+n.evidence.map(e=>'<li><b>'+esc(e.date||'Sin fecha registrada')+' · '+esc(e.environment||'Sin ambiente registrado')+'</b><br>'+esc(e.source||'Sin fuente registrada')+'<br>'+esc(e.result||'Sin resultado registrado')+'</li>').join('')+'</ul></details>':'Sin evidencia registrada')+'</td><td>'+esc(n.verification||'Sin comprobación pendiente registrada')+list(n.missing)+list(n.corrections)+'</td></tr>').join('')):empty('Sin ramas de newcrm registradas.'));
      content+='<p class="s">Total de evidencias registradas: '+evidenceCount+'. Sin evidencia productiva no se acredita producción; una evidencia de producción tampoco certifica requisitos fuera de su alcance.</p><details><summary>Antecedentes documentales de publicación</summary><p>docs/audiencia/PUBLICACION-REAL.md registra la publicación autorizada del árbol del 4 de octubre. docs/audiencia/2026-10-07-plugin-katy-publicacion.md registra conexión productiva de Katy y relectura de nota el 7 de octubre. Son antecedentes documentados, no una comprobación actual. Esta nueva interfaz permanece local hasta publicación autorizada.</p></details>';
    }
    return '<section class="aud-crm-guide" id="audienceCrmPanel" role="tabpanel" aria-labelledby="audienceCrmTab-'+esc(tab)+'"><h3>'+esc(CRM_VIEWS[tab]||'Vista sin registrar')+'</h3>'+content+'</section>';
  }

  function renderGlobalAgents(data) {
    const agents = data.tracking?.agents || [];
    const nodes = data.tracking?.nodes || [];
    const history = data.tracking?.history || [];
    const kindLabels = {module:'Módulo',area:'Área',function:'Función',work:'Trabajo',step:'Paso'};
    const assignmentRows = assigned => assigned.map(node => {
      const evidence = (node.evidence || []).map(e => '<li><b>' + esc(e.date || 'Sin fecha registrada') + ' · ' + esc(e.environment) + '</b><br>' + esc(e.source) + '<br>' + esc(e.result) + '</li>').join('');
      return '<tr><td>' + esc(node.project) + '</td><td><button class="aud-agent-link" data-agent-branch="' + esc(node.id) + '">' + esc(node.title) + '</button><small>' + esc(kindLabels[node.kind] || node.kind) + ' · ' + esc(node.id) + '</small></td><td>' + esc(node.role || 'Sin función registrada') + '</td><td>' + esc(['work','step'].includes(node.kind) ? (WORK_STATES[node.workState] || 'Sin estado registrado') : 'No aplica') + '</td><td>' + esc(TREE_STATES[node.status] || 'Sin verificar') + '<small>Cumplimiento: ' + esc(node.fulfillment || 'Sin registrar') + '</small></td><td>' + esc(node.nextStep || 'Sin registrar') + '<small>Vencimiento: ' + esc(node.deadline || 'Sin registrar') + '</small>' + (evidence ? '<details><summary>Evidencia registrada</summary><ul>' + evidence + '</ul></details>' : '<small>Sin evidencia registrada</small>') + '</td></tr>';
    }).join('');
    const assignments = assigned => assigned.length ? '<div class="aud-agent-table-wrap" role="region" aria-label="Asignaciones de seguimiento" tabindex="0"><table class="aud-agent-table"><thead><tr><th>Proyecto</th><th>Rama</th><th>Función asignada</th><th>Estado registrado del trabajo</th><th>Entrega</th><th>Próximo paso y evidencia</th></tr></thead><tbody>' + assignmentRows(assigned) + '</tbody></table></div>' : '<p class="s">Sin trabajos registrados. Sin ramas asignadas.</p>';
    const rows = agents.map(agent => {
      const assigned = nodes.filter(n => n.assignee === agent.id);
      const works = assigned.filter(n => ['work','step'].includes(n.kind));
      const projects = [...new Set(assigned.map(n => n.project))];
      const counts = Object.entries(WORK_STATES).map(([state,label]) => (state === 'en_curso' ? 'En curso (registrado)' : label) + ': ' + works.filter(n => n.workState === state).length).join(' · ');
      const unknownStates = works.filter(n => !WORK_STATES[n.workState]).length;
      const events = history.filter(e => (e.entity === 'agents' && e.entityId === agent.id) || (e.entity === 'nodes' && (e.before?.assignee === agent.id || e.after?.assignee === agent.id)));
      const latest = events.filter(e => !Number.isNaN(Date.parse(e.at))).sort((a,b) => Date.parse(b.at) - Date.parse(a.at))[0];
      return '<tr><td><b>' + esc(agent.name) + '</b><small>Especialidad: ' + esc(agent.role?.trim() && agent.role !== 'Por asignar' ? agent.role : 'Por definir') + '</small></td><td>' + (assigned.length ? '<b>Funciones y alcance asignados</b><small>' + esc([...new Set(assigned.filter(n => !['work','step'].includes(n.kind)).map(n => n.title))].join(' / ') || 'Sin funciones asignadas; consultar trabajos') + '</small><small>' + esc([...new Set(assigned.map(n => n.role).filter(Boolean))].join(' / ') || 'Alcance por definir') + '</small>' : 'Sin funciones ni trabajos asignados. Alcance por definir.') + '<details><summary>Evidencia de responsabilidad</summary><p>' + esc(agent.evidence || 'Por definir') + '</p></details><small>Proyectos declarados: ' + esc(agent.project || 'Por asignar') + '</small></td><td>' + esc(projects.join(' / ') || 'Sin ramas asignadas') + '<small>' + assigned.length + ' ramas · ' + works.length + ' trabajos/pasos</small><small>' + esc(counts) + (unknownStates ? ' · Sin estado registrado: ' + unknownStates : '') + '</small><details><summary>Ver asignaciones</summary>' + assignments(assigned) + '</details></td><td><b>Sin verificar</b><small>Sin fuente de actividad en tiempo real.</small><small>Acceso registrado: ' + esc(agent.access || 'Sin verificar') + '</small></td><td>' + (latest ? esc(latest.at) + '<small>Autor: ' + esc(latest.actor?.name || 'Sin registrar') + '</small><small>' + esc(latest.entity) + ' · ' + esc(latest.entityId) + ' · evento ' + esc(latest.id) + '</small>' : 'Sin cambios fechados registrados') + '</td></tr>';
    }).join('');
    const unassigned = nodes.filter(n => !n.assignee || !agents.some(a => a.id === n.assignee));
    return '<section id="audienceAgentsPanel" role="tabpanel" aria-labelledby="audienceAgentsTab" class="aud-workspace"><h2>Agentes · Todos los proyectos</h2><p class="s">Responsables y estados registrados; asignar o marcar En curso no demuestra actividad real. Las evidencias y el historial describen hechos pasados, sin monitoreo automático.</p>' + (agents.length ? '<div class="aud-agent-table-wrap" role="region" aria-label="Directorio de agentes global" tabindex="0"><table class="aud-agent-table aud-agent-summary"><thead><tr><th>Agente</th><th>Qué hace según el registro</th><th>Asignaciones en todos los proyectos</th><th>Actividad real actual</th><th>Último cambio registrado (no actividad)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="aud-empty">Sin agentes registrados.</div>') + '<details class="aud-agent-unassigned"><summary>Por asignar: ' + unassigned.length + ' ramas</summary>' + assignments(unassigned) + '</details></section>';
  }

  function renderData() {
    const view = byId('view');
    if (!view || !audienceData) return;
    const unclassifiedId = '__unclassified__';
    const trackingProjects = [...new Set(trackingNodes().map(n => n.project))].filter(name => !audienceData.projects.some(p => p.name === name)).map(name => ({id:'tracking:'+name,name,modules:[]}));
    const allProjects = [...audienceData.projects,...trackingProjects];
    const hasSelectedProject = allProjects.some((project) => project.id === selectedWorkspace);
    if (selectedWorkspace !== unclassifiedId && !hasSelectedProject) selectedWorkspace = audienceData.projects[0]?.id || unclassifiedId;
    const selectedProject = allProjects.find((project) => project.id === selectedWorkspace);
    const isUnclassified = selectedWorkspace === unclassifiedId;
    const unclassifiedCount = audienceData.items.filter((item) => !item.projectId).length;
    const selector = [...allProjects.map((project) => `<button class="aud-project-tab ${project.id === selectedWorkspace ? 'on' : ''}" onclick="window.audienciaSelectProject('${esc(project.id)}')">${esc(project.name)}</button>`), `<button class="aud-project-tab ${isUnclassified ? 'on' : ''}" onclick="window.audienciaSelectProject('${unclassifiedId}')">Sin clasificar${unclassifiedCount ? ` (${unclassifiedCount})` : ''}</button>`].join('');
    const visibleItems = audienceData.items.filter((item) => isUnclassified ? !item.projectId : item.projectId === selectedProject?.id);
    const items = [...visibleItems].sort((a, b) => (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31')).map((item) => {
      const project = audienceData.projects.find((candidate) => candidate.id === item.projectId);
      const module = project?.modules.find((candidate) => candidate.id === item.moduleId);
      const unclassified = item.kind === 'idea' && !item.projectId;
      const original = item.rawInput || item.notes;
      return `<article class="aud-item"><div class="aud-item-head"><div><h3>${esc(unclassified ? 'Información capturada' : item.title)}</h3><div class="aud-meta"><span>${unclassified ? 'Sin clasificar' : item.kind === 'idea' ? 'Idea' : 'Tarea'}</span><span class="aud-status">${esc(item.state)}</span>${project ? `<span>${esc(project.name)}</span>` : ''}${module ? `<span>${esc(module.name)}</span>` : ''}</div></div><button class="btn ghost" onclick="window.audienciaEdit('${esc(item.id)}')">${unclassified ? 'Desarrollar' : 'Ver'}</button></div>${original ? `<p>${esc(original)}</p>` : ''}${item.nextStep ? `<p><b>Próximo paso:</b> ${esc(item.nextStep)}</p>` : ''}<div class="aud-meta"><span>${item.date ? `Fecha: ${esc(item.date)}` : 'Sin fecha definida'}</span><span>${item.history?.length || 0} eventos</span></div></article>`;
    }).join('') || `<div class="aud-empty">${isUnclassified ? 'No hay información sin clasificar.' : 'No hay ideas ni pendientes en este proyecto.'}</div>`;
    const modules = selectedProject?.modules?.length ? selectedProject.modules.map((module) => `<span class="aud-module">${esc(module.name)}${module.status ? ` · ${esc(module.status)}` : ''}</span>`).join('') : '<small>Sin módulos documentados todavía</small>';
    const counts = selectedProject ? statusCounts(selectedProject.id).filter(({ count }) => count).map(({ state, count }) => `<span class="aud-count">${count} ${esc(state)}</span>`).join('') || '<span class="aud-count">Sin tareas</span>' : '<span class="aud-count">Sin tareas</span>';
    const responsibleAgents = selectedProject ? trackingAgents().filter((agent) => agent.project.split(' / ').includes(selectedProject.name)) : [];
    const workspaceResponsibility = isUnclassified ? '' : responsibleAgents.length
      ? `<div class="aud-meta"><span><b>Responsable:</b> ${responsibleAgents.map((agent) => esc(agent.name)).join(', ')}</span></div>`
      : '<div class="aud-meta"><span>Sin responsable confirmado</span></div>';
    selectedTrackingProject = selectedProject?.name || 'newcrm';
    const crmWorkTree = selectedProject ? renderCrmWorkTree(selectedProject.name) : '';
    const crmTabs = selectedProject?.name === 'newcrm' ? '<div class="aud-project-selector" role="tablist" aria-label="Documentación y seguimiento de newcrm">' + Object.entries(CRM_VIEWS).map(([id,label])=>'<button id="audienceCrmTab-'+id+'" role="tab" aria-selected="'+(selectedCrmTab===id)+'" aria-controls="'+(id==='tracking'?'audienceCrmTrackingPanel':'audienceCrmPanel')+'" class="aud-project-tab '+(selectedCrmTab===id?'on':'')+'" data-crm-tab="'+id+'">'+esc(label)+'</button>').join('') + '</div>' : '';
    const showGuide = selectedProject?.name === 'newcrm' && selectedCrmTab !== 'tracking';
    const workspaceTitle = isUnclassified ? 'Información sin clasificar' : esc(selectedProject?.name || 'Proyecto');
    const workspaceDescription = isUnclassified ? 'Capturas originales a la espera de una decisión. No están asignadas ni ejecutadas.' : 'Mapa, información y pendientes de este proyecto.';
    const workspaceActions = selectedProject ? '<button class="btn ghost" data-new-kind="module" data-parent="">Agregar módulo de seguimiento</button>' : '';
    const crmTheme = audienceData.theme === 'dark' ? 'soft-dark' : 'day';
    if (typeof window.applyTheme === 'function') window.applyTheme(crmTheme); else document.body.setAttribute('data-theme', crmTheme);
    view.innerHTML = `<section class="audiencia"><header class="aud-head"><div><h1>Audiencia</h1><p class="aud-sub">Captura primero; clasifica y convierte después.</p></div><div class="aud-actions"><button class="btn ghost" id="audienceRefresh">Actualizar registro</button><button class="btn ghost" id="audienceLock">Ocultar</button><button class="btn ghost" id="audienceTheme">${audienceData.theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</button><button class="btn" id="audienceNewTask">Capturar información</button></div></header><details class="aud-agent-directory" id="audienceKatyAccess"><summary>Acceso de lectura para Katy</summary><p class="s">Genera un archivo de solo lectura que vence en minutos y se guarda en Descargas de esta PC. No se muestra ni se envía por chat, no permite escribir y no es tu sesión. Katy lo lee con su script local.</p><div class="aud-actions"><button class="btn ghost" id="audienceKatyIssue">Autorizar a Katy (30 min)</button><button class="btn ghost" id="audienceKatyRevoke">Revocar accesos de Katy</button></div><p class="s" role="status" id="audienceKatyStatus"></p></details><div class="aud-project-selector" role="tablist" aria-label="Vistas de Audiencia"><button id="audienceProjectsTab" role="tab" aria-selected="${selectedSection === 'projects'}" aria-controls="audienceProjectsPanel" class="aud-project-tab ${selectedSection === 'projects' ? 'on' : ''}" data-audience-section="projects">Proyectos</button><button id="audienceAgentsTab" role="tab" aria-selected="${selectedSection === 'agents'}" aria-controls="audienceAgentsPanel" class="aud-project-tab ${selectedSection === 'agents' ? 'on' : ''}" data-audience-section="agents">Agentes</button></div>${selectedSection === 'agents' ? renderGlobalAgents(audienceData) : `<div class="aud-toolbar"><h2>Proyectos</h2><button class="btn ghost" id="audienceNewProject">Agregar proyecto</button></div><div class="aud-project-selector" role="tablist" aria-label="Proyectos de Audiencia">${selector}</div><section id="audienceProjectsPanel" role="tabpanel" aria-labelledby="audienceProjectsTab" class="aud-workspace"><header class="aud-workspace-head"><div><h2>${workspaceTitle}</h2><p class="aud-sub">${workspaceDescription}</p>${workspaceResponsibility}</div><div class="aud-actions">${workspaceActions}</div></header>${crmTabs}${showGuide ? renderCrmGuide(audienceData,selectedCrmTab,window.location?.origin) : `<section ${selectedProject?.name === 'newcrm' ? 'id="audienceCrmTrackingPanel" role="tabpanel" aria-labelledby="audienceCrmTab-tracking"' : ''}>${isUnclassified ? '' : `${crmWorkTree}<details><summary>Módulos anteriores conservados</summary><div class="aud-module-list">${modules}</div></details><div class="aud-counts">${counts}</div>`}<div class="aud-toolbar"><h3>Información y pendientes</h3><span class="s">${visibleItems.length} fichas</span></div><div class="aud-list">${items}</div></section>`}</section>`}</section>`;
    byId('audienceRefresh').onclick = loadData;
    byId('audienceLock').onclick = () => { audienceData = null; sessionStorage.removeItem(TOKEN_KEY); renderLocked(); };
    byId('audienceTheme').onclick = () => mutate({ ...audienceData, theme: audienceData.theme === 'dark' ? 'light' : 'dark' }).catch(error => alert(error.message));

    byId('audienceNewTask').onclick = openIdeaCapture;
    byId('audienceKatyIssue').onclick = issueKatyAccess;
    byId('audienceKatyRevoke').onclick = revokeKatyAccess;
    const newProjectButton = byId('audienceNewProject');
    if (newProjectButton) newProjectButton.onclick = addProject;
    view.onclick = event => {
      const crmTabButton = event.target.closest('[data-crm-tab]');
      if (crmTabButton && CRM_VIEWS[crmTabButton.dataset.crmTab]) { selectedCrmTab = crmTabButton.dataset.crmTab; renderData(); byId('audienceCrmTab-'+selectedCrmTab)?.focus(); return; }
      const sectionButton = event.target.closest('[data-audience-section]');
      if (sectionButton) { selectedSection = sectionButton.dataset.audienceSection; renderData(); byId(selectedSection === 'agents' ? 'audienceAgentsTab' : 'audienceProjectsTab')?.focus(); return; }
      const assignmentButton = event.target.closest('[data-agent-branch]');
      if (assignmentButton) {
        const node = trackingNodes().find(n => n.id === assignmentButton.dataset.agentBranch);
        if (!node) return;
        selectedSection = 'projects';
        selectedCrmTab = 'tracking';
        selectedWorkspace = audienceData.projects.find(p => p.name === node.project)?.id || 'tracking:' + node.project;
        window.audienciaSelectBranch(node.id); return;
      }
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.toggleBranch) window.audienciaToggleBranch(button.dataset.toggleBranch);
      if (button.dataset.selectBranch) window.audienciaSelectBranch(button.dataset.selectBranch);
      if (button.dataset.quickBranch) openQuickTrackingEditor(button.dataset.quickBranch);
      if (button.dataset.editBranch) window.audienciaEditBranch(button.dataset.editBranch);
      if (button.dataset.newKind) window.audienciaNewBranch(button.dataset.newKind, button.dataset.parent || '');
      if (button.dataset.decisionBranch) window.audienciaDecision(button.dataset.decisionBranch);
    };
  }

  async function mutate(next) {
    if (saving) throw new Error('Hay un guardado en curso.');
    saving = true;
    try { audienceData = await request('/api/audiencia/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    renderData(); } finally { saving = false; }
  }

  function bindCaptureVoice(input, button, status) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null, listening = false;
    const ended = () => { listening = false; button.textContent = 'Dictar'; };
    if (!Recognition) { button.disabled = true; status.textContent = 'Dictado del navegador no disponible; puedes usar el dictado de tu dispositivo en este campo.'; return () => {}; }
    button.onclick = () => {
      if (listening) { recognition.stop(); return; }
      recognition = new Recognition(); recognition.lang = 'es-PR'; recognition.continuous = false; recognition.interimResults = false;
      recognition.onresult = event => {
        for (let i = event.resultIndex; i < event.results.length; i++) if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript;
          input.value += (input.value && !/\s$/.test(input.value) ? ' ' : '') + text;
        }
        status.textContent = 'Texto añadido al mismo campo. Revisa y pulsa Guardar captura cuando quieras conservarlo.';
      };
      recognition.onerror = event => { ended(); status.textContent = event.error === 'not-allowed' ? 'Falta permiso del micrófono. Tu texto se conserva; puedes continuar escribiendo.' : 'No se pudo completar el dictado (' + event.error + '). Tu texto se conserva.'; };
      recognition.onend = ended;
      try { recognition.start(); listening = true; button.textContent = 'Detener dictado'; status.textContent = 'Escuchando. El dictado usa el servicio del navegador; todavía no se guarda información.'; }
      catch { ended(); status.textContent = 'No se pudo iniciar el micrófono. Tu texto se conserva.'; }
    };
    return () => { if (recognition && listening) recognition.abort(); };
  }

  function openIdeaCapture() {
    const dialog = document.createElement('dialog'); dialog.className = 'modal aud-dialog';
    dialog.innerHTML = `<form><div class="aud-head"><h2>Recoger información</h2><button type="button" class="btn ghost" id="captureCancel">Cerrar</button></div><div class="aud-field"><label for="audienceRawInput">Escribe o dicta la idea, necesidad o instrucción tal como la tienes.</label><textarea class="inp" id="audienceRawInput" name="rawInput" required></textarea></div><div class="s">Se guarda el texto original. No se ejecuta, no se clasifica y no se crea una tarea todavía. Puedes usar el dictado de tu dispositivo en este mismo campo.</div><p id="captureError" role="alert"></p><div class="aud-actions"><button class="btn" type="submit">Guardar captura</button></div></form>`;
    document.body.append(dialog);
    const voiceButton = document.createElement('button'); voiceButton.type = 'button'; voiceButton.className = 'btn ghost'; voiceButton.textContent = 'Dictar';
    const voiceStatus = document.createElement('p'); voiceStatus.className = 's'; voiceStatus.setAttribute('role', 'status'); voiceStatus.textContent = 'Dictado opcional mediante el servicio del navegador. El texto se guarda solo al confirmar.';
    dialog.querySelector('.aud-field').append(voiceButton, voiceStatus);
    const stopVoice = bindCaptureVoice(dialog.querySelector('#audienceRawInput'), voiceButton, voiceStatus);
    dialog.querySelector('#captureCancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => { stopVoice(); dialog.remove(); });
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const rawInput = String(new FormData(event.currentTarget).get('rawInput') || '');
      if (!rawInput.trim()) return;
      const timestamp = new Date().toISOString();
      const item = {id:crypto.randomUUID(),kind:'idea',title:rawInput.trim().slice(0,120),rawInput,projectId:'',moduleId:'',state:'pendiente',date:'',nextStep:'',notes:'',history:[{id:crypto.randomUUID(),at:timestamp,note:'Información capturada sin clasificar'}]};
      try { await mutate({...audienceData,items:[...audienceData.items,item]}); selectedWorkspace = '__unclassified__'; dialog.close(); renderData(); }
      catch(error) { dialog.querySelector('#captureError').textContent=error.message; }
    };
    dialog.showModal(); byId('audienceRawInput').focus();
  }

  function openEditor(kind, itemId = '') {
    const current = audienceData.items.find((item) => item.id === itemId);
    const projectOptions = ['<option value="">Sin proyecto</option>', ...audienceData.projects.map((project) => `<option value="${esc(project.id)}" ${current?.projectId === project.id ? 'selected' : ''}>${esc(project.name)}</option>`)].join('');
    const stateOptions = audienceData.states.map((state) => `<option value="${esc(state)}" ${(current?.state || 'pendiente') === state ? 'selected' : ''}>${esc(state)}</option>`).join('');
    const dialog = document.createElement('dialog');
    dialog.className = 'modal aud-dialog';
    const unclassified = current?.kind === 'idea' && !current?.projectId;
    dialog.innerHTML = `<form><div class="aud-head"><h2>${unclassified ? 'Desarrollar información' : current ? 'Editar ficha' : kind === 'idea' ? 'Nueva idea' : 'Nueva tarea'}</h2><button type="button" class="btn ghost" id="itemCancel">Cerrar</button></div><label class="aud-field">Tipo de ficha<select class="inp" name="kind"><option value="idea">Idea</option><option value="tarea" ${current?.kind === 'tarea' ? 'selected' : ''}>Tarea de dirección</option></select></label>${unclassified ? `<div class="aud-field"><label for="audItemrawInput">Texto original</label><textarea class="inp" id="audItemrawInput" name="rawInput" readonly>${esc(current.rawInput || current.notes || '')}</textarea></div><div class="s">Al guardar, esta ficha queda vinculada y desarrollada. El texto original se conserva.</div>` : ''}<div class="aud-field"><label for="audItemtitle">Título</label><input class="inp" id="audItemtitle" name="title" required value="${esc(current?.title || '')}"></div><div class="row"><div class="aud-field"><label for="audItemprojectId">Proyecto</label><select class="inp" id="audItemprojectId" name="projectId">${projectOptions}</select></div><div class="aud-field"><label for="audItemstate">Estado</label><select class="inp" id="audItemstate" name="state">${stateOptions}</select></div></div><div class="row"><div class="aud-field"><label for="audItemdate">Fecha</label><input class="inp" id="audItemdate" name="date" type="date" value="${esc(current?.date || '')}"></div><div class="aud-field"><label for="audItemnextStep">Próximo paso</label><input class="inp" id="audItemnextStep" name="nextStep" value="${esc(current?.nextStep || '')}"></div></div><div class="aud-field"><label for="audItemnotes">Detalle de desarrollo</label><textarea class="inp" id="audItemnotes" name="notes">${esc(current?.notes || '')}</textarea></div>${current?.history?.length ? `<div class="aud-field"><label>Historial</label><div class="aud-meta">${current.history.map((entry) => `${esc(entry.at)} · ${esc(entry.note)}`).join('<br>')}</div></div>` : ''}<div class="aud-actions"><p id="itemError" role="alert"></p><button class="btn" type="submit">Guardar desarrollo</button></div></form>`;
    document.body.append(dialog);
    dialog.querySelector('#itemCancel').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove());
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      const form = dialog.querySelector('form');
      const value = new FormData(form);
      const timestamp = new Date().toISOString();
      const entry = { id: crypto.randomUUID(), at: timestamp, note: current ? 'Ficha actualizada' : 'Ficha creada' };
      const nextItem = { ...current, id: current?.id || crypto.randomUUID(), kind: value.get('kind'), title: value.get('title').trim(), rawInput: current?.rawInput || current?.notes || '', projectId: value.get('projectId'), moduleId: current?.moduleId || '', state: value.get('state'), date: value.get('date'), nextStep: value.get('nextStep').trim(), notes: value.get('notes').trim(), history: [...(current?.history || []), entry] };
      const index = audienceData.items.findIndex((item) => item.id === nextItem.id);
      const items = [...audienceData.items];
      if (index >= 0) items[index] = nextItem; else items.push(nextItem);
      try { await mutate({ ...audienceData, items }); dialog.close(); } catch (error) { dialog.querySelector('#itemError').textContent=error.message; }
    };
    dialog.showModal();
    dialog.querySelector('[name=title]').focus();
  }

  async function addProject() {
    const name = window.prompt('Nombre del proyecto:')?.trim();
    if (!name) return;
    try { await mutate({ ...audienceData, projects: [...audienceData.projects, { id: crypto.randomUUID(), name, modules: [] }] }); } catch (error) { alert(error.message); }
  }

  async function addModule(projectId) {
    const name = window.prompt('Nombre del módulo o etapa:')?.trim();
    if (!name) return;
    const projects = audienceData.projects.map((project) => project.id === projectId ? { ...project, modules: [...project.modules, { id: crypto.randomUUID(), name }] } : project);
    try { await mutate({ ...audienceData, projects }); } catch (error) { alert(error.message); }
  }

  // Delegación de solo lectura para Katy: el token baja como archivo y nunca se pinta en pantalla.
  async function issueKatyAccess() {
    const status = byId('audienceKatyStatus');
    try {
      const grant = await request('/api/audiencia/delegations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: 30 }) });
      const file = { purpose: 'Lectura de Audiencia por Katy (solo lectura)', url: location.origin + '/api/audiencia/data', token: grant.token, scope: grant.scope, expiresAt: grant.expiresAt };
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
      link.download = 'katy-audiencia-acceso.json';
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
      status.textContent = 'Archivo katy-audiencia-acceso.json guardado en Descargas. Vence ' + new Date(grant.expiresAt).toLocaleTimeString('es') + '. Dile a Katy que lo lea con scripts/katy-leer-audiencia.mjs.';
    } catch (error) { status.textContent = error.message; }
  }

  async function revokeKatyAccess() {
    const status = byId('audienceKatyStatus');
    try { await request('/api/audiencia/delegations', { method: 'DELETE' }); status.textContent = 'Accesos de Katy revocados. Cualquier archivo anterior dejó de funcionar.'; }
    catch (error) { status.textContent = error.message; }
  }

  async function loadData() {
    try {
      audienceData = await request('/api/audiencia/data');
      renderData();
    } catch (error) {
      sessionStorage.removeItem(TOKEN_KEY);
      renderLocked(error.status === 401 ? 'Necesitas una sesión válida del CRM para abrir Audiencia.' : error.message);
    }
  }

  window.viewAudiencia = () => '<section class="audiencia"><div class="empty">Cargando Audiencia…</div></section>';
  window.audienciaInit = async () => {
    installStyles();
    try {
      const access = await request('/api/audiencia/access');
      if (access.available) loadData();
      else renderLocked('Audiencia todavía no está configurada en este ambiente.');
    } catch (error) {
      renderLocked(error.message);
    }
  };
  window.audienciaEdit = (id) => openEditor('tarea', id);
  window.audienciaAddModule = addModule;
  window.audienciaSelectProject = (projectId) => { selectedWorkspace = projectId; renderData(); };
  window.audienciaSelectBranch = (branchId) => { selectedCrmBranch = branchId; let parent=trackingNodes().find(n=>n.id===branchId)?.parentId; while(parent){ expandedBranches.add(parent); parent=trackingNodes().find(n=>n.id===parent)?.parentId; } renderData(); };
  window.audienciaToggleBranch = id => { if(expandedBranches.has(id))expandedBranches.delete(id);else expandedBranches.add(id); renderData(); };
  window.audienciaEditBranch = id => openTrackingEditor(id);
  window.audienciaNewBranch = (kind,parentId) => openTrackingEditor('',kind,parentId);
  window.audienciaDecision = nodeId => {
    const dialog=document.createElement('dialog'); dialog.className='modal aud-dialog';
    dialog.innerHTML='<form><h2>Registrar decisión</h2><label class="aud-field">Decisión de dirección<textarea class="inp" name="decision" required></textarea></label><label class="aud-field">Responsable de la decisión<select class="inp" name="assignee"><option value="">Por asignar</option>' + trackingAgents().map(a=>'<option value="'+esc(a.id)+'">'+esc(a.name)+'</option>').join('') + '</select></label><p class="s">No ejecuta acciones comerciales ni concede permisos.</p><p role="alert" id="decisionError"></p><div class="aud-actions"><button type="button" class="btn ghost" id="decisionCancel">Cancelar</button><button class="btn" type="submit">Guardar decisión</button></div></form>';
    document.body.append(dialog); dialog.querySelector('#decisionCancel').onclick=()=>dialog.close(); dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('form').onsubmit=async event=>{
      event.preventDefault();const values=new FormData(event.currentTarget),text=String(values.get('decision')||'').trim(); if(!text)return;
      const tracking=structuredClone(audienceData.tracking);
      tracking.decisions.push({id:crypto.randomUUID(),nodeId,text,at:reviewDate(),assignee:String(values.get('assignee')||'')});
      try {await mutate({...audienceData,tracking});dialog.close();}catch(error){dialog.querySelector('#decisionError').textContent=error.message;}
    };
    dialog.showModal(); dialog.querySelector('[name=decision]').focus();
  };
  window.clearAudienciaAccess = () => { ++accessRequest; audienceData = null; sessionStorage.removeItem(TOKEN_KEY); const nav = byId('audienciaNav'); if (nav) nav.innerHTML = ''; };
  window.refreshAudienciaAccess = async () => {
    const nav = byId('audienciaNav');
    const run = ++accessRequest;
    if (!nav) return;
    if (!window.vpAudienciaAuth || !Object.keys(window.vpAudienciaAuth()).length) { nav.innerHTML = ''; return; }
    try {
      const access = await request('/api/audiencia/access');
      if (run !== accessRequest) return;
      nav.innerHTML = access.available ? '<a class="nav" href="#/audiencia"><span class="d"></span>Audiencia</a>' : '';
    } catch {
      if (run === accessRequest) nav.innerHTML = '';
    }
  };
}());
