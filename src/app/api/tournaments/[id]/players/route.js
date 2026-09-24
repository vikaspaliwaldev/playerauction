import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const tournament = await prisma.tournament.findFirst({
      where: { id, userId: user.id },
      include: { categories: true },
    });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const body = await request.json();

    // Support bulk import
    if (Array.isArray(body)) {
      const players = await prisma.$transaction(
        body.map((p, idx) => {
          const categoryId = p.categoryId || tournament.categories[0]?.id;
          if (!categoryId) throw new Error('No categories exist. Create categories first.');
          
          return prisma.player.create({
            data: {
              playerNumber: p.playerNumber || idx + 1,
              name: p.name,
              photo: p.photo || null,
              categoryId,
              tournamentId: id,
              battingStyle: p.battingStyle || null,
              bowlingStyle: p.bowlingStyle || null,
              role: p.role || null,
              age: p.age ? parseInt(p.age) : null,
              phone: p.phone || null,
            },
          });
        })
      );
      return NextResponse.json({ players, count: players.length }, { status: 201 });
    }

    // Single player
    const { name, playerNumber, categoryId, photo, battingStyle, bowlingStyle, role, age, phone } = body;

    if (!name) {
      return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
    }

    const existingCount = await prisma.player.count({ where: { tournamentId: id } });
    const finalCategoryId = categoryId || tournament.categories[0]?.id;

    if (!finalCategoryId) {
      return NextResponse.json({ error: 'Create at least one category first' }, { status: 400 });
    }

    const player = await prisma.player.create({
      data: {
        playerNumber: playerNumber || existingCount + 1,
        name,
        photo: photo || null,
        categoryId: finalCategoryId,
        tournamentId: id,
        battingStyle: battingStyle || null,
        bowlingStyle: bowlingStyle || null,
        role: role || null,
        age: age ? parseInt(age) : null,
        phone: phone || null,
      },
    });

    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    console.error('Create player error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const {
      playerId,
      name,
      playerNumber,
      categoryId,
      role,
      battingStyle,
      bowlingStyle,
      age,
      photo,
      status,
      teamId,
      soldPrice,
      cancelAuction,
    } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (playerNumber !== undefined && playerNumber !== '') updateData.playerNumber = parseInt(playerNumber);
    if (categoryId) updateData.categoryId = categoryId;
    if (role !== undefined) updateData.role = role;
    if (battingStyle !== undefined) updateData.battingStyle = battingStyle;
    if (bowlingStyle !== undefined) updateData.bowlingStyle = bowlingStyle;
    if (age !== undefined) updateData.age = age ? parseInt(age) : null;
    if (photo !== undefined) updateData.photo = photo;

    // Handle Cancel Auction (Reset to available)
    if (cancelAuction || status === 'available') {
      updateData.status = 'available';
      await prisma.sale.deleteMany({ where: { playerId } });
      await prisma.bid.deleteMany({ where: { playerId } });
    } else if (status === 'unsold') {
      updateData.status = 'unsold';
      await prisma.sale.deleteMany({ where: { playerId } });
      await prisma.bid.deleteMany({ where: { playerId } });
    } else if (status === 'sold' || (teamId && soldPrice !== undefined)) {
      updateData.status = 'sold';
      const price = parseInt(soldPrice) || 0;
      if (teamId) {
        // Upsert sale record
        await prisma.sale.upsert({
          where: { playerId },
          update: { teamId, soldPrice: price },
          create: { playerId, teamId, soldPrice: price },
        });
      }
    }

    const player = await prisma.player.update({
      where: { id: playerId, tournamentId: id },
      data: updateData,
      include: {
        category: true,
        sale: { include: { team: true } },
      },
    });

    return NextResponse.json({ success: true, player });
  } catch (error) {
    console.error('Update player error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { playerId } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
    }

    await prisma.player.delete({
      where: { id: playerId, tournamentId: id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete player error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

