import { PrismaClient, JobSource, JobStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const jobs = [
    {
      sourceId: 'adzuna-sample-001',
      source: JobSource.ADZUNA,
      title: 'Software Engineer',
      company: 'Acme Corp',
      location: 'San Francisco, CA',
      salaryMin: 120000,
      salaryMax: 180000,
      salaryCurrency: 'USD',
      description:
        'We are looking for a skilled Software Engineer to join our team. You will work on building scalable web applications using modern technologies including React, Node.js, and PostgreSQL. 3+ years of experience required.',
      applyUrl: 'https://example.com/jobs/software-engineer-acme',
      status: JobStatus.PENDING_REVIEW,
    },
    {
      sourceId: 'greenhouse-sample-001',
      source: JobSource.GREENHOUSE,
      title: 'Full Stack Developer',
      company: 'TechStartup Inc',
      location: 'Remote',
      salaryMin: 100000,
      salaryMax: 150000,
      salaryCurrency: 'USD',
      description:
        'TechStartup is hiring a Full Stack Developer to build our next-generation platform. You will own features end-to-end, from database design to pixel-perfect UI. TypeScript, Next.js, and AWS experience preferred.',
      applyUrl: 'https://boards.greenhouse.io/techstartup/jobs/12345',
      status: JobStatus.PENDING_REVIEW,
    },
    {
      sourceId: 'lever-sample-001',
      source: JobSource.LEVER,
      title: 'Backend Engineer',
      company: 'DataFlow Systems',
      location: 'New York, NY',
      salaryMin: 130000,
      salaryMax: 170000,
      salaryCurrency: 'USD',
      description:
        'DataFlow Systems is seeking a Backend Engineer to design and build high-throughput data processing pipelines. Experience with Go or Python, Kafka, and distributed systems is essential. Competitive equity package included.',
      applyUrl: 'https://jobs.lever.co/dataflow/67890',
      status: JobStatus.PENDING_REVIEW,
    },
  ];

  for (const job of jobs) {
    await prisma.job.upsert({
      where: {
        sourceId_source: {
          sourceId: job.sourceId,
          source: job.source,
        },
      },
      update: {},
      create: job,
    });
  }

  console.log(`Seeded ${jobs.length} sample jobs`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
