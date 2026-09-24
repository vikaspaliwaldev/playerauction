import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const tournament = await prisma.tournament.findFirst({ where: { id, userId: user.id } });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const body = await request.json();
    const { name, shortName, purse, hotkey, color, logo } = body;

    if (!name || !shortName) {
      return NextResponse.json({ error: 'Team name and short name are required' }, { status: 400 });
    }

    const teamCount = await prisma.team.count({ where: { tournamentId: id } });

    const team = await prisma.team.create({
      data: {
        name,
        shortName: shortName.toUpperCase(),
        tournamentId: id,
        purse: purse || tournament.totalPurse,
        hotkey: hotkey ? hotkey.trim().toUpperCase() : null,
        color: color || null,
        logo: logo || null,
        sortOrder: teamCount,
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    console.error('Create team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const tournament = await prisma.tournament.findFirst({ where: { id, userId: user.id } });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const body = await request.json();
    const { teamId, purseDelta, purse, name, shortName, color, hotkey, logo } = body;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (typeof purseDelta === 'number') {
      updateData.purse = { increment: purseDelta };
    } else if (typeof purse === 'number') {
      updateData.purse = purse;
    }
    if (name) updateData.name = name;
    if (shortName) updateData.shortName = shortName.toUpperCase();
    if (color) updateData.color = color;
    if (hotkey !== undefined) updateData.hotkey = hotkey ? hotkey.trim().toUpperCase() : null;
    if (logo !== undefined) updateData.logo = logo;

    const team = await prisma.team.update({
      where: { id: teamId, tournamentId: id },
      data: updateData,
    });

    return NextResponse.json({ success: true, team });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { teamId } = body;

    if (!teamId) return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });

    await prisma.team.delete({
      where: { id: teamId, tournamentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}


