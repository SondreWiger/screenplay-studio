/**
 * funToasts.ts
 *
 * Personality-forward toast messages used across Screenplay Studio.
 * Every pool has a "rare" tier (~5% probability) for extra delight.
 *
 * Usage:
 *   import { pickToast, NEW_PROJECT, SUBMISSION_ADDED, ... } from '@/lib/funToasts';
 *   toast.success(pickToast(NEW_PROJECT));
 */

export interface FunToastPool {
  common: string[];
  rare: string[];
}

/** Pick a random message. Rare entries have a ~5% chance each. */
export function pickToast(pool: FunToastPool): string {
  // Each rare entry independently has a 5% chance of being picked first
  for (const msg of pool.rare) {
    if (Math.random() < 0.05) return msg;
  }
  return pool.common[Math.floor(Math.random() * pool.common.length)];
}

// ── New project created ───────────────────────────────────────
export const NEW_PROJECT: FunToastPool = {
  common: [
    'Good luck! This one\'s going to be great ❤️',
    'A blank page. The most terrifying and exciting thing in the world 🎬',
    'Every good film started exactly like this. Go get \'em 🚀',
    'New project, new possibilities. You\'ve got this 🌟',
    'The story is already inside you. Time to let it out ✍️',
    'Lights, camera… well, not yet. But soon! 🎥',
    'Adventure incoming. Don\'t forget to save ☁️',
    'Oh this is exciting. We can feel it 👀',
    'Project created. First rule of screenwriting: keep going 💪',
    'Fresh start. No notes yet. Enjoy it while it lasts 😄',
  ],
  rare: [
    'We believe in this one even more than you do right now 🤲',
    'Future festival darling, right here. We called it 🏆',
    'Somewhere in a parallel timeline, this script has already won an award. Chase it 🌌',
    'Plot twist: you actually finish this one 👀',
  ],
};

// ── Festival / submission added ───────────────────────────────
export const SUBMISSION_ADDED: FunToastPool = {
  common: [
    'Submitted! We believe in you 🙌',
    'Shot fired. Now we wait and try not to refresh our email every 5 minutes 📬',
    'Your story deserves to be seen. Good luck ✨',
    'Brave move. Really proud of you for putting it out there 💛',
    'The universe has received your submission. Ball is in their court now 🌍',
    'Application in! Time to manifest an acceptance 🕯️',
    'Filed and forgotten — until the acceptance email arrives 📩',
    'Fingers crossed, toes crossed, everything crossed 🤞',
    'You submitted! That took courage. Seriously 🦁',
    'One step closer to the red carpet. Or at least a nice tote bag 🎒',
  ],
  rare: [
    'Between us? This is the one they pick 🤫',
    'A little bird told us they\'re going to love it 🐦',
    'Historically, every great filmmaker got rejected first. Historically 📚',
    'We ran the numbers. This is going to be your breakthrough. We didn\'t actually run the numbers 😅',
  ],
};

// ── Submission status → accepted ─────────────────────────────
export const SUBMISSION_ACCEPTED: FunToastPool = {
  common: [
    'THEY SAID YES!! 🎉🎉🎉',
    'WAIT. WAIT. WAIT. LET\'S GOOOOO 🚀🚀🚀',
    'ACCEPTED!! You absolute genius 🏆',
    'GET IN. WE ARE SO GOING PLACES 🌟✨🎬',
    'THEY SAID YES AND WE ARE NOT SURPRISED AT ALL 👏',
    'OH MY GOD. OH MY GOD. OH MY GOD 😱🎉',
    'ACCEPTED! Go celebrate immediately. We mean it. Right now 🥂',
    'Called it. We called it from day one 🔮',
    'Your story is going places. Literally 🗺️🎥',
    'SCREAMING. CRYING. THROWING CONFETTI 🎊',
  ],
  rare: [
    'We knew it before you did. We KNEW IT 🧠✨',
    'Okay now you have to write the thank-you speech. We\'re serious 📝',
    'This is the beginning of something huge and we get to say we were here for it 🥹',
    'Future award ceremonies will reference this moment. Screenshot this toast 📸',
  ],
};

// ── Work milestones ───────────────────────────────────────────

export const WORK_1H: FunToastPool = {
  common: [
    'One hour in! Your back would like a word with you 🪑',
    'An hour of work! Have you blinked recently? Blink. 👁️',
    'One hour down! Grab some water, you creative machine 💧',
    'An hour of writing! Your brain deserves a 5-minute vacation 🏖️',
    '60 whole minutes! Stand up. Stretch. You know the drill 🧘',
    'Psst. Hey. You. One hour. Go get a snack 🍎',
    'One hour! Your coffee is almost certainly cold by now ☕',
  ],
  rare: [
    'One hour?! Already? Time flies when you\'re in the zone 🌀',
    'One hour of work and zero distractions? Honestly iconic 👑',
  ],
};

export const WORK_2H: FunToastPool = {
  common: [
    'Two hours in. Your chair is comfortable but it is also a liar 🪑',
    'Two hours! We\'re not saying get up, but… get up 🦵',
    'Two whole hours of writing! You\'re on fire 🔥 (please also drink water)',
    'TWO HOURS. Quick stretch or we\'re telling your physiotherapist 💆',
    'Two hours of focus. Genuinely impressive. Also please move your legs 🚶',
    'Hour two. Your eyes need a 20-second break. Look at something far away. Do it 👀',
    'Two hours mastered! Reward yourself with a ridiculous amount of water 💦',
  ],
  rare: [
    'Two hours in and still going? Okay we\'re a little bit in awe of you 😶',
    'The screenplay gods are smiling. Also they say take a break 🌤️',
  ],
};

