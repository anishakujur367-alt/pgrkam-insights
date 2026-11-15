
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import prisma from '../db.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

// ---------- Validation ----------
const emailField = z.string().trim().toLowerCase().pipe(z.email().max(254));

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailField,
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).max(72),
});

function validationError(res, error) {
  return res.status(400).json({
    error: 'Invalid input',
    details: error.issues.map((i) => ({
      field: i.path.join('.') || '(body)',
      message: i.message,
    })),
  });
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  created_at: true,
};

// ---------- POST /api/auth/register ----------
router.post('/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const { name, email, password } = parsed.data;
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const user = await prisma.users.create({
      data: { name, email, password_hash, role: 'candidate' },
      select: USER_SELECT,
    });

    // Record registration for acquisition analytics.
    try {
      await prisma.user_events.create({
        data: {
          event_id: crypto.randomUUID(),
          event_name: 'register',
          user_id: user.id,
          source: 'direct',
          device: 'unknown',
          session_id: `registration-${crypto.randomUUID()}`,
          event_time: new Date(),
          properties: {
            registration_method: 'email',
          },
        },
      });
    } catch (eventError) {
      console.error('Registration event tracking failed:', eventError);
    }

    return res.status(201).json({
      user,
      token: signToken(user),
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: 'An account with this email already exists',
      });
    }
    throw err;
  }
});

// ---------- POST /api/auth/login ----------
router.post('/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return validationError(res, parsed.error);

  const { email, password } = parsed.data;

  const found = await prisma.users.findUnique({ where: { email } });
  const passwordOk = await bcrypt.compare(
    password,
    found ? found.password_hash : DUMMY_HASH
  );

  if (!found || !passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const user = {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
    created_at: found.created_at,
  };

  return res.status(200).json({
    user,
    token: signToken(user),
  });
});

// ---------- GET /api/auth/me ----------
router.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

export default router;
