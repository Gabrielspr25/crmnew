const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)-240226.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('fijos.txt', data.text);
    console.log('listo');
}).catch(e => console.error(e));
