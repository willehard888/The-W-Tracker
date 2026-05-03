
-- ============ MIND ============
UPDATE public.vault_articles SET
  subtitle = 'Three time-scales. Three tools. One operator.',
  summary = 'Emotional regulation is a trained skill, not a fixed trait. The next four lessons give you precision tools for three distinct moments: acute spikes (seconds), daily baseline (minutes), and structural patterns (weeks).',
  why_it_matters = 'Most people grab the wrong tool at the wrong moment — meditating during a panic spike, or breathing through a years-old pattern. The three-time-scale model fixes that. Match the tool to the moment and every technique that follows compounds.',
  try_today = ARRAY[
    'Pick ONE recurring moment this week where emotion derails you (a meeting, a commute, a conversation).',
    'Tag its time-scale: acute spike, daily background, or structural pattern.',
    'Note it. You will return to this map at the end of the course.'
  ],
  key_takeaways = ARRAY[
    'Emotion is trainable. Treat it like strength: progressive, repeatable, measurable.',
    'One time-scale, one tool. Acute → breath. Daily → mindfulness. Structural → reframing.',
    'Train the skill in calm moments so it shows up in hard ones.'
  ]
WHERE id = '023f10db-a8f5-4c67-af05-f6ff0aab2240';

UPDATE public.vault_articles SET
  subtitle = '4-4-4-4 — the operator''s reset',
  summary = 'Four counts in, four hold, four out, four hold. Five minutes pulls the parasympathetic system online, drops heart rate and blood pressure, and clears decision fog. Effects begin inside 60 seconds.',
  why_it_matters = 'You cannot think your way out of an acute stress spike — adrenaline is faster than reason. Box breathing forces a physiological reset through the vagus nerve. The Navy SEALs use it before breaching a door. You can use it before sending the email.',
  try_today = ARRAY[
    'Choose one high-pressure moment today — a meeting, a hard call, a difficult conversation.',
    'Run 4 rounds 60 seconds before: inhale 4, hold 4, exhale 4, hold 4. Through the nose.',
    'Rate your tension 1–10 before and after. Most people drop 2–3 points.'
  ],
  key_takeaways = ARRAY[
    'The pattern is symmetry: 4-4-4-4. Equal counts are the active ingredient.',
    'Acute dose: 4–8 rounds. Anything longer is a bonus, not a requirement.',
    'This is physiology, not belief. It works whether you trust it or not.'
  ]
WHERE id = '53bc1523-354c-432f-bb66-c31b6e43af51';

UPDATE public.vault_articles SET
  subtitle = 'Stanford''s 60-second off-switch',
  summary = 'Two short nasal inhales, one long mouth exhale. Repeated for one to three minutes, this is the single most effective breath pattern measured for acute stress reduction (Balban, Cell Reports Medicine 2023).',
  why_it_matters = 'In a head-to-head Stanford trial, the physiological sigh outperformed box breathing, cyclic hyperventilation, AND mindfulness for daily mood improvement. It is the fastest known voluntary tool to slow your heart in real time.',
  try_today = ARRAY[
    'Right now: inhale through your nose, then a second smaller sip to top off your lungs.',
    'Slow, complete exhale through the mouth — twice as long as the inhale.',
    'Three rounds. Notice the shift. Use it any time stress spikes today.'
  ],
  key_takeaways = ARRAY[
    'Pattern: double nasal inhale → long mouth exhale. The exhale is the active ingredient.',
    'Effects in under 60 seconds. No equipment, no privacy required.',
    'Beat box breathing AND meditation in the Stanford trial for acute mood.'
  ]
WHERE id = 'f1535aff-1739-405c-b7b3-a9d7e7393f34';

