// All the words. Satire of a very specific lifestyle, written with love.

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export const INTRO = [
  'In my restless dreams, I see that neighborhood.\n\nOregon Hill.',
  'You moved to Richmond for "the creative scene."\n\nThe listing said "historic charm."\nThe lease said "as-is."\nYour bank account says "please."',
  'You are a freelance creative in your mid-twenties.\nYou have a laptop, a portfolio, a 1998 Subaru with one hubcap,\nand a roommate named Sage.',
  'Survive 14 days.\nPay the rent. Stay relevant. Stay sane.\nMind the meter.',
  'Welcome home.\n\nYou are now a member of the\nOregon Hill gentrification community.',
];

export const CONTROLS_HELP = [
  ['WASD / Left stick', 'Walk (camera-relative)'],
  ['Shift', 'Run (burns energy)'],
  ['Mouse drag / ← →', 'Turn camera'],
  ['E', 'Interact / talk'],
  ['Space / F', 'Swing your U-lock'],
  ['C', 'Flashlight'],
  ['Tab / P', 'Phone (status, gigs, tickets, map, save)'],
  ['1-4 / Enter', 'Dialogue choices'],
];

// --------------------------------------------------------------------------
// Gigs
// --------------------------------------------------------------------------
export const GIGS = [
  { client: 'Hop Tart Brewing Co.', title: 'Logo + mural + 40s Super Bowl spot', brief: '"We want it to feel like Patagonia met a skateboard. Budget is $300 but the exposure is honestly priceless."', pay: 300, sessions: 3 },
  { client: 'Brayden (Startup Founder)', title: 'Pitch deck for "Uber, but for porches"', brief: '"Think Apple, but punk, but also corporate-friendly. Can you have it by tomorrow? Equity is on the table."', pay: 450, sessions: 3 },
  { client: 'Taco Libre Food Truck', title: 'Full website, by Friday', brief: '"Nothing crazy. Just online ordering, a loyalty app, and an animated taco that says the customer\'s name."', pay: 280, sessions: 2 },
  { client: 'A Realtor Named Chip', title: '"Gritty" photos of Oregon Hill', brief: '"Make it look edgy, but like, safe-edgy. The people who live there now should not be in frame."', pay: 520, sessions: 2, evil: true },
  { client: 'The Fan District Yoga Collective', title: 'Rebrand. "Less yoga, more cult."', brief: '"Cult is a strong word. Say \'community with a mandatory retreat.\'"', pay: 350, sessions: 2 },
  { client: 'Your Uncle Rick', title: 'Flyer for his cover band, "Fleetwood Mac & Cheese"', brief: '"Family discount, obviously. I can pay you in a Costco hot dog and gratitude."', pay: 60, sessions: 1 },
  { client: 'Moxie Kombucha', title: 'Can design for "Electric Tumor" flavor', brief: '"The name is final. Legal has concerns. Make legal feel calm."', pay: 400, sessions: 2 },
  { client: 'Councilman\'s Nephew', title: 'NFT collection of Richmond potholes', brief: '"Each pothole is unique, like a snowflake. A snowflake that eats axles. Floor price is a vibe."', pay: 600, sessions: 3 },
  { client: 'Short Pump Dentist', title: '3D animated tooth mascot', brief: '"He needs a backstory. Trauma, redemption, the works. Also make him sexy but not in a way that\'s actionable."', pay: 480, sessions: 3 },
  { client: 'A Local Podcast (3 listeners)', title: 'Cover art + intro music', brief: '"It\'s two guys reviewing gas station sushi. We\'re sort of the Serial of that."', pay: 120, sessions: 1 },
  { client: 'Gallery Fivefold', title: 'Catalog for "Liminal Spaces of the VA DMV"', brief: '"The artist has requested the catalog be printed on actual DMV forms. We are not sure that\'s legal."', pay: 380, sessions: 2 },
  { client: 'A Wedding in Scott\'s Addition', title: 'Edison-bulb-themed save-the-dates', brief: '"Rustic but industrial but farmhouse but make it Brooklyn."', pay: 260, sessions: 2 },
  { client: 'CrossFit Box "IRONGRIT RVA"', title: 'Motivational posters', brief: '"Every poster has to say GRIND. Every one. Different fonts though, we\'re not animals."', pay: 220, sessions: 1 },
  { client: 'An Influencer (11k followers)', title: 'Rebrand her dog', brief: '"Biscuit is entering his villain era. Can his color palette reflect that?"', pay: 310, sessions: 2 },
  { client: 'The Basement (DIY venue)', title: 'Show poster for "Hollywood Cemetery Dance Party"', brief: '"We can pay you in drink tickets. Three drink tickets. Okay four."', pay: 40, sessions: 1, clout: 10 },
];

