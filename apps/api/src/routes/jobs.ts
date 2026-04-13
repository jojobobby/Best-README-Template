import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@applybot/db';
import { ApiEnv, validateStatusTransition, JobNotFoundError, enqueueNotify } from '@applybot/shared';
import { apiKeyAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createLogger } from '../middleware/logger';

const logger = createLogger('jobs');

const listQuerySchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

const updateStatusSchema = z.object({
  status: z.enum([
    'PENDING_REVIEW',
    'APPROVED',
    'REJECTED',
    'APPLYING',
    'APPLIED',
    'FAILED',
    'SKIPPED',
  ]),
});

const manualJobSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().optional(),
  company: z.string().optional(),
});

export function jobsRouter(env: ApiEnv): Router {
  const router = Router();
  router.use(apiKeyAuth(env.API_KEY));

  // GET /jobs — paginated job list
  router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
    try {
      const { status, source, page, limit } = req.query as z.infer<typeof listQuerySchema>;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (source) where.source = source;

      const [jobs, total] = await Promise.all([
        prisma.job.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            _count: { select: { applicationLogs: true } },
          },
        }),
        prisma.job.count({ where }),
      ]);

      const mapped = jobs.map((j) => ({
        ...j,
        applicationLogCount: j._count.applicationLogs,
        _count: undefined,
      }));

      res.json({
        jobs: mapped,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      next(err);
    }
  });

  // GET /jobs/:id — job detail
  router.get('/:id', async (req, res, next) => {
    try {
      const job = await prisma.job.findUnique({
        where: { id: req.params.id },
        include: {
          applicationLogs: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!job) {
        throw new JobNotFoundError(req.params.id!);
      }

      res.json(job);
    } catch (err) {
      next(err);
    }
  });

  // PATCH /jobs/:id/status — manual status override
  router.patch('/:id/status', validate(updateStatusSchema), async (req, res, next) => {
    try {
      const job = await prisma.job.findUnique({ where: { id: req.params.id } });
      if (!job) {
        throw new JobNotFoundError(req.params.id!);
      }

      const { status } = req.body as z.infer<typeof updateStatusSchema>;
      validateStatusTransition(job.status, status, job.id);

      const updated = await prisma.job.update({
        where: { id: job.id },
        data: { status },
      });

      logger.info('Job status manually updated', {
        jobId: job.id,
        from: job.status,
        to: status,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // POST /jobs/manual — add job by URL
  router.post('/manual', validate(manualJobSchema), async (req, res, next) => {
    try {
      const { url, title, company } = req.body as z.infer<typeof manualJobSchema>;

      const job = await prisma.job.create({
        data: {
          sourceId: `manual-${Date.now()}`,
          source: 'MANUAL',
          title: title || 'Manual Job',
          company: company || 'Unknown',
          description: `Manually added job from URL: ${url}`,
          applyUrl: url,
          status: 'PENDING_REVIEW',
        },
      });

      await enqueueNotify(job.id);

      logger.info('Manual job created', { jobId: job.id, url });
      res.status(201).json(job);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
