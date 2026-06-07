/* ==========================================================
   Extras — diaries (all tiers), pets, music cape, slayer monsters,
   boss loadouts, quest walkthroughs. Data-heavy.
   ========================================================== */

// ==========================================================
// FULL DIARIES — Easy, Medium, Hard, Elite per region
// ==========================================================
const DIARIES = [
  {
    region: 'Karamja', icon: '🌴',
    tiers: [
      { tier: 'Easy', reward: 'Karamja gloves 1: free Karamja teleport, +10% banana picking', tasks: 10, wiki: 'Karamja_Diary/Easy' },
      { tier: 'Medium', reward: 'Karamja gloves 2: Glory teleport to Karamja, faster cleanup', tasks: 19, wiki: 'Karamja_Diary/Medium' },
      { tier: 'Hard', reward: 'Karamja gloves 3: Fight Cave teleport, gem-rock 1.5× chance', tasks: 11, wiki: 'Karamja_Diary/Hard' },
      { tier: 'Elite', reward: 'Karamja gloves 4: 100 lockpicks daily, double Karambwan catch', tasks: 5, wiki: 'Karamja_Diary/Elite' },
    ]
  },
  {
    region: 'Lumbridge & Draynor', icon: '🗺️',
    tiers: [
      { tier: 'Easy', reward: "Explorer's ring 1: 30% run replenish 2×/day", tasks: 12, wiki: 'Lumbridge_%26_Draynor_Diary/Easy' },
      { tier: 'Medium', reward: "Explorer's ring 2: run replenish 4×/day + Cabbage teleport", tasks: 12, wiki: 'Lumbridge_%26_Draynor_Diary/Medium' },
      { tier: 'Hard', reward: "Explorer's ring 3: alch 30× free runes/day", tasks: 11, wiki: 'Lumbridge_%26_Draynor_Diary/Hard' },
      { tier: 'Elite', reward: "🔥 Explorer's ring 4: 10% to auto-cast High Alch on every other cast", tasks: 6, wiki: 'Lumbridge_%26_Draynor_Diary/Elite' },
    ]
  },
  {
    region: 'Varrock', icon: '🛡️',
    tiers: [
      { tier: 'Easy', reward: 'Varrock armor 1: mine 2 ores/swing up to iron', tasks: 14, wiki: 'Varrock_Diary/Easy' },
      { tier: 'Medium', reward: 'Varrock armor 2: mine 2 ores/swing up to coal', tasks: 13, wiki: 'Varrock_Diary/Medium' },
      { tier: 'Hard', reward: 'Varrock armor 3: mine 2 ores/swing up to adamant', tasks: 13, wiki: 'Varrock_Diary/Hard' },
      { tier: 'Elite', reward: 'Varrock armor 4: mine 2 ores/swing up to runite + smith 10% bar save', tasks: 5, wiki: 'Varrock_Diary/Elite' },
    ]
  },
  {
    region: 'Falador', icon: '⚔️',
    tiers: [
      { tier: 'Easy', reward: 'Falador shield 1: 1 free prayer restore/day', tasks: 11, wiki: 'Falador_Diary/Easy' },
      { tier: 'Medium', reward: 'Falador shield 2: 2 free prayer restores/day + 50% bonus prayer XP at altar', tasks: 14, wiki: 'Falador_Diary/Medium' },
      { tier: 'Hard', reward: 'Falador shield 3: 3 free prayer restores + 25% bonus to Crystal teleport seeds', tasks: 13, wiki: 'Falador_Diary/Hard' },
      { tier: 'Elite', reward: 'Falador shield 4: 4 free prayer restores + Crystal teleport seed cheaper', tasks: 5, wiki: 'Falador_Diary/Elite' },
    ]
  },
  {
    region: 'Ardougne', icon: '🧥',
    tiers: [
      { tier: 'Easy', reward: 'Ardougne cloak 1: 2 free Monastery teleports/day', tasks: 11, wiki: 'Ardougne_Diary/Easy' },
      { tier: 'Medium', reward: 'Ardougne cloak 2: 5 teleports + farming patches access', tasks: 12, wiki: 'Ardougne_Diary/Medium' },
      { tier: 'Hard', reward: '🔥 Ardougne cloak 3: 50% chance to steal 2 items pickpocketing in Ardy', tasks: 12, wiki: 'Ardougne_Diary/Hard' },
      { tier: 'Elite', reward: 'Ardougne cloak 4: unlimited teleports + Tower of Life perk', tasks: 8, wiki: 'Ardougne_Diary/Elite' },
    ]
  },
  {
    region: 'Wilderness', icon: '💀',
    tiers: [
      { tier: 'Easy', reward: "Wilderness sword 1: 30% run energy daily", tasks: 14, wiki: 'Wilderness_Diary/Easy' },
      { tier: 'Medium', reward: 'Wilderness sword 2: Edgeville teleport + Boneyard tele', tasks: 12, wiki: 'Wilderness_Diary/Medium' },
      { tier: 'Hard', reward: 'Wilderness sword 3: 3 free decant + Boss room tele', tasks: 14, wiki: 'Wilderness_Diary/Hard' },
      { tier: 'Elite', reward: 'Wilderness sword 4: Boneyard tele unlimited + 10% more revenant rate', tasks: 7, wiki: 'Wilderness_Diary/Elite' },
    ]
  },
  {
    region: 'Western Provinces', icon: '🏝️',
    tiers: [
      { tier: 'Easy', reward: 'Western banner 1: 2.5% more chompy hunting', tasks: 11, wiki: 'Western_Provinces_Diary/Easy' },
      { tier: 'Medium', reward: 'Western banner 2: free Piscatoris teleport + 5% chompy', tasks: 13, wiki: 'Western_Provinces_Diary/Medium' },
      { tier: 'Hard', reward: 'Western banner 3: free Tirannwn teleports + 7.5% chompy', tasks: 13, wiki: 'Western_Provinces_Diary/Hard' },
      { tier: 'Elite', reward: 'Western banner 4: unlimited Tirannwn teleports + 10% chompy + Mythic statuette', tasks: 8, wiki: 'Western_Provinces_Diary/Elite' },
    ]
  },
  {
    region: 'Kourend & Kebos', icon: '🌅',
    tiers: [
      { tier: 'Easy', reward: 'Rada\'s blessing 1: 4 free Kourend teleports/day', tasks: 13, wiki: 'Kourend_%26_Kebos_Diary/Easy' },
      { tier: 'Medium', reward: "Rada's blessing 2: 5 teleports + 50% xp from Soul Wars zeal", tasks: 14, wiki: 'Kourend_%26_Kebos_Diary/Medium' },
      { tier: 'Hard', reward: "Rada's blessing 3: 7 teleports + Wintertodt brazier never explodes", tasks: 11, wiki: 'Kourend_%26_Kebos_Diary/Hard' },
      { tier: 'Elite', reward: "Rada's blessing 4: 10% chance to save runes when casting + Wintertodt 10% pet rate", tasks: 9, wiki: 'Kourend_%26_Kebos_Diary/Elite' },
    ]
  },
  {
    region: 'Morytania', icon: '⚰️',
    tiers: [
      { tier: 'Easy', reward: "Morytania legs 1: 1.5× ecto tokens from Ectofuntus", tasks: 11, wiki: 'Morytania_Diary/Easy' },
      { tier: 'Medium', reward: 'Morytania legs 2: 1.5× resources from Slayer Tower', tasks: 12, wiki: 'Morytania_Diary/Medium' },
      { tier: 'Hard', reward: 'Morytania legs 3: increased Barrows rewards + Burgh tele', tasks: 14, wiki: 'Morytania_Diary/Hard' },
      { tier: 'Elite', reward: 'Morytania legs 4: 50% increased Barrows reward chances', tasks: 8, wiki: 'Morytania_Diary/Elite' },
    ]
  },
  {
    region: 'Fremennik', icon: '⚔️',
    tiers: [
      { tier: 'Easy', reward: 'Fremennik sea boots 1: free Rellekka teleport', tasks: 9, wiki: 'Fremennik_Diary/Easy' },
      { tier: 'Medium', reward: 'Fremennik sea boots 2: faster Trollheim agility', tasks: 12, wiki: 'Fremennik_Diary/Medium' },
      { tier: 'Hard', reward: '🔥 Helm of Neitiznot enhancement option (Faceguard)', tasks: 13, wiki: 'Fremennik_Diary/Hard' },
      { tier: 'Elite', reward: 'Fremennik sea boots 4: Lyre tele unlimited + Slayer ring 2', tasks: 6, wiki: 'Fremennik_Diary/Elite' },
    ]
  },
  {
    region: 'Desert', icon: '🐪',
    tiers: [
      { tier: 'Easy', reward: 'Desert amulet 1: Free Nardah tele', tasks: 11, wiki: 'Desert_Diary/Easy' },
      { tier: 'Medium', reward: 'Desert amulet 2: faster water filling + faster Desert Treasure stuff', tasks: 12, wiki: 'Desert_Diary/Medium' },
      { tier: 'Hard', reward: 'Desert amulet 3: 50% more Pyramid Plunder loot', tasks: 10, wiki: 'Desert_Diary/Hard' },
      { tier: 'Elite', reward: '🔥 Desert amulet 4: passive water from Camulet, faster runs in pyramid', tasks: 7, wiki: 'Desert_Diary/Elite' },
    ]
  },
];

