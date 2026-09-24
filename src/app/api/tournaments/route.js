import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tournaments = await prisma.tournament.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { teams: true, players: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ tournaments });
  } catch (error) {
    console.error('Get tournaments error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, logo, totalPurse, minPlayers, maxPlayers, baseIncrement, sportType } = body;

    if (!name) {
      return NextResponse.json({ error: 'Tournament name is required' }, { status: 400 });
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        logo: logo || null,
        userId: user.id,
        totalPurse: totalPurse || 100000,
        minPlayers: minPlayers || 7,
        maxPlayers: maxPlayers || 15,
        baseIncrement: baseIncrement || 100,
        sportType: sportType || 'cricket',
      },
    });

    // Create default auction state
    await prisma.auctionState.create({
      data: {
        tournamentId: tournament.id,
      },
    });

    return NextResponse.json({ tournament }, { status: 201 });
  } catch (error) {
    console.error('Create tournament error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
