
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserActiveFlag1795278449737
  implements MigrationInterface
{
  name = 'AddUserActiveFlag1795278449737';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      throw new Error(
        'Required table "users" does not exist. Migration stopped.',
      );
    }

    if (await queryRunner.hasColumn('users', 'is_active')) {
      throw new Error(
        'Migration conflict: users.is_active already exists. Migration stopped.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD \`is_active\` tinyint NOT NULL DEFAULT 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('users')) &&
      (await queryRunner.hasColumn('users', 'is_active'))
    ) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        DROP COLUMN \`is_active\`
      `);
    }
  }
}
