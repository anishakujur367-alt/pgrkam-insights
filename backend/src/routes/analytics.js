import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

const ACTIVE_EVENT_NAMES = [
  'session_start',
  'page_view',
  'login',
  'job_search',
  'job_view',
  'job_save',
  'job_apply',
  'scheme_view',
  'service_view',
  'recommendation_impression',
  'recommendation_click',
];

function getDateFilters(query) {
  const { startDate, endDate, source, device } = query;
  const filters = {};

  if (startDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new Error('Invalid startDate. Use YYYY-MM-DD.');
    }

    const date = new Date(`${startDate}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== startDate) {
      throw new Error('Invalid startDate. Use YYYY-MM-DD.');
    }

    filters.gte = date;
  }

  if (endDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new Error('Invalid endDate. Use YYYY-MM-DD.');
    }

    const date = new Date(`${endDate}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== endDate
    ) {
      throw new Error('Invalid endDate. Use YYYY-MM-DD.');
    }

    date.setUTCHours(23, 59, 59, 999);
    filters.lte = date;
  }

  if (filters.gte && filters.lte && filters.gte > filters.lte) {
    throw new Error('startDate must be before or equal to endDate.');
  }

  return {
    dateFilter: Object.keys(filters).length ? filters : undefined,
    source: source || undefined,
    device: device || undefined,
  };
}

function handleError(res, error) {
  if (
    error.message.startsWith('Invalid ') ||
    error.message.startsWith('startDate')
  ) {
    return res.status(400).json({ error: error.message });
  }

  console.error('Analytics error:', error);
  return res.status(500).json({ error: 'Failed to fetch analytics.' });
}

function toNumber(value) {
  return Number(value ?? 0);
}

