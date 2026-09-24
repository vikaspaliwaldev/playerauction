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
    const { name, basePrice, sortOrder, maxPerTeam } = body;

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    const catCount = await prisma.category.count({ where: { tournamentId: id } });

    const category = await prisma.category.create({
      data: {
        name,
        basePrice: basePrice || 1000,
        maxPerTeam: (maxPerTeam && parseInt(maxPerTeam) > 0) ? parseInt(maxPerTeam) : null,
        tournamentId: id,
        sortOrder: sortOrder ?? catCount,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Create category error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { categoryId, name, basePrice, sortOrder, maxPerTeam } = body;

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (basePrice !== undefined && basePrice !== '') updateData.basePrice = parseInt(basePrice) || 0;
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder) || 0;
    if (maxPerTeam !== undefined) {
      updateData.maxPerTeam = (maxPerTeam === null || maxPerTeam === '' || parseInt(maxPerTeam) <= 0) ? null : parseInt(maxPerTeam);
    }

    const category = await prisma.category.update({
      where: { id: categoryId, tournamentId: id },
      data: updateData,
    });

    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error('Update category error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { categoryId } = body;

    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    const playerCount = await prisma.player.count({ where: { categoryId } });
    if (playerCount > 0) {
      return NextResponse.json({
        error: `Cannot delete category: ${playerCount} player(s) are assigned to it. Reassign them first.`
      }, { status: 400 });
    }

    await prisma.category.delete({
      where: { id: categoryId, tournamentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete category error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
