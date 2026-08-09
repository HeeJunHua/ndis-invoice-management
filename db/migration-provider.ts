import { promises as fs } from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type { Migration, MigrationProvider } from 'kysely/migration';

/**
 * Windows-safe replacement for Kysely's built-in FileMigrationProvider.
 * The built-in one passes a raw filesystem path to `import()`, which Node's ESM loader
 * rejects on Windows (it requires a proper file:// URL, not "C:\...").
 * `pathToFileURL` builds that URL correctly, including encoding spaces in the path.
 */
export class WindowsSafeFileMigrationProvider implements MigrationProvider {
  constructor(private migrationFolder: string) {}

  async getMigrations(): Promise<Record<string, Migration>> {
    const migrations: Record<string, Migration> = {};
    const files = await fs.readdir(this.migrationFolder);

    for (const fileName of files) {
      if (!fileName.endsWith('.ts') && !fileName.endsWith('.js')) continue;

      const filePath = path.join(this.migrationFolder, fileName);
      const fileUrl = pathToFileURL(filePath).href;
      const migration = await import(fileUrl);
      const migrationKey = fileName.substring(0, fileName.lastIndexOf('.'));

      migrations[migrationKey] = migration.default ?? migration;
    }

    return migrations;
  }
}