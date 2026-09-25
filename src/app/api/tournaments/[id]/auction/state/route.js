import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';
import { invalidateCache } from '@/lib/tournamentCache';

// GET auction state
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const state = await prisma.auctionState.findUnique({
      where: { tournamentId: id },
    });

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        teams: {
          include: {
            sales: { include: { player: { include: { category: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        players: {
          include: { category: true, sale: { include: { team: true } } },
          orderBy: { playerNumber: 'asc' },
        },
        categories: { orderBy: { sortOrder: 'asc' } },
        sponsors: { orderBy: { sortOrder: 'asc' } },
      },
    });

    return NextResponse.json({ state, tournament });
  } catch (error) {
    console.error('Get auction state error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update auction state
export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    const state = await prisma.auctionState.upsert({
      where: { tournamentId: id },
      update: body,
      create: { tournamentId: id, ...body },
    });

    invalidateCache(id);

    return NextResponse.json({ state });
  } catch (error) {
    console.error('Update auction state error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
