-- Blog post: one subscription, three apps, and what everything costs now
-- Run in Supabase SQL editor.

INSERT INTO blog_posts (
  slug,
  title,
  excerpt,
  tags,
  status,
  published_at,
  author_id,
  allow_comments,
  sections
)
VALUES (
  'one-sub-three-apps',
  'you now get three apps for the price of one and a bit',
  'pro on screenplay studio now unlocks cinderra and castingcall too. there are codes. the codes are one time use. i explain the whole thing below, including why castingcall is the one app you have to pay for.',
  ARRAY['pricing', 'updates', 'pro', 'cinderra', 'castingcall'],
  'published',
  NOW(),
  'f0e0c4a4-0833-4c64-b012-15829c087c77',
  true,
  $sections$
  [
    {
      "order": 1,
      "heading": "the short version",
      "body": "screenplay studio pro is now $249 a year, or $29 a month if you would rather not commit.\n\nit used to be $200 a year. it went up by $49. in exchange it now also unlocks two other apps that used to cost money separately. so if you were going to buy even one of them, you are up.\n\nthat is genuinely the whole announcement. everything below is detail for people who like detail."
    },
    {
      "order": 2,
      "heading": "what the other two apps are",
      "body": "**cinderra** is an infinite canvas. cards, boards, images, links, tables, drawings, connected with lines you draw yourself. i use it for shot lists and moodboards and for the specific flavour of panic that happens two weeks before a shoot. free on its own, $79 a year for pro.\n\n**castingcall** is the casting side. public apply pages, selftapes, availability, and a thing that works out what it costs to actually get an actor to your set including hotels if they live far enough away. $100 for one production, or $50 a month.\n\nboth of those are now included with screenplay studio pro. you do not pay twice."
    },
    {
      "order": 3,
      "heading": "how the codes work",
      "body": "the three apps run on three completely separate databases. this is on purpose. it means a bad day in one of them cannot take the other two down, and it means castingcall holding real people's home addresses is nowhere near the database where you write jokes in a screenplay.\n\nthe downside is that castingcall has no way to ask screenplay studio whether you are pro. so instead you get a code.\n\ngo to your account page, you will see two codes sitting there. one for cinderra, one for castingcall. paste the relevant one into the relevant app, done. it unlocks immediately, no card, nothing to set up.\n\nthe codes are signed, which is a fancy way of saying you cannot make one up. i tried. it does not work. each one is single use, so if you give yours away you have given yours away."
    },
    {
      "order": 4,
      "heading": "if you were already pro, you already have codes",
      "body": "this works backwards. everyone who is currently pro, including everyone i toggled to pro by hand back before there was any way to actually pay me, has codes waiting on their account page right now.\n\nyou do not need to do anything. you do not need to rebuy anything. go and look, they are there.\n\nwhen your subscription renews, the codes are reissued with a new expiry. if it lapses, they stop being reissued. nothing dramatic happens, you just stop getting new ones."
    },
    {
      "order": 5,
      "heading": "why castingcall is not free and everything else is",
      "body": "the whole portfolio runs on the davinci resolve model. free is not a trial, free is the actual product. every feature that is just code belongs to everybody, and pro is a separate suite of heavier tools on top. that has not changed and it is not going to.\n\ncastingcall breaks that rule and i want to be straight about why rather than pretend it does not.\n\ncastingcall is not a tool you use alone. it holds other people's names, phone numbers, home addresses and video of their face. that carries an actual duty of care and a real cost to do properly, and running a casting call is a commercial act in a way that writing a screenplay in your bedroom at 2am is not. so it is paid.\n\nthere is a free trial, it is one production and ten applicants, and it is deliberately small. it is enough to run something real end to end and decide. it is not enough to quietly cast a feature on it. i would rather tell you that up front than have you find the wall halfway through casting."
    },
    {
      "order": 6,
      "heading": "the full price list",
      "body": "**screenplay studio.** free forever, fully featured. pro is $249 a year or $29 a month, and includes cinderra pro and castingcall pro.\n\n**cinderra.** free forever, every card type, unlimited boards. pro is $79 a year or $9 a month, and adds version history, smart layout, high res export and brand kits. the only thing metered on free is hosted uploads, because bytes in storage cost me money in a way that rows in a database do not.\n\n**castingcall.** $100 once for a single production, or $50 a month with a two month minimum. free trial is one production and ten applicants.\n\neverything is paypal. everything is in usd."
    },
    {
      "order": 7,
      "heading": "the honest bit about the price rise",
      "body": "i put the price up because $200 a year for three apps was not sustainable and i would rather charge properly than quietly gut the free tier later. free tiers get worse when the paid tier does not work. i am trying very hard to never do that.\n\nif you are on the old $200 price you keep it until your next renewal. nobody gets rebilled at the new number mid term.\n\nif $249 is genuinely out of reach and you are a student or making something with no budget, email me. i have never said no to that and i am not about to start."
    }
  ]
  $sections$
);
