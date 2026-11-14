import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import prisma from '../src/db.js';

// =============================================
// CONFIGURATION
// =============================================

const CANDIDATE_COUNT = 150;
const JOB_COUNT = 30;
const DAYS_OF_EVENTS = 30;

const PASSWORD = 'DemoPass123!';

const DISTRICTS = [
  'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala',
  'Bathinda', 'Mohali', 'Hoshiarpur', 'Gurdaspur',
  'Pathankot', 'Moga', 'Ferozepur', 'Sangrur',
];

const GENDERS = ['Male', 'Female', 'Other'];

const SOURCES = [
  'google', 'facebook', 'instagram',
  'direct', 'youtube', 'whatsapp', 'referral',
];

const DEVICES = ['desktop', 'mobile', 'tablet'];

const CAMPAIGNS = [
  'diwali_drive', 'skill_india', 'employment_2026',
  'rural_outreach', 'job_fair', '',
];

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Ishaan',
  'Rohan', 'Kabir', 'Rahul', 'Simran', 'Ananya',
  'Priya', 'Aanya', 'Meera', 'Kavya', 'Harpreet',
  'Gurpreet', 'Manpreet', 'Jaspreet', 'Navdeep', 'Sana',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Singh', 'Kaur', 'Patel',
  'Kumar', 'Gupta', 'Malhotra', 'Gill', 'Arora',
  'Mehta', 'Chawla', 'Bhatia', 'Saini', 'Joshi',
];

const JOB_TEMPLATES = [
  {
    title: 'Junior Web Developer',
    category: 'IT & Software',
    skills: ['JavaScript', 'HTML & CSS', 'React', 'Node.js'],
  },
  {
    title: 'Data Entry Operator',
    category: 'Office & Admin',
    skills: ['Data Entry', 'MS Excel', 'Typing', 'MS Word'],
  },
  {
    title: 'Primary School Teacher',
    category: 'Teaching',
    skills: ['Classroom Management', 'Mathematics', 'English Teaching'],
  },
  {
    title: 'Machine Operator',
    category: 'Manufacturing',
    skills: ['Machine Operation', 'Quality Inspection', 'Computer Basics'],
  },
  {
    title: 'Account Assistant',
    category: 'Office & Admin',
    skills: ['Accounting', 'Tally', 'MS Excel'],
  },
  {
    title: 'Customer Support Executive',
    category: 'Retail & Sales',
    skills: ['Customer Service', 'Communication', 'Problem Solving'],
  },
  {
    title: 'Electrical Technician',
    category: 'Manufacturing',
    skills: ['Electrical Wiring', 'Problem Solving', 'Quality Inspection'],
  },
  {
    title: 'Healthcare Assistant',
    category: 'Healthcare',
    skills: ['Patient Care', 'First Aid', 'Communication'],
  },
  {
    title: 'Sales Executive',
    category: 'Retail & Sales',
    skills: ['Sales', 'Marketing', 'Communication'],
  },
  {
    title: 'Agriculture Assistant',
    category: 'Agriculture',
    skills: ['Farm Management', 'Tractor Operation', 'Teamwork'],
  },
];

const COMPANIES = [
  'Punjab TechHub',
  'Northern Careers',
  'SkillBridge Solutions',
];

// =============================================
// HELPERS
// =============================================

function stableNumber(value, max) {
  const hash = createHash('sha256').update(String(value)).digest();
  return hash.readUInt32BE(0) % max;
}

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

function daysAgo(days, hour = 12) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, stableNumber(`${days}-${hour}`, 60), 0, 0);
  return date;
}