// ==========================================================
// PETS — major pets with sources
// ==========================================================
const PETS = [
  // Skilling
  { name: 'Beaver',            icon: '🦫', source: 'Woodcutting',    rate: '1/72,321 to 1/317,647', wiki: 'Beaver' },
  { name: 'Heron',             icon: '🦩', source: 'Fishing',         rate: '1/3,750 to 1/498,750',  wiki: 'Heron' },
  { name: 'Rock Golem',        icon: '🗿', source: 'Mining',          rate: '1/178,302 to 1/741,378', wiki: 'Rock_golem' },
  { name: 'Tangleroot',        icon: '🌷', source: 'Farming (Hespori)', rate: '1/5,000 from Hespori', wiki: 'Tangleroot' },
  { name: 'Rocky',             icon: '🐀', source: 'Thieving',        rate: '1/247,886 to 1/5M+',    wiki: 'Rocky' },
  { name: 'Giant Squirrel',    icon: '🐿️', source: 'Agility courses', rate: '1/36,000 (Sepulchre)', wiki: 'Giant_squirrel' },
  { name: 'Phoenix',           icon: '🐦‍🔥', source: 'Wintertodt',     rate: '1/5,000 per supply crate', wiki: 'Phoenix_(pet)' },
  { name: 'Tempoross pet',     icon: '🌊', source: 'Tempoross',       rate: '1/8,000 → 1/1,650 (lvl 99 fishing)', wiki: 'Tiny_tempor' },
  { name: 'Baby Mole',         icon: '🦔', source: 'Giant Mole',      rate: '1/3,000', wiki: 'Baby_mole' },
  { name: 'Rift Guardian',     icon: '🌀', source: 'Runecraft',       rate: '1/1.4M → 1/420K', wiki: 'Rift_guardian' },
  { name: 'Herbi',             icon: '🌱', source: 'Hunter (herbiboar)', rate: '1/6,500',     wiki: 'Herbi' },
  { name: 'Chompy chick',      icon: '🐤', source: 'Chompy hunting',  rate: '1/500 (with Elite Western diary)', wiki: 'Chompy_chick' },
  // Bosses
  { name: 'Vorki',             icon: '🐲', source: 'Vorkath',         rate: '1/3,000',  wiki: 'Vorki' },
  { name: "Pet snakeling",     icon: '🐍', source: 'Zulrah',          rate: '1/4,000',  wiki: 'Pet_snakeling' },
  { name: 'Olmlet',            icon: '🦞', source: 'Chambers of Xeric', rate: '1/53 → 1/65 (raid party)', wiki: 'Olmlet' },
  { name: 'Lil Zik',           icon: '🕷️', source: 'Theatre of Blood', rate: '1/650', wiki: 'Lil_Zik' },
  { name: 'Tumeken\'s Guardian', icon: '☀️', source: 'Tombs of Amascut', rate: '1/300 (max invocations)', wiki: 'Tumeken%27s_guardian' },
  { name: 'Jal-nib-rek',       icon: '🌋', source: 'TzKal-Zuk (Inferno)', rate: '1/100 → 1/75',  wiki: 'Jal-nib-rek' },
  { name: 'TzRek-Jad',         icon: '🔥', source: 'TzTok-Jad (Fight Cave)', rate: '1/100 → 1/200', wiki: 'TzRek-Jad' },
  { name: 'Kraken pet',        icon: '🦑', source: 'Kraken (87 Slayer)', rate: '1/3,000', wiki: 'Pet_kraken' },
  { name: 'Hellpuppy',         icon: '🐕', source: 'Cerberus (91 Slayer)', rate: '1/3,000', wiki: 'Hellpuppy' },
  { name: 'Ikkle Hydra',       icon: '🐉', source: 'Alch Hydra (95 Slayer)', rate: '1/3,000', wiki: 'Ikkle_hydra' },
  { name: 'Heredit pet',       icon: '⚔️', source: 'Sol Heredit (Colosseum)', rate: '1/200', wiki: 'Sol_Heredit' },
];

