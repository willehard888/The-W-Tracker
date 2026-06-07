-- ============================================================
-- Vault content expansion — real recipes, real programs, deeper
-- recovery / sleep / stress / nervous-system content.
-- Idempotent: ON CONFLICT (slug) DO NOTHING. Re-runnable.
-- Delivers what the paywall promises across all 5 pillars.
-- ============================================================

INSERT INTO public.vault_articles
  (category_id, slug, title, subtitle, summary, evidence_tier, read_time_min,
   benefits, body_md, key_takeaways, try_today, references_json, display_order)
VALUES

-- ─────────────── RECIPES (Performance Nutrition) ───────────────
('recipes', 'high-protein-breakfast-3-builds',
 'High-Protein Breakfast: 3 builds under 6 minutes',
 'Hit 35–40g protein before you leave the house',
 'Three fast, real-food breakfasts that each land ~35–40g protein — the dose shown to maximally trigger muscle protein synthesis in a single meal.',
 'strong', 4,
 ARRAY['Front-loads daily protein','Stabilises morning energy','Cuts mid-morning snacking'],
 E'Most people under-eat protein at breakfast and overshoot at dinner. Spreading 30–40g across each meal drives more muscle protein synthesis than back-loading it.\n\n**1. Savoury scramble (38g)**\n- 3 eggs + 40g grated cheese\n- Handful spinach, cooked in the pan\n- Macros: ~38g protein · 28g fat · 3g carb\n\n**2. Greek yogurt power bowl (40g)**\n- 250g 0% Greek yogurt\n- 30g whey or 20g mixed nuts\n- 100g berries, drizzle of honey\n- Macros: ~40g protein · 8g fat · 25g carb\n\n**3. Overnight oats + protein (36g)**\n- 60g oats, 250ml milk, 1 scoop whey\n- 1 tbsp chia, cinnamon\n- Prep the night before; grab and go\n- Macros: ~36g protein · 12g fat · 45g carb\n\nPick by your day: scramble on low-carb mornings, oats before training.',
 ARRAY['Aim for 30–40g protein per meal, not just at dinner','~6 min of prep beats a 0g-protein pastry every time'],
 ARRAY['Build one of the three tomorrow morning','Pre-portion oats tonight for a zero-effort grab'],
 '[{"author":"Schoenfeld & Aragon","title":"How much protein per meal to maximize muscle protein synthesis","year":2018}]'::jsonb,
 100),

('recipes', 'ten-minute-performance-plate',
 'The 10-minute performance plate',
 'A repeatable template, not another recipe to memorise',
 'One plate formula — protein + plants + smart carbs + fat — that you can rebuild from whatever is in the fridge, with three worked examples.',
 'strong', 4,
 ARRAY['Removes decision fatigue','Balances macros automatically','Scales to any goal'],
 E'Stop hunting recipes. Learn one **plate formula** and rebuild it forever:\n\n- **Palm of protein** (chicken, fish, tofu, beef, eggs)\n- **Half-plate plants** (frozen veg counts — it is just as nutritious)\n- **Cupped hand of smart carbs** (rice, potato, beans) — scale up around training\n- **Thumb of fat** (olive oil, avocado, nuts)\n\n**Example A — 12 min:** salmon fillet, microwave broccoli, microwave rice pouch, olive oil + lemon.\n\n**Example B — 8 min:** tinned tuna, bagged salad, tinned chickpeas, olive oil.\n\n**Example C — 10 min:** pre-cooked chicken, frozen stir-fry veg, noodles, sesame oil.\n\nThis is the Mediterranean pattern in disguise — the most consistently evidence-backed way of eating for long-term health.',
 ARRAY['Protein + plants + smart carbs + fat = done','Frozen and tinned are legitimate — convenience keeps you consistent'],
 ARRAY['Build tonight''s dinner from the formula, no recipe','Stock 3 freezer veg bags so the plate is always 8 minutes away'],
 '[{"author":"Estruch et al.","title":"Primary Prevention of Cardiovascular Disease with a Mediterranean Diet (PREDIMED)","year":2018}]'::jsonb,
 101),

