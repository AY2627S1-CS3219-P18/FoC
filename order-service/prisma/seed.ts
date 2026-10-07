/*
 * AI Assistance Disclosure:
 * Tool: GitHub Copilot (model: current), date: 2026-09-28
 * Scope: Generated deterministic dummy order fixtures for local testing.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run the order seed.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const requesterA = '10000000-0000-4000-8000-000000000001';
const requesterB = '10000000-0000-4000-8000-000000000002';
const courierA = '10000000-0000-4000-8000-000000000003';

const orderIds = [
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000004',
  '20000000-0000-4000-8000-000000000005',
  '20000000-0000-4000-8000-000000000006',
  '20000000-0000-4000-8000-000000000007',
  '20000000-0000-4000-8000-000000000008',
  '20000000-0000-4000-8000-000000000009',
];

const now = Date.now();
const minutesFromNow = (minutes: number): Date =>
  new Date(now + minutes * 60_000);

const orders: Prisma.OrderRequestCreateManyInput[] = [
  {
    id: orderIds[0],
    requesterId: requesterA,
    supplierId: '30000000-0000-4000-8000-000000000001',
    description: 'Chicken rice with no cucumber and chilli on the side',
    deliveryLocation: 'COM1 Basement',
    credits: 4,
    completeBy: minutesFromNow(75),
    additionalDetails: 'Please meet by the vending machines.',
    status: 'open',
  },
  {
    id: orderIds[1],
    requesterId: requesterB,
    supplierId: '30000000-0000-4000-8000-000000000002',
    description: 'Kopi-o kosong and kaya toast set',
    deliveryLocation: 'COM2 Level 3 Lounge',
    credits: 2,
    completeBy: null,
    status: 'open',
  },
  {
    id: orderIds[2],
    requesterId: requesterA,
    supplierId: '30000000-0000-4000-8000-000000000003',
    description: 'Two dishes cai fan, no pork',
    deliveryLocation: 'Central Library Level 2',
    credits: 6,
    completeBy: minutesFromNow(120),
    status: 'accepted',
    courierId: courierA,
    acceptedAt: minutesFromNow(-20),
  },
  {
    id: orderIds[3],
    requesterId: requesterB,
    supplierId: '30000000-0000-4000-8000-000000000004',
    description: 'Large ban mian with extra chilli',
    deliveryLocation: 'UTown Residence Front Desk',
    credits: 8,
    completeBy: minutesFromNow(40),
    status: 'picked_up',
    courierId: courierA,
    acceptedAt: minutesFromNow(-35),
  },
  {
    id: orderIds[4],
    requesterId: requesterA,
    supplierId: '30000000-0000-4000-8000-000000000005',
    description: 'Mixed rice, one meat and two vegetables',
    deliveryLocation: 'Yusof Ishak House Lobby',
    credits: 10,
    completeBy: minutesFromNow(-5),
    status: 'delivered',
    courierId: courierA,
    acceptedAt: minutesFromNow(-80),
    deliveredAt: minutesFromNow(-10),
  },
  {
    id: orderIds[5],
    requesterId: requesterB,
    supplierId: '30000000-0000-4000-8000-000000000006',
    description: 'Two prata kosong and one teh peng',
    deliveryLocation: 'PGP Residence Block A',
    credits: 12,
    completeBy: minutesFromNow(-90),
    status: 'completed',
    courierId: courierA,
    acceptedAt: minutesFromNow(-150),
    deliveredAt: minutesFromNow(-105),
  },
  {
    id: orderIds[6],
    requesterId: requesterA,
    supplierId: '30000000-0000-4000-8000-000000000007',
    description: 'Nasi lemak set with extra sambal',
    deliveryLocation: 'SDE4 Studio',
    credits: 15,
    completeBy: minutesFromNow(10),
    additionalDetails: 'Cancelled because the requester left campus.',
    status: 'cancelled',
  },
  {
    id: orderIds[7],
    requesterId: requesterB,
    supplierId: '30000000-0000-4000-8000-000000000008',
    description: 'Bubble tea, half sugar and less ice',
    deliveryLocation: 'Science Drive 2',
    credits: 3,
    completeBy: null,
    status: 'expired',
  },
  {
    id: orderIds[8],
    requesterId: requesterA,
    supplierId: '30000000-0000-4000-8000-000000000009',
    description: 'Iced milo and tuna sandwich',
    deliveryLocation: 'LT19 Main Entrance',
    credits: 5,
    completeBy: minutesFromNow(25),
    status: 'open',
  },
];

try {
  await prisma.orderRequest.deleteMany({ where: { id: { in: orderIds } } });
  await prisma.orderRequest.createMany({ data: orders });
  console.log(`Seeded ${orders.length} order requests.`);
} finally {
  await prisma.$disconnect();
}