UPDATE public.vault_articles SET
  subtitle = '10 minutes a day. 8 weeks. Measurable rewiring.',
  summary = 'Ten minutes of formal mindfulness daily for eight weeks produces structural brain changes and reduces anxiety with effect sizes comparable to first-line SSRIs for mild-to-moderate cases (Hoge, JAMA Psychiatry 2023).',
  why_it_matters = 'Mindfulness is not mystical — it is attention training. The MBSR protocol has 30+ years of clinical data. Ten minutes a day is the minimum effective dose. Less and you''re journaling; more and you''re scaling something that already works.',
  try_today = ARRAY[
    'Sit upright for 10 minutes. Phone in airplane mode, timer on.',
    'Anchor on the breath. When attention wanders — and it will — return without judgment. That return IS the rep.',
    'Use Waking Up, Headspace or Insight Timer if you need a guide. Same hour each day if possible.'
  ],
  key_takeaways = ARRAY[
    'Dose: 10 min/day. Below this you will not see structural change.',
    'The rep is the return, not the focus. Wandering is the setup, not the failure.',
    'Compounds invisibly for 4–6 weeks, then becomes obvious. Trust the timeline.'
  ]
WHERE id = 'bc15bbfb-1556-4b0e-8c6a-4ef12b554ac9';

UPDATE public.vault_articles SET
  subtitle = 'Catch the thought. Test the evidence. Rewrite the line.',
  summary = 'Cognitive reframing — the core skill of CBT — is the most evidence-backed intervention in all of psychology. Catch an automatic thought, name the distortion, weigh the evidence, write a balanced reframe. Daily practice rewires response patterns.',
  why_it_matters = 'Events do not cause feelings. Interpretations do. The same missed call can read as "they hate me" or "they''re busy." One tanks your day; the other doesn''t. Reframing is the difference between being a passenger to your thoughts and being the operator.',
  try_today = ARRAY[
    'Catch one upsetting moment today. Write the trigger in a single sentence.',
    'Write the automatic thought it produced ("I''m failing", "they don''t respect me").',
    'List two pieces of evidence FOR and two AGAINST. Write one balanced reframe.'
  ],
  key_takeaways = ARRAY[
    'Trigger → thought → feeling. The thought is the lever, not the trigger.',
    'Reframing is a skill, not a personality. Reps build it.',
    'CBT is the most-validated psychological intervention ever measured. Use it.'
  ]
WHERE id = 'e4931ec6-0b23-4782-bc61-d5fce1913cb7';

-- ============ NERVOUS SYSTEM ============
UPDATE public.vault_articles SET
  subtitle = 'Three states. Two modes. One operator.',
  summary = 'Your nervous system runs in three states: ventral vagal (calm-engaged), sympathetic (fight-or-flight), and dorsal vagal (shutdown). Knowing which state you are in tells you which tool to reach for. This lesson is the map.',
  why_it_matters = 'You cannot regulate what you cannot name. Most people cycle between sympathetic activation and shutdown all day without noticing. The state map turns vague "stress" into a precise read — and gives every tool in this course a clear use case.',
  try_today = ARRAY[
    'Set 3 phone alarms today. At each one, name your state: ventral, sympathetic, or dorsal.',
    'Notice the trigger that put you there.',
    'Notice what naturally pulls you back to ventral (a person, a place, a movement).'
  ],
  key_takeaways = ARRAY[
    'Three states: ventral (online), sympathetic (revved), dorsal (offline).',
    'Naming the state is the first regulation skill. Awareness is the lever.',
    'You move between states constantly. The goal is faster recovery, not permanent calm.'
  ]
WHERE id = 'fe57afe2-d125-4189-a0c4-abd3e903ad6c';

