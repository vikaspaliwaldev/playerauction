import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthUser } from '@/lib/utils';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const sponsors = await prisma.sponsor.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json({ sponsors });
  } catch (error) {
    console.error('Get sponsors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const tournament = await prisma.tournament.findFirst({ where: { id } });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    const body = await request.json();

    // 1. Bulk update / rebalance sponsors
    if (body.bulkUpdates && Array.isArray(body.bulkUpdates)) {
      await prisma.$transaction(
        body.bulkUpdates.map((item, idx) =>
          prisma.sponsor.update({
            where: { id: item.id },
            data: {
              ...(item.name && { name: item.name.trim() }),
              ...(item.logo && { logo: item.logo.trim() }),
              ...(item.url !== undefined && { url: item.url ? item.url.trim() : null }),
              ...(item.weight !== undefined && { weight: Math.max(1, Math.min(100, parseInt(item.weight) || 10)) }),
              sortOrder: item.sortOrder !== undefined ? parseInt(item.sortOrder) : idx,
            },
          })
        )
      );
      const sponsors = await prisma.sponsor.findMany({
        where: { tournamentId: id },
        orderBy: { sortOrder: 'asc' },
      });
      return NextResponse.json({ success: true, sponsors });
    }

    const { name, logo, url, weight, sortOrder, sponsorId } = body;

    // 2. Update existing sponsor if sponsorId provided
    if (sponsorId) {
      const existing = await prisma.sponsor.findUnique({ where: { id: sponsorId } });
      if (!existing) return NextResponse.json({ error: 'Sponsor not found' }, { status: 404 });

      const updated = await prisma.sponsor.update({
        where: { id: sponsorId },
        data: {
          ...(name && { name: name.trim() }),
          ...(logo && { logo: logo.trim() }),
          ...(url !== undefined && { url: url ? url.trim() : null }),
          ...(weight !== undefined && { weight: Math.max(1, Math.min(100, parseInt(weight) || 10)) }),
          ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
        },
      });

      const all = await prisma.sponsor.findMany({
        where: { tournamentId: id },
        orderBy: { sortOrder: 'asc' },
      });
      return NextResponse.json({ sponsor: updated, sponsors: all });
    }

    // 3. Create NEW sponsor
    if (!logo || !logo.trim()) {
      return NextResponse.json({ error: 'Sponsor logo or banner is required' }, { status: 400 });
    }

    const trimmedName = name ? name.trim() : 'Official Sponsor';
    const trimmedLogo = logo.trim();
    const trimmedUrl = url && url.trim() ? url.trim() : null;

    const existingSponsors = await prisma.sponsor.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
    });

    const newCount = existingSponsors.length + 1;
    // Default weight calculation (divide 100 by newCount if not explicitly specified)
    const defaultWeight = weight !== undefined
      ? Math.max(1, Math.min(100, parseInt(weight) || 10))
      : Math.floor(100 / newCount);

    const newSponsor = await prisma.sponsor.create({
      data: {
        tournamentId: id,
        name: trimmedName,
        logo: trimmedLogo,
        url: trimmedUrl,
        sortOrder: sortOrder !== undefined ? parseInt(sortOrder) : existingSponsors.length,
        weight: defaultWeight,
      },
    });

    // If requested or if user added a sponsor and wanted auto-equal weights
    if (body.autoRebalance && existingSponsors.length > 0) {
      const allSponsors = [...existingSponsors, newSponsor];
      const equalShare = Math.floor(100 / allSponsors.length);
      const remainder = 100 - (equalShare * allSponsors.length);

      await prisma.$transaction(
        allSponsors.map((s, idx) =>
          prisma.sponsor.update({
            where: { id: s.id },
            data: { weight: equalShare + (idx === 0 ? remainder : 0) },
          })
        )
      );
    }

    const all = await prisma.sponsor.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ sponsor: newSponsor, sponsors: all }, { status: 201 });
  } catch (error) {
    console.error('Create/update sponsor error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { sponsorId, name, logo, weight, sortOrder } = body;

    if (!sponsorId) {
      return NextResponse.json({ error: 'Sponsor ID is required' }, { status: 400 });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (logo) updateData.logo = logo.trim();
    if (weight !== undefined) updateData.weight = Math.max(1, Math.min(100, parseInt(weight) || 10));
    if (sortOrder !== undefined) updateData.sortOrder = parseInt(sortOrder) || 0;

    const sponsor = await prisma.sponsor.update({
      where: { id: sponsorId },
      data: updateData,
    });

    const sponsors = await prisma.sponsor.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ success: true, sponsor, sponsors });
  } catch (error) {
    console.error('Update sponsor error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty
    }
    const { sponsorId, deleteAll, autoRebalance } = body;

    if (deleteAll) {
      await prisma.sponsor.deleteMany({ where: { tournamentId: id } });
      return NextResponse.json({ success: true, message: 'All sponsors removed', sponsors: [] });
    }

    if (sponsorId) {
      await prisma.sponsor.delete({ where: { id: sponsorId } });
    } else {
      // Delete most recent or first if no sponsorId
      const first = await prisma.sponsor.findFirst({ where: { tournamentId: id } });
      if (first) {
        await prisma.sponsor.delete({ where: { id: first.id } });
      }
    }

    let remaining = await prisma.sponsor.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: 'asc' },
    });

    // Optionally auto-rebalance remaining to 100%
    if (autoRebalance && remaining.length > 0) {
      const equalShare = Math.floor(100 / remaining.length);
      const remainder = 100 - (equalShare * remaining.length);

      await prisma.$transaction(
        remaining.map((s, idx) =>
          prisma.sponsor.update({
            where: { id: s.id },
            data: { weight: equalShare + (idx === 0 ? remainder : 0) },
          })
        )
      );

      remaining = await prisma.sponsor.findMany({
        where: { tournamentId: id },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return NextResponse.json({ success: true, sponsors: remaining });
  } catch (error) {
    console.error('Delete sponsor error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
