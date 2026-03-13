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
    'BiSp Ab', 'CAP256J3LS', 'EV-D68', 'FluMos-v2', 'FP6', 'FP7', 'FP8',
    'Influenza Vaccine: HA', 'Influenza Vaccine: Na Seasonal', 'Influenza Vaccine: Pandemic',
    'L9LS', 'mRNA', 'Mumps', 'Rapid Response', 'SteMos', 'Trimer 7678', 'TrsAb',
  ];
  for (const name of PROJECTS) {
    const { rowCount } = await query(
      'INSERT INTO projects (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    console.log(`  ${rowCount && rowCount > 0 ? 'created' : 'exists '}: ${name}`);
  }

  // Storage locations (idempotent — skip duplicates)
  console.log('\nStorage locations:');
  const STORAGE_LOCATIONS = [
    'B13', 'B13-Probe 5 (-80c)', 'B13-Probe 66', 'B22', 'B22-Probe 36',
    'B26 VRC FAC.', 'BM 901', 'BM Hall', 'BM Hall Cab', 'REF87',
    'Room 244', 'S Hall Cold Room Probe 37', 'S Hall Cold Room Probe 38', 'VPP Storage (New Rm)',
  ];
  for (const name of STORAGE_LOCATIONS) {
    const { rowCount } = await query(
      'INSERT INTO storage_locations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
    console.log(`  ${rowCount && rowCount > 0 ? 'created' : 'exists '}: ${name}`);
  }

  // Manufacturers (idempotent — skip duplicates)
  console.log('\nManufacturers:');
  const MANUFACTURERS = [
    '3M', '908Devices', 'Alfa Laval', 'Applikon', 'Avanti Polar Lipids',
    'B. Braun', 'Bausch+Lomb', 'Baxter', 'BD', 'Beckman Coulter',
    'Bio-Rad', 'Cayman Chemical', 'Cole-Parmer', 'Corning', 'Cytiva',
    'ELGA', 'EMD Millipore', 'Eppendorf', 'FujiFilm', 'GE Healthcare',
    'Getinge', 'Gibco', 'Gilson', 'Henke-Ject', 'Hospira',
    'ICU Medical', 'J.T. Baker', 'Jackson ImmunoResearch', 'Life Tech', 'Life Technologies',
    'Macherey-Nagel', 'MaxCyte', 'Mettler Toledo', 'Millipore', 'MilliporeSigma',
    'Molecular Devices', 'MP Biomedicals', 'Nova Biomedical', 'Peprotech', 'PerkinElmer',
    'Pfanstiehl', 'Precision Nanosystems', 'Promega', 'Repligen', 'Revvity',
    'Roche', 'Sartorius', 'Sciex', 'Spectrum', 'Tecan',
    'Terumo BCT', 'Thermo Scientific', 'ThermoFisher', 'Toyopearl', 'TriLink Bio',
    'UNchained', 'UnChained Labs', 'Unomedical', 'VWR', 'Watson Marlow', 'Xell',
  ];
  for (const name of MANUFACTURERS) {
    const { rowCount } = await query(
      'INSERT INTO manufacturers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
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

  // Deactivate placeholder projects from original seed
  console.log('\nCleanup:');
  const OLD_PROJECTS = ['Project Alpha', 'Project Beta', 'Clinical Trial Gamma', 'Pre-clinical Study Delta'];
  for (const name of OLD_PROJECTS) {
    const { rowCount } = await query(
      'UPDATE projects SET is_active = FALSE WHERE name = $1 AND is_active = TRUE',
      [name]
    );
    if (rowCount && rowCount > 0) console.log(`  deactivated old project: ${name}`);
  }

  console.log('\nSeed complete.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
