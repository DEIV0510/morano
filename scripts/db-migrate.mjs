// Aplica migraciones pendientes y carga el catálogo inicial si está vacío.
// Uso: npm run db:migrate
import { migrate } from '../src/lib/migrate.ts';
import { seedCatalog } from '../src/lib/seed.ts';

const applied = await migrate();
console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Base de datos al día.');
const seeded = await seedCatalog();
if (seeded) console.log(`Catálogo inicial cargado: ${seeded} productos (sin precios).`);
process.exit(0);
