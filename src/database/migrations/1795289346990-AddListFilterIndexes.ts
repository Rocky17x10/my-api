import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListFilterIndexes1795289346990 implements MigrationInterface {
    name = 'AddListFilterIndexes1795289346990'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX \`IDX_activity_logs_created_at\` ON \`activity_logs\` (\`created_at\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_asset_requests_status\` ON \`asset_requests\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_assets_status\` ON \`assets\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_maintenance_records_status\` ON \`maintenance_records\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_support_tickets_status\` ON \`support_tickets\` (\`status\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_support_tickets_status\` ON \`support_tickets\``);
        await queryRunner.query(`DROP INDEX \`IDX_maintenance_records_status\` ON \`maintenance_records\``);
        await queryRunner.query(`DROP INDEX \`IDX_assets_status\` ON \`assets\``);
        await queryRunner.query(`DROP INDEX \`IDX_asset_requests_status\` ON \`asset_requests\``);
        await queryRunner.query(`DROP INDEX \`IDX_activity_logs_created_at\` ON \`activity_logs\``);
    }

}