// ==========================================================
// MUSIC CAPE — flagship tracks unlocked at notable areas
// (Not exhaustive; representative milestones)
// ==========================================================
const MUSIC_TRACKS = [
  { name: 'Newbie Melody',    where: 'Lumbridge starting area',         category: 'Tutorial' },
  { name: 'Adventure',        where: 'Various quests',                   category: 'Quest' },
  { name: 'Sea Shanty 2',     where: 'Port Sarim (the meme)',            category: 'F2P' },
  { name: 'Scape Main',       where: 'Lumbridge (the iconic theme)',     category: 'F2P' },
  { name: 'Harmony',          where: 'Falador',                          category: 'F2P' },
  { name: 'Yesteryear',       where: 'Varrock Square',                   category: 'F2P' },
  { name: 'Forever',          where: 'Wilderness',                       category: 'F2P' },
  { name: 'Cave of the Goblins', where: 'Goblin Village',                category: 'F2P' },
  { name: 'Vision',           where: 'Fairy ring AIQ + various',          category: 'Members' },
  { name: 'Floral Delight',   where: 'Catherby flower beds',              category: 'Members' },
  { name: 'Inferno',          where: 'TzHaar (Mor Ul Rek)',               category: 'Endgame' },
  { name: 'Faithful',         where: 'Death\'s Office (after dying)',    category: 'Meta' },
  { name: 'Karamja Jam',      where: 'Karamja (the beach jam)',          category: 'Members' },
];