UPDATE public.vault_articles SET
  subtitle = 'Why "calm down" doesn''t work — and what does',
  summary = 'Polyvagal theory (Porges) explains why willpower can''t override a stressed nervous system. The vagus nerve runs on co-regulation and physiological safety cues — not commands. This lesson translates the theory into actionable signals.',
  why_it_matters = 'Telling a sympathetic-activated person to "relax" is like telling a sprinting heart to slow on command. Polyvagal theory tells you which inputs the nervous system actually responds to: breath, posture, gaze, voice tone, social safety. Use the inputs that work.',
  try_today = ARRAY[
    'Soften your jaw, drop your shoulders, lengthen your exhale. Hold for 60 seconds.',
    'Make eye contact with someone you trust today. Notice the regulation that follows.',
    'Identify ONE place or person that reliably puts you back into ventral. Visit them this week.'
  ],
  key_takeaways = ARRAY[
    'The vagus nerve responds to physiological inputs, not verbal commands.',
    'Co-regulation is the fastest path back: voice, eye contact, slow breath.',
    'Safety cues > willpower. Engineer your environment, don''t fight it.'
  ]
WHERE id = 'f3f0c92c-1b24-4f20-8ba4-abefbd052a7f';

UPDATE public.vault_articles SET
  subtitle = 'A 10-minute deposit against sleep debt',
  summary = 'Non-Sleep Deep Rest (NSDR) and Yoga Nidra are guided protocols that drop you into a state physiologically similar to deep sleep — without sleeping. Ten to twenty minutes restores dopamine, sharpens focus, and partially repays sleep debt.',
  why_it_matters = 'You will not always sleep enough. NSDR is the closest thing to a make-good. Stanford''s Andrew Huberman uses it daily. The protocol is free, requires no skill, and produces measurable cognitive recovery — especially after a poor night.',
  try_today = ARRAY[
    'Search YouTube for "NSDR Huberman 10 minute" or "Yoga Nidra 20 minute".',
    'Lie flat on your back, eyes closed, headphones in. Follow the audio.',
    'Best windows: post-lunch dip (13:00–15:00) or after a poor night''s sleep.'
  ],
  key_takeaways = ARRAY[
    'NSDR is sleep''s little brother — restorative, but not a full replacement.',
    '10–20 min restores dopamine and rebuilds focus mid-day.',
    'Use it as a tool, not a habit. Real sleep is still the foundation.'
  ]
WHERE id = '1c69fef4-61bb-4427-ac46-f41dc68c1afd';

UPDATE public.vault_articles SET
  subtitle = 'The resonance frequency that maxes HRV',
  summary = 'Breathing at roughly 5.5 breaths per minute (about 5.5 seconds in, 5.5 seconds out) hits the cardiovascular resonance frequency — the cadence at which heart rate variability is maximised. Daily practice trains long-term vagal tone.',
  why_it_matters = 'High HRV is the single best non-invasive marker of nervous-system fitness. Coherent breathing is the most efficient way to train it: no app, no device, no skill. Five minutes daily compounds into a measurably more resilient autonomic baseline.',
  try_today = ARRAY[
    'Set a 5-minute timer. Breathe in for 5.5 seconds, out for 5.5 seconds. Through the nose.',
    'Use a metronome app or "Breathwrk" / "Othership" to keep cadence honest.',
    'Same time each day — ideally morning or pre-sleep — to compound the adaptation.'
  ],
  key_takeaways = ARRAY[
    'Target cadence: ~5.5 breaths per minute. The exact number that maxes HRV.',
    'Daily 5 minutes raises baseline HRV in 4–8 weeks.',
    'Trains the nervous system the way Zone 2 trains the heart: low intensity, high consistency.'
  ]
WHERE id = '45b0ecae-45b2-4757-b232-61e609acfd4f';

UPDATE public.vault_articles SET
  subtitle = '30 seconds to kill a panic spike',
  summary = 'Submerging the face in cold water (or holding a cold pack to the cheekbones and forehead) triggers the mammalian dive reflex — an automatic vagal response that drops heart rate by 10–25% within seconds. The fastest known anti-panic tool.',
  why_it_matters = 'In a panic spike or rage moment, the body needs an override that bypasses thinking. The dive reflex is hard-wired: cold receptors on the face trigger immediate parasympathetic dominance. Used clinically in DBT for emotional crises. It works in 30 seconds.',
  try_today = ARRAY[
    'Fill a bowl with cold water (under 15°C / 60°F). Add ice if you have it.',
    'Hold your breath, dunk your face for 15–30 seconds. Or press a cold pack to forehead + cheekbones.',
    'Repeat 1–2 times. Notice the heart rate drop and emotional reset.'
  ],
  key_takeaways = ARRAY[
    'Cold + face + breath-hold = mammalian dive reflex. Hard-wired, automatic.',
    'Use for acute panic, rage, or overwhelming emotion. Not for chronic stress.',
    'The DBT "TIP" skill — clinically validated for crisis tolerance.'
  ]
