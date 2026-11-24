import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrityGuards1795266446841 implements MigrationInterface {
  name = 'AddIntegrityGuards1795266446841';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // typeorm_metadata rows are keyed by database name; never hard-code the dev one.
    const db = await queryRunner.getCurrentDatabase();
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` ADD \`open_asset_id\` int AS (IF(\`returned_at\` IS NULL, \`asset_id\`, NULL)) VIRTUAL`,
    );
    await queryRunner.query(
      `INSERT INTO \`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`) VALUES (DEFAULT, ?, ?, ?, ?, ?)`,
      [
        db,
        'asset_assignment_history',
        'GENERATED_COLUMN',
        'open_asset_id',
        'IF(`returned_at` IS NULL, `asset_id`, NULL)',
      ],
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` ADD UNIQUE INDEX \`IDX_1f0ca7fe2ad5d51addcc950358\` (\`open_asset_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` ADD \`pending_assignment_id\` int AS (IF(\`status\` = 'pending', \`assignment_history_id\`, NULL)) VIRTUAL`,
    );
    await queryRunner.query(
      `INSERT INTO \`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`) VALUES (DEFAULT, ?, ?, ?, ?, ?)`,
      [
        db,
        'asset_returns',
        'GENERATED_COLUMN',
        'pending_assignment_id',
        "IF(`status` = 'pending', `assignment_history_id`, NULL)",
      ],
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` ADD UNIQUE INDEX \`IDX_73423309f10dc060021c227fa8\` (\`pending_assignment_id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` ADD \`in_progress_asset_id\` int AS (IF(\`status\` = 'in_progress', \`asset_id\`, NULL)) VIRTUAL`,
    );
    await queryRunner.query(
      `INSERT INTO \`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`) VALUES (DEFAULT, ?, ?, ?, ?, ?)`,
      [
        db,
        'maintenance_records',
        'GENERATED_COLUMN',
        'in_progress_asset_id',
        "IF(`status` = 'in_progress', `asset_id`, NULL)",
      ],
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` ADD UNIQUE INDEX \`IDX_f118298932c861413f2bdca9ff\` (\`in_progress_asset_id\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // typeorm_metadata rows are keyed by database name; never hard-code the dev one.
    const db = await queryRunner.getCurrentDatabase();
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` DROP INDEX \`IDX_f118298932c861413f2bdca9ff\``,
    );
    await queryRunner.query(
      `DELETE FROM \`typeorm_metadata\` WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ? AND \`table\` = ?`,
      ['GENERATED_COLUMN', 'in_progress_asset_id', db, 'maintenance_records'],
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` DROP COLUMN \`in_progress_asset_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` DROP INDEX \`IDX_73423309f10dc060021c227fa8\``,
    );
    await queryRunner.query(
      `DELETE FROM \`typeorm_metadata\` WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ? AND \`table\` = ?`,
      ['GENERATED_COLUMN', 'pending_assignment_id', db, 'asset_returns'],
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` DROP COLUMN \`pending_assignment_id\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` DROP INDEX \`IDX_1f0ca7fe2ad5d51addcc950358\``,
    );
    await queryRunner.query(
      `DELETE FROM \`typeorm_metadata\` WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ? AND \`table\` = ?`,
      ['GENERATED_COLUMN', 'open_asset_id', db, 'asset_assignment_history'],
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` DROP COLUMN \`open_asset_id\``,
    );
  }
}
