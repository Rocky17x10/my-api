
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListFilterIndexes1795289346990
  implements MigrationInterface
{
  name = 'AddListFilterIndexes1795289346990';

  private readonly definitions = [
    {
      table: 'activity_logs',
      index: 'IDX_activity_logs_created_at',
      columns: ['created_at'],
    },
    {
      table: 'asset_requests',
      index: 'IDX_asset_requests_status',
      columns: ['status'],
    },
    {
      table: 'assets',
      index: 'IDX_assets_status',
      columns: ['status'],
    },
    {
      table: 'maintenance_records',
      index: 'IDX_maintenance_records_status',
      columns: ['status'],
    },
    {
      table: 'support_tickets',
      index: 'IDX_support_tickets_status',
      columns: ['status'],
    },
  ] as const;

  private async getExistingIndex(
    queryRunner: QueryRunner,
    tableName: string,
    columns: readonly string[],
  ): Promise<string | undefined> {
    const table = await queryRunner.getTable(tableName);

    return table?.indices.find(
      (index) =>
        index.columnNames.length === columns.length &&
        index.columnNames.every(
          (column, position) => column === columns[position],
        ),
    )?.name;
  }

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);

    return table?.indices.some(
      (index) => index.name === indexName,
    ) ?? false;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verify all required tables before making changes.
    for (const definition of this.definitions) {
      if (!(await queryRunner.hasTable(definition.table))) {
        throw new Error(
          `Required table "${definition.table}" does not exist. Migration stopped.`,
        );
      }
    }

    // Check all indexes before creating anything.
    const indexesToCreate: Array<(typeof this.definitions)[number]> = [];

    for (const definition of this.definitions) {
      const existingNamedIndex = await this.hasIndex(
        queryRunner,
        definition.table,
        definition.index,
      );

      if (existingNamedIndex) {
        const table = await queryRunner.getTable(definition.table);

        const namedIndex = table?.indices.find(
          (index) => index.name === definition.index,
        );

        const matches =
          namedIndex?.columnNames.length === definition.columns.length &&
          namedIndex.columnNames.every(
            (column, position) =>
              column === definition.columns[position],
          );

        if (!matches) {
          throw new Error(
            `Index "${definition.index}" already exists with different columns on "${definition.table}". Migration stopped.`,
          );
        }

        // Preserve an existing index with the expected name and columns.
        continue;
      }

      const equivalentIndex = await this.getExistingIndex(
        queryRunner,
        definition.table,
        definition.columns,
      );

      if (equivalentIndex) {
        // An equivalent index already exists under another name.
        // Do not create a duplicate.
        continue;
      }

      indexesToCreate.push(definition);
    }

    // Create only genuinely missing indexes.
    for (const definition of indexesToCreate) {
      const columns = definition.columns
        .map((column) => `\`${column}\``)
        .join(', ');

      await queryRunner.query(`
        CREATE INDEX \`${definition.index}\`
        ON \`${definition.table}\` (${columns})
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // In the current database, only these two indexes were confirmed
    // missing before this migration and can be removed safely.

    if (await queryRunner.hasTable('assets')) {
      if (
        await this.hasIndex(
          queryRunner,
          'assets',
          'IDX_assets_status',
        )
      ) {
        await queryRunner.query(
          'DROP INDEX `IDX_assets_status` ON `assets`',
        );
      }
    }

    if (await queryRunner.hasTable('asset_requests')) {
      if (
        await this.hasIndex(
          queryRunner,
          'asset_requests',
          'IDX_asset_requests_status',
        )
      ) {
        await queryRunner.query(
          'DROP INDEX `IDX_asset_requests_status` ON `asset_requests`',
        );
      }
    }

    // Never remove the pre-existing activity_logs,
    // maintenance_records, or support_tickets indexes.
  }
}
