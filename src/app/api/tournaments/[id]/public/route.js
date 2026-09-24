import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            sales: { include: { player: { include: { category: true } } } },
            owners: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        players: {
          include: { category: true, sale: { include: { team: true } } },
          orderBy: { playerNumber: 'asc' },
        },
        categories: { orderBy: { sortOrder: 'asc' } },
        sponsors: { orderBy: { sortOrder: 'asc' } },
        auctionState: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({ tournament });
  } catch (error) {
    console.error('Public get tournament error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
