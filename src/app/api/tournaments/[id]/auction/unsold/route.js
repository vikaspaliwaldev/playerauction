import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

// POST - Mark player as unsold
export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.player.update({
        where: { id: playerId },
        data: { status: 'unsold' },
      }),
      prisma.bid.deleteMany({ where: { playerId } }),
      prisma.auctionState.update({
        where: { tournamentId: id },
        data: { currentPlayerId: null, currentBid: 0, currentTeamId: null },
      }),
    ]);

    return NextResponse.json({ message: 'Player marked as unsold' });
  } catch (error) {
    console.error('Unsold error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
