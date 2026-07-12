import fs from 'fs';
import PDFParser from 'pdf2json';

const pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError));
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("fijos.txt", pdfParser.getRawTextContent());
    console.log("Texto extraído exitosamente a fijos.txt");
});

pdfParser.loadPDF("LISTADO ESTRUCTURA PLANES PYMES&NEGOCIOS TODOS 2024(12)-240226.pdf");
