// Seed logic (entry point: run-seed.ts). See docs/DATABASE_MIGRATIONS.md.
import * as bcrypt from 'bcrypt';
import { isEmail } from 'class-validator';
import { DataSource } from 'typeorm';

import { EnvironmentVariables } from '../config/env.validation';
import { Asset } from '../assets/asset.entity';
import { User } from '../users/user.entity';

export const MIN_SEED_PASSWORD_LENGTH = 12;

export interface SeedConfig {
  admin: { name: string; email: string; password: string };
  demoPassword?: string;
}

/** Validates seed input. Throws with every problem listed, so nothing is half-seeded. */
export function readSeedConfig(
  raw: Record<string, string | undefined>,
  env: Pick<EnvironmentVariables, 'NODE_ENV'>,
  demo: boolean,
): SeedConfig {
  const problems: string[] = [];
  const email = raw.SEED_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
  const password = raw.SEED_ADMIN_PASSWORD ?? '';
  const name = raw.SEED_ADMIN_NAME?.trim() || 'Super Admin';

  if (!isEmail(email))
    problems.push('SEED_ADMIN_EMAIL must be a valid email address');
  if (password.length < MIN_SEED_PASSWORD_LENGTH) {
    problems.push(
      `SEED_ADMIN_PASSWORD must be at least ${MIN_SEED_PASSWORD_LENGTH} characters`,
    );
  }

  let demoPassword: string | undefined;
  if (demo) {
    if (env.NODE_ENV === 'production')
      problems.push('--demo is not allowed when NODE_ENV=production');
    demoPassword = raw.SEED_DEMO_PASSWORD ?? '';
    if (demoPassword.length < MIN_SEED_PASSWORD_LENGTH) {
      problems.push(
        `SEED_DEMO_PASSWORD must be at least ${MIN_SEED_PASSWORD_LENGTH} characters`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(`Seed aborted:\n  ${problems.join('\n  ')}`);
  }
  return { admin: { name, email, password }, demoPassword };
}

const DEMO_EMPLOYEES = [
  {
    name: 'Ayesha Rahman',
    email: 'ayesha.rahman@demo.test',
    department: 'Engineering',
    designation: 'Software Engineer',
  },
  {
    name: 'Tanvir Hasan',
    email: 'tanvir.hasan@demo.test',
    department: 'Sales',
    designation: 'Account Executive',
  },
  {
    name: 'Nusrat Jahan',
    email: 'nusrat.jahan@demo.test',
    department: 'Finance',
    designation: 'Accountant',
  },
];

const DEMO_ASSETS: Partial<Asset>[] = [
  {
    assetTag: 'LAP-001',
    name: 'Developer Laptop',
    category: 'Laptop',
    brand: 'Dell',
    model: 'XPS 15 9530',
    serialNumber: 'DXPS15-0001',
    department: 'Engineering',
    location: 'HQ - Floor 2',
    purchaseDate: '2025-03-14',
  },
  {
    assetTag: 'LAP-002',
    name: 'Developer Laptop',
    category: 'Laptop',
    brand: 'Apple',
    model: 'MacBook Pro 14 M3',
    serialNumber: 'C02MBP14-0002',
    department: 'Engineering',
    location: 'HQ - Floor 2',
    purchaseDate: '2025-06-02',
  },
  {
    assetTag: 'LAP-003',
    name: 'Sales Laptop',
    category: 'Laptop',
    brand: 'Lenovo',
    model: 'ThinkPad T14 Gen 4',
    serialNumber: 'LTP14-0003',
    department: 'Sales',
    location: 'HQ - Floor 1',
    purchaseDate: '2024-11-20',
  },
  {
    assetTag: 'MON-001',
    name: '27" Monitor',
    category: 'Monitor',
    brand: 'LG',
    model: '27UP850',
    serialNumber: 'LG27-0001',
    department: 'Engineering',
    location: 'HQ - Floor 2',
    purchaseDate: '2025-01-08',
  },
  {
    assetTag: 'MON-002',
    name: '24" Monitor',
    category: 'Monitor',
    brand: 'Dell',
    model: 'P2423D',
    serialNumber: 'DP24-0002',
    department: 'Finance',
    location: 'HQ - Floor 3',
    purchaseDate: '2024-09-15',
  },
  {
    assetTag: 'PHN-001',
    name: 'Company Phone',
    category: 'Phone',
    brand: 'Samsung',
    model: 'Galaxy S24',
    serialNumber: 'SGS24-0001',
    department: 'Sales',
    location: 'HQ - Floor 1',
    purchaseDate: '2025-04-10',
  },
  {
    assetTag: 'PRN-001',
    name: 'Office Printer',
    category: 'Printer',
    brand: 'HP',
    model: 'LaserJet Pro M404dn',
    serialNumber: 'HPLJ-0001',
    department: 'Administration',
    location: 'HQ - Floor 1',
    purchaseDate: '2023-07-22',
  },
  {
    assetTag: 'KBD-001',
    name: 'Wireless Keyboard',
    category: 'Accessory',
    brand: 'Logitech',
    model: 'MX Keys',
    serialNumber: 'LGMX-0001',
    department: 'Engineering',
    location: 'HQ - Floor 2',
    purchaseDate: '2025-02-01',
  },
  {
    assetTag: 'LAP-OLD-01',
    name: 'Old Office Laptop',
    category: 'Laptop',
    brand: 'HP',
    model: 'EliteBook 840 G3',
    serialNumber: 'HPEB-0099',
    department: 'Administration',
    location: 'Storage Room',
    purchaseDate: '2017-05-30',
    status: 'retired',
    notes: 'Battery failed; kept for parts.',
  },
];

export async function runSeed(
  ds: DataSource,
  config: SeedConfig,
  saltRounds: number,
  log: (line: string) => void = console.log,
): Promise<void> {
  const users = ds.getRepository(User);
  const assets = ds.getRepository(Asset);

  // 1. First super_admin: only if none exists, so a later run can never reset a real password.
  const existingSuper = await users.findOne({ where: { role: 'super_admin' } });
  if (existingSuper) {
    log(`super_admin exists (${existingSuper.email}), skipped`);
  } else if (await users.exists({ where: { email: config.admin.email } })) {
    throw new Error(
      `${config.admin.email} already exists with another role; choose a different SEED_ADMIN_EMAIL`,
    );
  } else {
    await users.insert({
      name: config.admin.name,
      email: config.admin.email,
      password: await bcrypt.hash(config.admin.password, saltRounds),
      role: 'super_admin',
    });
    log(`super_admin created: ${config.admin.email}`);
  }

  if (!config.demoPassword) return;

  // 2. Demo employees and assets (dev/test only; checked in readSeedConfig).
  const demoHash = await bcrypt.hash(config.demoPassword, saltRounds);
  for (const employee of DEMO_EMPLOYEES) {
    if (await users.exists({ where: { email: employee.email } })) {
      log(`user exists, skipped: ${employee.email}`);
      continue;
    }
    await users.insert({ ...employee, password: demoHash, role: 'user' });
    log(`demo employee created: ${employee.email}`);
  }

  for (const asset of DEMO_ASSETS) {
    if (await assets.exists({ where: { assetTag: asset.assetTag } })) {
      log(`asset exists, skipped: ${asset.assetTag}`);
      continue;
    }
    await assets.insert({ status: 'available', ...asset });
    log(`demo asset created: ${asset.assetTag}`);
  }
}
