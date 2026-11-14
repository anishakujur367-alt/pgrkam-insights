import 'dotenv/config';
import { createHash } from 'node:crypto';
import prisma from '../src/db.js';

const SOURCES = [
  'google', 'facebook', 'instagram',
  'direct', 'youtube', 'whatsapp', 'referral',
];

const DEVICES = ['desktop', 'mobile', 'tablet'];

const CAMPAIGNS = [
  'diwali_drive', 'skill_india', 'employment_2026',
  'rural_outreach', 'job_fair', '',
];

function stableUuid(value) {
  const hash = createHash('sha256').update(String(value)).digest('hex');
  const hex = hash.slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = 'a';

  const result = hex.join('');

  return [
    result.slice(0, 8),
    result.slice(8, 12),
    result.slice(12, 16),
    result.slice(16, 20),
    result.slice(20),
  ].join('-');
}

async function main() {
  const candidates = await prisma.users.findMany({
    where: {
      email: { endsWith: '@synthetic.example' },
      role: 'candidate',
    },
    orderBy: { email: 'asc' },
    select: {
      id: true,
      email: true,
      created_at: true,
    },
  });

  const eventRows = candidates.map((user) => {
    const match = user.email.match(/demo\.candidate\.(\d+)@synthetic\.example/);

    if (!match) {
      throw new Error(`Unexpected synthetic email: ${user.email}`);
    }

    const index = Number(match[1]) - 1;

    return {
      event_id: stableUuid(`pgrkam-demo-${index}-5`),
      user_id: user.id,
      anonymous_id: `demo-anon-${String(index + 1).padStart(3, '0')}`,
      event_name: 'register',
      source: SOURCES[index % SOURCES.length],
      campaign: CAMPAIGNS[index % CAMPAIGNS.length] || null,
      device: DEVICES[index % DEVICES.length],
      session_id: `demo-session-${String(index + 1).padStart(3, '0')}`,
      event_time: user.created_at,
      properties: { demo: true, registration: true },
    };
  });

  const result = await prisma.user_events.createMany({
    data: eventRows,
    skipDuplicates: true,
  });

  console.log(`Synthetic candidates found: ${candidates.length}`);
  console.log(`Registration events inserted: ${result.count}`);
  console.log(`Existing events skipped: ${candidates.length - result.count}`);
}

main()
  .catch((error) => {
    console.error('Registration event seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
