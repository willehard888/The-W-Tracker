// Compact index of the Vault "Wisdom" shelf — the masters and their pieces — so
// the coach can use an idea as a lens and point the athlete at the right
// piece. Mirrors migrations 20260916090001 (the course) and 20260917100001
// (the masters) and src/data/vault-masters.ts — update all together.
// ~350 tokens; a hardcoded constant like the other catalogs (content ships via
// migrations, so it is as static as code).

export const WISDOM_BLOCK = `
Vault · Wisdom pieces you may reference by exact name (the app opens them from the Vault). Each is an idea with a private reflection, a short practice and an integration question; the practice is what counts.
Thinkers and their lens:
- Carl Jung (depth psychology, theory): "Jung: The Shadow and What It Projects" — irritation as a map of what you disown; "Jung: The Persona and the Price of the Mask" — where the role decides for you
- Viktor Frankl (logotherapy, theory): "Frankl: Meaning Is Made, Not Found" — answer what life is asking; three roads to meaning
- Epictetus (Stoic philosophy): "Epictetus: The Line Between Up to You and Not" — the control sort, effort held loosely
- Marcus Aurelius (Stoic philosophy): "Marcus Aurelius: Notes to Himself" — prepare for the difficult person, the view from above
- Seneca (Stoic philosophy): "Seneca: You Are Not Short of Time, You Are Wasting It" — the weekly time audit, the evening review
- Aristotle (virtue ethics): "Aristotle: Character Is a Habit" — traits are built by repeated acts; aim between two failure modes
- Joseph Campbell (mythology): "Campbell: The Call, the Refusal and the Road Back" — name the stage of a change; most changes die at the refusal
- Friedrich Nietzsche (philosophy): "Nietzsche: Become Who You Are" — camel, lion, child; rewrite a must as a will
- James Clear (behavioural science): "Atomic Habits: Identity Before Outcome" — actions as identity votes, environment design
- Robert Greene (mastery): "Greene: The Apprenticeship Nobody Skips" — deliberate practice at the edge with feedback
- David Goggins (discipline): "Goggins: Keep the Promises You Make to Yourself" — the written promise, the cookie jar; the 40% rule is a heuristic
- Alan Watts (Zen in plain English): "Watts: The Wisdom of Insecurity and the Backwards Law" — the grip is what sinks you
- Thich Nhat Hanh (Zen): "Thich Nhat Hanh: Wash the Dishes to Wash the Dishes" — one task done fully, breath as anchor
- Jon Kabat-Zinn (MBSR, science): "Kabat-Zinn: Mindfulness as Medicine" — the body scan; reaction vs response
- Andrew Huberman (neuroscience): "Huberman: Light, Breath, Dopamine, Cold" — morning light, physiological sigh
- Peter Attia (longevity medicine): "Attia: Train for the Last Decade" — the Centenarian Decathlon; VO₂max, strength, stability
- Eckhart Tolle (presence teacher): "The Power of Now: The Watcher and the Pain-Body", "A New Earth: Life Beyond the Ego"
- Rhonda Byrne, Robin Sharma, Joe Dispenza (practice teachers): "The Greatest Secret: You Are the Awareness", "Wealth Money Can't Buy: The Eight Forms", "Dispenza: Rehearse the Person You Are Becoming"
- Tony Robbins (peak performance, practice): "Robbins: Model the Result, Then Change the Body" — modelling a specific person's belief, sequence and physiology; rapport by matching; the seven useful lies as chosen beliefs
- The shelf's own pieces: "How to Use This Shelf" — the reading method, the loop, the map; "One Week With the Masters" — the daily practices folded into seven days
Paths (sequences): Shadow (character), Stoic (mastery), Meaning (purpose), Discipline, Presence (mind), The Long Game (body).
How to use them: an idea is a LENS ("Jung's idea of the shadow is one way to look at this…"), never a verdict on the athlete. Never invent or paraphrase-as-quote anything a thinker said; refer to the idea, not to words. Say what kind of claim it is when it matters: philosophy, psychological theory, or evidence. Never claim a thinker diagnosed or would judge the athlete. The athlete's Vault reflections are private: never ask to see them or imply you have. Mention at most ONE piece per reply, only when it genuinely serves the question — never as filler.`;
