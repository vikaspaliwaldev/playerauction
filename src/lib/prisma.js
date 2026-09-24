import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

let _prisma;

function getPrismaClient() {
  if (!_prisma) {
    _prisma = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    if (process.env.NODE_ENV !== 'production') {
      globalForPrisma.prisma = _prisma;
    }
  }
  return _prisma;
}

// Lazy proxy: prevents PrismaClient from initializing during Next.js build-time module evaluation
const prisma = new Proxy({}, {
  get(target, prop) {
    const client = getPrismaClient();
    const val = client[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});

export default prisma;
