import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

export async function GET(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const tournament = await prisma.tournament.findFirst({
      where: { id, userId: user.id },
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
    console.error('Get tournament error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.logo !== undefined) updateData.logo = body.logo || null;
    if (body.totalPurse !== undefined) updateData.totalPurse = parseInt(body.totalPurse) || 100000;
    if (body.minPlayers !== undefined) updateData.minPlayers = parseInt(body.minPlayers) || 7;
    if (body.maxPlayers !== undefined) updateData.maxPlayers = parseInt(body.maxPlayers) || 15;
    if (body.baseIncrement !== undefined) updateData.baseIncrement = parseInt(body.baseIncrement) || 100;
    if (body.incrementType !== undefined) updateData.incrementType = body.incrementType;
    if (body.incrementSlabs !== undefined) updateData.incrementSlabs = body.incrementSlabs;
    if (body.sportType !== undefined) updateData.sportType = body.sportType;
    if (body.status !== undefined) updateData.status = body.status;

    const tournament = await prisma.tournament.updateMany({
      where: { id, userId: user.id },
      data: updateData,
    });

    if (tournament.count === 0) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Tournament updated' });
  } catch (error) {
    console.error('Update tournament error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.tournament.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ message: 'Tournament deleted' });
  } catch (error) {
    console.error('Delete tournament error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