export const FEEDBACK = [
  'Love it!! Can you make the logo bigger? And also smaller?',
  'Can it pop more? Like, sonically?',
  'My wife saw it and said "eh." Can we go back to version one? No, the other version one.',
  'This is perfect. Can we try it in every other color?',
  'Can you make it feel more... you know? You know.',
  'Our CEO wants to see it in Comic Sans "as a joke." He is not joking.',
  'Quick tweak: entirely different concept.',
  'We showed it to a focus group (my nephew). He said it\'s "mid."',
  'Can we add a QR code? To the QR code?',
  'Love the energy. Hate everything else. Keep the energy.',
];

// --------------------------------------------------------------------------
// Parking
// --------------------------------------------------------------------------
export const TICKET_REASONS = [
  ['Parked within 15 ft of a hydrant (hydrant removed in 1987)', 40],
  ['Vehicle facing wrong direction, spiritually', 35],
  ['2-hour limit exceeded (sign obscured by a tree since 2009)', 45],
  ['Residential Permit Zone violation (zone boundaries are a vibe)', 50],
  ['Excessive bumper stickers ("COEXIST" deemed provocative)', 30],
  ['Street sweeping (no sweeper has been seen in years)', 60],
  ['Expired permit (city portal was down, this is not our problem)', 55],
  ['Tire chalked by an officer named Gary. Gary is never wrong.', 45],
  ['Parked "too close to the vibe" of a crosswalk', 35],
  ['Loitering, vehicular', 25],
  ['One (1) hubcap. Felt disrespectful.', 40],
  ['Being from out of state (Subaru has NC plates from a previous owner)', 65],
];

export const OFFICER_LINES = [
  'I don\'t make the rules. I just enforce them, selectively, with joy.',
  'Your tire has been chalked. The chalk remembers.',
  'Ma\'am, sir, or friend: step away from the meter.',
  'Do you have any idea how long you\'ve been parked? Because I do. I always do.',
  'I\'ve been doing this for 31 years. I\'ve never been wrong. I\'ve never been loved.',
];

// --------------------------------------------------------------------------
// Roommate: Sage (they/them)
// --------------------------------------------------------------------------
export const SAGE = {
  khole: [
    'Sage is horizontal on the couch, staring at the ceiling fan like it owes them money.',
    '"Dude. Dude. The couch is the ocean. You\'re... the ocean too. We\'re all..."  They trail off.',
    '"I can hear the color of the TV static. It\'s beige. It\'s SO beige."',
  ],
  lucid: [
    'Sage is making tea and seems unusually clear-eyed.',
    '"Hey. Real talk? You\'re doing way better than you think. Also you owe Dominion $64."',
    '"Clients will always try to get stuff for free. Your rate is your rate. Charge them the \'I have to think about you in the shower\' fee."',
  ],
  borrow: [
    'Sage corners you by the fridge.',
    '"Hey so, totally unrelated to anything, could I borrow $40 for, like, groceries? Specific groceries. Very legal groceries."',
  ],
  utilities: [
    'The Dominion Energy bill is on the counter. Sage\'s half is circled in red. By you. Last month.',
  ],
  stickpoke: [
    'Sage is sterilizing a needle with a Bic lighter and a lot of confidence.',
    '"Yo. Free stick-and-poke? I\'ve been practicing on an orange. The orange looks GREAT."',
  ],
  absent: ['Sage isn\'t here. There\'s a note on the couch: "at a sound bath. or a regular bath. unclear. ♡ S"'],
};

