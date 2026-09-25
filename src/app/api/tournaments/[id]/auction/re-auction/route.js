import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';
import { invalidateCache } from '@/lib/tournamentCache';

// POST - Re-auction a sold/unsold player (make available again)
export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { playerId } = await request.json();

    if (!playerId) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 });
    }

    // Remove existing sale if any
    await prisma.sale.deleteMany({ where: { playerId } });

    // Set player back to available and set as current player
    const player = await prisma.player.update({
      where: { id: playerId },
      data: { status: 'available' },
      include: { category: true },
    });

    // Update auction state to show this player
    await prisma.auctionState.update({
      where: { tournamentId: id },
      data: {
        currentPlayerId: playerId,
        currentBid: player.category.basePrice,
        currentTeamId: null,
      },
    });

    invalidateCache(id);

    return NextResponse.json({ player, message: 'Player available for re-auction' });
  } catch (error) {
    console.error('Re-auction error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