WHERE id = '44854a25-d308-45e1-b0e5-a802dbc7167f';

-- ============ RECIPES (NUTRITION) ============
UPDATE public.vault_articles SET
  subtitle = 'Pattern over perfection',
  summary = 'Performance nutrition rests on four pillars: hit a protein floor, fuel carbs around training, eat a Mediterranean base, and use caffeine as a tool. Get those right and 90% of the result follows. The next four lessons are the protocols.',
  why_it_matters = 'Without a mental model, you''ll treat nutrition as a checklist and quit in three weeks. The four pillars are the spine. They''re ordered intentionally: protein first because it has the largest signal, caffeine last because it''s a multiplier, not a foundation.',
  try_today = ARRAY[
    'Read this lesson today. Commit to one new lesson per day for the next four days.',
    'Audit your last 24 hours against the four pillars. Which one is weakest?',
    'That weakest pillar is where the next lesson will give you the biggest return.'
  ],
  key_takeaways = ARRAY[
    'Patterns beat diets. Identity beats discipline.',
    'Order matters: protein → workout fueling → Mediterranean base → caffeine.',
    'You''re training a system, not following a recipe.'
  ]
WHERE id = '28735731-b918-4c0a-9bca-97106135c68b';

UPDATE public.vault_articles SET
  subtitle = 'The non-negotiable for muscle, recovery, and aging well',
  summary = '1.6 to 2.2 grams of protein per kilogram of body weight, split across three to four meals of 30–45 g, is the highest-leverage nutrition lever you have. Below 1.6 you are leaving muscle, satiety, and recovery on the table.',
  why_it_matters = 'Of every nutrition variable studied, daily protein intake has the largest effect size on body composition, recovery, and long-term function. It is the one number worth tracking. Most people under-eat protein by 30–50 g/day and wonder why progress stalls.',
  try_today = ARRAY[
    'Multiply your bodyweight in kg by 1.6 and 2.2. That is your daily target range in grams.',
    'Plan tomorrow''s meals so each one delivers 30–45 g (palm-sized serving of meat, fish, dairy, or 2 scoops whey).',
    'Track for 3 days. Most people are shocked how far below the floor they sit.'
  ],
  key_takeaways = ARRAY[
    'Range: 1.6–2.2 g/kg/day. Below 1.6 = under-dosed.',
    'Distribution matters: 3–4 meals × 30–45 g triggers more muscle protein synthesis than 2 huge meals.',
    'Protein is the most filling macronutrient. High-protein eaters spontaneously eat ~400 fewer kcal/day.'
  ]
WHERE id = '1536340d-7936-4816-8390-50971d8f406b';

UPDATE public.vault_articles SET
  subtitle = 'Carbs around training — when, how much, why',
  summary = 'Carbs are the highest-octane fuel you have for hard training. Pre, during, and post-workout windows have specific roles: top off glycogen, sustain output, refill stores. Get these three windows right and your training quality jumps.',
  why_it_matters = 'Most people either fear carbs or eat them randomly. Both leak performance. Strategic carb timing around training extends working capacity, lifts intensity, and accelerates recovery — without changing total daily intake.',
  try_today = ARRAY[
    'Pre (60–90 min before): 30–60 g easy carbs (oats, fruit, rice, toast).',
    'Intra (sessions >75 min): 30–60 g/hour from a sports drink, gel, or fruit.',
    'Post (within 60 min): 1–1.2 g carbs/kg + 20–40 g protein. Eat a real meal.'
  ],
  key_takeaways = ARRAY[
    'Pre = top off. Intra = sustain. Post = refill. Each window has a job.',
    'Total daily carbs scale to training volume. Hard days more, rest days less.',
    'Carbs are not optional for hard training — they are the working fuel.'
  ]
