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
      include: { categories: true, teams: true },
    });
    if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    // 1. Ensure Categories (reuse if existing, otherwise create)
    let catPlatinum = tournament.categories.find(c => c.name.toLowerCase().includes('platinum') || c.name.toLowerCase().includes('icon'));
    if (!catPlatinum) {
      catPlatinum = await prisma.category.create({
        data: {
          name: 'Platinum / Icon',
          basePrice: 5000,
          sortOrder: tournament.categories.length + 1,
          tournamentId: id,
        },
      });
    }

    let catGold = tournament.categories.find(c => c.name.toLowerCase().includes('gold'));
    if (!catGold) {
      catGold = await prisma.category.create({
        data: {
          name: 'Gold',
          basePrice: 2500,
          sortOrder: tournament.categories.length + 2,
          tournamentId: id,
        },
      });
    }

    let catSilver = tournament.categories.find(c => c.name.toLowerCase().includes('silver'));
    if (!catSilver) {
      catSilver = await prisma.category.create({
        data: {
          name: 'Silver',
          basePrice: 1000,
          sortOrder: tournament.categories.length + 3,
          tournamentId: id,
        },
      });
    }

    // 2. Ensure Teams (create if less than 4)
    const existingTeams = tournament.teams;
    if (existingTeams.length === 0) {
      await prisma.team.createMany({
        data: [
          {
            name: 'Mumbai Blasters',
            shortName: 'MB',
            purse: tournament.totalPurse || 100000,
            hotkey: '1',
            color: '#004ba0',
            sortOrder: 1,
            tournamentId: id,
          },
          {
            name: 'Royal Challengers',
            shortName: 'RC',
            purse: tournament.totalPurse || 100000,
            hotkey: '2',
            color: '#d32f2f',
            sortOrder: 2,
            tournamentId: id,
          },
          {
            name: 'Chennai Super Kings',
            shortName: 'CSK',
            purse: tournament.totalPurse || 100000,
            hotkey: '3',
            color: '#fbc02d',
            sortOrder: 3,
            tournamentId: id,
          },
          {
            name: 'Kolkata Knights',
            shortName: 'KK',
            purse: tournament.totalPurse || 100000,
            hotkey: '4',
            color: '#7b1fa2',
            sortOrder: 4,
            tournamentId: id,
          },
        ],
      });
    }

    // 3. Find highest existing playerNumber to avoid unique constraint collision
    const maxNumResult = await prisma.player.aggregate({
      where: { tournamentId: id },
      _max: { playerNumber: true },
    });
    const currentMaxNumber = maxNumResult._max.playerNumber || 0;

    const samplePlayers = [
      // Platinum
      { name: 'Virat Kohli', role: 'Batsman', battingStyle: 'Right Hand', age: 35, categoryId: catPlatinum.id },
      { name: 'Rohit Sharma', role: 'Batsman', battingStyle: 'Right Hand', age: 36, categoryId: catPlatinum.id },
      { name: 'Jasprit Bumrah', role: 'Bowler', bowlingStyle: 'Right Arm Fast', age: 30, categoryId: catPlatinum.id },
      { name: 'MS Dhoni', role: 'Wicket Keeper', battingStyle: 'Right Hand', age: 42, categoryId: catPlatinum.id },
      // Gold
      { name: 'Hardik Pandya', role: 'All-Rounder', battingStyle: 'Right Hand', bowlingStyle: 'Right Arm Medium', age: 30, categoryId: catGold.id },
      { name: 'KL Rahul', role: 'Wicket Keeper', battingStyle: 'Right Hand', age: 31, categoryId: catGold.id },
      { name: 'Suryakumar Yadav', role: 'Batsman', battingStyle: 'Right Hand', age: 33, categoryId: catGold.id },
      { name: 'Ravindra Jadeja', role: 'All-Rounder', battingStyle: 'Left Hand', bowlingStyle: 'Left Arm Spin', age: 35, categoryId: catGold.id },
      { name: 'Rishabh Pant', role: 'Wicket Keeper', battingStyle: 'Left Hand', age: 26, categoryId: catGold.id },
      { name: 'Shubman Gill', role: 'Batsman', battingStyle: 'Right Hand', age: 24, categoryId: catGold.id },
      // Silver
      { name: 'Mohammed Siraj', role: 'Bowler', bowlingStyle: 'Right Arm Fast', age: 30, categoryId: catSilver.id },
      { name: 'Kuldeep Yadav', role: 'Bowler', bowlingStyle: 'Left Arm Wrist Spin', age: 29, categoryId: catSilver.id },
      { name: 'Axar Patel', role: 'All-Rounder', battingStyle: 'Left Hand', bowlingStyle: 'Left Arm Spin', age: 30, categoryId: catSilver.id },
      { name: 'Yuzvendra Chahal', role: 'Bowler', bowlingStyle: 'Right Arm Leg Spin', age: 33, categoryId: catSilver.id },
      { name: 'Arshdeep Singh', role: 'Bowler', bowlingStyle: 'Left Arm Fast', age: 25, categoryId: catSilver.id },
      { name: 'Ishan Kishan', role: 'Wicket Keeper', battingStyle: 'Left Hand', age: 25, categoryId: catSilver.id },
    ];

    await prisma.player.createMany({
      data: samplePlayers.map((p, idx) => ({
        ...p,
        playerNumber: currentMaxNumber + idx + 1,
        tournamentId: id,
        status: 'available',
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Demo tournament seeded successfully with ${samplePlayers.length} star players!`,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