// GET /api/analytics/overview
router.get('/overview', async (req, res) => {
  try {
    const { dateFilter, source, device } = getDateFilters(req.query);

    const registrationUserFilter = {
      event_name: 'register',
      ...(source ? { source } : {}),
      ...(device ? { device } : {}),
    };

    const hasAttributionFilter = Boolean(source || device);

    const [
      activeEvents,
      registrationCount,
      applications,
      recommendationEvents,
    ] = await Promise.all([
      prisma.user_events.findMany({
        where: {
          event_name: { in: ACTIVE_EVENT_NAMES },
          ...(dateFilter ? { event_time: dateFilter } : {}),
          ...(source ? { source } : {}),
          ...(device ? { device } : {}),
        },
        select: {
          event_time: true,
          user_id: true,
          anonymous_id: true,
        },
        orderBy: { event_time: 'asc' },
      }),

      prisma.user_events.count({
        where: {
          ...registrationUserFilter,
          ...(dateFilter ? { event_time: dateFilter } : {}),
        },
      }),

      prisma.applications.findMany({
        where: {
          ...(dateFilter ? { applied_at: dateFilter } : {}),
          ...(hasAttributionFilter
            ? {
                users: {
                  user_events: {
                    some: registrationUserFilter,
                  },
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      }),

      prisma.recommendation_events.findMany({
        where: {
          ...(dateFilter ? { event_time: dateFilter } : {}),
          ...(hasAttributionFilter
            ? {
                recommendations: {
                  users: {
                    user_events: {
                      some: registrationUserFilter,
                    },
                  },
                },
              }
            : {}),
        },
        select: {
          event_type: true,
        },
      }),
    ]);

    // Match the ETL's distinct-user logic and group activity by UTC date.
    const dailyUsers = new Map();

    for (const event of activeEvents) {
      const identity = event.user_id !== null
        ? `user:${event.user_id}`
        : event.anonymous_id
          ? `anon:${event.anonymous_id}`
          : null;

      if (!identity) continue;

      const date = event.event_time.toISOString().slice(0, 10);

      if (!dailyUsers.has(date)) {
        dailyUsers.set(date, new Set());
      }

      dailyUsers.get(date).add(identity);
    }

    const dailyActiveUsers = Array.from(dailyUsers, ([date, users]) => ({
      date,
      users: users.size,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const totalDau = dailyActiveUsers.reduce(
      (sum, row) => sum + row.users,
      0
    );

    const impressions = recommendationEvents.filter(
      (event) => event.event_type === 'impression'
    ).length;

    const clicks = recommendationEvents.filter(
      (event) => event.event_type === 'click'
    ).length;

    const averageCtr = impressions
      ? (clicks * 100) / impressions
      : 0;

    res.json({
      filters: {
        startDate: req.query.startDate || null,
        endDate: req.query.endDate || null,
        source: source || null,
        device: device || null,
      },
      summary: {
        totalDau,
        totalRegistrations: registrationCount,
        totalApplications: applications.length,
        averageRecommendationCtr: Number(averageCtr.toFixed(2)),
      },
      dailyActiveUsers,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/acquisition
router.get('/acquisition', async (req, res) => {
  try {
    const { dateFilter, source, device } = getDateFilters(req.query);

    const events = await prisma.user_events.findMany({
      where: {
        event_name: 'register',
        ...(dateFilter ? { event_time: dateFilter } : {}),
        ...(source ? { source } : {}),
        ...(device ? { device } : {}),
      },
      select: {
        event_time: true,
        source: true,
        campaign: true,
        device: true,
        user_id: true,
      },
      orderBy: { event_time: 'asc' },
    });

    const groupBy = (key) => {
      const groups = new Map();

      for (const event of events) {
        const value = event[key] || 'unknown';
        groups.set(value, (groups.get(value) || 0) + 1);
      }

      return Array.from(groups, ([name, registrations]) => ({
        name,
        registrations,
      })).sort((a, b) => b.registrations - a.registrations);
    };

    res.json({
      totalRegistrations: events.length,
      bySource: groupBy('source'),
      byCampaign: groupBy('campaign'),
      byDevice: groupBy('device'),
      registrations: events.map((event) => ({
        date: event.event_time,
        source: event.source,
        campaign: event.campaign,
        device: event.device,
        userId: event.user_id,
      })),
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/conversion
router.get('/conversion', async (req, res) => {
  try {
    const { dateFilter, source, device } = getDateFilters(req.query);

    const applications = await prisma.applications.findMany({
      where: {
        ...(dateFilter ? { applied_at: dateFilter } : {}),
        ...(source || device
          ? {
              users: {
                user_events: {
                  some: {
                    event_name: 'register',
                    ...(source ? { source } : {}),
                    ...(device ? { device } : {}),
                  },
                },
              },
            }
          : {}),
      },
      select: { status: true },
    });

    const counts = new Map();

    for (const application of applications) {
      counts.set(
        application.status,
        (counts.get(application.status) || 0) + 1
      );
    }

    const total = applications.length;

    const funnel = Array.from(counts, ([status, count]) => ({
      status,
      count,
      percentage: total
        ? Number((count * 100 / total).toFixed(2))
        : 0,
    }));

    res.json({
      totalApplications: total,
      funnel,
    });
  } catch (error) {
    handleError(res, error);
  }
});

// GET /api/analytics/recommendations
router.get('/recommendations', async (req, res) => {
  try {
    const { dateFilter, source, device } = getDateFilters(req.query);

    const events = await prisma.recommendation_events.findMany({
      where: {
        ...(dateFilter ? { event_time: dateFilter } : {}),
        ...(source || device
          ? {
              recommendations: {
                users: {
                  user_events: {
                    some: {
                      event_name: 'register',
                      ...(source ? { source } : {}),
                      ...(device ? { device } : {}),
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: { event_type: true },
    });

    const impressions = events.filter(
      (event) => event.event_type === 'impression'
    ).length;

    const clicks = events.filter(
      (event) => event.event_type === 'click'
    ).length;

    const applied = events.filter(
      (event) => event.event_type === 'applied'
    ).length;

    res.json({
      impressions,
      clicks,
      applied,
      ctr: impressions
        ? Number((clicks * 100 / impressions).toFixed(2))
        : 0,
    });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