WHERE id = '1ddf730a-afe1-4215-89b0-0c13ea911a8d';

UPDATE public.vault_articles SET
  subtitle = 'The most-evidenced longevity diet on the planet',
  summary = 'Olive oil, fish, vegetables, legumes, nuts, whole grains, moderate dairy, minimal red and processed meat. The Mediterranean pattern has 60+ years of data behind it for cardiovascular health, cognitive aging, and all-cause mortality.',
  why_it_matters = 'No single diet has more long-term outcome data. The PREDIMED trial alone showed a 30% drop in major cardiovascular events. It is not a "cleanse" or a phase — it is a default operating pattern that compounds over decades.',
  try_today = ARRAY[
    'Add one fish meal this week (sardines, salmon, mackerel, anchovies).',
    'Cook in extra-virgin olive oil instead of butter or seed oils today.',
    'Make half your dinner plate vegetables. Add a handful of nuts as a snack.'
  ],
  key_takeaways = ARRAY[
    'Pattern: plants + olive oil + fish + nuts. Red meat is a guest, not the host.',
    '30% reduction in cardiovascular events vs control (PREDIMED, NEJM 2018).',
    'Easy to sustain because it is genuinely enjoyable food, not deprivation.'
  ]
WHERE id = 'e5b5ac62-75ea-4db3-a71a-8f2efff76746';

UPDATE public.vault_articles SET
  subtitle = '3–6 mg/kg, 45–60 min pre-effort, last dose by 14:00',
  summary = 'Caffeine is the most studied legal performance drug on earth. Dose 3–6 mg per kg body weight, take it 45–60 minutes before effort, and stop intake by 14:00 to protect deep sleep. Used right, it is a multiplier. Used wrong, it wrecks the night.',
  why_it_matters = 'Caffeine has a 5–7 hour half-life. The 16:00 coffee is still at half-strength when you go to bed. That is why you "sleep fine" but feel wrecked the next day — your deep sleep was suppressed by yesterday''s coffee.',
  try_today = ARRAY[
    'Calculate your dose: bodyweight in kg × 3–6 mg. (75 kg = 225–450 mg.)',
    'Time it 45–60 min before training or your hardest cognitive block.',
    'Set a hard cut-off: no caffeine after 14:00. Test for two weeks. Watch your sleep score.'
  ],
  key_takeaways = ARRAY[
    'Dose: 3–6 mg/kg. Timing: 45–60 min before effort. Cut-off: 14:00.',
    'Half-life is 5–7 hours. Late coffee = suppressed deep sleep, even if you "sleep fine".',
    'It is a tool, not a crutch. Cycle off occasionally to keep sensitivity.'
  ]
WHERE id = 'b244767e-e0e3-46bc-ace9-0f64b631070a';

-- ============ RECOVERY ============
UPDATE public.vault_articles SET
  subtitle = 'Three levers, one outcome',
  summary = 'Recovery rests on three levers: total sleep duration (the dose), morning light (the timing signal), and protected sleep windows (caffeine cut-off, dark room, cool temp). Get these three and 80% of recovery follows automatically.',
  why_it_matters = 'Most people optimise the wrong layer — supplements, gadgets, hacks — while their fundamentals leak. Sleep duration is the dose, light is the timer that decides when that dose lands. Everything else is decoration on top of these two.',
  try_today = ARRAY[
    'Pick a fixed wake time. Same time every day, including weekends, for the next 7 days.',
    'Get outside within 30 minutes of waking for 5–10 minutes. No sunglasses.',
    'Set a caffeine cut-off alarm at 14:00. Defend it.'
  ],
  key_takeaways = ARRAY[
    'Sleep is the dose. Light is the timer. Both must be right.',
    'Three levers beat ten supplements. Master the basics first.',
    'Consistency of timing matters more than total quantity, week to week.'
  ]