-- ─────────────── TRAINING (Strength & Conditioning) ───────────────
('training', 'beginner-strength-4-week-block',
 '4-week beginner strength block',
 '3 sessions a week. Full body. Progressive overload.',
 'A complete, finishable 4-week full-body program built on the lifts that move the needle — with exact sets, reps and how to add weight each week.',
 'strong', 6,
 ARRAY['Builds full-body strength fast','Simple enough to actually finish','Teaches progressive overload'],
 E'Three days a week (e.g. Mon/Wed/Fri). Same two workouts alternating. Rest 90–120s between sets.\n\n**Workout A**\n- Goblet or back squat — 3×8\n- Push-up or bench press — 3×8\n- Dumbbell row — 3×10\n- Plank — 3×30s\n\n**Workout B**\n- Romanian deadlift — 3×8\n- Overhead press — 3×8\n- Lat pulldown or assisted pull-up — 3×10\n- Hanging knee raise — 3×12\n\n**Progression (the whole point):**\n- Week 1: find a weight where the last rep is hard but clean\n- Each week, add a small amount (2.5kg lower body, 1–2.5kg upper) OR 1 rep per set\n- Week 4 is your peak; then deload or restart heavier\n\nForm over ego. A clean 8 beats a sloppy 12 every time.',
 ARRAY['Compound lifts 3×/week drive the most adaptation for the time spent','Progressive overload = add a little each week, consistently'],
 ARRAY['Schedule your 3 sessions in your calendar now','Workout A today — find your starting weights'],
 '[{"author":"American College of Sports Medicine","title":"Progression Models in Resistance Training for Healthy Adults","year":2009}]'::jsonb,
 100),

('training', 'engine-builder-zone2-4x4',
 'The engine builder: Zone 2 + Norwegian 4×4',
 '4 weeks to a bigger aerobic base and higher VO₂max',
 'A conditioning block pairing high-volume easy Zone 2 with one weekly 4×4 interval session — the combination with the strongest evidence for raising VO₂max.',
 'strong', 6,
 ARRAY['Raises VO₂max — a top predictor of longevity','Builds a base that makes everything easier','Only one hard session a week'],
 E'Two ingredients, four weeks.\n\n**Zone 2 (easy):** conversational pace — you can speak in full sentences. 2–3 sessions/week, 30–45 min. Bike, brisk walk on incline, row, or jog. This builds mitochondria; it should feel almost too easy.\n\n**Norwegian 4×4 (hard):** once a week.\n- Warm up 10 min\n- 4 rounds: 4 min near-max effort (you cannot talk) + 3 min easy recovery\n- Cool down 5 min\n\n**The 4 weeks:**\n- Wk1–2: 2× Zone 2 + 1× 4×4\n- Wk3: 3× Zone 2 + 1× 4×4\n- Wk4: 2× Zone 2 + 1× 4×4 (lighter — let fitness surface)\n\nKeep easy days truly easy. Most people ruin their base by making easy days medium.',
 ARRAY['Most volume easy, one session genuinely hard','VO₂max is one of the strongest predictors of all-cause mortality'],
 ARRAY['Do a 35-min Zone 2 session today at conversational pace','Book your weekly 4×4 — same day each week'],
 '[{"author":"Helgerud et al.","title":"Aerobic high-intensity intervals improve VO2max more than moderate training","year":2007}]'::jsonb,
 101),

-- ─────────────── RECOVERY & SLEEP ───────────────
('recovery', 'sleep-stack-7-levers',
 'The sleep stack: 7 levers, ranked',
 'Where to spend your effort for better sleep',
 'The seven highest-impact sleep levers in priority order — so you fix the things that move the needle before chasing gadgets.',
 'strong', 5,
 ARRAY['Deeper, more restorative sleep','Faster sleep onset','Better next-day focus and mood'],
 E'Fix these in order. The first three do most of the work.\n\n1. **Consistent wake time** — same time daily, even weekends. Anchors your whole clock.\n2. **Morning light** — 5–10 min outdoors within an hour of waking. Sets the timer for melatonin ~16h later.\n3. **Caffeine cut-off** — none within 8–10h of bed. Caffeine has a ~5–6h half-life.\n4. **Cool, dark room** — ~18°C, blackout. Core temperature must drop to sleep.\n5. **No screens 60 min pre-bed** — or at least dim everything.\n6. **Last big meal 3h before bed** — digestion fragments sleep.\n7. **Wind-down ritual** — same 20-min sequence nightly signals "sleep is coming".\n\nDo not buy a ring before you fix your wake time. Behaviour beats hardware.',
 ARRAY['Consistent wake time + morning light are the two biggest levers','Caffeine has a long tail — afternoon coffee costs you deep sleep'],
 ARRAY['Set one fixed wake-up alarm for every day this week','Get 10 minutes of outdoor light tomorrow morning'],
 '[{"author":"Walker, M.","title":"Why We Sleep","year":2017}]'::jsonb,
 100),