// ==========================================================
// SLAYER MONSTERS — basic info per common task
// ==========================================================
const SLAYER_MONSTERS = [
  { name: 'Crawling Hand',      reqs: { slayer: 5 },   location: 'Slayer Tower 1F', gear: 'Any',         tips: 'Easiest task. Drops adamant kiteshields.' },
  { name: 'Cave Bug',           reqs: { slayer: 7 },   location: 'Lumbridge Swamp Caves', gear: 'Any', tips: 'Annoying but easy. Bring waterskin if hot.' },
  { name: 'Banshee',            reqs: { slayer: 15 },  location: 'Slayer Tower',    gear: 'Earmuffs req', tips: 'Earmuffs prevent stat drain. Use Salve.' },
  { name: 'Cockatrice',         reqs: { slayer: 25 },  location: 'Fremennik Slayer Caves', gear: 'Mirror shield', tips: 'Without mirror shield, stat drain.' },
  { name: 'Pyrefiend',          reqs: { slayer: 30 },  location: 'Slayer Tower',    gear: 'Any',         tips: 'Magic weak. Drops loop/tooth halves.' },
  { name: 'Basilisk',           reqs: { slayer: 40 },  location: 'Fremennik Caves', gear: 'Mirror shield req', tips: 'Crush weak. Drops jaw (basilisk knight upgrade).' },
  { name: 'Bloodveld',          reqs: { slayer: 50 },  location: 'Morytania Slayer Tower', gear: 'Salve (e)', tips: 'Undead → Salve amulet boost.' },
  { name: 'Aberrant Spectre',   reqs: { slayer: 60 },  location: 'Slayer Tower 2F', gear: 'Nose peg req', tips: 'Stink. Bring nose peg or stat drain.' },
  { name: 'Dust Devil',         reqs: { slayer: 65 },  location: 'Smoke Dungeon', gear: 'Facemask req',  tips: 'Cannon-able. Good gp.' },
  { name: 'Greater Demon',      reqs: { slayer: 70 },  location: 'Brimhaven Dungeon / Catacombs', gear: 'Magic dart spec', tips: 'Drops ashes for prayer pots.' },
  { name: 'Black Demon',        reqs: { slayer: 70 },  location: 'Taverley Dungeon', gear: 'Magic',     tips: 'Aggressive in catacombs. Drops a few clues.' },
  { name: 'Abyssal Demon',      reqs: { slayer: 85 },  location: 'Slayer Tower 3F', gear: 'Whip + Salve', tips: '🔥 1/512 whip drop. Top-tier task XP.' },
  { name: 'Smoke Devil',        reqs: { slayer: 93 },  location: 'Smoke Devil Dungeon', gear: 'Facemask + Magic', tips: 'BIS gp/hr. Group bossing too.' },
  { name: 'Dark Beast',         reqs: { slayer: 90 },  location: 'Mourning\'s End cave', gear: 'Crush weak', tips: 'Dark bow drop. ~6m gp/task.' },
  { name: 'Wyrm',               reqs: { slayer: 62 },  location: 'Mt Karuulm', gear: 'Boots of stone',  tips: 'Easy XP + brimstone drops.' },
  { name: 'Drake',              reqs: { slayer: 84 },  location: 'Mt Karuulm', gear: 'Boots of stone + DHC', tips: 'Boots of Brimstone drop.' },
  { name: 'Hydra',              reqs: { slayer: 95 },  location: 'Mt Karuulm', gear: 'BIS gear', tips: 'Hydra leather → Ferocious gloves.' },
];