WHERE id = '566961ee-ea21-4706-b43e-c2669fc134cf';

UPDATE public.vault_articles SET
  subtitle = 'The closest thing to a master health lever',
  summary = 'Seven to nine hours nightly, with a consistent schedule, is the single most powerful intervention for cognition, mood, hormones, recovery, and lifespan. No supplement, training plan, or diet rivals it. The dose-response is steep below 7 hours.',
  why_it_matters = 'Sleeping 6 hours instead of 8 produces a cognitive deficit equivalent to a 0.10% blood alcohol level after 10 days — and you don''t notice it. Sleep debt is invisible to the sleep-deprived. The data is unambiguous: protect the window or pay the tax everywhere else.',
  try_today = ARRAY[
    'Pick a target wake time. Count back 8 hours — that is your in-bed time.',
    'Defend that bedtime tonight as if it were a meeting with someone important.',
    'Track for 7 nights. Anything under 7 hours is a tax on tomorrow.'
  ],
  key_takeaways = ARRAY[
    'Target: 7–9 hours, every night. The floor is 7, not the ceiling 9.',
    'Consistency of timing > total hours, week to week. Same wake time = the lever.',
    'Sleep debt does not "catch up" on weekends. The damage is already done.'
  ]
WHERE id = '74394cb5-4134-41a3-93c3-f93e7ac8f2f3';

UPDATE public.vault_articles SET
  subtitle = 'The single biggest circadian lever',
  summary = '5 to 10 minutes of bright outdoor light within 30 minutes of waking anchors your circadian clock, sets cortisol to peak in the morning (where it belongs), and pulls melatonin earlier in the evening — making sleep onset easier 14 hours later.',
  why_it_matters = 'Indoor light is 100x dimmer than overcast outdoor light, even if it doesn''t look it. Without a strong morning light signal, your body clock drifts. Morning light is free, takes 10 minutes, and produces a measurable shift in sleep, mood, and energy within a week.',
  try_today = ARRAY[
    'Tomorrow morning, get outside within 30 minutes of waking.',
    'Stay 5–10 minutes (cloudy day) or 2–5 minutes (clear sky). No sunglasses, eyes open but not staring at the sun.',
    'Pair it with a coffee or a walk. Make it automatic, not a chore.'
  ],
  key_takeaways = ARRAY[
    'Window: first 30 minutes after waking. Dose: 5–10 minutes outdoors.',
    'Indoor light won''t do it. Lux matters. Get outside.',
    'Pulls evening melatonin earlier — easier sleep onset that night.'
  ]
WHERE id = '176f9f40-c1f9-4ec9-abff-344a4cf05de9';

UPDATE public.vault_articles SET
  subtitle = 'Why your 16:00 coffee is wrecking deep sleep',
  summary = 'Caffeine has a 5–7 hour half-life. A 200 mg coffee at 16:00 leaves 100 mg in your system at 22:00 — enough to suppress deep sleep by 20–30%, even if you fall asleep "fine". The fix is a hard 14:00 cut-off.',
  why_it_matters = 'You can fall asleep on caffeine — and still get poor sleep. Adenosine receptor blockade reduces slow-wave sleep without changing sleep onset. The damage is invisible until you cut the late coffee for two weeks and remember what real recovery feels like.',
  try_today = ARRAY[
    'Set a hard caffeine cut-off at 14:00 starting today.',
    'Replace afternoon coffee with: water, herbal tea, a 5-minute walk, or a 10-minute NSDR.',
    'Run the experiment for 14 days. If your sleep doesn''t measurably improve, go back. (It will.)'
  ],
  key_takeaways = ARRAY[
    'Half-life: 5–7 hours. A 16:00 coffee is still half-active at bedtime.',
    'Caffeine suppresses deep sleep by 20–30% even when sleep onset feels normal.',
    'Cut-off: 14:00. Non-negotiable for serious recovery.'
  ]