('recovery', 'deload-active-recovery',
 'Deload and active recovery',
 'How to come back stronger, not just less tired',
 'Why planned easy weeks make you stronger, and what to actually do on rest days so recovery is active rather than passive.',
 'promising', 4,
 ARRAY['Prevents overuse and burnout','Lets adaptations surface','Protects long-term consistency'],
 E'Training is the stimulus; **recovery is when you actually adapt.** Push without backing off and you accumulate fatigue that masks your real fitness.\n\n**Deload (every 4–6 weeks):** for one week, cut volume ~40–50% (fewer sets) while keeping some intensity. You will often hit PRs the week after.\n\n**Active recovery (rest days):** movement that promotes blood flow without adding fatigue —\n- 20–30 min easy walk\n- Light mobility / stretching\n- Easy Zone 2 spin\n- Sauna, if available\n\nAvoid the trap of "rest = nothing". Gentle movement clears soreness faster than the couch. But if you are genuinely run-down, full rest wins — fatigue is information.',
 ARRAY['Schedule a deload every 4–6 weeks before your body forces one','Active recovery > total inactivity for clearing soreness'],
 ARRAY['Plan your next deload week in the calendar','Take a 25-min easy walk on your next rest day'],
 '[{"author":"Bell et al.","title":"Overreaching and overtraining in resistance exercise","year":2020}]'::jsonb,
 101),

-- ─────────────── MIND & EMOTIONAL SKILL ───────────────
('mind', 'stress-downshift-90s',
 'Stress down-shift: a 90-second reset',
 'Two breath tools that work faster than willpower',
 'Two evidence-backed breathing protocols — the physiological sigh and box breathing — that pull your nervous system out of fight-or-flight in under two minutes.',
 'strong', 3,
 ARRAY['Rapidly lowers acute stress','Usable anywhere, no equipment','Improves focus under pressure'],
 E'You cannot think your way out of an activated nervous system — but you can breathe your way out. Exhales longer than inhales activate the parasympathetic "rest" branch.\n\n**Physiological sigh (fastest — ~30s):**\n- Double inhale through the nose (one big, one short top-up)\n- Long, slow exhale through the mouth\n- Repeat 1–3 times. This is the quickest known way to lower arousal in real time.\n\n**Box breathing (sustained calm — ~90s):**\n- Inhale 4s → hold 4s → exhale 4s → hold 4s\n- Repeat 4–6 rounds\n- Used by special-forces operators before high-stakes moments\n\nUse the sigh when you need to reset *now*; box breathing to settle before something hard.',
 ARRAY['Long exhales flip the nervous system toward calm','The physiological sigh is the fastest real-time de-stress tool'],
 ARRAY['Do 3 physiological sighs right now','Box-breathe for 90s before your next stressful task'],
 '[{"author":"Balban et al.","title":"Brief structured respiration practices enhance mood and reduce arousal","year":2023}]'::jsonb,
 100),

