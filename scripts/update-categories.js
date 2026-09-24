const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const RANK_1_PLAYERS = [
  'Akshay Tamane',
  'Asif Tamboli',
  'Rudra Pathak',
  'Sagar Vekanjkar',
  'Tarun jha',
  'SACHIN KABLE',
  'Pradyumna Juikar',
  'Prashant Omble',
  'Rohit Kashyap',
  'VAIJNATH PAWAR',
  'Amit Chougule',
  'Pankaj sehra',
];

const RANK_2_PLAYERS = [
  'Anand Kulkarni',
  'Pandurang Biradar',
  'Yash Bhame',
  'Vinod Digole',
  'Harahit Upadhyay',
  'Neeraj',
  'NILESH GAIKWAD',
  'SHIVRAJ SALVE',
  'Sushant Mane',
  'Abie',
  'Shailesh Sapate',
  'Vinod Mulik',
];

const RANK_3_PLAYERS = [
  'Shreyas Mohite',
  'Niranjan Nande',
  'Vaibhav Gunjal',
  'Dr Amit R M',
  'Ajit Sarwale',
  'Rahul Pawar',
  'Yogesh M',
  'Ashwin Sutar',
  'Harsh Munot',
  'Himanshu Rajpali',
  'Onkar Jagtap',
  'Yogesh Jadhav',
  'Anup Chudiwal',
  'Mahesh Dhole',
  'Rakesh Rane',
  'Ranjit Savant',
  'Tushar Lokhande',
  'Vinay Mahadik',
  'Bharat Patil',
  'C.kishor Ladekar',
  'Vikas Paliwal',
  'Manish Mishra',
  'Shivraj Harale',
  'Sibendra Singh',
  'Suyash M Harkare',
  'Kavish Gianani',
  'Jayesh Deore',
];

function normalizeName(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  console.log('Locating tournament "7PD VPL Season 2"...');
  const tournament = await prisma.tournament.findFirst({
    where: {
      name: { contains: '7PD VPL', mode: 'insensitive' },
    },
    include: {
      categories: true,
      players: true,
    },
  });

  if (!tournament) {
    console.error('Tournament not found!');
    process.exit(1);
  }

  console.log(`Found tournament: "${tournament.name}" (ID: ${tournament.id}) with ${tournament.players.length} players.`);
  console.log('Existing categories:', tournament.categories.map(c => c.name));

  // Find or create Categories: "List A", "List B", "List C"
  async function getOrCreateCategory(name, sortOrder, basePrice = 1000) {
    let cat = tournament.categories.find(
      c => c.name.toLowerCase() === name.toLowerCase() ||
           (name === 'List A' && (c.name.toLowerCase().includes('rank 1') || c.name.toLowerCase().includes('list a'))) ||
           (name === 'List B' && (c.name.toLowerCase().includes('rank 2') || c.name.toLowerCase().includes('list b'))) ||
           (name === 'List C' && (c.name.toLowerCase().includes('rank 3') || c.name.toLowerCase().includes('list c')))
    );

    if (cat) {
      // Ensure name is exactly "List A", "List B", "List C"
      if (cat.name !== name) {
        cat = await prisma.category.update({
          where: { id: cat.id },
          data: { name, sortOrder },
        });
        console.log(`Renamed category ${cat.id} to "${name}"`);
      }
      return cat;
    }

    cat = await prisma.category.create({
      data: {
        name,
        sortOrder,
        basePrice,
        tournamentId: tournament.id,
      },
    });
    console.log(`Created new category: "${name}" (${cat.id})`);
    return cat;
  }

  const catA = await getOrCreateCategory('List A', 1, 3000);
  const catB = await getOrCreateCategory('List B', 2, 2000);
  const catC = await getOrCreateCategory('List C', 3, 1000);

  const r1Norm = RANK_1_PLAYERS.map(n => ({ original: n, norm: normalizeName(n) }));
  const r2Norm = RANK_2_PLAYERS.map(n => ({ original: n, norm: normalizeName(n) }));
  const r3Norm = RANK_3_PLAYERS.map(n => ({ original: n, norm: normalizeName(n) }));

  let countA = 0;
  let countB = 0;
  let countC = 0;
  let resetAgeCount = 0;

  for (const player of tournament.players) {
    const pNorm = normalizeName(player.name);

    let targetCatId = null;
    let rankLabel = '';

    if (r1Norm.some(r => r.norm === pNorm || pNorm.includes(r.norm) || r.norm.includes(pNorm))) {
      targetCatId = catA.id;
      rankLabel = 'List A (Rank 1)';
      countA++;
    } else if (r2Norm.some(r => r.norm === pNorm || pNorm.includes(r.norm) || r.norm.includes(pNorm))) {
      targetCatId = catB.id;
      rankLabel = 'List B (Rank 2)';
      countB++;
    } else if (r3Norm.some(r => r.norm === pNorm || pNorm.includes(r.norm) || r.norm.includes(pNorm))) {
      targetCatId = catC.id;
      rankLabel = 'List C (Rank 3)';
      countC++;
    } else {
      // Default to List C if not in list
      targetCatId = catC.id;
      rankLabel = 'List C (Rank 3 - Default)';
      countC++;
    }

    await prisma.player.update({
      where: { id: player.id },
      data: {
        categoryId: targetCatId,
        age: 0,
      },
    });
    resetAgeCount++;

    console.log(`Player #${player.playerNumber}: ${player.name} -> ${rankLabel}, Age: 0`);
  }

  console.log('\n=======================================');
  console.log(`Update Complete! Summary:`);
  console.log(`- List A (Rank 1): ${countA} players`);
  console.log(`- List B (Rank 2): ${countB} players`);
  console.log(`- List C (Rank 3): ${countC} players`);
  console.log(`- All ${resetAgeCount} players had their age reset to 0.`);
  console.log('=======================================');
}

main()
  .catch((e) => {
    console.error('Error updating player categories & age:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
