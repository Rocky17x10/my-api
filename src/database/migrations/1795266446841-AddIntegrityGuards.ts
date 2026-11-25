
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrityGuards1795266446841
  implements MigrationInterface
{
  name = 'AddIntegrityGuards1795266446841';

  private readonly definitions = [
    {
      table: 'asset_assignment_history',
      column: 'open_asset_id',
      index: 'IDX_1f0ca7fe2ad5d51addcc950358',
      expression: 'IF(`returned_at` IS NULL, `asset_id`, NULL)',
      duplicateCheck: `
        SELECT asset_id
        FROM asset_assignment_history
        WHERE returned_at IS NULL
        GROUP BY asset_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
    },
    {
      table: 'asset_returns',
      column: 'pending_assignment_id',
      index: 'IDX_73423309f10dc060021c227fa8',
      expression: "IF(`status` = 'pending', `assignment_history_id`, NULL)",
      duplicateCheck: `
        SELECT assignment_history_id
        FROM asset_returns
        WHERE status = 'pending'
        GROUP BY assignment_history_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
    },
    {
      table: 'maintenance_records',
      column: 'in_progress_asset_id',
      index: 'IDX_f118298932c861413f2bdca9ff',
      expression: "IF(`status` = 'in_progress', `asset_id`, NULL)",
      duplicateCheck: `
        SELECT asset_id
        FROM maintenance_records
        WHERE status = 'in_progress'
        GROUP BY asset_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
    },
  ] as const;

  private async hasIndex(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);

    return table?.indices.some((index) => index.name === indexName) ?? false;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verify required tables before making changes.
    for (const definition of this.definitions) {
      if (!(await queryRunner.hasTable(definition.table))) {
        throw new Error(
          `Required table "${definition.table}" does not exist. Migration stopped.`,
        );
      }
    }

    // Check for partially applied or conflicting schema changes.
    for (const definition of this.definitions) {
      const columnExists = await queryRunner.hasColumn(
        definition.table,
        definition.column,
      );

      const indexExists = await this.hasIndex(
        queryRunner,
        definition.table,
        definition.index,
      );

      if (columnExists || indexExists) {
        throw new Error(
          `Migration conflict: "${definition.column}" or its index already exists on "${definition.table}". Migration stopped.`,
        );
      }
    }

    // Check for duplicate records before creating unique indexes.
    for (const definition of this.definitions) {
      const duplicates = await queryRunner.query(
        definition.duplicateCheck,
      );

      if (duplicates.length > 0) {
        throw new Error(
          `Duplicate records found in "${definition.table}". Resolve them before running this migration.`,
        );
      }
    }

    // Create TypeORM metadata table if missing.
    if (!(await queryRunner.hasTable('typeorm_metadata'))) {
      await queryRunner.query(`
        CREATE TABLE \`typeorm_metadata\` (
          \`type\` varchar(255) NOT NULL,
          \`database\` varchar(255) NULL,
          \`schema\` varchar(255) NULL,
          \`table\` varchar(255) NULL,
          \`name\` varchar(255) NULL,
          \`value\` text NULL
        ) ENGINE=InnoDB
      `);
    } else {
      const requiredColumns = [
        'type',
        'database',
        'schema',
        'table',
        'name',
        'value',
      ];

      for (const column of requiredColumns) {
        if (!(await queryRunner.hasColumn('typeorm_metadata', column))) {
          throw new Error(
            `The existing typeorm_metadata table is missing "${column}". Migration stopped.`,
          );
        }
      }
    }

    const db = await queryRunner.getCurrentDatabase();

    // Add generated columns, metadata records and unique indexes.
    for (const definition of this.definitions) {
      await queryRunner.query(`
        ALTER TABLE \`${definition.table}\`
        ADD \`${definition.column}\` int
        AS (${definition.expression}) VIRTUAL
      `);

      await queryRunner.query(
        `
          INSERT INTO \`typeorm_metadata\`
            (\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`)
          VALUES (DEFAULT, ?, ?, ?, ?, ?)
        `,
        [
          db,
          definition.table,
          'GENERATED_COLUMN',
          definition.column,
          definition.expression,
        ],
      );

      await queryRunner.query(`
        ALTER TABLE \`${definition.table}\`
        ADD UNIQUE INDEX \`${definition.index}\`
        (\`${definition.column}\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const db = await queryRunner.getCurrentDatabase();

    // Reverse only objects belonging to this migration.
    for (const definition of [...this.definitions].reverse()) {
      if (await queryRunner.hasTable(definition.table)) {
        if (
          await this.hasIndex(
            queryRunner,
            definition.table,
            definition.index,
          )
        ) {
          await queryRunner.query(`
            ALTER TABLE \`${definition.table}\`
            DROP INDEX \`${definition.index}\`
          `);
        }

        if (
          await queryRunner.hasColumn(
            definition.table,
            definition.column,
          )
        ) {
          await queryRunner.query(`
            ALTER TABLE \`${definition.table}\`
            DROP COLUMN \`${definition.column}\`
          `);
        }
      }

      if (await queryRunner.hasTable('typeorm_metadata')) {
        await queryRunner.query(
          `
            DELETE FROM \`typeorm_metadata\`
            WHERE \`type\` = ?
              AND \`name\` = ?
              AND \`schema\` = ?
              AND \`table\` = ?
          `,
          [
            'GENERATED_COLUMN',
            definition.column,
            db,
            definition.table,
          ],
        );
      }
    }

    // Do not drop typeorm_metadata; other TypeORM features may use it.
  }
}