export const SAGE_POKES = ['A slightly crooked moth', 'The word "RENT" (misspelled "RNET")', 'A tiny ghost that looks surprised', 'A stick-and-poke of the Subaru', 'A star (five points, mostly)'];

// --------------------------------------------------------------------------
// Landlord: Dale, Hilltop Property Solutions LLC
// --------------------------------------------------------------------------
export const DALE = {
  greet: [
    '"Hey hey! Dale, Hilltop Property Solutions. Just doing a little walkthrough. Don\'t mind me. Is that a new tattoo? Love that. Very \'neighborhood character.\'"',
    '"There\'s my favorite tenant! Of the ones in this unit. Who are you again? Kidding! Kidding. Mostly."',
    '"Just checking on the property. My property. That you live in. For now! Kidding. Market\'s crazy though."',
  ],
  repair: [
    '"The mold? That\'s historic mold. You can\'t remove historic mold, there\'s a whole commission."',
    '"I\'ll send a guy." (There is no guy. There has never been a guy.)',
    '"The radiator makes that noise because it\'s happy. You wouldn\'t take away its happiness, would you?"',
    '"Water pressure is a social construct."',
    '"Have you tried simply not noticing it?"',
  ],
  raise: '"So, bad news-good news. Bad news: rent\'s going up $50 next cycle. Good news: that\'s it, that\'s all the news. Market adjustment. Vibe shift. Interest rates. You get it."',
  rentAsk: '"So! Rent day. Love rent day. Cash, check, Venmo, Zelle, CashApp, small unmarked bills, firstborn — kidding about the firstborn. Unless?"',
  paid: '"Pleasure doing business! You\'re a great tenant. I\'m gonna tell the next landlord that, if it comes to that. Kidding!"',
  cantPay: '"Ooh. Oof. Okay. I\'m gonna do you a solid: five-day pay-or-quit notice. That\'s legally the nicest thing I\'m allowed to do. Plus a $75 late fee. That one\'s just for me."',
};

// --------------------------------------------------------------------------
// The Bar: The Lowered Expectations
// --------------------------------------------------------------------------
export const BAR = {
  wren: [
    '"What\'ll it be? And before you say water: we have it, but I will judge you."',
    '"Same as always? I don\'t even ask anymore. I just see you walk in and start pouring. That\'s friendship. Or a symptom."',
  ],
  tannerBex: [
    'TANNER: "Ayyyy!! Look who it is!"\nBEX: "We were literally just talking about how we\'re not gonna go hard tonight."',
    'BEX: "Okay, one drink. ONE drink."\nTANNER: "One drink." (This is the fourth time tonight they\'ve said this.)',
    'TANNER: "Dude, I\'m doing a dry month."\nBEX: "Since when?"\nTANNER: "Since the start of this beer. Starting tomorrow. Starting... cheers!"',
  ],
  round: [
    'You get another round. Bex tells a story about her ex that is 40% true and 100% hilarious.',
    'Another round. Tanner explains crypto. Nobody stops him. It\'s kind of nice?',
    'Another round. You all agree, for the ninth time, that you should start a band.',
    'Another round. Someone puts on "the song." Everyone yells. A bonding moment.',
  ],
  honest: [
    'You say: "Do you guys ever think we... drink a lot?"\n\nA long silence. The jukebox skips.\n\nBEX: "Haha. Anyway."\nTANNER: "Shots?"',
    'You say: "I think I\'ve been drinking to cope with freelance instability."\n\nTANNER: "That\'s so real."\nBEX: "So real."\nTANNER: "Shots?"',
  ],
  feelings: [
    'You open up about your career anxiety.\n\nBEX: "Totally. Totally. Anyway did you see the thing about the guy?"',
    'You mention you miss having health insurance.\n\nTANNER: "Bro, just don\'t get sick. That\'s what I do. Cheers to not getting sick!"',
  ],
  blackout: [
    'You wake up at home. Your Venmo shows $40 sent to someone named "Big Country" for "the thing 🐸."',
    'You wake up at home wearing a Flying Squirrels jersey you do not own. You are $40 lighter.',
    'You wake up at home. Your phone has a new contact: "DO NOT TEXT (karaoke guy)". $40 is missing.',
  ],
};