export const WORK_3H: FunToastPool = {
  common: [
    'THREE HOURS. We\'re impressed and also concerned. Both. Equally 😬',
    'Three hours of non-stop writing?! Your dedication is both inspiring and slightly worrying 😅',
    'Three hours! At this point a walk around the block is not a request, it\'s a prescription 🏃',
    'Hour three. The words are flowing but so should blood to your legs. Please stand up 🧍',
    'Three hours in! Fun fact: creativity actually improves after a proper break. Science 🧪',
    'THREE HOURS! You could have watched a whole film by now. Instead you\'re writing one. Fair enough 🎬',
    'Hour three. We believe in the work. We also believe in hydration and basic movement 💙',
  ],
  rare: [
    'Three hours. In a parallel universe you\'re asleep. This universe you\'re a legend 🌌',
    'THREE HOURS and the script is still going? Okay this truly might be the one 🏆',
  ],
};

export const WORK_4H: FunToastPool = {
  common: [
    'Four hours. Okay, we\'re being serious now. Take a proper break. Eat something real 🍽️',
    '4 hours of screen time. Your eyes, your back, and your future self are all asking nicely. Please stop for 15 minutes 🙏',
    'Four hours straight. We respect the hustle. We also respect the science of diminishing returns. Break time.',
    'Hour four. Deep work is great. Running on empty is not. Food, water, air. In that order 🥗',
    'You\'ve been at this for four hours. The script can wait 15 minutes. You cannot wait any longer. Break. Now 🛑',
    'FOUR HOURS. This is your official, formal, sincere request to step away from the screen for a bit 💙',
    'Four hours. The ideas will still be there after you eat lunch. We promise 🤝',
  ],
  rare: [
    'Four hours. Genuinely: you are not a robot and this isn\'t a compliment about your work ethic. Please rest.',
    'This is the serious one: four hours is a long time. Go be a human for 20 minutes. We\'ll be here ❤️',
  ],
};

export const WORK_5H: FunToastPool = {
  common: [
    'FIVE HOURS?! Okay at this point you\'re either finishing a feature or need an intervention 🎬',
    'Five hours in! Somehow still going! You absolute menace 😤🔥',
    'Hour five! Your dedication is unhinged and we mean that as the highest compliment 🫡',
    'FIVE HOURS of writing! Did you eat? Drink? See the sun? Rhetorical questions, please go outside 🌞',
    'Five hours. You know what pairs well with a five-hour writing session? A long walk and a large meal 🚶🍕',
    'Hour five! Your characters are probably more rested than you are right now 😂',
    'Five whole hours of work! You\'re not going to stop, are you. That\'s fine. We give up. Drink water 💧',
  ],
  rare: [
    'FIVE HOURS. The audacity. The dedication. The sheer chaos of it all. We\'re obsessed with you 👁️',
    'Five hours in and somehow the words keep coming? Okay we actually need to know your secret ✨',
  ],
};

export const WORK_12H: FunToastPool = {
  common: [
    'TWELVE HOURS?! Are you okay?? Genuinely asking 😳',
    '12 hours at the keyboard. That is a full working day. Please, for the love of all things cinematic, stop 🛑',
    'TWELVE HOURS OF WRITING. We are beyond concerned. We are in awe and also calling someone 📱',
    'Hour twelve. This script better win every award at every festival on every continent 🏆🏆🏆',
    'Twelve hours. The sun has moved. The world has changed. Your back has aged significantly. Please rest 🌅',
    'TWELVE HOURS. At some point the dedication becomes a cry for help. This might be that point 💙',
    '12 hours in. The words you\'re writing right now might not be your best. Sleep helps with that. Just saying 💤',
  ],
  rare: [
    'Twelve. Hours. We don\'t even know what to say. You\'re either writing a masterpiece or you\'ve forgotten what outside looks like 🌍',
    'TWELVE HOURS of screen time in one sitting. We have officially upgraded your status to \'Cinematic Force of Nature\' 🌪️',
  ],
};

export const WORK_24H: FunToastPool = {
  common: [
    'It has been 24 hours. We are worried about you. Please sleep. The script will still exist tomorrow 🛌',
    '24 HOURS. Is this a record? It might be a record. It\'s also a health concern. Please rest 💙',
    'You have been working for a full day. We are no longer joking. Sleep. Food. Water. In any order 🙏',
    'Twenty-four hours. Your brain is currently running on fumes and determination. The fumes won\'t last. Please sleep 💤',
    'A full day of writing. Whatever this script is, it had better be extraordinary. Rest now. Finish tomorrow 🌙',
    '24 hours at the desk. Somewhere, a doctor is cringing. Please take care of yourself. The story can wait ❤️',
    'ONE FULL DAY. We\'re not even showing you writing tips right now. We\'re just asking you to sleep. Please 🛏️',
  ],
  rare: [
    '24 hours. We\'ve moved past concern into a new emotion we don\'t have a word for. It\'s somewhere between awe and panic. SLEEP.',
    'Twenty-four hours of work. If this script doesn\'t change cinema as we know it, we are going to be very disappointed on your behalf 🎬💤',
  ],
};