('mind', 'catch-check-change-reframing',
 'Catch–Check–Change: reframing in 3 steps',
 'The core CBT move, stripped to its essentials',
 'A simple three-step cognitive reframing protocol you can run on any stressful thought, drawn from cognitive behavioural therapy.',
 'strong', 4,
 ARRAY['Defuses catastrophic thinking','Builds emotional resilience','Improves decision-making under stress'],
 E'Thoughts are not facts. CBT works by catching distorted thoughts and testing them. Run this on any spiralling thought:\n\n**1. Catch** — name the thought. "I am thinking: I will fail this and everyone will see."\n\n**2. Check** — interrogate it:\n- What is the actual evidence for and against?\n- Am I mind-reading or fortune-telling?\n- Would I say this to a friend?\n- What is the realistic worst case — and could I cope?\n\n**3. Change** — write a more accurate, balanced version. Not toxic positivity — *accurate*. "This is hard and I am underprepared in one area. I can prepare that area tonight."\n\nDone repeatedly, this rewires the default. The goal is not to feel great — it is to think clearly.',
 ARRAY['Thoughts are hypotheses, not facts — test them','Aim for accurate, not positive'],
 ARRAY['Catch one stressful thought today and run the 3 steps','Write the balanced version down — externalising helps'],
 '[{"author":"Beck, J.","title":"Cognitive Behavior Therapy: Basics and Beyond","year":2020}]'::jsonb,
 101),

-- ─────────────── NERVOUS SYSTEM REGULATION ───────────────
('nervous-system', 'nsdr-10-minute-recharge',
 'NSDR: the 10-minute recharge',
 'Non-Sleep Deep Rest / Yoga Nidra, demystified',
 'A guided 10-minute protocol that restores alertness and dopamine without sleep — useful after a bad night or a draining afternoon.',
 'promising', 4,
 ARRAY['Restores energy without a nap','Lowers stress and arousal','Replenishes focus mid-day'],
 E'NSDR (Non-Sleep Deep Rest) is a deliberate state between waking and sleep. Research on Yoga Nidra links it to dopamine replenishment in striatal regions and measurable recovery of focus.\n\n**The protocol (10 min):**\n1. Lie down, eyes closed, arms by your side\n2. 3 slow breaths with long exhales\n3. Body scan — move attention slowly from feet to head, "softening" each part\n4. Let the breath return to normal; stay still and aware\n5. Finish with a few deeper breaths and gentle movement\n\nUse a free guided NSDR/Yoga Nidra audio at first — the voice keeps you from drifting fully asleep. Best after a poor night, before an important block of work, or as a 2pm reset instead of more caffeine.',
 ARRAY['NSDR recharges focus without the grogginess of a nap','A great alternative to a 3rd coffee'],
 ARRAY['Do a 10-minute NSDR today instead of an afternoon coffee','Bookmark one guided audio you trust'],
 '[{"author":"Datta et al.","title":"Yoga Nidra: An innovative approach for management of chronic insomnia","year":2017}]'::jsonb,
 100),

('nervous-system', 'cold-exposure-done-right',
 'Cold exposure, done right',
 'Real benefits, real caveats, correct timing',
 'How to use deliberate cold for mood and resilience without blunting your strength and muscle gains — it is all about dose and timing.',
 'promising', 5,
 ARRAY['Sharp mood and alertness lift','Builds stress resilience','Trains voluntary calm under discomfort'],
 E'Cold exposure reliably spikes dopamine and noradrenaline — a clean, durable mood and focus lift. But timing matters for athletes.\n\n**The catch:** cold-water immersion right after resistance training can blunt muscle and strength adaptations. The cold suppresses the inflammatory signalling that drives growth.\n\n**Do it right:**\n- **For mood/alertness:** brief cold shower or 1–3 min immersion, any time *away* from lifting (mornings are great)\n- **If building muscle:** keep cold at least 4–6h from strength sessions, or use it on rest days\n- **Endurance-only or recovery focus:** post-session cold is fine\n- **Dose:** uncomfortably cold but safe. 1–3 min total across the week is enough; you do not need to suffer for 20 minutes\n\nBreathe slowly through the discomfort — that is the trainable skill.',
 ARRAY['Cold lifts mood reliably — but keep it away from lifting if you want gains','A few minutes a week is plenty; more is not better'],
 ARRAY['End your next non-lifting shower with 60s cold','Practise slow breathing through the cold — do not gasp'],
 '[{"author":"Roberts et al.","title":"Post-exercise cold water immersion attenuates resistance training adaptations","year":2015}]'::jsonb,
 101)

ON CONFLICT (slug) DO NOTHING;