function candidateName(index) {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[
    stableNumber(`last-${index}`, LAST_NAMES.length)
  ]}`;
}

function candidateEmail(index) {
  return `demo.candidate.${String(index + 1).padStart(3, '0')}@synthetic.example`;
}

function applicationStatus(index) {
  if (index < 50) return 'Applied';
  if (index < 85) return 'Under Review';
  if (index < 110) return 'Shortlisted';
  if (index < 125) return 'Accepted';
  if (index < 135) return 'Placed';
  return 'Rejected';
}

// =============================================
// MAIN SEED FUNCTION
// =============================================

async function main() {
  console.log('\nStarting PGKRAM demo data generation...\n');

  // 1. Load existing skills

  const skills = await prisma.skills.findMany();

  if (skills.length < 10) {
    throw new Error(
      'Not enough skills found. Run npm run seed-skills first.'
    );
  }

  const skillMap = new Map(
    skills.map((skill) => [skill.skill_name, skill])
  );

  for (const template of JOB_TEMPLATES) {
    for (const name of template.skills) {
      if (!skillMap.has(name)) {
        throw new Error(`Required skill missing from database: ${name}`);
      }
    }
  }

  console.log(`Found ${skills.length} existing skills.`);

  // 2. Prepare synthetic password

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // 3. Create candidates

  const candidates = [];

  for (let i = 0; i < CANDIDATE_COUNT; i++) {
    const email = candidateEmail(i);
    const district = DISTRICTS[i % DISTRICTS.length];
    const gender = GENDERS[i % GENDERS.length];

    const user = await prisma.users.upsert({
      where: { email },
      update: {
        name: candidateName(i),
        role: 'candidate',
      },
      create: {
        name: candidateName(i),
        email,
        password_hash: passwordHash,
        role: 'candidate',
        created_at: daysAgo(i % DAYS_OF_EVENTS),
      },
    });

    await prisma.candidate_profiles.upsert({
      where: { user_id: user.id },
      update: {
        education: ['10th Pass', '12th Pass', 'Graduate', 'Diploma'][
          i % 4
        ],
        experience_years: i % 8,
        location: district,
        preferred_location: DISTRICTS[(i + 3) % DISTRICTS.length],
        preferred_category: JOB_TEMPLATES[i % JOB_TEMPLATES.length].category,
        bio: `Synthetic demo candidate from ${district}.`,
        gender,
        district,
        date_of_birth: new Date(
          1988 + (i % 15),
          i % 12,
          1 + (i % 27)
        ),
        profile_completed: i % 10 !== 0,
      },
      create: {
        user_id: user.id,
        education: ['10th Pass', '12th Pass', 'Graduate', 'Diploma'][
          i % 4
        ],
        experience_years: i % 8,
        location: district,
        preferred_location: DISTRICTS[(i + 3) % DISTRICTS.length],
        preferred_category: JOB_TEMPLATES[i % JOB_TEMPLATES.length].category,
        bio: `Synthetic demo candidate from ${district}.`,
        gender,
        district,
        date_of_birth: new Date(
          1988 + (i % 15),
          i % 12,
          1 + (i % 27)
        ),
        profile_completed: i % 10 !== 0,
      },
    });

    // Assign four existing skills to each candidate

    const candidateSkillIds = [];

    for (let j = 0; j < 4; j++) {
      const skill = skills[
        stableNumber(`candidate-${i}-skill-${j}`, skills.length)
      ];

      candidateSkillIds.push(skill.id);
    }

    await prisma.candidate_skills.deleteMany({
      where: { user_id: user.id },
    });

    await prisma.candidate_skills.createMany({
      data: candidateSkillIds.map((skill_id, index) => ({
        user_id: user.id,
        skill_id,
        proficiency: 2 + (index % 3),
      })),
      skipDuplicates: true,
    });

    candidates.push(user);

    if ((i + 1) % 25 === 0) {
      console.log(`Created/updated ${i + 1} candidates.`);
    }
  }

  // 4. Create 30 jobs

  const jobs = [];

  for (let i = 0; i < JOB_COUNT; i++) {
    const template = JOB_TEMPLATES[i % JOB_TEMPLATES.length];
    const company = `DEMO - ${COMPANIES[Math.floor(i / JOB_TEMPLATES.length)]}`;

    const title = `${template.title}${i >= JOB_TEMPLATES.length
      ? ` - ${Math.floor(i / JOB_TEMPLATES.length) + 1}`
      : ''
    }`;

    let job = await prisma.jobs.findFirst({
      where: { title, company },
    });

    const jobData = {
      title,
      company,
      description: `Synthetic demo vacancy for ${template.title}. Skills required: ${template.skills.join(', ')}.`,
      location: DISTRICTS[i % DISTRICTS.length],
      salary_min: 15000 + (i % 5) * 3000,
      salary_max: 25000 + (i % 5) * 5000,
      experience_required: i % 5,
      category: template.category,
      status: 'open',
    };

    if (job) {
      job = await prisma.jobs.update({
        where: { id: job.id },
        data: jobData,
      });
    } else {
      job = await prisma.jobs.create({
        data: jobData,
      });
    }

    await prisma.job_skills.deleteMany({
      where: { job_id: job.id },
    });

    await prisma.job_skills.createMany({
      data: template.skills.map((name, index) => ({
        job_id: job.id,
        skill_id: skillMap.get(name).id,
        importance: 3 + (index % 3),
      })),
      skipDuplicates: true,
    });

    jobs.push(job);
  }

  console.log(`Created/updated ${jobs.length} jobs.`);

    // 5. Create recommendations and applications

  const STATUSES = [
    ...Array(50).fill('Applied'),
    ...Array(35).fill('Under Review'),
    ...Array(25).fill('Shortlisted'),
    ...Array(15).fill('Accepted'),
    ...Array(10).fill('Placed'),
    ...Array(15).fill('Rejected'),
  ];

  for (let i = 0; i < candidates.length; i++) {
    const user = candidates[i];
    const job = jobs[(i * 7) % jobs.length];
    const status = STATUSES[i];

    const candidateSkillRows = await prisma.candidate_skills.findMany({
      where: { user_id: user.id },
      include: { skills: true },
    });

    const jobSkillRows = await prisma.job_skills.findMany({
      where: { job_id: job.id },
      include: { skills: true },
    });

    const candidateSkillNames = candidateSkillRows.map(
      (row) => row.skills.skill_name
    );

    const requiredSkillNames = jobSkillRows.map(
      (row) => row.skills.skill_name
    );

    const matchedSkills = requiredSkillNames.filter(
      (name) => candidateSkillNames.includes(name)
    );

    const missingSkills = requiredSkillNames.filter(
      (name) => !candidateSkillNames.includes(name)
    );

    const score = requiredSkillNames.length
      ? Math.round(
          (matchedSkills.length / requiredSkillNames.length) * 100
        )
      : 0;

    let recommendation = await prisma.recommendations.findFirst({
      where: {
        user_id: user.id,
        job_id: job.id,
      },
    });

    const recommendationData = {
      match_score: score,
      matched_skills: matchedSkills,
      missing_skills: missingSkills,
      algorithm_version: 'v1-weighted',
    };

    if (recommendation) {
      recommendation = await prisma.recommendations.update({
        where: { id: recommendation.id },
        data: recommendationData,
      });
    } else {
      recommendation = await prisma.recommendations.create({
        data: {
          user_id: user.id,
          job_id: job.id,
          ...recommendationData,
        },
      });
    }

    // Recommendation impression

    const recommendationEventTypes = ['impression'];

    if (i % 2 === 0) {
      recommendationEventTypes.push('click');
    }

    recommendationEventTypes.push('applied');

    if (status === 'Placed') {
      recommendationEventTypes.push('placed');
    }

    for (const eventType of recommendationEventTypes) {
      const existingEvent =
        await prisma.recommendation_events.findFirst({
          where: {
            recommendation_id: recommendation.id,
            event_type: eventType,
          },
        });

      if (!existingEvent) {
        await prisma.recommendation_events.create({
          data: {
            recommendation_id: recommendation.id,
            event_type: eventType,
            event_time: daysAgo(i % DAYS_OF_EVENTS),
          },
        });
      }
    }

    // Create or update the candidate's application

    const applicationDate = daysAgo(i % DAYS_OF_EVENTS);

    await prisma.applications.upsert({
      where: {
        user_id_job_id: {
          user_id: user.id,
          job_id: job.id,
        },
      },
      update: {
        recommendation_id: recommendation.id,
        status,
        updated_at: applicationDate,
      },
      create: {
        user_id: user.id,
        job_id: job.id,
        recommendation_id: recommendation.id,
        status,
        applied_at: applicationDate,
        updated_at: applicationDate,
      },
    });

    if ((i + 1) % 25 === 0) {
      console.log(`Processed ${i + 1} applications and recommendations.`);
    }
  }

  // 6. Generate 30 days of synthetic user events

  const eventNames = [
    'session_start',
    'page_view',
    'job_search',
    'job_view',
    'job_apply',
  ];

  const eventRows = [];

  for (let i = 0; i < candidates.length; i++) {
    const user = candidates[i];

    const source = SOURCES[i % SOURCES.length];
    const device = DEVICES[i % DEVICES.length];
    const campaign = CAMPAIGNS[i % CAMPAIGNS.length];

    const anonymousId = `demo-anon-${String(i + 1).padStart(3, '0')}`;
    const sessionId = `demo-session-${String(i + 1).padStart(3, '0')}`;

    const job = jobs[(i * 7) % jobs.length];

    for (let j = 0; j < eventNames.length; j++) {
      const eventName = eventNames[j];

      const day = (i + j * 7) % DAYS_OF_EVENTS;

      eventRows.push({
        event_id: stableUuid(`pgrkam-demo-${i}-${j}`),
        user_id: user.id,
        anonymous_id: anonymousId,
        event_name: eventName,
        source,
        campaign: campaign || null,
        device,
        session_id: sessionId,
        event_time: daysAgo(day, 9 + j * 2),
        properties: {
          demo: true,
          job_id: job.id,
          page: eventName === 'page_view' ? 'home' : null,
        },
      });
    }
  }

  // Insert in batches to avoid oversized queries

  let insertedEvents = 0;

  for (let i = 0; i < eventRows.length; i += 250) {
    const batch = eventRows.slice(i, i + 250);

    const result = await prisma.user_events.createMany({
      data: batch,
      skipDuplicates: true,
    });

    insertedEvents += result.count;
  }

  // 7. Print summary

  const candidateTotal = await prisma.users.count({
    where: { email: { endsWith: '@synthetic.example' } },
  });

  const jobTotal = await prisma.jobs.count({
    where: { company: { startsWith: 'DEMO - ' } },
  });

  const applicationTotal = await prisma.applications.count({
    where: {
      users: {
        email: { endsWith: '@synthetic.example' },
      },
    },
  });

  const recommendationTotal = await prisma.recommendations.count({
    where: {
      users: {
        email: { endsWith: '@synthetic.example' },
      },
    },
  });

  console.log('\n======================================');
  console.log('PGKRAM DEMO SEED COMPLETED');
  console.log('======================================');
  console.log(`Synthetic candidates: ${candidateTotal}`);
  console.log(`Synthetic jobs: ${jobTotal}`);
  console.log(`Synthetic applications: ${applicationTotal}`);
  console.log(`Synthetic recommendations: ${recommendationTotal}`);
  console.log(`New analytics events inserted: ${insertedEvents}`);
  console.log(`Event rows generated: ${eventRows.length}`);
  console.log('Demo candidate password: DemoPass123!');
  console.log('Demo candidate emails: demo.candidate.001@synthetic.example ...');
  console.log('======================================\n');
}

main()
  .catch((error) => {
    console.error('\nDemo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  

