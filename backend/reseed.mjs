// Recarga los clientes de ejemplo con acentos correctos (UTF-8).
import 'dotenv/config';
import { pool } from './src/db.js';

const clientes = [
  ['Gastronomía Mejicana', 'Gabriel', 'Bayamón', 'nannette@gmail.com'],
  ['Ferretería Ponce', 'María Torres', 'Ponce', null],
  ['Clínica Bayamón', 'Gabriel', 'Bayamón', null],
  ['Distribuidora Camuy', 'Dayana', 'Camuy', null],
];

await pool.query('DELETE FROM clients');
for (const [name, sp, city, email] of clientes) {
  await pool.query(
    'INSERT INTO clients (name, salesperson, city, email) VALUES ($1,$2,$3,$4)',
    [name, sp, city, email]
  );
}
console.log('Reseed OK:', clientes.length, 'clientes con acentos correctos.');
await pool.end();