// --------------------------------------------------------------------------
// Tattoo artists
// --------------------------------------------------------------------------
export const ARTISTS = {
  moth: {
    name: 'Moth',
    shop: 'Moth & Mortal Tattoo',
    open: [12, 20],
    wall: '#2a2230',
    prompts: [
      '"So what are you into?"',
      'Moth adjusts a houseplant named Gerald. "You come here often? Like, to this neighborhood?"',
      '"What are you listening to lately?"',
      'Moth looks up from sketching. "Any plans this weekend?"',
    ],
    good: [
      '"Mostly doom metal and repotting things."',
      '"Is that a pothos? It looks so healthy. What\'s your secret?"',
      '"I just rewatched The Thing. Practical effects hit different."',
      '"Your flash is sick. Is that cat yours? Can I meet the cat?"',
      '"Planning to sit in Hollywood Cemetery and feel things."',
    ],
    neutral: ['"Oh, you know. Stuff."', '"Work, mostly. I\'m freelance."', '"Just vibing, honestly."', '"I like most music. Except country. And jazz. And..."'],
    bad: [
      '"Does it hurt? Like, a lot? Be honest. Is it gonna hurt?"',
      '"Could you do it for like, half? I\'ll post you on my story."',
      '"I\'m kind of an influencer, so this is basically marketing for you."',
      '"I saw this on Pinterest, can you copy it exactly?"',
    ],
    flash: [
      { name: 'Moth over a skull', price: 180, color: 0x6a4a8a },
      { name: 'Hollywood Cemetery angel', price: 240, color: 0x8a8a9a },
      { name: 'A pothos vine', price: 140, color: 0x2a7a3a },
      { name: 'Tiny dagger (finger)', price: 90, color: 0x9a1a1a },
    ],
  },
  sal: {
    name: 'Big Sal',
    shop: 'Sal\'s Ink Emporium',
    open: [11, 21],
    wall: '#2a3a2a',
    prompts: [
      '"Whaddya want, kid? And don\'t say infinity symbol."',
      'Sal wipes down his station. "You see the Squirrels game last night?"',
      '"You know I been tattooing since before you were born? What do you do?"',
      'Sal hums. "Ever been out on the river? Got a boat. Real nice boat."',
    ],
    good: [
      '"Flying Squirrels, baby! Nutzy is the best mascot in minor league baseball."',
      '"Tell me about the boat, Sal."',
      '"Old school flash. Bold lines. Will hold up forever."',
      '"I respect a man who\'s been doing the same thing for 30 years."',
      '"Whatever you think looks good. You\'re the artist."',
    ],
    neutral: ['"I\'m a designer. Graphic, mostly."', '"Just something meaningful, y\'know?"', '"Not really a sports person."', '"Kinda nervous."'],
    bad: [
      '"Can you do fine line? Like super micro minimalist?"',
      '"My buddy does stick and pokes for free, but I figured I\'d try a real shop."',
      '"Here\'s a Pinterest board. It\'s 340 images."',
      '"Is this place, like, clean?"',
    ],
    flash: [
      { name: 'Classic swallow', price: 160, color: 0x2040a0 },
      { name: 'Anchor + "MOM"', price: 130, color: 0x1a1a1a },
      { name: 'Chesapeake Blue Crab', price: 200, color: 0x2a5aa0 },
      { name: 'Rose with a dagger', price: 220, color: 0xb02020 },
    ],
  },
  juniper: {
    name: 'Juniper',
    shop: 'Holy Ghost Tattoo',
    open: [13, 22],
    wall: '#3a2a22',
    prompts: [
      '"What\'s your sign? I\'m kidding. Unless you know it."',
      'Juniper sips something orange and cloudy. "Have you been to the river lately?"',
      '"What made you want this piece?"',
      '"You seem like you have an interesting job. What is it?"',
    ],
    good: [
      '"Is that natural wine? Very funky. Respect."',
      '"I\'ve been birdwatching on Belle Isle. Saw a heron. Life changing."',
      '"I pulled the Tower card this morning, so, seemed like the day."',
      '"I love your flash. It feels like an old church window."',
      '"Honestly, I just trust you."',
    ],
    neutral: ['"I\'m a freelancer. It\'s... a lot."', '"No reason, really."', '"I think I\'m a Gemini? Or a Leo."', '"Yeah, the river\'s cool."'],
    bad: [
      '"So where are you from originally? Like ORIGINALLY originally?"',
      '"Have you thought about getting into crypto?"',
      '"Can you do a photorealistic portrait of my dog? He\'s on my phone. Somewhere."',
      '"Does this hurt more than, like, getting your ears pierced?"',
    ],
    flash: [
      { name: 'Heron in a sacred heart', price: 230, color: 0x3a8a8a },
      { name: 'The Tower (tarot)', price: 260, color: 0xb08020 },
      { name: 'James River wave', price: 170, color: 0x2a6a8a },
      { name: 'Tiny ghost holding a beer', price: 110, color: 0xd0d0d0 },
    ],
  },
};

