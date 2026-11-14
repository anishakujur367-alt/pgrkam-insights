
import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { JOB_INCLUDE, shapeJob } from '../utils/jobs.js';

const router = Router();

router.use(requireAuth, requireRole('candidate'));

const WEIGHTS = {
  skills: 50,
  location: 15,
  experience: 15,
  category: 10,
  education: 10,
};

const EDUCATION_RANK = {
  below_10th: 0,
  '10th': 1,
  '12th': 2,
  iti: 3,
  diploma: 3,
  graduate: 4,
  postgraduate: 5,
  doctorate: 6,
  other: 0,
};

// Supports older synthetic seed values as well as profile API values.
function normalizeEducation(value) {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase();

  const aliases = {
    '10th pass': '10th',
    '12th pass': '12th',
    graduate: 'graduate',
    'undergraduate': 'graduate',
    diploma: 'diploma',
    postgraduate: 'postgraduate',
  };

  return aliases[normalized] || normalized.replace(/\s+/g, '_');
}

function calculateScore(profile, candidateSkills, job) {
  const candidateSkillIds = new Set(
    candidateSkills.map((skill) => skill.skill_id)
  );

  const matchedSkills = [];
  const missingSkills = [];

  const totalImportance = job.job_skills.reduce(
    (sum, skill) => sum + skill.importance,
    0
  );

  let matchedImportance = 0;

  for (const jobSkill of job.job_skills) {
    if (candidateSkillIds.has(jobSkill.skill_id)) {
      matchedSkills.push(jobSkill.skills.skill_name);
      matchedImportance += jobSkill.importance;
    } else {
      missingSkills.push(jobSkill.skills.skill_name);
    }
  }

  const skillScore =
    totalImportance > 0
      ? (matchedImportance / totalImportance) * 100
      : 0;

  const preferredLocation = profile?.preferred_location;

  const locationScore =
    preferredLocation && job.location
      ? preferredLocation.toLowerCase() === job.location.toLowerCase()
        ? 100
        : 0
      : 0;

  const candidateExperience = Number(profile?.experience_years ?? 0);
  const requiredExperience = Number(job.experience_required ?? 0);

  const experienceScore =
    job.experience_required == null || requiredExperience === 0
      ? 100
      : Math.min(
          (candidateExperience / requiredExperience) * 100,
          100
        );

  const categoryScore =
    profile?.preferred_category && job.category
      ? profile.preferred_category === job.category
        ? 100
        : 0
      : 0;

  const candidateEducation = normalizeEducation(profile?.education);
  const requiredEducation = normalizeEducation(job.education_required);

  const candidateEducationRank =
    candidateEducation != null
      ? EDUCATION_RANK[candidateEducation]
      : undefined;

  const requiredEducationRank =
    requiredEducation != null
      ? EDUCATION_RANK[requiredEducation]
      : undefined;

  const educationScore =
    requiredEducation == null
      ? 100
      : candidateEducationRank !== undefined &&
          requiredEducationRank !== undefined &&
          candidateEducationRank >= requiredEducationRank
        ? 100
        : 0;

  const score =
    (skillScore * WEIGHTS.skills +
      locationScore * WEIGHTS.location +
      experienceScore * WEIGHTS.experience +
      categoryScore * WEIGHTS.category +
      educationScore * WEIGHTS.education) /
    100;

  return {
    match_score: Number(score.toFixed(2)),
    matched_skills: matchedSkills,
    missing_skills: missingSkills,
  };
}

// POST /api/recommendations/generate
router.post('/generate', async (req, res) => {
  const userId = req.user.id;

  const [profile, candidateSkills, jobs] = await Promise.all([
    prisma.candidate_profiles.findUnique({
      where: { user_id: userId },
    }),
    prisma.candidate_skills.findMany({
      where: { user_id: userId },
    }),
    prisma.jobs.findMany({
      where: { status: 'open' },
      include: JOB_INCLUDE,
    }),
  ]);

  if (jobs.length === 0) {
    return res.status(200).json({
      message: 'No open jobs available',
      total: 0,
      recommendations: [],
    });
  }

  const results = [];

  for (const job of jobs) {
    const result = calculateScore(profile, candidateSkills, job);

    // The schema has no unique constraint on user_id + job_id.
    // Find the existing record first to avoid creating duplicates.
    const existing = await prisma.recommendations.findFirst({
      where: {
        user_id: userId,
        job_id: job.id,
      },
    });

    const data = {
      match_score: result.match_score,
      matched_skills: result.matched_skills,
      missing_skills: result.missing_skills,
      algorithm_version: 'v1-weighted',
    };

    const recommendation = existing
      ? await prisma.recommendations.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.recommendations.create({
          data: {
            user_id: userId,
            job_id: job.id,
            ...data,
          },
        });

    results.push({
      id: recommendation.id,
      match_score: Number(recommendation.match_score),
      matched_skills: recommendation.matched_skills,
      missing_skills: recommendation.missing_skills,
      algorithm_version: recommendation.algorithm_version,
      created_at: recommendation.created_at,
      job: shapeJob(job),
    });
  }

  results.sort(
    (a, b) => b.match_score - a.match_score
  );

  return res.status(200).json({
    total: results.length,
    recommendations: results,
  });
});

// GET /api/recommendations/me
router.get('/me', async (req, res) => {
  const recommendations = await prisma.recommendations.findMany({
    where: {
      user_id: req.user.id,
      jobs: { status: 'open' },
    },
    include: {
      jobs: { include: JOB_INCLUDE },
    },
    orderBy: { match_score: 'desc' },
  });

  return res.status(200).json({
    total: recommendations.length,
    recommendations: recommendations.map((r) => ({
      id: r.id,
      match_score: Number(r.match_score),
      matched_skills: r.matched_skills,
      missing_skills: r.missing_skills,
      algorithm_version: r.algorithm_version,
      created_at: r.created_at,
      job: shapeJob(r.jobs),
    })),
  });
});

// POST /api/recommendations/:id/events
// Records impression, click or applied events.
router.post('/:id/events', async (req, res) => {
  const recommendationId = Number(req.params.id);

  if (!Number.isInteger(recommendationId) || recommendationId <= 0) {
    return res.status(400).json({
      error: 'Invalid recommendation ID',
    });
  }

  const allowedEvents = ['impression', 'click', 'applied'];
  const { event_type } = req.body;

  if (!allowedEvents.includes(event_type)) {
    return res.status(400).json({
      error: 'event_type must be impression, click or applied',
    });
  }

  const recommendation = await prisma.recommendations.findFirst({
    where: {
      id: recommendationId,
      user_id: req.user.id,
    },
  });

  if (!recommendation) {
    return res.status(404).json({
      error: 'Recommendation not found',
    });
  }

  const event = await prisma.recommendation_events.create({
    data: {
      recommendation_id: recommendationId,
      event_type,
    },
  });

  return res.status(201).json({
    message: 'Recommendation event recorded',
    event: {
      id: event.id.toString(),
      recommendation_id: event.recommendation_id,
      event_type: event.event_type,
      event_time: event.event_time,
    },
  });
});

export default router;
