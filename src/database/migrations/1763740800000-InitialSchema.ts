import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline: the schema as defined by the entities on 2026-11-21.
 *
 * - Empty database: creates all tables.
 * - Database created before migrations existed (all tables present): adopts it as-is.
 *   Verified for the original dev DB: migration:generate reports no changes afterwards.
 * - Some tables present: refuses, because guessing would hide a broken schema.
 */
export class InitialSchema1763740800000 implements MigrationInterface {
  name = 'InitialSchema1763740800000';

  static readonly TABLES = [
    'users',
    'activity_logs',
    'assets',
    'asset_assignment_history',
    'asset_returns',
    'asset_requests',
    'maintenance_records',
    'support_ticket_messages',
    'support_tickets',
    'notifications',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const present: string[] = [];
    for (const table of InitialSchema1763740800000.TABLES) {
      if (await queryRunner.hasTable(table)) present.push(table);
    }

    if (present.length === InitialSchema1763740800000.TABLES.length) return;
    if (present.length > 0) {
      throw new Error(
        `InitialSchema: database is partially set up (found: ${present.join(', ')}). ` +
          'Restore the missing tables or start from an empty database.',
      );
    }

    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` int NOT NULL AUTO_INCREMENT, \`name\` varchar(100) NOT NULL, \`email\` varchar(150) NOT NULL, \`password\` varchar(255) NULL, \`department\` varchar(100) NULL, \`designation\` varchar(100) NULL, \`role\` enum ('super_admin', 'admin', 'user') NOT NULL DEFAULT 'user', UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`activity_logs\` (\`id\` int NOT NULL AUTO_INCREMENT, \`action\` varchar(100) NOT NULL, \`entity_type\` varchar(100) NOT NULL, \`entity_id\` int NULL, \`description\` text NOT NULL, \`metadata\` json NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`actor_id\` int NULL, INDEX \`IDX_activity_logs_entity\` (\`entity_type\`, \`entity_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`assets\` (\`id\` int NOT NULL AUTO_INCREMENT, \`asset_tag\` varchar(50) NOT NULL, \`name\` varchar(150) NOT NULL, \`category\` varchar(50) NOT NULL, \`brand\` varchar(100) NULL, \`model\` varchar(100) NULL, \`serial_number\` varchar(150) NULL, \`status\` enum ('available', 'assigned', 'maintenance', 'retired') NOT NULL DEFAULT 'available', \`department\` varchar(100) NULL, \`location\` varchar(150) NULL, \`purchase_date\` date NULL, \`notes\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`assigned_to\` int NULL, UNIQUE INDEX \`IDX_490daec7711d8e8bedd6a5a7ca\` (\`asset_tag\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`asset_assignment_history\` (\`id\` int NOT NULL AUTO_INCREMENT, \`assigned_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`returned_at\` datetime NULL, \`asset_id\` int NOT NULL, \`assigned_to\` int NOT NULL, \`assigned_by\` int NULL, INDEX \`IDX_assignment_history_admin\` (\`assigned_by\`), INDEX \`IDX_assignment_history_employee\` (\`assigned_to\`), INDEX \`IDX_assignment_history_asset\` (\`asset_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`asset_returns\` (\`id\` int NOT NULL AUTO_INCREMENT, \`status\` enum ('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending', \`condition\` enum ('good', 'damaged', 'needs_maintenance') NULL, \`employee_note\` text NULL, \`admin_note\` text NULL, \`requested_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`reviewed_at\` datetime NULL, \`confirmed_at\` datetime NULL, \`asset_id\` int NOT NULL, \`assignment_history_id\` int NOT NULL, \`requested_by\` int NOT NULL, \`reviewed_by\` int NULL, INDEX \`IDX_asset_returns_status\` (\`status\`), INDEX \`IDX_asset_returns_reviewer\` (\`reviewed_by\`), INDEX \`IDX_asset_returns_employee\` (\`requested_by\`), INDEX \`IDX_asset_returns_assignment\` (\`assignment_history_id\`), INDEX \`IDX_asset_returns_asset\` (\`asset_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`asset_requests\` (\`id\` int NOT NULL AUTO_INCREMENT, \`itemName\` varchar(150) NOT NULL, \`category\` varchar(100) NOT NULL, \`reason\` text NOT NULL, \`status\` enum ('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending', \`adminNote\` text NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`requested_by\` int NOT NULL, \`reviewed_by\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`maintenance_records\` (\`id\` int NOT NULL AUTO_INCREMENT, \`maintenance_type\` varchar(80) NOT NULL, \`problem_description\` text NOT NULL, \`repair_details\` text NULL, \`start_date\` datetime NOT NULL, \`completion_date\` datetime NULL, \`cost\` decimal(12,2) NOT NULL DEFAULT '0.00', \`service_provider\` varchar(150) NULL, \`status\` enum ('in_progress', 'completed') NOT NULL DEFAULT 'in_progress', \`admin_notes\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`asset_id\` int NOT NULL, \`created_by\` int NOT NULL, \`completed_by\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`support_ticket_messages\` (\`id\` int NOT NULL AUTO_INCREMENT, \`message\` text NOT NULL, \`is_internal_note\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`ticket_id\` int NOT NULL, \`sender_id\` int NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`support_tickets\` (\`id\` int NOT NULL AUTO_INCREMENT, \`ticket_number\` varchar(30) NOT NULL, \`subject\` varchar(200) NOT NULL, \`category\` varchar(100) NOT NULL, \`description\` text NOT NULL, \`priority\` enum ('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium', \`status\` enum ('open', 'in_progress', 'waiting_for_employee', 'resolved', 'closed', 'reopened') NOT NULL DEFAULT 'open', \`resolved_at\` datetime NULL, \`closed_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`created_by\` int NOT NULL, \`assigned_to\` int NULL, UNIQUE INDEX \`IDX_27bc711a89a033d5318df5e020\` (\`ticket_number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (\`id\` int NOT NULL AUTO_INCREMENT, \`reference_id\` int NULL, \`title\` varchar(200) NOT NULL, \`message\` text NOT NULL, \`type\` varchar(50) NOT NULL DEFAULT 'support_ticket', \`is_read\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`recipient_id\` int NOT NULL, \`ticket_id\` int NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_logs\` ADD CONSTRAINT \`FK_d4a993f3a163eca3d27ffee1361\` FOREIGN KEY (\`actor_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`assets\` ADD CONSTRAINT \`FK_6ce7e037e1bac19ddf02d1d82d6\` FOREIGN KEY (\`assigned_to\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` ADD CONSTRAINT \`FK_0e8c02a5000ab45a55669abba00\` FOREIGN KEY (\`asset_id\`) REFERENCES \`assets\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` ADD CONSTRAINT \`FK_d1a3c7062faab3653145cf0bf81\` FOREIGN KEY (\`assigned_to\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` ADD CONSTRAINT \`FK_e28c88ec6a48489f4aef24b6d5f\` FOREIGN KEY (\`assigned_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` ADD CONSTRAINT \`FK_a9a321621698b777107db88351c\` FOREIGN KEY (\`asset_id\`) REFERENCES \`assets\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` ADD CONSTRAINT \`FK_a366b32cb662bc597c47321e49f\` FOREIGN KEY (\`assignment_history_id\`) REFERENCES \`asset_assignment_history\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` ADD CONSTRAINT \`FK_7e61adc269d0e80ef0df9f6d04b\` FOREIGN KEY (\`requested_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` ADD CONSTRAINT \`FK_970b5a520e4619f3bf80e00e784\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_requests\` ADD CONSTRAINT \`FK_81ac2fe506bb08953b3c455098d\` FOREIGN KEY (\`requested_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_requests\` ADD CONSTRAINT \`FK_54f3cc56c0e578be5a66198b701\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` ADD CONSTRAINT \`FK_b3b2598eb0923a5a7a9f2151596\` FOREIGN KEY (\`asset_id\`) REFERENCES \`assets\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` ADD CONSTRAINT \`FK_fa5f1bf37257ae1f8bbf330e2ce\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` ADD CONSTRAINT \`FK_cd619a2867190f188d9347c896f\` FOREIGN KEY (\`completed_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_ticket_messages\` ADD CONSTRAINT \`FK_4339162c880269e72a10a4e08ad\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`support_tickets\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_ticket_messages\` ADD CONSTRAINT \`FK_b30cb666dee84b6cbf721af4219\` FOREIGN KEY (\`sender_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_tickets\` ADD CONSTRAINT \`FK_b819b3cb43af2e7924e8892c9bc\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_tickets\` ADD CONSTRAINT \`FK_1497d97a1193ff937dea51ac1ea\` FOREIGN KEY (\`assigned_to\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_5332a4daa46fd3f4e6625dd275d\` FOREIGN KEY (\`recipient_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_d506dd64e3806b61e88a26714e3\` FOREIGN KEY (\`ticket_id\`) REFERENCES \`support_tickets\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_d506dd64e3806b61e88a26714e3\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_5332a4daa46fd3f4e6625dd275d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_tickets\` DROP FOREIGN KEY \`FK_1497d97a1193ff937dea51ac1ea\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_tickets\` DROP FOREIGN KEY \`FK_b819b3cb43af2e7924e8892c9bc\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_ticket_messages\` DROP FOREIGN KEY \`FK_b30cb666dee84b6cbf721af4219\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`support_ticket_messages\` DROP FOREIGN KEY \`FK_4339162c880269e72a10a4e08ad\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` DROP FOREIGN KEY \`FK_cd619a2867190f188d9347c896f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` DROP FOREIGN KEY \`FK_fa5f1bf37257ae1f8bbf330e2ce\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`maintenance_records\` DROP FOREIGN KEY \`FK_b3b2598eb0923a5a7a9f2151596\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_requests\` DROP FOREIGN KEY \`FK_54f3cc56c0e578be5a66198b701\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_requests\` DROP FOREIGN KEY \`FK_81ac2fe506bb08953b3c455098d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` DROP FOREIGN KEY \`FK_970b5a520e4619f3bf80e00e784\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` DROP FOREIGN KEY \`FK_7e61adc269d0e80ef0df9f6d04b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` DROP FOREIGN KEY \`FK_a366b32cb662bc597c47321e49f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_returns\` DROP FOREIGN KEY \`FK_a9a321621698b777107db88351c\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` DROP FOREIGN KEY \`FK_e28c88ec6a48489f4aef24b6d5f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` DROP FOREIGN KEY \`FK_d1a3c7062faab3653145cf0bf81\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`asset_assignment_history\` DROP FOREIGN KEY \`FK_0e8c02a5000ab45a55669abba00\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`assets\` DROP FOREIGN KEY \`FK_6ce7e037e1bac19ddf02d1d82d6\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`activity_logs\` DROP FOREIGN KEY \`FK_d4a993f3a163eca3d27ffee1361\``,
    );
    await queryRunner.query(`DROP TABLE \`notifications\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_27bc711a89a033d5318df5e020\` ON \`support_tickets\``,
    );
    await queryRunner.query(`DROP TABLE \`support_tickets\``);
    await queryRunner.query(`DROP TABLE \`support_ticket_messages\``);
    await queryRunner.query(`DROP TABLE \`maintenance_records\``);
    await queryRunner.query(`DROP TABLE \`asset_requests\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_asset_returns_asset\` ON \`asset_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_asset_returns_assignment\` ON \`asset_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_asset_returns_employee\` ON \`asset_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_asset_returns_reviewer\` ON \`asset_returns\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_asset_returns_status\` ON \`asset_returns\``,
    );
    await queryRunner.query(`DROP TABLE \`asset_returns\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_assignment_history_asset\` ON \`asset_assignment_history\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_assignment_history_employee\` ON \`asset_assignment_history\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_assignment_history_admin\` ON \`asset_assignment_history\``,
    );
    await queryRunner.query(`DROP TABLE \`asset_assignment_history\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_490daec7711d8e8bedd6a5a7ca\` ON \`assets\``,
    );
    await queryRunner.query(`DROP TABLE \`assets\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_activity_logs_entity\` ON \`activity_logs\``,
    );
    await queryRunner.query(`DROP TABLE \`activity_logs\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
  }
}
