import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const tournaments = await prisma.tournament.findMany({
      where: {
        status: { not: 'completed' },
      },
      select: {
        id: true,
        name: true,
        logo: true,
        sportType: true,
        status: true,
        totalPurse: true,
        minPlayers: true,
        maxPlayers: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            teams: true,
            players: true,
            categories: true,
            sponsors: true,
          },
        },
        auctionState: {
          select: {
            isActive: true,
            mode: true,
            currentBid: true,
          },
        },
        players: {
          where: { status: 'sold' },
          select: { id: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    });

    const formattedTournaments = tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      logo: t.logo,
      sportType: t.sportType,
      status: t.status,
      totalPurse: t.totalPurse,
      minPlayers: t.minPlayers,
      maxPlayers: t.maxPlayers,
      teamsCount: t._count?.teams || 0,
      playersCount: t._count?.players || 0,
      soldCount: t.players?.length || 0,
      categoriesCount: t._count?.categories || 0,
      sponsorsCount: t._count?.sponsors || 0,
      isAuctionActive: !!t.auctionState?.isActive,
      auctionMode: t.auctionState?.mode || 'trial',
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
    }));

    return NextResponse.json({ tournaments: formattedTournaments });
  } catch (error) {
    console.error('Public get tournaments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