// ==========================================================
// BOSS LOADOUTS — gear + inventory recommendations
// ==========================================================
const BOSS_LOADOUTS = {
  scurrius: {
    boss: 'Scurrius',
    gear: ['Helm of Neitiznot', 'Amulet of Strength', 'Rune Plate', 'Rune Legs', "Climbing Boots", 'Rune Scim', 'Dragon Defender (or Rune)', "Combat Bracelet"],
    inventory: ['Trout × 10', 'Prayer potion(4) × 1', 'Varrock Tab × 2', 'Stamina (4) × 1'],
    notes: 'Drink prayer pots only if needed. Tank with Protect from Range when he sprays. Drops Scurrius spine for stab bonus.',
  },
  barrows: {
    boss: 'Barrows',
    gear: ['Helm of Neitiznot', 'God Book / Glory', 'Black dhide top', 'Black dhide legs', 'Snakeskin boots', 'Magic Shortbow + amethyst arrows', "Ava's Accumulator", 'Ring of Wealth'],
    inventory: ['Shark × 10', 'Prayer pot(4) × 3', 'Varrock Tab × 1', 'Stamina × 1', 'Spade × 1'],
    notes: 'Switch to crush for Verac. Mage Karil. Use Protect from Melee on most brothers. Always do Dharok last (he tanks himself low).',
  },
  vorkath: {
    boss: 'Vorkath',
    gear: ['Slayer helm (i)', 'Salve amulet (ei)', 'Karil\'s leather top + skirt OR Armadyl', 'Pegasian boots', "Toxic Blowpipe (dragon darts)", "Ava's Assembler", 'Treasonous ring (i)'],
    inventory: ['Salve (ei) toggle', 'Magic Shortbow + dragon arrows (special)', 'Antifire pot × 1', 'Super Restore × 4', 'Manta ray × 12', 'Vorkath Head (for Assembler upgrade)'],
    notes: 'Antifire MANDATORY. Special spec MSB at start. Pray Magic when she chooses Mage attack. White dragonbreath: walk under her. Spawn: ranged. Zombified spawn: kill with mage spell. Acid: walk in marked pattern.',
  },
  zulrah: {
    boss: 'Zulrah',
    gear: ['Magic phase: Ahrim\'s top + Imbued cape + Trident of Swamp; Range phase: Karil\'s + ACB/Blowpipe'],
    inventory: ['Trident charges', 'Toxic blowpipe', '2× God cape (mage), Ava\'s', 'Anti-venom + × 1', 'Super restore × 8', 'Manta × 8'],
    notes: '4 rotations — learn them by heart. Movement matters more than DPS at first. Watch a guide.',
  },
  kbd: {
    boss: 'King Black Dragon',
    gear: ['Anti-dragon shield (or DFS)', 'Karil\'s OR Armadyl', "Pegasian boots", 'Glory amulet', 'Rune crossbow + diamond bolts (e)'],
    inventory: ['Antifire pot × 2', 'Shark × 6', 'Super restore × 1', 'Wilderness sword for tele'],
    notes: 'Wilderness — wear NOTHING valuable. Trip to KBD via lever in Edgeville. Pray Magic. Bring teleport for emergencies.',
  },
};

