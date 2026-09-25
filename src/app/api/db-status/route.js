import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const startTime = Date.now();
  try {
    // Run a lightweight raw query to get database server info
    const dbInfo = await prisma.$queryRaw`
      SELECT 
        current_database() as database_name,
        inet_server_addr()::text as server_ip,
        version() as pg_version
    `;

    const latencyMs = Date.now() - startTime;
    const dbUrl = process.env.DATABASE_URL || '';

    let provider = 'Unknown';
    let host = 'Not configured';

    try {
      // Clean password with multiple @ characters if unencoded
      const parts = dbUrl.split('@');
      if (parts.length > 1) {
        const hostPortPart = parts[parts.length - 1]; // Take portion after last @
        host = hostPortPart.split('/')[0].split(':')[0];
      }
    } catch {
      host = 'Parsed from DATABASE_URL';
    }

    if (dbUrl.includes('supabase')) {
      provider = 'Supabase (High Speed Pooler)';
    } else if (dbUrl.includes('aivencloud')) {
      provider = 'Aiven';
    }

    const tournamentCount = await prisma.tournament.count();
    const playerCount = await prisma.player.count();

    return NextResponse.json({
      status: 'Connected',
      provider,
      connectedHost: host,
      database: dbInfo[0]?.database_name,
      serverIp: dbInfo[0]?.server_ip,
      roundTripLatency: `${latencyMs}ms`,
      tournaments: tournamentCount,
      players: playerCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'Error',
      error: error.message,
    }, { status: 500 });
  }
}