// --------------------------------------------------------------------------
// Pedestrian chatter
// --------------------------------------------------------------------------
export const PEDS = [
  '"I\'m a VCU student. I\'m majoring in being in your way on the sidewalk."',
  '"Have you been to the new brunch place? The wait is three hours. It\'s SO worth it. I haven\'t been."',
  '"I moved here from NoVA. It\'s so authentic here. Do you know where I can get a $14 latte?"',
  '"My dog is named Gwar. He\'s a golden retriever."',
  '"I\'ve lived on this hill since 1974. You\'re the fourth wave of you I\'ve seen."',
  '"Did you hear? They\'re turning the old laundromat into a \'laundry concept.\'"',
  '"Don\'t park on Laurel today. Trust me. TRUST me."',
  '"I\'m starting a podcast about the James River. It\'s mostly me yelling at kayakers."',
  '"Friday Cheers is back! Or it\'s gone. One of those."',
  '"You look like you need a tattoo. Or a nap. Or a nap tattoo."',
  '"The fog\'s been weird lately. My aunt says it gets thicker when you stop going out."',
  '"I heard a meter maid fell into the river once and came back out with a ticket for the river."',
  '"My aunt swears if you pet the iron dog in the cemetery in the dead hours, three different nights, it tells you who really owns the hill."',
  '"Street sweeping signs are a suggestion. A threatening suggestion. Check the day before you park."',
];

