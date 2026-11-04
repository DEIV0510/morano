// Aplica las migraciones pendientes de db/migrations.
// Uso: npm run db:migrate
import { migrate } from '../src/lib/migrate.ts';

const applied = await migrate();
console.log(applied.length ? `Migraciones aplicadas: ${applied.join(', ')}` : 'Base de datos al día.');
process.exit(0);