WHERE id = '210fcb3f-ab90-414e-911c-41c63237b994';

UPDATE public.vault_articles SET
  subtitle = '2–3 minutes ≤15°C — and never near strength sessions',
  summary = 'Deliberate cold exposure (2–3 minutes at 15°C or below, 2–4 times per week) drives a sustained dopamine and norepinephrine release, sharpens focus, and improves resilience. Critical caveat: cold within 6 hours of strength training blunts hypertrophy.',
  why_it_matters = 'The cold dopamine response is real and durable — up to 250% baseline for hours. But the same anti-inflammatory effect that helps mood also blocks the inflammatory signal that drives muscle growth. Timing is everything.',
  try_today = ARRAY[
    'Start with a 30-second cold finish on your shower. Cool, not Arctic.',
    'Build to 2–3 minutes at the coldest setting over 1–2 weeks.',
    'Schedule cold AWAY from strength training (>6 hours, ideally morning if you lift evening).'
  ],
  key_takeaways = ARRAY[
    'Dose: 2–3 minutes ≤15°C, 2–4×/week. Total: 11+ minutes/week.',
    'Mood and focus benefits are real and well-replicated.',
    'NEVER within 6 hours of strength training. It blocks hypertrophy.'
  ]
WHERE id = '631db97c-32c2-4e53-a3e0-fa65531758de';

-- ============ TRAINING ============
UPDATE public.vault_articles SET
  subtitle = 'Stress · recover · adapt',
  summary = 'Every training adaptation follows the same loop: applied stress → recovery → super-compensation. Get the dose right and you grow stronger. Get it wrong — too much, too little, no recovery — and you stagnate or break. This is the operating system.',
  why_it_matters = 'Training programs change. The principle does not. Once you understand the stress-recovery-adapt cycle, every protocol that follows makes sense: progressive overload (controlled stress), Zone 2 (sustainable stress), VO₂max (peak stress), deloads (recovery). All four lessons run on this engine.',
  try_today = ARRAY[
    'Audit your last 7 days. Where did you apply stress? Where did you recover?',
    'Identify ONE area where you are doing too much (constant intensity, no rest) or too little (no progressive overload, comfort zone).',
    'That gap is where the next four lessons will give you the biggest return.'
  ],
  key_takeaways = ARRAY[
    'Adaptation = stress + recovery. Skip either side and there is no growth.',
    'More is not better. Right dose, right recovery, right repeated is better.',
    'Every protocol in this course is an instance of this one principle.'
  ]
WHERE id = 'aedc464f-1be4-4203-8fb4-98d44c6cf798';

UPDATE public.vault_articles SET
  subtitle = 'The one mechanism that drives every adaptation',
  summary = 'Progressive overload — gradually increasing training stress through weight, reps, sets, density, or technical difficulty — is the single mechanism behind every long-term gain. Without it you maintain. With it you grow, indefinitely.',
  why_it_matters = 'Most people train hard but stay the same year after year. The reason is almost always the same: no progression model. Progressive overload is the mathematical requirement for adaptation. The body only changes when forced to.',
  try_today = ARRAY[
    'Pick ONE compound lift (squat, deadlift, press, row). Record today''s weight × reps.',
    'Next session, add either 1 rep, 2.5 kg, or one set. Pick one variable.',
    'Track in a notebook or app. The log is the program.'
  ],
  key_takeaways = ARRAY[
    'Progress one variable at a time: weight, reps, sets, density, or quality.',
    'If you''re not tracking, you''re not progressing. Memory lies.',
    'Slow and ruthless beats fast and sloppy. 1% per week = 67% per year.'
  ]
WHERE id = '8204edde-ea6d-4526-b26d-a0e1d3afec2f';

