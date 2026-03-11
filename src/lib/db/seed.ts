import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from './index';

const FUNCTIONAL_GROUPS = [
  'Cell Line Development',
  'Cell Culture Development',
  'Scientific Operations',
  'Downstream Process Development',
  'Formulation Development',
  'Analytical Development',
  'Program Management',
];

const INITIAL_ADMIN = {
  fullName: 'System Administrator',
  email: 'admin@hullc.nih.gov',
  password: 'Admin1234!',
};

async function seed() {
  console.log('Seeding database...\n');

  // Functional groups (idempotent — skip duplicates)
  console.log('Functional groups:');
  for (const name of FUNCTIONAL_GROUPS) {
    const { rowCount } = await query(
      'INSERT INTO functional_groups (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    console.log(`  ${rowCount && rowCount > 0 ? 'created' : 'exists '}: ${name}`);
  }

  // Projects (idempotent — skip duplicates)
  console.log('\nProjects:');
  const PROJECTS = [
    'Project Alpha',
    'Project Beta',
    'Clinical Trial Gamma',
    'Pre-clinical Study Delta',
  ];
  for (const name of PROJECTS) {
    const { rowCount } = await query(
      'INSERT INTO projects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    console.log(`  ${rowCount && rowCount > 0 ? 'created' : 'exists '}: ${name}`);
  }

  // Initial admin user (idempotent — skip if email exists)
  console.log('\nAdmin user:');
  const existingAdmin = await query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
    [INITIAL_ADMIN.email]
  );

  if (existingAdmin.rows.length === 0) {
    const hash = await bcrypt.hash(INITIAL_ADMIN.password, 12);
    await query(
      `INSERT INTO users (full_name, email, password_hash, role, department, is_active)
       VALUES ($1, $2, $3, 'Admin', 'core', TRUE)`,
      [INITIAL_ADMIN.fullName, INITIAL_ADMIN.email, hash]
    );
    console.log(`  created: ${INITIAL_ADMIN.email}`);
    console.log(`  password: ${INITIAL_ADMIN.password}`);
  } else {
    console.log(`  exists:  ${INITIAL_ADMIN.email}`);
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
