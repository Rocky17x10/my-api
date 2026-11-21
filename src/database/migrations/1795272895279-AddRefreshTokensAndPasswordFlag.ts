import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokensAndPasswordFlag1795272895279 implements MigrationInterface {
    name = 'AddRefreshTokensAndPasswordFlag1795272895279'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`refresh_tokens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`user_id\` int NOT NULL, \`family_id\` char(36) NOT NULL, \`token_hash\` char(64) NOT NULL, \`expires_at\` datetime NOT NULL, \`revoked_at\` datetime NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX \`IDX_refresh_tokens_family\` (\`family_id\`), UNIQUE INDEX \`IDX_a7838d2ba25be1342091b6695f\` (\`token_hash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`must_change_password\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_3ddc983c5f7bcf132fd8732c3f4\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_3ddc983c5f7bcf132fd8732c3f4\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`must_change_password\``);
        await queryRunner.query(`DROP INDEX \`IDX_a7838d2ba25be1342091b6695f\` ON \`refresh_tokens\``);
        await queryRunner.query(`DROP INDEX \`IDX_refresh_tokens_family\` ON \`refresh_tokens\``);
        await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
    }

}
