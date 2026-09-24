const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const AVATAR_THEMES = [
  { p: '#8b5cf6', s: '#6d28d9', a: '#c4b5fd', bg: '#1e1b4b' }, // Royal Violet
  { p: '#0284c7', s: '#0369a1', a: '#7dd3fc', bg: '#082f49' }, // Electric Cyan
  { p: '#e11d48', s: '#be123c', a: '#fda4af', bg: '#4c0519' }, // Ruby Crimson
  { p: '#059669', s: '#047857', a: '#6ee7b7', bg: '#022c22' }, // Emerald Volt
  { p: '#d97706', s: '#b45309', a: '#fde68a', bg: '#451a03' }, // Amber Gold
  { p: '#c026d3', s: '#9333ea', a: '#f0abfc', bg: '#3b0764' }, // Neon Magenta
  { p: '#4f46e5', s: '#3730a3', a: '#a5b4fc', bg: '#1e1b4b' }, // Deep Indigo
  { p: '#0d9488', s: '#0f766e', a: '#5eead4', bg: '#042f2e' }, // Teal Surge
];

function generateJerseyAvatar(playerNumber, name = 'PLAYER', role = '', leagueTag = '7PD VPL') {
  const num = parseInt(playerNumber) || 1;
  const padNum = String(num).padStart(2, '0');
  const t = AVATAR_THEMES[(num - 1) % AVATAR_THEMES.length];
  
  const cleanName = (name || 'PLAYER').trim().toUpperCase().slice(0, 16);
  const cleanRole = (role || 'PLAYER').trim().toUpperCase().slice(0, 12);
  const cleanTag = (leagueTag || '7PD VPL').trim().toUpperCase().slice(0, 14);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.bg}"/>
      <stop offset="60%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="jerseyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.p}"/>
      <stop offset="100%" stop-color="${t.s}"/>
    </linearGradient>
    <radialGradient id="halo" cx="50%" cy="45%" r="65%">
      <stop offset="0%" stop-color="${t.p}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${t.p}" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <rect width="320" height="320" rx="24" fill="url(#bgGrad)"/>
  <rect width="320" height="320" rx="24" fill="url(#halo)"/>
  <rect x="1.5" y="1.5" width="317" height="317" rx="23" fill="none" stroke="${t.p}" stroke-width="1.5" stroke-opacity="0.45"/>

  <path d="M-20,60 L120,-80 M-20,120 L180,-80 M-20,180 L240,-80" stroke="${t.p}" stroke-width="2" stroke-opacity="0.1"/>
  <path d="M340,240 L200,380 M340,180 L140,380" stroke="${t.p}" stroke-width="2" stroke-opacity="0.1"/>

  <rect x="95" y="16" width="130" height="22" rx="11" fill="rgba(255,255,255,0.06)" stroke="${t.p}" stroke-width="1" stroke-opacity="0.6"/>
  <text x="160" y="31.5" font-family="'Outfit', -apple-system, sans-serif" font-size="10" font-weight="800" fill="${t.a}" text-anchor="middle" letter-spacing="1.5">${cleanTag}</text>

  <path d="M 95,88 L 66,134 L 95,150 L 110,128 L 110,238 L 210,238 L 210,128 L 225,150 L 254,134 L 225,88 L 182,86 Q 160,110 138,86 Z"
        fill="url(#jerseyGrad)"
        stroke="rgba(255,255,255,0.25)"
        stroke-width="1.5"
        filter="url(#glow)"/>

  <path d="M 138,86 Q 160,110 182,86" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>

  <line x1="72" y1="129" x2="90" y2="140" stroke="${t.a}" stroke-width="3" stroke-linecap="round"/>
  <line x1="248" y1="129" x2="230" y2="140" stroke="${t.a}" stroke-width="3" stroke-linecap="round"/>

  <text x="160" y="192" font-family="'Impact', 'Bebas Neue', -apple-system, sans-serif" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">${padNum}</text>

  <rect x="136" y="204" width="48" height="4" rx="2" fill="${t.a}"/>

  <rect x="22" y="254" width="276" height="46" rx="10" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
  <text x="160" y="274" font-family="'Outfit', -apple-system, sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="0.8">${cleanName}</text>
  <text x="160" y="291" font-family="'Outfit', -apple-system, sans-serif" font-size="9" font-weight="700" fill="${t.a}" text-anchor="middle" letter-spacing="1.5">${cleanRole}</text>
</svg>`;

  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

async function main() {
  console.log('Finding tournament "7PD VPL Season 2"...');
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { contains: '7PD VPL', mode: 'insensitive' },
    },
    include: {
      players: {
        orderBy: { playerNumber: 'asc' },
      },
    },
  });

  if (!tournament) {
    console.error('Tournament "7PD VPL Season 2" not found!');
    process.exit(1);
  }

  console.log(`Found tournament: "${tournament.name}" (ID: ${tournament.id}) with ${tournament.players.length} players.`);

  let updatedCount = 0;
  for (const player of tournament.players) {
    const avatar = generateJerseyAvatar(
      player.playerNumber,
      player.name,
      player.role,
      '7PD VPL • S2'
    );

    await prisma.player.update({
      where: { id: player.id },
      data: { photo: avatar },
    });
    updatedCount++;
    console.log(`[${updatedCount}/${tournament.players.length}] Player #${player.playerNumber}: ${player.name} (${player.role || 'Player'}) -> Avatar Assigned`);
  }

  console.log(`\n🎉 Successfully generated and assigned sequence-number avatars to all ${updatedCount} players!`);
}

main()
  .catch((e) => {
    console.error('Error assigning avatars:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