// --------------------------------------------------------------------------
// Memos (collectible notes)
// --------------------------------------------------------------------------
export const MEMOS = [
  { id: 'lease', title: 'Lease Addendum 14(b)', text: 'LEASE ADDENDUM 14(b)\n\nTenant acknowledges that the mold in the bathroom is a "historic feature" and agrees not to "make it weird" by mentioning it to guests, health inspectors, or God.\n\n- Hilltop Property Solutions LLC' },
  { id: 'fridge', title: 'Note on the fridge', text: 'WHOEVER KEEPS USING THE UTILITY MONEY JAR AS A "PERSONAL LIQUIDITY FUND" PLEASE STOP\n\n- Sage\n\n(written in Sage\'s handwriting. They are aware.)' },
  { id: 'cemetery', title: 'Damp flyer, cemetery', text: 'LOST: one (1) sense of purpose.\nLast seen: the day I quit my agency job to "go freelance."\nIf found, please return. Reward: exposure.' },
  { id: 'overlook', title: 'Carved in the overlook bench', text: 'J + M 2014\nJ + K 2016\nJ + R 2019\nJ alone 2023\nJ IS DOING GREAT ACTUALLY 2024' },
  { id: 'bus', title: 'GRTC bus stop poster', text: 'GRTC: STILL FREE.\n(We don\'t understand it either. Please don\'t ask questions. Just ride.)' },
  { id: 'basement', title: 'Taped to The Basement door', text: 'THE BASEMENT RULES:\n1. No fascists\n2. No cops\n3. No more ska. We mean it this time.\n4. Respect the space (the space is a basement)' },
  { id: 'belvidere', title: 'Crumpled invoice, Belvidere', text: 'INVOICE #0047\nDesign services: $1,200\nStatus: NET 30\nStatus: NET 60\nStatus: NET 90\nStatus: "who is this?"\nStatus: [the client has blocked you]' },
  { id: 'meter', title: 'Parking officer\'s notebook page', text: 'Day 4,117.\nThe Subaru with one hubcap remains.\nIt mocks me.\nI will chalk its tires until the end of time.\n- Officer Gary' },
  { id: 'dale', title: 'Dale\'s dropped notepad', text: 'TO DO:\n- raise rent (all units)\n- call the guy (DON\'T call the guy)\n- rename LLC again??\n- buy 3rd boat\n- "market adjustment" - google what this means' },
  { id: 'gallery', title: 'Gallery wall text', text: '"Untitled (Rent)"\nMixed media: eviction notice, tears, a single Natty Boh can.\nPrice: $4,200\nThe artist is in attendance and would like you to know they "made this for themselves."' },
  { id: 'river', title: 'Note in a bottle, James River', text: 'If you\'re reading this, the river is high and so am I.\nPlease tell my landlord I\'m not home.\nPlease tell my mom I\'m doing great.\nPlease tell my clients I never got the email.' },
  { id: 'alley', title: 'Graffiti, back alley', text: 'OREGON HILL WAS HERE FIRST\n\n(underneath, in different paint:)\nso was the fog\n\n(underneath that:)\nsomeone pls fix the pothole on Pine' },
];

// --------------------------------------------------------------------------
// RVA events: be active or the fog takes you
// --------------------------------------------------------------------------
// day: 0=Mon..6=Sun ; [startHour, endHour)
export const EVENTS = [
  { id: 'trivia', name: 'Trivia Night at The Lowered Expectations', where: 'bar', days: [0], hours: [19, 22], clout: 8, sanity: 6, energy: -10, cost: 10, drunk: 1, text: 'Your team is called "Quiz Khalifa." You lose to a team called "The Fog." They only answered with sighs. They were all correct.' },
  { id: 'openmic', name: 'Open Mic at The Basement', where: 'basement', days: [1], hours: [20, 23], clout: 10, sanity: 4, energy: -12, cost: 0, text: 'A man plays a 19-minute song about his landlord. You cry a little. Everyone does. It\'s about Dale. It\'s always about Dale.' },
  { id: 'cemwalk', name: 'Twilight Walk, Hollywood Cemetery', where: 'cemetery', days: [2], hours: [17, 20], clout: 6, sanity: 14, energy: -8, cost: 0, text: 'You wander among the old stones as the sun sets over the James. A tour guide says "and THIS mausoleum is haunted." Somewhere, a meter maid screams.' },
  { id: 'diyshow', name: 'DIY Show at The Basement', where: 'basement', days: [3, 5], hours: [21, 25], clout: 14, sanity: 8, energy: -18, cost: 10, drunk: 1, text: 'Three bands named after obscure Simpsons quotes. Someone crowd-surfs into a water heater. You make eye contact with a booker. A client vibe is in the air.', referral: true },
  { id: 'fivefold', name: 'Fridays at Gallery Fivefold', where: 'gallery', days: [4], hours: [18, 22], clout: 15, sanity: 6, energy: -10, cost: 0, drunk: 1, text: 'Free warm white wine. A painting titled "Gentrification (Self-Portrait)" is just a mirror. You hand out four business cards and one grocery receipt by accident.', referral: true },
  { id: 'riverday', name: 'River Day at the Overlook', where: 'overlook', days: [5, 6], hours: [11, 18], clout: 8, sanity: 18, energy: 5, cost: 0, text: 'You climb down to the rocks and sit in the James. It\'s cold and brown and perfect. A heron judges you. For an afternoon, nothing is due.' },
];