// ==========================================================
// QUEST WALKTHROUGHS — concise steps for top starter quests
// ==========================================================
const QUEST_WALKTHROUGHS = {
  cooks_assistant: [
    'Talk to the Cook in Lumbridge Castle kitchen (ground floor, NW corner).',
    'He needs: a bucket of milk (cow east of castle), an egg (chicken pen east of castle), and a pot of flour (Mill north of Lumbridge — climb to top floor, use grain on hopper, flour comes out on ground floor).',
    'Return all 3 to the Cook → done. +300 Cooking XP.',
  ],
  sheep_shearer: [
    'Talk to Fred the Farmer (just north of Lumbridge).',
    'Get shears from him. Shear 20 sheep at the pen nearby.',
    'Use the wool on the spinning wheel in Lumbridge Castle 1st floor → balls of wool.',
    'Return 20 balls of wool to Fred. +150 Crafting XP.',
  ],
  restless_ghost: [
    'Talk to Father Aereck in Lumbridge church.',
    'Talk to Father Urhney in Lumbridge Swamp (south of Lumbridge) — he gives you the Ghostspeak Amulet.',
    'Wear amulet, return to the Ghost in the graveyard, talk to him.',
    'Find his skull in Wizards Tower basement (south of Draynor). Take it back to him → +1,125 Prayer XP.',
  ],
  witchs_potion: [
    'Talk to Hetty in her house in Rimmington (south of Falador).',
    'She needs: a rat\'s tail, an onion, Burnt meat, and an eye of newt.',
    'Rat tail: kill any rat. Onion: north of Rimmington. Burnt meat: cook raw beef until burnt. Eye of newt: buy from her shop.',
    'Give all to her, drink the potion → +325 Magic XP.',
  ],
  imp_catcher: [
    'Buy 4 beads from the Grand Exchange: red, yellow, black, white.',
    'Climb to top floor of Wizards\' Tower (south of Draynor).',
    'Give the 4 beads to Wizard Mizgog → +875 Magic XP + Amulet of Accuracy.',
  ],
  dorics_quest: [
    'Get: 6 clay, 4 copper ore, 2 iron ore. (Buy from GE or mine.)',
    'Talk to Doric (north of Falador, between Falador and Taverley).',
    'Hand him the ores → +1,300 Mining XP, 180 gp.',
  ],
  knights_sword: [
    'Talk to Squire in Falador Castle 1st floor (south wing).',
    'Talk to Reldo in Varrock Castle Library — research the sword.',
    'Go to the Asgarnian Ice Dungeon (south of Port Sarim). Talk to Thurgo (Imcando dwarf south of the dungeon entrance).',
    'Bring him a redberry pie (cook one in Lumbridge), 2 iron bars, and Reldo\'s research notes.',
    'Bring him the materials → he\'ll make the sword. Take it to the Squire → 🔥 +12,725 Smithing XP (instant 29 from 1!).',
  ],
  witchs_house: [
    'Talk to a small boy in Taverley village.',
    'Enter the witch\'s house (south of Taverley, east of the lake). Investigate inside.',
    'Find the witch\'s diary upstairs. Read it.',
    'Get the magnet from the cupboard in the back room.',
    'Go to the basement (key is hidden in a drawer in the back room). Fight 4 Shapeshifters consecutively (rat→spider→bear→wolf, lvl 19/30/42/53). Use the magnet on the ball.',
    'Return to the boy → +6,325 Hitpoints XP (instant 23 HP).',
  ],
  druidic_ritual: [
    'Talk to Kaqemeex at the Druid Stone Circle (north of Taverley).',
    'Talk to Sanfew in the Taverley building.',
    'Get raw meats: beef, rat, chicken, bear meat. Use each on Kaqemeex\'s stone circle.',
    'Return to Kaqemeex → 🔥 250 Herblore XP. UNLOCKS Herblore skill.',
  ],
  vampyre_slayer: [
    'Talk to Morgan in Draynor Village.',
    'Talk to Dr Harlow in the Blue Moon Inn (Varrock SW). Buy him a beer. He gives you a stake.',
    'Take the stake to Count Draynor in his manor basement. Equip a hammer + wield the stake.',
    'Fight Count Draynor (lvl 34) — safespot with the stake. → +4,825 Attack XP.',
  ],
  tree_gnome_village: [
    'Talk to King Bolren in the Gnome Village (south of Ardougne — use the spirit tree maze).',
    'Get 6 normal logs. Talk to Commander Montai.',
    'Take 3 Khazard warriors to the gates (kill or safespot). Get tracker, follow the road.',
    'Fight a Khazard Warlord (lvl 112) — safespot with ranged/magic. → +11,450 Attack XP + Spirit Tree teleport network!',
  ],
  waterfall_quest: [
    'Talk to Almera at Baxtorian Falls (north of Barbarian Village).',
    'Go upriver to find Hadley. Get a barrel.',
    'Use the barrel on the river, climb in, ride down to the falls.',
    'In the dungeon: navigate maze. Drink the Glarial waters from her tomb (do NOT take treasure!).',
    'Use the waters on the rock barriers. Get the diamond, ruby, gold bar from the room.',
    'Cast the Crown spell (provided), then take the treasure. → 🔥 +13,750 Attack + +13,750 Strength XP (instant 30/30!).',
  ],
};
