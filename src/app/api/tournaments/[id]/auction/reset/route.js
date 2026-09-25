import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';
import { invalidateCache } from '@/lib/tournamentCache';

// POST - Reset auction (clear all sales, bids, reset player statuses)
export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { type } = body; // 'full' or 'unsold'

    if (type === 'unsold') {
      // Move all unsold players back to available
      await prisma.player.updateMany({
        where: { tournamentId: id, status: 'unsold' },
        data: { status: 'available' },
      });

      invalidateCache(id);

      return NextResponse.json({ message: 'Unsold players moved back to available pool' });
    }

    // Full reset
    await prisma.$transaction([
      prisma.bid.deleteMany({
        where: { player: { tournamentId: id } },
      }),
      prisma.sale.deleteMany({
        where: { player: { tournamentId: id } },
      }),
      prisma.player.updateMany({
        where: { tournamentId: id },
        data: { status: 'available' },
      }),
      prisma.auctionState.update({
        where: { tournamentId: id },
        data: {
          currentPlayerId: null,
          currentBid: 0,
          currentTeamId: null,
          isActive: false,
        },
      }),
    ]);

    invalidateCache(id);

    return NextResponse.json({ message: 'Auction reset successfully' });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