export const BUS_TRIPS = [
  { id: 'carytown', name: 'Carytown thrift crawl', cost: 25, hours: 3, clout: 9, sanity: 6, energy: -10, text: 'You buy a jacket that makes you look like a 1983 ski instructor who knows a guy. Three strangers compliment it. Worth every penny.' },
  { id: 'squirrels', name: 'Flying Squirrels game at The Diamond', cost: 15, hours: 4, clout: 7, sanity: 10, energy: -12, drunk: 2, text: 'Nutzy the squirrel dances on the dugout. Dollar beer night. You don\'t remember the score. You remember the joy.', weekend: false },
  { id: 'scotts', name: 'Scott\'s Addition brewery hop', cost: 30, hours: 3, clout: 8, sanity: 4, energy: -10, drunk: 2, text: 'Six breweries in three hours. Every one has a "hazy" and a dog wearing a bandana. A guy in a Patagonia vest asks what you "do." You hand him a card.', referral: true },
  { id: 'shortpump', name: 'Short Pump Town Center', cost: 20, hours: 3, clout: -6, sanity: -8, energy: -10, text: 'You buy a candle that smells like "Coastal Grandmother." You see three people from high school. One of them is a realtor now. Your soul thins.' },
  { id: 'brunch', name: 'Brunch in The Fan', cost: 32, hours: 3, clout: 6, sanity: 5, energy: 8, drunk: 1, sunday: true, text: 'Bottomless mimosas. A two-hour wait. Someone at the next table is pitching a "dog-walking blockchain." You eat a $19 biscuit. It\'s a very good biscuit.' },
];

// --------------------------------------------------------------------------
// Shops
// --------------------------------------------------------------------------
export const MART = [
  { id: 'tallboy', name: 'Tallboy (domestic, warm)', price: 3, energy: 0, sanity: 4, drunk: 1, text: 'You crack it on the curb. Classic.' },
  { id: 'coldbrew', name: 'Canned cold brew', price: 4, energy: 22, sanity: 0, text: 'Your heart rate is now a techno song.' },
  { id: 'sushi', name: 'Gas station sushi', price: 6, energy: 14, sanity: -3, text: 'It tastes like a dare.' },
  { id: 'kit', name: 'Hangover kit (blue Gatorade + Advil)', price: 7, energy: 8, sanity: 2, cure: true, text: 'Electrolytes. The fog in your skull lifts a little.' },
  { id: 'scratch', name: 'Scratch-off ticket', price: 2, scratch: true, text: '' },
  { id: 'sixer', name: 'Six-pack for the fridge', price: 11, fridge: 6, text: 'For "guests."' },
];

export const MART_LINES = [
  'DONNY: "We\'re open 24 hours. We\'ve always been open. We will always be open."',
  'DONNY: "You again? You\'re my best customer. That\'s not a compliment, that\'s a data point."',
  'DONNY: "The hot dogs have been rolling since 2011. Nobody\'s bought one. They just... roll."',
];

export const COFFEE_LINES = [
  'JULES: "Oat latte? We\'re out of oat. We have pea. Pea latte? It\'s green."',
  'JULES: "You\'re the one who sits by the outlet for six hours with one drip coffee, right? Love you. Leave."',
  'JULES: "Every single person in here is a freelance creative. Including me. I\'m just doing this for the health insurance. We don\'t have health insurance."',
];

