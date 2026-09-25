import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';
import { calculateTeamReserve } from '@/lib/auctionRules';

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

    // Parallel fetch: get player, tournament categories & minPlayers, and team with its sales in 1 single roundtrip!
    const [player, tournament, team] = await Promise.all([
      prisma.player.findFirst({
        where: { id: playerId, tournamentId: id },
        include: { category: true },
      }),
      prisma.tournament.findUnique({
        where: { id },
        include: { categories: true }, // Do NOT fetch entire players table
      }),
      prisma.team.findUnique({
        where: { id: teamId },
        include: { sales: { include: { player: true } } },
      }),
    ]);

    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Verify category player quota if maxPerTeam is set (calculated in-memory from team.sales)
    if (player.category?.maxPerTeam && player.category.maxPerTeam > 0) {
      const existingInCat = (team?.sales || []).filter(s => 
        s.playerId !== playerId && s.player?.categoryId === player.categoryId
      ).length;

      if (existingInCat >= player.category.maxPerTeam) {
        return NextResponse.json({
          error: `Cannot complete sale: Team already has the maximum allowed ${player.category.maxPerTeam} player(s) for category "${player.category.name}".`
        }, { status: 400 });
      }
    }

    // Verify minimum reserve balance is maintained
    if (team && tournament) {
      const otherSales = (team.sales || []).filter(s => s.playerId !== playerId);
      const currentSpent = otherSales.reduce((sum, s) => sum + s.soldPrice, 0);
      const remainingBalanceAfterSale = team.purse - (currentSpent + soldPrice);

      const reserveInfo = calculateTeamReserve(
        { ...team, sales: otherSales },
        tournament,
        player.categoryId
      );

      if (remainingBalanceAfterSale < reserveInfo.totalReserve) {
        return NextResponse.json({
          error: `Cannot complete sale: Team purse balance after purchase (₹${remainingBalanceAfterSale.toLocaleString()}) would fall below the mandatory reserve of ₹${reserveInfo.totalReserve.toLocaleString()} required for category quotas.`
        }, { status: 400 });
      }
    }

    // Atomic transaction: remove existing sale, create sale, update player, clear bids, update auction state
    const [_, sale] = await prisma.$transaction([
      prisma.sale.deleteMany({ where: { playerId } }),
      prisma.sale.create({
        data: { playerId, teamId, soldPrice },
      }),
      prisma.player.update({
        where: { id: playerId },
        data: { status: 'sold' },
      }),
      prisma.bid.deleteMany({ where: { playerId } }),
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
