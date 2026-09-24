import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

// POST - Sell a player to a team
export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { playerId, teamId, soldPrice } = await request.json();

    if (!playerId || !teamId || !soldPrice) {
      return NextResponse.json({ error: 'playerId, teamId, and soldPrice are required' }, { status: 400 });
    }

    // Verify player exists and is available or unsold
    const player = await prisma.player.findFirst({
      where: { id: playerId, tournamentId: id },
      include: { category: true },
    });

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Verify category player quota if maxPerTeam is set
    if (player.category?.maxPerTeam && player.category.maxPerTeam > 0) {
      const existingInCat = await prisma.sale.count({
        where: {
          teamId,
          player: { categoryId: player.categoryId },
          playerId: { not: playerId }, // exclude current player if re-auctioning
        },
      });
      if (existingInCat >= player.category.maxPerTeam) {
        return NextResponse.json({
          error: `Cannot complete sale: Team already has the maximum allowed ${player.category.maxPerTeam} player(s) for category "${player.category.name}".`
        }, { status: 400 });
      }
    }

    // Remove existing sale if re-auctioning
    await prisma.sale.deleteMany({ where: { playerId } });

    // Create sale and update player status
    const [sale] = await prisma.$transaction([
      prisma.sale.create({
        data: { playerId, teamId, soldPrice },
      }),
      prisma.player.update({
        where: { id: playerId },
        data: { status: 'sold' },
      }),
      // Clear bid history for this player
      prisma.bid.deleteMany({ where: { playerId } }),
      // Update auction state
      prisma.auctionState.update({
        where: { tournamentId: id },
        data: { currentPlayerId: null, currentBid: 0, currentTeamId: null },
      }),
    ]);

    return NextResponse.json({ sale, message: 'Player sold successfully' });
  } catch (error) {
    console.error('Sold error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
