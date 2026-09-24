import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';
import { generateJerseyAvatar } from '@/lib/avatarGenerator';

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const tournament = await prisma.tournament.findFirst({
      where: { id, userId: user.id },
      include: {
        players: { orderBy: { playerNumber: 'asc' } },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    let updatedCount = 0;
    const leagueTag = tournament.name?.length > 14 ? tournament.name.slice(0, 14) : tournament.name;

    for (const player of tournament.players) {
      const avatar = generateJerseyAvatar(
        player.playerNumber,
        player.name,
        player.role,
        leagueTag
      );

      await prisma.player.update({
        where: { id: player.id },
        data: { photo: avatar },
      });
      updatedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully generated and assigned sequence number avatars to ${updatedCount} players!`,
      count: updatedCount,
    });
  } catch (error) {
    console.error('Generate avatars error:', error);
    return NextResponse.json({ error: 'Failed to generate avatars' }, { status: 500 });
  }
}