export const FREELANCERS = [
  '"I\'m working on my personal brand. It\'s \'authentic.\' I\'m on version 14."',
  '"I\'m writing a screenplay. It\'s like Succession, but set at a Richmond brewery."',
  '"I have six clients and zero of them have paid me. I\'m thriving."',
  '"Do you have a charger? Any charger. I\'ll take a car charger. I\'ll take a hug."',
];

export const MIRROR = (s) => {
  if (s.sanity < 30) return 'You look in the mirror. The person looking back looks like they\'ve been living in a Silent Hill game. Wait.';
  if (s.ink.length >= 5) return 'You look in the mirror. Look at all that ink. You look like someone who has opinions about coffee. Hell yes.';
  if (s.clout >= 70) return 'You look in the mirror. Local celebrity energy. Three people waved at you today. One was a bus.';
  if (s.money < 150) return 'You look in the mirror and practice saying "my rate is my rate." Your reflection does not believe you.';
  if (s.drunk >= 2) return 'You look in the mirror. Two of you look back. Both of you are doing great, actually.';
  return 'You look in the mirror. Mid-twenties. Tote bag. Undercut you\'ve been "growing out" for a year. You look fine. You look like Richmond.';
};

// --------------------------------------------------------------------------
// Endings
// --------------------------------------------------------------------------
export const ENDINGS = {
  evicted: { title: 'ENDING: SUBARU LIFE', text: 'Dale changes the locks. You move into the Subaru.\n\nIt gets a ticket the first night. "Residing in a vehicle without a residential permit."\n\nYou frame it. It\'s your best work.' },
  insane: { title: 'ENDING: CHESTERFIELD', text: 'Your sanity runs out somewhere on Laurel Street.\n\nYou move back in with your parents in Chesterfield. They have a Keurig and a Ring doorbell and they ask what you "actually do" every single morning.\n\nThe fog never reaches the suburbs. Nothing does.' },
  passedOut: { title: '', text: '' },
  landlord: { title: 'ENDING: THE HORROR IS YOU', text: 'With your savings, you put a down payment on the rowhouse next door.\n\nYou list it within the week. "Historic charm. As-is."\n\nYou raise the rent. You send a guy (there is no guy).\n\nSomewhere, Sage looks at you and says, very gently: "Oh no. Oh no, buddy."' },
  legend: { title: 'ENDING: LOCAL LEGEND', text: 'Fourteen days. Rent paid. Arms covered. Everyone at The Basement knows your name. The meter maid nods at you now — not kindly, but with respect.\n\nYou are part of the hill. The fog parts when you walk down Pine Street.\n\nThe lease renews automatically. +12%. Of course it does.\n\nWelcome home.' },
  renewed: { title: 'ENDING: LEASE RENEWED (+12%)', text: 'You made it fourteen days. Nothing is solved. Everything is a little worse and a little more expensive.\n\nBut you\'re still here. Sage made you tea. Tanner and Bex are at the bar. The fog is just fog, mostly.\n\nThe lease renews automatically.\n\nSee you next month.' },
  asheville: { title: 'ENDING: MOVE TO ASHEVILLE', text: 'You survived, technically. But you stopped going out. You stopped going to shows. One day you realized you hadn\'t seen anyone in a week except the meter maid.\n\nThe fog got thick. Nobody noticed you were gone.\n\nYou move to Asheville. It\'s the same, but with mountains and more expensive.' },
  dog: { title: 'ENDING: GOOD BOY', text: 'You pet the iron dog three times in the dead of night.\n\nIts eyes glow. It speaks:\n\n"I have guarded these graves for 160 years. I have seen every landlord come and go. Dale is not a man. Dale is a concept."\n\nThe dog hands you a deed. It\'s for the whole hill. It was the dog\'s all along.\n\nYou make rent free for everyone. The fog lifts forever.\n\nThe parking tickets, however, remain.' },
};
