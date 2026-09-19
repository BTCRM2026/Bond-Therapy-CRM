import { open, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const prismaDirectory = join(scriptsDirectory, '..', 'prisma');
const productionSchemaPath = join(prismaDirectory, 'schema.prisma');
const localSchemaPath = join(prismaDirectory, 'schema.local.prisma');
const localDatabasePath = join(prismaDirectory, 'bond-therapy-local.db');

const productionSchema = await readFile(productionSchemaPath, 'utf8');
const localSchema = productionSchema
  .replace('provider = "postgresql"', 'provider = "sqlite"')
  .replaceAll(' @db.Decimal(12, 2)', '');

await writeFile(localSchemaPath, localSchema, 'utf8');
const localDatabase = await open(localDatabasePath, 'a');
await localDatabase.close();
console.log('Prepared the local SQLite schema. Production remains PostgreSQL.');
