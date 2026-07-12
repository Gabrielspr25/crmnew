const fs = require('fs');

const text = fs.readFileSync('fijos.txt', 'utf8');
const lines = text.split('\n').filter(l => l.trim() !== '');

let htmlContent = `
<div class="plans-grid">
`;

// Expresión regular para detectar líneas que parecen tener un plan:
// Código + Nombre + Precio + (Alfa Code / Tech)
const planRegex = /^([A-Z0-9]{4,6})\s+(.+?)\s+\$(\d+\.\d{2})\s+([A-Z0-9\-]+)\s+(COBRE\/VRAD|GPON|COBRE\/VRAD\/GPON|VRAD\/GPON)/;

let categories = {
  "Telefonía Medida": [],
  "Telefonía Ilimitada": [],
  "2Play (Internet + Voz)": [],
  "Televisión": [],
  "Complementos y Otros": []
};

for (const line of lines) {
  const match = line.match(planRegex);
  if (match) {
    const code = match[1];
    const name = match[2];
    const price = match[3];
    const alfaCode = match[4];
    const tech = match[5];

    let category = "Complementos y Otros";
    if (name.includes("2PLAY") || name.includes("+") && name.includes("M")) category = "2Play (Internet + Voz)";
    else if (name.includes("Clarotv+") || name.includes("TV")) category = "Televisión";
    else if (name.includes("ILIM")) category = "Telefonía Ilimitada";
    else if (name.includes("MED")) category = "Telefonía Medida";

    categories[category].push({ code, name, price, alfaCode, tech });
  }
}

for (const [catName, plans] of Object.entries(categories)) {
  if (plans.length === 0) continue;
  htmlContent += `
  <div class="category-section">
      <h3 class="category-title">${catName}</h3>
      <table class="modern-table">
          <thead>
              <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Alfa Code</th>
                  <th>Tecnología</th>
                  <th>Precio</th>
              </tr>
          </thead>
          <tbody>
  `;
  for (const plan of plans) {
    htmlContent += `
              <tr>
                  <td><code>${plan.code}</code></td>
                  <td>${plan.name}</td>
                  <td>${plan.alfaCode}</td>
                  <td><span class="tech-badge ${plan.tech.replace(/[^a-zA-Z]/g, '').toLowerCase()}">${plan.tech}</span></td>
                  <td class="price">$${plan.price}</td>
              </tr>
    `;
  }
  htmlContent += `
          </tbody>
      </table>
  </div>
  `;
}

htmlContent += `</div>`;

let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(
    /<div id="fijos" class="tab-content active">[\s\S]*?<\/div>\s*<div id="banda-ancha"/,
    `<div id="fijos" class="tab-content active">\n<h2>BOLETIN: LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS</h2>\n${htmlContent}\n</div>\n\n<div id="banda-ancha"`
);

fs.writeFileSync('index.html', indexHtml);
console.log('HTML Actualizado con los planes!');
