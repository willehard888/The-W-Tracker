import type { ExerciseCoaching } from "@/data/exercise-coaching";

/**
 * Coaching entries — lower body movements the generator can prescribe
 * (src/data/illustration-map.ts). Same schema and house rules as
 * exercise-coaching.ts: plain language, every mistake ships with its fix, no
 * medical claims, "use less weight" when in doubt. Keyed by illustrated slug.
 *
 * Groups: squats (barbell, machine, dumbbell, band) · leg press and knee
 * isolation · lunges and step-ups · hinges · calves · hips · core.
 */
export const LOWER_BODY_COACHING: Record<string, ExerciseCoaching> = {
  // ── Squats — barbell ───────────────────────────────────────────────────

  "front-squat-with-barbell": {
    setup: [
      "Bar rests on the front of your shoulders, close to your neck — the shelf is your shoulders, not your hands.",
      "Cross your arms and lay your hands on top of the bar. Elbows up and pointing forward.",
      "Step back, feet a little wider than your shoulders, toes turned slightly out.",
    ],
    cues: [
      "Elbows high the whole rep — if the elbows drop, the bar rolls forward.",
      "Brace your stomach, then sit straight down between your feet, chest up.",
      "Push the floor away and lead up with your elbows.",
    ],
    tempo: "3 seconds down · brief pause at the bottom · stand up under control",
    breathing: "Breathe in at the top and hold it through the rep. Breathe out once you're standing.",
    mistakes: [
      {
        error: "The bar slides forward off your shoulders on the way up.",
        fix: "Drive your elbows up toward the ceiling as you stand. If they keep dropping, the weight is too heavy for now.",
      },
      {
        error: "Your upper back rounds and your chest drops at the bottom.",
        fix: "Stop the rep higher, where your chest still stays up, and use less weight. Depth comes back as your upper back gets stronger.",
      },
      {
        error: "The bar presses on your throat and it is hard to breathe.",
        fix: "The bar sits on the shelf of your shoulders, touching your neck but not pressing on it. Lift your elbows and it settles into place.",
      },
    ],
    feelIt: "Thighs first, then glutes. Your upper back works hard to hold the bar up — that is part of the lift. Your wrists should not ache; if they do, the bar is in your hands instead of on your shoulders.",
    easier: "Goblet squat — hold one dumbbell at your chest. Same upright shape, nothing to balance on your shoulders.",
    harder: "Add weight in small steps, or pause two seconds at the bottom with your elbows still high.",
  },

  "wide-stance-squat-with-barbell": {
    setup: [
      "Bar on the muscle across the top of your back, hands just outside your shoulders.",
      "Feet well wider than your shoulders, toes turned out about 30° — your knees will follow your toes.",
      "Step back two steps and set your feet before you start.",
    ],
    cues: [
      "Push your knees out toward your toes the whole way down and up.",
      "Sit your hips down between your heels, chest up.",
      "Drive the floor apart with your feet to stand.",
    ],
    tempo: "3 seconds down · pause at the bottom · stand up under control",
    breathing: "Breathe in at the top and hold it through the rep. Breathe out once you're standing.",
    mistakes: [
      {
        error: "Your knees fall inward as you push up.",
        fix: "Push them out over your little toes. If they still fall in, turn your toes out more and use less weight.",
      },
      {
        error: "You lean forward and it turns into a bow.",
        fix: "Keep your chest up and sit your hips down, not back. A slightly shallower rep with a tall chest is the one to keep.",
      },
      {
        error: "Your feet roll onto their inside edges.",
        fix: "Grip the floor with your whole foot, especially the outside edge. Narrow the stance a little if it keeps happening.",
      },
    ],
    feelIt: "Inner thighs and glutes more than a normal squat, with the front of your thighs still working. Your lower back stays braced and quiet.",
    easier: "Plié squat with one dumbbell held at your chest — same wide stance, much easier to keep upright.",
    harder: "Add weight in small steps, or pause two seconds at the bottom with your knees pushed out.",
  },

  "narrow-stance-squat-with-barbell": {
    setup: [
      "Bar on the muscle across the top of your back, not the bone at the base of your neck.",
      "Feet close together — about a hand's width apart, toes pointing slightly out.",
      "Step back two steps and plant your whole foot before you start.",
    ],
    cues: [
      "Let your knees travel forward over your toes — that is the point of the narrow stance.",
      "Chest up, sit straight down as far as your heels stay planted.",
      "Push through the middle of your foot to stand.",
    ],
    tempo: "3 seconds down · brief pause · stand up under control",
    breathing: "Breathe in at the top and hold it through the rep. Breathe out once you're standing.",
    mistakes: [
      {
        error: "Your heels lift and you tip forward onto your toes.",
        fix: "Stop the rep where your heels start to lift — that is your depth for now. A small plate under each heel helps while your ankles loosen.",
      },
      {
        error: "Your knees knock together on the way up.",
        fix: "Push them apart, just slightly, as you stand. If they keep touching, use less weight.",
      },
      {
        error: "You wobble and cannot find your balance at the bottom.",
        fix: "Widen your stance a little and slow the descent. Balance comes before load in this one.",
      },
    ],
    feelIt: "Front of your thighs, right above the knee, more than in a normal squat. Your lower back stays braced and quiet.",
    easier: "A normal-width barbell squat, or a goblet squat with your feet a little closer than usual.",
    harder: "Add weight in small steps, or pause two seconds at the bottom.",
  },

  "hack-squat-with-barbell": {
    setup: [
      "Bar on the floor just behind your heels. Feet about shoulder width, toes forward.",
      "Squat down and take the bar behind you, palms facing back, hands just outside your legs.",
      "Chest up, shoulders back, and check the bar is touching the back of your legs before you lift.",
    ],
    cues: [
      "Stand up with your chest tall — the bar stays brushing the back of your legs.",
      "Sit straight down, knees forward, until your thighs are about parallel.",
      "Push through your whole foot to stand. Stop just short of locking your knees.",
    ],
    tempo: "Stand up under control · 3 seconds down · light touch of the plates, no bounce",
    breathing: "Breathe in at the top. Hold it on the way down and back up, then breathe out.",
    mistakes: [
      {
        error: "The bar scrapes the back of your legs and you lean forward to avoid it.",
        fix: "Let it touch — that is where it belongs. Long socks or leggings fix the scrape; leaning forward puts the work into your lower back.",
      },
      {
        error: "You round your back to reach the bar at the bottom.",
        fix: "Raise the bar on a pair of plates or blocks so you reach it with a flat back. Range comes back as your hips loosen.",
      },
      {
        error: "Your heels lift and you tip onto your toes as you stand.",
        fix: "Push through the middle of your foot. A small plate under each heel helps while your ankles loosen.",
      },
    ],
    feelIt: "Front of your thighs above all — the bar behind you makes your legs do the work. Your lower back stays braced, not pulling.",
    easier: "A goblet squat, or the hack squat machine, which holds the weight in the right place for you.",
    harder: "Add weight in small steps once every rep looks the same, or pause two seconds at the bottom.",
  },

  // ── Squats — machine ───────────────────────────────────────────────────

  "hack-squat-machine": {
    setup: [
      "Shoulders under the pads, back flat against the backrest, and keep it there.",
      "Feet on the platform a little closer than shoulder width, toes turned slightly out.",
      "Stand the sled up, then release the safety handles. Know how to re-set them before you start.",
    ],
    cues: [
      "Push your back into the pad and sink straight down, knees tracking over your toes.",
      "Go as deep as your hips stay on the pad.",
      "Push through your whole foot to stand. Stop just short of locking your knees.",
    ],
    tempo: "3 seconds down · brief pause at the bottom · press up under control",
    breathing: "Breathe in as you lower. Breathe out as you press up.",
    mistakes: [
      {
        error: "Your hips curl up off the pad at the bottom.",
        fix: "Stop the rep higher. The moment your hips start to lift is past your range for now — moving your feet a little higher on the platform helps too.",
      },
      {
        error: "You snap your knees straight at the top.",
        fix: "Stop just short of locked. The muscles should hold the weight at the top, not the joint.",
      },
      {
        error: "Your heels come off the platform.",
        fix: "Move your feet a little higher on the platform and push through the middle of your foot.",
      },
    ],
    feelIt: "Front of your thighs, and glutes as you press up. Your lower back stays pressed to the pad and does nothing.",
    easier: "The leg press — the seat supports more of you, and the weight is easier to control.",
    harder: "Slow the lowering to 4 seconds, or add weight in small steps once every rep looks the same.",
  },

  "narrow-stance-hack-squats": {
    setup: [
      "Shoulders under the pads, back flat against the backrest.",
      "Feet close together — about a hand's width apart — placed slightly higher on the platform than usual.",
      "Release the safety handles only once you are standing tall.",
    ],
    cues: [
      "Knees travel straight forward over your toes, not in or out.",
      "Sink until your thighs are about parallel, or higher if your heels start to lift.",
      "Press through the middle of your foot. Stop short of locking your knees.",
    ],
    tempo: "3 seconds down · brief pause · press up under control",
    breathing: "Breathe in as you lower. Breathe out as you press up.",
    mistakes: [
      {
        error: "Your heels lift off the platform at the bottom.",
        fix: "Move your feet higher on the platform, or stop the rep a little higher. Push through the middle of your foot.",
      },
      {
        error: "Your knees knock together as you press up.",
        fix: "Keep a small gap between them all the way up. If they still touch, the weight is too heavy.",
      },
      {
        error: "You bounce out of the bottom to get going.",
        fix: "Pause for a beat at the bottom, then press. If you need the bounce, use less weight.",
      },
    ],
    feelIt: "Front of your thighs, more so than the normal-width version. Your knees should feel strong, not pinched — if they do, widen your feet and use less weight.",
    easier: "The hack squat machine with a normal-width stance, or the leg press.",
    harder: "Slow the lowering to 4 seconds, or add weight in small steps.",
  },

  "smith-machine-squats": {
    setup: [
      "Set the bar at shoulder height, with the safety stops just below your lowest position.",
      "Bar on the muscle across the top of your back. Feet a little wider than your shoulders and slightly in front of the bar.",
      "Stand tall, twist the bar to unhook it, and settle before the first rep.",
    ],
    cues: [
      "Sit straight down along the rails, chest up, knees following your toes.",
      "Go as deep as your back stays flat and your heels stay down.",
      "Push the floor away to stand. Hook the bar back only when the set is done.",
    ],
    tempo: "3 seconds down · brief pause · stand up under control",
    breathing: "Breathe in at the top and hold it through the rep. Breathe out once you're standing.",
    mistakes: [
      {
        error: "Your feet are too far forward and the bar drags you backwards.",
        fix: "Bring your feet back so they sit just in front of the bar. A few centimetres makes a big difference.",
      },
      {
        error: "The bar path pushes you forward onto your toes.",
        fix: "Move your feet slightly forward and sit back into your heels. The rail decides the bar path, so your feet have to move instead.",
      },
      {
        error: "You forget where the hooks are and struggle to rack the bar at the end.",
        fix: "Practise hooking and unhooking with an empty bar before you load it. Set the safety stops every time.",
      },
    ],
    feelIt: "Thighs and glutes. Because the machine balances the bar, your lower back should feel calm — if it is working hard, your feet are in the wrong place.",
    easier: "A goblet squat, or the leg press. Both let you find your natural path before the rails set it for you.",
    harder: "Pause two seconds at the bottom, or move to a free barbell squat once the shape feels automatic.",
  },

  // ── Squats — dumbbell and band ─────────────────────────────────────────

  "squats-using-dumbbells": {
    setup: [
      "A dumbbell in each hand, arms hanging straight at your sides.",
      "Feet a little wider than your shoulders, toes turned slightly out.",
      "Stand tall with your shoulders back — the dumbbells hang beside your legs, not in front of your knees.",
    ],
    cues: [
      "Chest up, sit your hips down and back with the dumbbells sliding past your legs.",
      "Go as deep as your back stays flat and your heels stay planted.",
      "Push the floor away to stand.",
    ],
    tempo: "3 seconds down · brief pause · stand up under control",
    breathing: "Breathe in as you sit down. Breathe out as you stand.",
    mistakes: [
      {
        error: "You lean forward and the dumbbells swing out in front of your knees.",
        fix: "Keep them brushing the outside of your legs. If they drift forward, your chest has dropped — sit down, not over.",
      },
      {
        error: "Your grip gives out before your legs do.",
        fix: "Use lighter dumbbells, or hold one at your chest instead. The goblet version is the simpler fix.",
      },
      {
        error: "Your knees drift together as you stand.",
        fix: "Push them out toward your little toes on the way up. Slow down until they stay there.",
      },
    ],
    feelIt: "Thighs and glutes. Your forearms will work to hold the weight — that is normal, as long as the grip does not end the set.",
    easier: "Goblet squat with one dumbbell at your chest, or a squat to a bench with no weight at all.",
    harder: "Heavier dumbbells once every rep looks the same, or a barbell squat.",
  },

  "squat-to-bench-with-dumbbells": {
    setup: [
      "Bench behind you. Its edge should touch the back of your legs when you stand tall.",
      "A dumbbell in each hand at your sides, feet a little wider than your shoulders, toes turned slightly out.",
      "Start with a high bench. A lower one is a progression, not the starting point.",
    ],
    cues: [
      "Sit back until you just touch the bench, then stand — it is a marker, not a seat.",
      "Chest up, knees following your toes.",
      "Push through your whole foot to stand up.",
    ],
    tempo: "3 seconds down · light touch on the bench · stand up under control",
    breathing: "Breathe in as you sit back. Breathe out as you stand.",
    mistakes: [
      {
        error: "You sit down on the bench and relax between reps.",
        fix: "Touch and go. If you cannot control it to a light touch, the bench is too low or the dumbbells are too heavy.",
      },
      {
        error: "You drop the last few centimetres and bounce off the bench.",
        fix: "Slow down the second half of the descent. Three full seconds down means the touch is light.",
      },
      {
        error: "You lean forward to get off the bench.",
        fix: "Push your feet into the floor and keep your chest up. Leaning forward moves the work into your lower back — use less weight until you can stand straight up.",
      },
    ],
    feelIt: "Thighs and glutes. Your lower back should stay braced and steady, never doing the lifting.",
    easier: "No dumbbells, a higher bench, or a box with a pad on it. The higher the seat, the easier it is — and it still counts.",
    harder: "A lower bench, heavier dumbbells, or a two-second pause on the bench with your body still tight.",
  },

  "pile-squat-with-dumbbell": {
    setup: [
      "Feet well wider than your shoulders, toes turned out about 45°.",
      "Hold one dumbbell by its top end with both hands, hanging straight down between your legs.",
      "Stand tall, shoulders back. The dumbbell hangs, it does not pull you forward.",
    ],
    cues: [
      "Sit straight down between your feet, knees pushed out over your toes.",
      "Chest up the whole way — the dumbbell travels straight down and up.",
      "Squeeze your glutes to stand.",
    ],
    tempo: "3 seconds down · brief pause · stand up under control",
    breathing: "Breathe in as you sit down. Breathe out as you stand.",
    mistakes: [
      {
        error: "Your knees fall inward as you stand.",
        fix: "Push them out toward your toes. If they still fall in, turn your toes out a little more and use less weight.",
      },
      {
        error: "You bend forward and the dumbbell swings out in front.",
        fix: "Keep your chest up and sit your hips straight down, not back. The dumbbell should travel in a straight line.",
      },
      {
        error: "Your feet roll onto their inside edges.",
        fix: "Grip the floor with the outside of your feet. Narrow the stance a little if it keeps happening.",
      },
    ],
    feelIt: "Inner thighs and glutes above all. Your lower back stays tall and quiet.",
    easier: "No weight at all, hands on your hips, until the wide stance feels natural.",
    harder: "A heavier dumbbell, or a two-second pause at the bottom with your knees pushed out.",
  },

  "jefferson-squats-with-barbell": {
    setup: [
      "Stand over the bar so it runs between your feet, front to back. Feet a little wider than your shoulders.",
      "Squat down and take the bar with one hand in front of you and one behind, both palms down.",
      "Chest up, back flat. The bar should hang straight down between your legs, not against one thigh.",
    ],
    cues: [
      "Stand up straight through the middle — do not let one side pull you into a twist.",
      "Knees follow your toes, chest stays up.",
      "Lower under control until the plates just touch the floor.",
    ],
    tempo: "Stand up under control · brief pause at the top · 3 seconds down",
    breathing: "Breathe in at the bottom, brace, and hold it through the lift. Breathe out at the top.",
    mistakes: [
      {
        error: "Your body twists toward the front hand as you stand.",
        fix: "Use less weight and think about driving both feet evenly. Swap which hand is in front every set so neither side does all the work.",
      },
      {
        error: "The bar hits the inside of your thigh.",
        fix: "Widen your stance a little and turn your toes out. The bar should have clear room to travel straight up.",
      },
      {
        error: "Your back rounds to reach the bar at the bottom.",
        fix: "Raise the bar on blocks or plates so you reach it with a flat back. Range comes back as your hips loosen.",
      },
    ],
    feelIt: "Thighs, inner thighs and glutes. Your lower back stays braced and even, never twisting.",
    easier: "A plié squat with one dumbbell — the same wide, upright shape with nothing to balance front to back.",
    harder: "Add weight in small steps once the bar travels straight, or pause a second at the bottom.",
  },

  "squats-with-exercise-bands": {
    setup: [
      "Stand on the middle of the band with your feet about shoulder width, toes turned slightly out.",
      "Bring the handles up to your shoulders, palms facing forward, elbows down.",
      "Stand tall and check the tension — the band should be snug at the top, not slack.",
    ],
    cues: [
      "Chest up, sit down and back as the band shortens, then drive up against it.",
      "Knees follow your toes the whole way.",
      "The band pulls hardest at the top — stand all the way up anyway.",
    ],
    tempo: "3 seconds down · brief pause · stand up under control",
    breathing: "Breathe in as you sit down. Breathe out as you stand.",
    mistakes: [
      {
        error: "The band slides out from under your feet mid-set.",
        fix: "Stand on the band with the middle of both feet, not the arches, and keep your feet still. Check it before every set.",
      },
      {
        error: "You lean forward because the handles pull you down.",
        fix: "Keep your elbows down and the handles pinned to your shoulders, chest up. If it still pulls you over, use a lighter band.",
      },
      {
        error: "You stop short at the top where the band is hardest.",
        fix: "Stand fully tall every rep. If you cannot, the band is too strong — the top is the point.",
      },
    ],
    feelIt: "Thighs and glutes, with the hardest part at the top of the rep. Your shoulders hold the handles still and should not ache.",
    easier: "A bodyweight squat, or a lighter band. Standing on the band with one foot halves the tension.",
    harder: "A thicker band, a wider stance under the band, or a pause at the bottom.",
  },

  // ── Leg press and knee isolation ───────────────────────────────────────

  "narrow-stance-leg-press": {
    setup: [
      "Set the seat so your knees bend to about a right angle at the bottom, no deeper to start.",
      "Feet close together on the middle of the platform — about a hand's width apart, toes slightly out.",
      "Sit right back so your hips and lower back stay against the pad.",
    ],
    cues: [
      "Lower until your knees are bent about 90°, keeping your hips on the pad.",
      "Push through your whole foot, not your toes.",
      "Stop just short of locking your knees at the top.",
    ],
    tempo: "3 seconds down · brief pause · press back up under control",
    breathing: "Breathe in as the platform comes down. Breathe out as you press.",
    mistakes: [
      {
        error: "Your hips curl up off the seat at the bottom.",
        fix: "You are going too deep for now. Stop the rep higher — the moment your hips start to lift is past your range.",
      },
      {
        error: "Your knees knock together as you press.",
        fix: "Keep a small gap between them the whole way. If they still touch, the weight is too heavy.",
      },
      {
        error: "You snap your knees straight at the top.",
        fix: "Stop just short of locked. The muscles hold the weight at the top, not the joint.",
      },
    ],
    feelIt: "Front of your thighs, more so than the normal-width leg press. Your lower back stays supported by the pad and does nothing.",
    easier: "The normal-width leg press with less weight and a shorter range.",
    harder: "Slow the lowering to 4 seconds, or add weight in small steps.",
  },

  "leg-extensions": {
    setup: [
      "Line your knees up with the machine's pivot — the point the lever rotates around.",
      "Pad sits on your shins just above your ankles, not on top of your feet.",
      "Back against the seat, hands on the handles, and keep them there.",
    ],
    cues: [
      "Straighten your legs slowly and squeeze the front of your thighs at the top.",
      "Stop just short of locking your knees.",
      "Lower for three seconds — the slow half is where the work is.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you straighten. Breathe in as you lower.",
    mistakes: [
      {
        error: "You swing the weight up with momentum.",
        fix: "Take two full seconds to straighten. If you need the swing, the weight is too heavy.",
      },
      {
        error: "Your hips lift off the seat at the top.",
        fix: "Press your back into the seat and hold the handles. Lifting your hips means your legs are getting help — use less weight.",
      },
      {
        error: "The weight stack slams down between reps.",
        fix: "Three seconds down, every rep. Stop just before the plates touch.",
      },
    ],
    feelIt: "Front of your thighs, right through the middle. Your knees should feel like they are working, not being pulled — if they feel strained, shorten the range at the bottom and use less weight.",
    easier: "Less weight and a shorter range at the bottom while you learn where the squeeze is.",
    harder: "Hold the top for two seconds, or work one leg at a time.",
  },

  "lying-leg-curl-machine": {
    setup: [
      "Lie face down with your knees just off the edge of the bench, lined up with the machine's pivot.",
      "Pad sits just above your heels, not on your calves.",
      "Hips pressed into the bench, hands on the grips.",
    ],
    cues: [
      "Curl your heels toward your backside and squeeze at the top.",
      "Keep your hips pressed down the whole rep.",
      "Lower for three seconds until your legs are almost straight.",
    ],
    tempo: "1 second to curl · squeeze for a beat · 3 seconds back",
    breathing: "Breathe out as you curl. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your hips lift off the bench as you curl.",
        fix: "Press them down and use less weight. If your hips move, your lower back is helping.",
      },
      {
        error: "You jerk the weight up and it bounces at the bottom.",
        fix: "Curl in one second and take three to lower. The slow half is where most of the work is.",
      },
      {
        error: "Your range gets shorter as the set goes on.",
        fix: "Drop the weight. Half a curl trains half the muscle, and the last reps are the ones that count.",
      },
    ],
    feelIt: "The back of your thighs. Cramping there is common at first and eases as you get used to it. Not your lower back.",
    easier: "Less weight and a shorter range, or the seated leg curl, which holds your hips in place for you.",
    harder: "Slow the return to 4 seconds, or work one leg at a time.",
  },

  // ── Lunges and step-ups ────────────────────────────────────────────────

  "rear-lunges-with-dumbbell": {
    setup: [
      "A dumbbell in each hand, arms relaxed at your sides.",
      "Stand tall with your feet under your hips.",
      "Pick a spot to step back to — about one long stride behind you.",
    ],
    cues: [
      "Step back and drop your back knee straight down, weight staying on the front foot.",
      "Front shin close to vertical, chest up.",
      "Push through your front heel to bring the back foot home.",
    ],
    tempo: "2 seconds down · light touch at the bottom · drive up under control",
    breathing: "Breathe in as you step back and lower. Breathe out as you come back up.",
    mistakes: [
      {
        error: "You lean forward over your front leg.",
        fix: "Chest up, eyes ahead. Leaning forward moves the work into your lower back.",
      },
      {
        error: "Your front knee drifts inward as you stand.",
        fix: "Push the knee out so it tracks over your middle toes. Slow down and use lighter dumbbells until it stays there.",
      },
      {
        error: "You step back too short and your front heel lifts.",
        fix: "Take a longer stride. Your front foot should stay flat the whole rep — if it cannot, the step is too small.",
      },
    ],
    feelIt: "The front leg's thigh and glute. The back leg is mostly there for balance.",
    easier: "No weight at all, holding a rack or wall with one hand. Many people find stepping back easier to balance than stepping forward — that is why this one comes first.",
    harder: "Heavier dumbbells, a pause at the bottom, or step the back foot onto a low step to lengthen the range.",
  },

  "barbell-lunges": {
    setup: [
      "Bar on the muscle across the top of your back, hands a little wider than your shoulders.",
      "Stand tall, feet under your hips, in a clear space — step out of the rack first.",
      "Start with an empty bar. Balance under a bar is a skill before it is a weight.",
    ],
    cues: [
      "Step one long stride forward and drop your back knee straight down.",
      "Chest up, front shin close to vertical.",
      "Push through your front heel to step back to standing.",
    ],
    tempo: "2 seconds down · light touch at the bottom · drive back under control",
    breathing: "Breathe in as you step and lower. Breathe out as you push back.",
    mistakes: [
      {
        error: "You wobble side to side under the bar.",
        fix: "Do them stationary first — stay in one split stance and just go up and down. Add the step only when the up and down is steady.",
      },
      {
        error: "Your front knee drifts inward as you push back.",
        fix: "Push it out over your middle toes. If it keeps drifting, use less weight.",
      },
      {
        error: "You lean forward and the bar tips you over your front leg.",
        fix: "Chest up, eyes ahead. A shorter step with a tall chest beats a long one with your back doing the work.",
      },
    ],
    feelIt: "The front leg's thigh and glute. Your stomach and back work to keep the bar still — that is normal.",
    easier: "Dumbbell lunges — the weight hangs at your sides instead of balanced on your back. Or an empty bar, stationary.",
    harder: "Add weight in small steps, walking lunges, or a pause at the bottom.",
  },

  "step-ups-with-barbell": {
    setup: [
      "A box or bench around knee height. Lower is fine — start lower than you think.",
      "Bar on the muscle across the top of your back, hands a little wider than your shoulders.",
      "Place your whole foot on the box, not just the front half.",
    ],
    cues: [
      "Drive up through the foot on the box — the floor foot is just along for the ride.",
      "Stand all the way up before you step down.",
      "Lower yourself under control, the same leg working on the way down.",
    ],
    tempo: "Drive up · stand tall for a beat · 3 seconds down",
    breathing: "Breathe out as you step up. Breathe in as you lower.",
    mistakes: [
      {
        error: "You bounce off your back foot to get up.",
        fix: "The leg on the box does the work. Try touching your back toe down lightly between reps instead of pushing off it.",
      },
      {
        error: "You lurch forward and the bar rolls up your neck.",
        fix: "The box is too high or the weight is too heavy. Drop to a lower box and keep your chest up.",
      },
      {
        error: "You drop back down and land hard.",
        fix: "Take three seconds to lower. Landing hard is where knees get sore.",
      },
    ],
    feelIt: "The leg on the box — thigh and glute. Your back stays tall and braced under the bar.",
    easier: "Step-ups with dumbbells, or a lower box with no weight at all.",
    harder: "A higher box, more weight in small steps, or a pause at the top of each rep.",
  },

  // ── Hinges ─────────────────────────────────────────────────────────────

  "barbell-dead-lifts": {
    setup: [
      "Bar over the middle of your feet, feet about hip width. Shins a few centimetres from the bar.",
      "Push your hips back and bend your knees until your hands reach the bar, just outside your legs.",
      "Chest up, back flat, arms straight. Pull the slack out of the bar before you lift.",
    ],
    cues: [
      "Push the floor away and stand up — the bar stays brushing your legs the whole way.",
      "Hips and chest rise together. If your hips shoot up first, the weight is too heavy.",
      "Finish standing tall, glutes squeezed. Don't lean back.",
      "Lower by pushing your hips back, then bend your knees once the bar passes them.",
    ],
    tempo: "Stand up under control · brief pause at the top · 2–3 seconds down · reset every rep",
    breathing: "Breathe in and brace before you pull. Hold it until you are standing, then breathe out. Fresh breath every rep.",
    mistakes: [
      {
        error: "Your lower back rounds as you pull from the floor.",
        fix: "Raise the bar on blocks so you can start with a flat back, and use less weight. The floor comes back as your hips loosen.",
      },
      {
        error: "The bar swings out in front of your shins.",
        fix: "Keep it touching your legs the whole way up and down. A bar out in front is what makes backs sore.",
      },
      {
        error: "Your hips shoot up first and the lift turns into a stiff-legged pull.",
        fix: "Set your hips lower at the start and think about pushing the floor away with your legs. If they still shoot up, the weight is too heavy.",
      },
    ],
    feelIt: "Glutes, the back of your thighs and your whole back holding tight. Your lower back should feel braced and steady, never strained — if it is, reduce the weight.",
    easier: "Romanian deadlift with a bar or dumbbells, or a deadlift from blocks. Both teach the hinge with a shorter range.",
    harder: "Add weight in small steps once every rep starts from the same flat-back position, or pause a second just off the floor.",
  },

  "barbell-good-mornings": {
    setup: [
      "Bar on the muscle across the top of your back, hands a little wider than your shoulders.",
      "Feet about hip width, knees slightly bent and kept that way.",
      "Start with an empty bar. This one is about the shape, not the weight.",
    ],
    cues: [
      "Push your hips straight back, as if closing a car door behind you.",
      "Chest stays proud, back stays flat — bow forward from the hips only.",
      "Stop when the back of your thighs feels tight. That is your depth, wherever it is.",
      "Drive your hips forward to stand tall.",
    ],
    tempo: "3 seconds down · no bounce at the bottom · hips forward to stand",
    breathing: "Breathe in at the top and hold it as you bow. Breathe out once you are standing.",
    mistakes: [
      {
        error: "Your back rounds as you bow forward.",
        fix: "Stop the rep higher — go only as far as your back stays flat, and use less weight. Parallel to the floor is a goal, not a requirement.",
      },
      {
        error: "You bend your knees more and more, so it turns into a squat.",
        fix: "Fix the knee angle at the start and don't change it. Only the hips move.",
      },
      {
        error: "The bar rolls up onto your neck as you bow.",
        fix: "Pull your elbows back and pin the bar into your back. If it still rolls, the weight is too heavy.",
      },
    ],
    feelIt: "A strong stretch down the back of your thighs, and your glutes as you stand. If you feel it mostly in your lower back, you are rounding — reduce the range and the weight.",
    easier: "Romanian deadlift with light dumbbells — the same hinge with the weight in your hands, where it is easier to control.",
    harder: "Add weight in small steps, or slow the lowering to 4 seconds.",
  },

  // ── Calves ─────────────────────────────────────────────────────────────

  "standing-barbell-calf-raise": {
    setup: [
      "Bar on the muscle across the top of your back, hands a little wider than your shoulders.",
      "Balls of your feet on a block or a pair of plates, heels hanging off the edge.",
      "Stand tall, knees straight but not locked, feet about hip width.",
    ],
    cues: [
      "Rise onto the balls of your feet as high as you can, then squeeze at the top.",
      "Lower slowly until your heels are below the block and you feel the stretch.",
      "Keep your body still — only your ankles move.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 3 seconds down · pause in the stretch",
    breathing: "Breathe out as you rise. Breathe in as you lower.",
    mistakes: [
      {
        error: "You bounce out of the bottom to get going.",
        fix: "Pause a full second in the stretch, then rise. If you need the bounce, the weight is too heavy.",
      },
      {
        error: "You bend your knees and turn it into a bob.",
        fix: "Keep your knees straight but not locked. If they bend, the weight is too heavy for your calves alone.",
      },
      {
        error: "You only rise a few centimetres.",
        fix: "Go all the way up onto your toes every rep. Use less weight and a full range — half a rep trains half the muscle.",
      },
    ],
    feelIt: "Your calves, from the heel up to behind the knee. Not your lower back — if it aches, you are leaning back under the bar.",
    easier: "Bodyweight calf raises on a step, holding a rail, or one dumbbell in one hand with the other hand on a rail.",
    harder: "Add weight in small steps, or pause two seconds at the top and two in the stretch.",
  },

  "smith-machine-reverse-calf-raises": {
    setup: [
      "Block or low box under the bar. Stand on it with your heels on the edge and your toes hanging off.",
      "Bar on the muscle across the top of your back. Use the machine as a handrail — it is there for balance.",
      "Lean forward very slightly from the ankles, weight on your heels.",
    ],
    cues: [
      "Lift your toes up toward your shins as high as they go, then squeeze.",
      "Lower slowly until your toes point down and you feel a stretch on the front of your shin.",
      "Keep your knees straight and your body still.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you lift your toes. Breathe in as you lower.",
    mistakes: [
      {
        error: "You bend your knees and rock instead of lifting your toes.",
        fix: "Keep your knees straight but not locked. Only your ankles move — use less weight until they can.",
      },
      {
        error: "You lose balance and grab the bar.",
        fix: "Hold the bar with both hands the whole set and make the movement small. Balance is not the point of this one.",
      },
      {
        error: "The range is tiny because the block is too low.",
        fix: "Use a taller block so your toes have room to drop below your heels. The stretch at the bottom is half the exercise.",
      },
    ],
    feelIt: "The front of your shins, and it burns quickly — that is normal. Not your knees or your lower back.",
    easier: "No bar at all: stand on the block and lift your toes with just your body weight, hands on the rails.",
    harder: "Add weight in small steps, or slow the lowering to 4 seconds.",
  },

  // ── Hips ───────────────────────────────────────────────────────────────

  "one-legged-cable-kickback": {
    setup: [
      "Ankle cuff on the low pulley. Face the stack and hold the frame with both hands.",
      "Stand on the free leg with a soft knee. Working leg slightly in front, the cable pulling it forward.",
      "Lean forward just slightly from the hips, stomach braced, back flat.",
    ],
    cues: [
      "Squeeze your glute and push the leg straight back — small and controlled, not a swing.",
      "Only the leg moves. Your hips and back stay still.",
      "Return slowly until the leg is just past the standing one.",
    ],
    tempo: "1 second back · squeeze for a beat · 2–3 seconds forward",
    breathing: "Breathe out as you kick back. Breathe in as it returns.",
    mistakes: [
      {
        error: "Your lower back arches and your hips tilt as the leg goes back.",
        fix: "Shorten the kick. The rep ends where your hips start to move — use less weight and think about squeezing rather than reaching.",
      },
      {
        error: "You swing the leg back with momentum.",
        fix: "Take a full second back and three forward. If the stack bounces, the weight is too heavy.",
      },
      {
        error: "Your standing knee wobbles and you hang off the frame.",
        fix: "Use less weight and stand tall on a soft knee. The frame is for balance, not for holding you up.",
      },
    ],
    feelIt: "Your glute on the working leg. If you feel it mostly in your lower back, the kick is too big — make it smaller.",
    easier: "The same movement on your hands and knees with no cable, or a light band around your ankles.",
    harder: "Pause two seconds at the back of the kick, or add weight in small steps.",
  },

  "thigh-abductor": {
    setup: [
      "Sit tall, back against the pad, knees against the outside of the pads.",
      "Pick a weight you can open fully under control — lighter than you think.",
      "Hold the handles and keep your torso still.",
    ],
    cues: [
      "Push your knees apart slowly and hold for a beat at the widest point.",
      "Come back together under control — don't let the stack pull your knees in.",
      "Torso stays tall and still. Only the legs move.",
    ],
    tempo: "2 seconds open · hold for a beat · 3 seconds back",
    breathing: "Breathe out as you open. Breathe in as you close.",
    mistakes: [
      {
        error: "You lean back and drive the pads with your whole body.",
        fix: "Sit tall with your back on the pad. If you have to lean to move it, the weight is too heavy.",
      },
      {
        error: "The stack slams down as your knees come back in.",
        fix: "Three seconds back, every rep. The return is half the work.",
      },
      {
        error: "You jerk the pads open and your range shrinks with every rep.",
        fix: "Use less weight and open slowly. Go as wide as you can control, not as wide as the machine allows.",
      },
    ],
    feelIt: "The sides of your hips and glutes. Not your lower back.",
    easier: "Less weight and a smaller range, or a band around your knees while you sit and push out against it.",
    harder: "Hold the open position for two seconds, or lean slightly forward from the hips with a flat back.",
  },

  "thigh-adductor": {
    setup: [
      "Sit tall, back against the pad, knees against the inside of the pads.",
      "Set the start width somewhere comfortable — not the widest setting on your first day.",
      "Hold the handles and keep your torso still.",
    ],
    cues: [
      "Squeeze your knees together slowly and hold for a beat when they meet.",
      "Open again under control — don't let the stack pull your legs apart.",
      "Torso stays tall and still. Only the legs move.",
    ],
    tempo: "2 seconds together · hold for a beat · 3 seconds back out",
    breathing: "Breathe out as you squeeze. Breathe in as you open.",
    mistakes: [
      {
        error: "The stack yanks your legs apart on the way back.",
        fix: "Three seconds out, every rep. If it still yanks, use less weight — the inner thigh does not like surprises.",
      },
      {
        error: "You start with the pads too wide and feel a sharp pull at the top.",
        fix: "Bring the start position in a notch or two. Range grows from week to week, not inside one set.",
      },
      {
        error: "You lean forward or back to help.",
        fix: "Sit tall with your back against the pad. If you have to lean, the weight is too heavy.",
      },
    ],
    feelIt: "Your inner thighs. A gentle stretch when the pads are open is fine — a sharp pull means the start is set too wide.",
    easier: "Less weight and a narrower start, or squeeze a ball between your knees while seated.",
    harder: "Hold the squeeze for two seconds, or slow the return to 4 seconds.",
  },

  // ── Core ───────────────────────────────────────────────────────────────

  "cross-body-crunch": {
    setup: [
      "On your back, knees bent, feet flat on the floor.",
      "Fingertips lightly beside your ears — not clasped behind your head.",
      "Look at a point on the ceiling and keep looking there.",
    ],
    cues: [
      "Curl one shoulder up and twist, elbow toward the opposite knee.",
      "The knee can lift to meet the elbow — the shoulder comes up, not the whole back.",
      "Lower slowly, then go to the other side.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 2 seconds down · alternate sides",
    breathing: "Breathe out as you curl and twist. Breathe in as you lower.",
    mistakes: [
      {
        error: "You pull on your head to get the elbow across.",
        fix: "Fingertips only, elbows wide. The elbow reaches because your ribs twist, not because your hands pull.",
      },
      {
        error: "You sit all the way up and swing across.",
        fix: "Only one shoulder blade leaves the floor. Sitting further up uses your hips, not your stomach.",
      },
      {
        error: "You rush and the twist disappears.",
        fix: "Two seconds up, two down, with a beat at the top. Twelve slow reps beat forty fast ones.",
      },
    ],
    feelIt: "Your stomach, with the sides working as you twist. If you feel it mostly in your neck, your hands are pulling.",
    easier: "A plain crunch, hands crossed on your chest, until lifting your shoulder blades feels automatic.",
    harder: "Slow it down further, pause at the top, or lift both feet off the floor.",
  },

  "decline-crunch": {
    setup: [
      "Set the bench at a shallow decline to start. Steeper is a progression.",
      "Hook your feet under the pads and lie back.",
      "Hands crossed over your chest — easier than beside your ears, and kinder to your neck.",
    ],
    cues: [
      "Curl your ribs toward your hips, one piece of your spine at a time.",
      "Come up only until your shoulder blades are clear of the bench.",
      "Lower slowly, all the way back, without dropping.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as you curl up. Breathe in as you lower.",
    mistakes: [
      {
        error: "You sit all the way up with a flat back.",
        fix: "Curl instead of sitting. Once your shoulder blades are off the bench, the work is done — the rest is your hips.",
      },
      {
        error: "You pull on your neck with your hands.",
        fix: "Cross your hands over your chest instead. If your neck aches, that is where the problem is.",
      },
      {
        error: "You drop back and bounce off the bench.",
        fix: "Three seconds down, every rep. The lowering is where most of the work is.",
      },
    ],
    feelIt: "Your stomach, right through the middle. If you feel it mostly in the front of your hips, you are coming up too far or the bench is too steep.",
    easier: "A flat bench or the floor, or a shallower angle. Flat crunches are the same movement without the extra load.",
    harder: "A steeper decline, a slower lowering, or a light plate held on your chest.",
  },

  "decline-oblique-crunch": {
    setup: [
      "Set the bench at a shallow decline to start.",
      "Hook your feet under the pads, lie back, fingertips beside your ears or hands crossed on your chest.",
      "Look at a point on the ceiling and keep looking there.",
    ],
    cues: [
      "Curl up and twist one shoulder toward the opposite knee.",
      "Shoulder blades off the bench — that is the top. Don't sit all the way up.",
      "Lower slowly, then twist to the other side on the next rep.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 3 seconds down · alternate sides",
    breathing: "Breathe out as you curl and twist. Breathe in as you lower.",
    mistakes: [
      {
        error: "You sit all the way up, then twist at the top.",
        fix: "The twist happens on the way up, and only your shoulder blades leave the bench. Sitting up uses your hips, not your stomach.",
      },
      {
        error: "You pull your head across with your hands.",
        fix: "Fingertips only, elbows wide — or cross your hands over your chest. The elbow reaches because your ribs twist, not because your hands pull.",
      },
      {
        error: "One side is much easier than the other and you drift that way.",
        fix: "Slow both sides to the same speed. Start each set on the harder side while you are fresh.",
      },
    ],
    feelIt: "Your stomach and the sides of your waist. If you feel it mostly in your neck or the front of your hips, you are coming up too far.",
    easier: "Cross-body crunch on the floor — the same twist without the bench.",
    harder: "A steeper decline, a pause at the top of each twist, or a slower lowering.",
  },

  "bent-knee-hip-raise": {
    setup: [
      "On your back, arms out to your sides, palms down on the floor.",
      "Knees bent, feet just off the floor. Press your lower back gently into the floor.",
      "Chin tucked, looking straight up.",
    ],
    cues: [
      "Curl your hips up off the floor, bringing your knees over your chest.",
      "Small lift — your hips come up a few centimetres, not your whole back.",
      "Lower slowly until your feet are just off the floor again — don't let them touch.",
    ],
    tempo: "2 seconds up · squeeze for a beat · 3 seconds down",
    breathing: "Breathe out as your hips lift. Breathe in as you lower.",
    mistakes: [
      {
        error: "You swing your legs to throw your hips up.",
        fix: "Slow down and make the lift smaller. If you need the swing, rest your feet on the floor between reps until it is stronger.",
      },
      {
        error: "Your lower back arches off the floor as your legs lower.",
        fix: "Lower only as far as your back stays pressed down. If that means your feet stay high, that is your range for now.",
      },
      {
        error: "You press hard into your arms and shoulders.",
        fix: "Arms are for balance, not for pushing. Move them closer to your sides — the harder they push, the less your stomach does.",
      },
    ],
    feelIt: "The lower part of your stomach. If you feel it mostly in your lower back or the front of your hips, the range is too big.",
    easier: "Keep your feet on the floor between reps, or bend your knees tighter — the closer the knees are to your chest, the easier it is.",
    harder: "Straighten your legs slightly, pause at the top, or do it on a decline bench.",
  },

  "flutter-kicks": {
    setup: [
      "Lie face down on a flat bench with your hips right at the end and your legs hanging off.",
      "Hold the bench with both hands, or hug it underneath.",
      "Squeeze your glutes before you start, so your legs are held, not hanging.",
    ],
    cues: [
      "Lift one leg at a time with your glute, keeping your hips pressed to the bench.",
      "Small, even kicks — up to level with your body, not above.",
      "Legs stay straight, toes pointed.",
    ],
    tempo: "Steady rhythm · about one second per kick · never a swing",
    breathing: "Keep breathing steadily throughout — don't hold your breath.",
    mistakes: [
      {
        error: "Your hips lift off the bench and your lower back does the kicking.",
        fix: "Make the kicks smaller — level with the bench is high enough. If your hips still lift, move them a little further onto the bench.",
      },
      {
        error: "You kick fast and the legs just swing.",
        fix: "Slow to one kick a second and squeeze your glute at the top of each. Rhythm is not the point — control is.",
      },
      {
        error: "You hold your breath and go red in the face.",
        fix: "Breathe out on every kick. Cut the set short and breathe if you have to.",
      },
    ],
    feelIt: "Glutes and the back of your thighs. If you feel it in your lower back, the kicks are too high.",
    easier: "Lift one leg at a time from the floor, face down, with the other resting. Or hold each leg up for two seconds instead of kicking.",
    harder: "Longer sets, ankle weights, or lift both legs together and hold at the top.",
  },

  "air-bike": {
    setup: [
      "On your back, fingertips beside your ears, elbows wide.",
      "Lift your legs so your knees are bent and your shins are level with the floor.",
      "Press your lower back gently into the floor and keep it there.",
    ],
    cues: [
      "Curl one shoulder up and across toward the opposite knee as that knee comes in.",
      "The other leg stretches out long, hovering off the floor.",
      "Slow — one side, then the other, without your feet ever touching down.",
    ],
    tempo: "Slow and even · about 2 seconds per side · never a scramble",
    breathing: "Breathe out each time an elbow meets a knee. Breathe in as you change sides.",
    mistakes: [
      {
        error: "You pull your head with your hands to reach the knee.",
        fix: "Fingertips only, elbows wide. The elbow reaches because your ribs twist, not because your hands pull.",
      },
      {
        error: "Your lower back arches as the straight leg goes out.",
        fix: "Keep the straight leg higher off the floor. Lower it only as far as your back stays pressed down.",
      },
      {
        error: "You pedal fast and the twist disappears.",
        fix: "Two full seconds per side, with a beat when elbow meets knee. Ten slow reps beat fifty fast ones.",
      },
    ],
    feelIt: "Your whole stomach, with the sides working as you twist. If you feel it mostly in your neck or your lower back, slow down and lift the straight leg higher.",
    easier: "Keep your feet on the floor and just do the upper-body twist, or do the cross-body crunch.",
    harder: "Slow it down further, pause with elbow at knee, or lower the straight leg closer to the floor.",
  },

  "ab-rollout-with-barbell": {
    setup: [
      "Bar loaded with round plates that roll, on the floor at your feet.",
      "Bend forward and take the bar with both hands about shoulder width, palms down.",
      "Brace your stomach before you move an inch. If you cannot do the kneeling version for ten steady reps, start there.",
    ],
    cues: [
      "Roll out only as far as your lower back stays flat — your hips must not sag.",
      "Arms straight the whole way. The bar rolls, you don't reach.",
      "Pull back by lifting your hips up high, as if folding in half.",
    ],
    tempo: "3 seconds out · brief pause · pull back under control",
    breathing: "Breathe in as you roll out. Breathe out as you pull back.",
    mistakes: [
      {
        error: "Your lower back sags and arches at the far point.",
        fix: "Shorten the range — stop well before your hips drop. If it still sags, go back to the kneeling version until it is stronger.",
      },
      {
        error: "You bend your arms to pull the bar back.",
        fix: "Keep your arms straight and pull with your hips and stomach. If you cannot, the range is too long.",
      },
      {
        error: "The bar shoots away from you on the first rep.",
        fix: "Roll out slowly, three full seconds, and start from your knees. Heavier plates roll slower — a lighter bar is not an easier one here.",
      },
    ],
    feelIt: "Your whole stomach, and your shoulders and back working to hold you straight. Not your lower back — if it aches, shorten the range.",
    easier: "Ab rollout on your knees with the barbell. Nearly everyone starts there, and it stays hard for a long time.",
    harder: "Roll further, pause at the far point, or slow the roll out to 4 seconds.",
  },
};