UPDATE public.vault_articles SET
  subtitle = '180 min/week at conversational pace',
  summary = 'Zone 2 — the highest intensity at which you can still hold a conversation — builds mitochondrial density, fat oxidation, and aerobic base. Three hours a week, accumulated, is the most evidence-backed longevity training stimulus we have.',
  why_it_matters = 'Mitochondrial dysfunction underlies most chronic disease and aging. Zone 2 is the only training zone that drives mitochondrial biogenesis at scale. Iñigo San Millán (Tour de France physiologist) calls it "the floor of human performance and the ceiling of healthspan".',
  try_today = ARRAY[
    'Find a Zone 2 effort: nose-breathing or holding a full conversation, slightly uncomfortable but sustainable.',
    'Commit to 3 × 60-minute sessions this week (or 4 × 45-minute). Walking incline, rowing, cycling, or jogging.',
    'If you can''t talk in full sentences, you''re too high. Slow down.'
  ],
  key_takeaways = ARRAY[
    'Target: 180 minutes per week minimum. Sustained, not chopped up.',
    'Test: full-sentence conversation = right zone. Gasping = too hard.',
    'The longevity training stimulus. Boring, slow, and the most important thing in the program.'
  ]
WHERE id = '986d2fea-597b-4b3f-aac9-8bd3d1c2d123';

UPDATE public.vault_articles SET
  subtitle = 'One brutal session per week, decades of payoff',
  summary = 'Four minutes hard, three minutes easy, repeated four times — the Norwegian 4×4 protocol — is the most efficient stimulus for raising VO₂max. One weekly session adds years to your healthspan and removes the single biggest predictor of all-cause mortality.',
  why_it_matters = 'VO₂max is the strongest non-modifiable predictor of all-cause mortality we have measured. Doubling it cuts mortality risk roughly in half. The Norwegian 4×4 takes 28 minutes and produces gains in 6–8 weeks. The price-to-payoff ratio is unmatched.',
  try_today = ARRAY[
    'Pick a tool: bike, rower, hill, or treadmill. Warm up 10 minutes.',
    'Run 4 rounds: 4 minutes near-max effort (RPE 9/10), 3 minutes easy. Total: 28 min + warm-up/cool-down.',
    'Do this once per week. Do not add a second session — it cannibalises Zone 2 recovery.'
  ],
  key_takeaways = ARRAY[
    'Protocol: 4 × (4 min hard / 3 min easy). Once per week. That''s the whole thing.',
    'VO₂max is the #1 modifiable predictor of all-cause mortality.',
    'Brutal but brief. The return on 28 minutes is decades.'
  ]
WHERE id = 'ccf8aaab-fbed-47ad-b946-b2f4f0baea08';

UPDATE public.vault_articles SET
  subtitle = 'Every 4th week should be lighter — here''s why',
  summary = 'Planned deload weeks — reducing volume by 40–60% every 4–6 weeks — let accumulated fatigue dissipate so adaptation can fully express. Skip them and you stall, get hurt, or burn out. They feel like rest. They are actually how progress lands.',
  why_it_matters = 'Fitness gains happen during recovery, not training. Without scheduled deloads, fatigue silently masks fitness — you feel weaker, sleep worse, plateau. A planned 4–6 day reduction lets the bill come due. Every elite program builds them in. Most amateur programs don''t.',
  try_today = ARRAY[
    'Look at your training calendar. When is your next deload week scheduled?',
    'If "never" — schedule one. Pick week 4, 5, or 6. Cut volume by 40–60% (sets, distance, or sessions).',
    'Keep intensity. Cut volume. Use the extra recovery for sleep, walks, and mobility.'
  ],
  key_takeaways = ARRAY[
    'Cadence: deload every 4–6 weeks. Cut volume 40–60%, keep intensity.',
    'Adaptation expresses during recovery, not training. Deloads are when gains land.',
    'Skipping deloads is the most common reason high-intent trainers stagnate.'
  ]
WHERE id = 'affbbe99-699d-430d-89b2-20b27fb48c4e';
