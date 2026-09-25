/**
 * Migration Script: Transfers complete data from Aiven to Supabase
 * Usage: node --env-file=.env scripts/migrate-aiven-to-supabase.js
 */

const { PrismaClient: AivenPrisma } = require('@prisma/client');

const AIVEN_URL = process.env.AIVEN_DATABASE_URL || process.env.DATABASE_URL;

async function main() {
  const supabaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!supabaseUrl) {
    console.error('Please configure DATABASE_URL or DIRECT_URL in .env with your Supabase connection string.');
    process.exit(1);
  }

  console.log('Connecting to Aiven (Source)...');
  const aiven = new AivenPrisma({
    datasources: { db: { url: AIVEN_URL } },
  });

  console.log('Connecting to Supabase (Target)...');
  const supabase = new AivenPrisma({
    datasources: { db: { url: supabaseUrl } },
  });

  try {
    // 1. Fetch Users
    const users = await aiven.user.findMany();
    console.log(`Fetched ${users.length} users from Aiven.`);
    for (const u of users) {
      await supabase.user.upsert({
        where: { id: u.id },
        update: u,
        create: u,
      });
    }

    // 2. Fetch Tournaments
    const tournaments = await aiven.tournament.findMany();
    console.log(`Fetched ${tournaments.length} tournaments from Aiven.`);
    for (const t of tournaments) {
      await supabase.tournament.upsert({
        where: { id: t.id },
        update: t,
        create: t,
      });
    }

    // 3. Categories
    const categories = await aiven.category.findMany();
    console.log(`Fetched ${categories.length} categories from Aiven.`);
    for (const c of categories) {
      await supabase.category.upsert({
        where: { id: c.id },
        update: c,
        create: c,
      });
    }

    // 4. Teams
    const teams = await aiven.team.findMany();
    console.log(`Fetched ${teams.length} teams from Aiven.`);
    for (const tm of teams) {
      await supabase.team.upsert({
        where: { id: tm.id },
        update: tm,
        create: tm,
      });
    }

    // 5. Team Owners
    const owners = await aiven.teamOwner.findMany();
    console.log(`Fetched ${owners.length} team owners from Aiven.`);
    for (const o of owners) {
      await supabase.teamOwner.upsert({
        where: { id: o.id },
        update: o,
        create: o,
      });
    }

    // 6. Players
    const players = await aiven.player.findMany();
    console.log(`Fetched ${players.length} players from Aiven.`);
    for (const p of players) {
      await supabase.player.upsert({
        where: { id: p.id },
        update: p,
        create: p,
      });
    }

    // 7. Sponsors
    const sponsors = await aiven.sponsor.findMany();
    console.log(`Fetched ${sponsors.length} sponsors from Aiven.`);
    for (const s of sponsors) {
      await supabase.sponsor.upsert({
        where: { id: s.id },
        update: s,
        create: s,
      });
    }

    // 8. Auction State
    const auctionStates = await aiven.auctionState.findMany();
    console.log(`Fetched ${auctionStates.length} auction states from Aiven.`);
    for (const as of auctionStates) {
      await supabase.auctionState.upsert({
        where: { tournamentId: as.tournamentId },
        update: as,
        create: as,
      });
    }

    // 9. Bids
    const bids = await aiven.bid.findMany();
    console.log(`Fetched ${bids.length} bids from Aiven.`);
    for (const b of bids) {
      await supabase.bid.upsert({
        where: { id: b.id },
        update: b,
        create: b,
      });
    }

    // 10. Sales
    const sales = await aiven.sale.findMany();
    console.log(`Fetched ${sales.length} sales from Aiven.`);
    for (const sl of sales) {
      await supabase.sale.upsert({
        where: { playerId: sl.playerId },
        update: sl,
        create: sl,
      });
    }

    console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY FROM AIVEN TO SUPABASE!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await aiven.$disconnect();
    await supabase.$disconnect();
  }
}

main();
