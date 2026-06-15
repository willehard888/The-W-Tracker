// Curated Whealth Factory recipes — structured so the UI can scale ingredients
// for meal prep (cook once, eat all week) and show storage / reheat guidance.
//
// All base quantities are for ONE serving. The recipe screen multiplies them by
// the chosen batch size (e.g. ×4 = four meals prepped at once).

export interface Ingredient {
  qty?: number;       // base amount for 1 serving (scaled in UI). Omit for "to taste".
  unit?: string;      // g, ml, tbsp, tsp, clove, …
  item: string;
  note?: string;      // e.g. "to taste", "optional"
}

export interface IngredientGroup {
  title: string;
  items: Ingredient[];
}

export interface MethodStep {
  title: string;
  steps: string[];
}

export interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  blurb: string;
  tags: string[];
  prepMin: number;
  cookMin: number;
  nutrition: { calories: number; protein: number; carbs: number; fat: number };
  groups: IngredientGroup[];
  method: MethodStep[];
  mealPrep: {
    fridgeDays: number;
    freezerWeeks?: number;
    reheat: string;
    tips: string[];
  };
}

export const RECIPES: Recipe[] = [
  {
    id: "greek-chicken-bowl",
    title: "Greek Chicken Bowl",
    subtitle: "Chicken · potatoes · tzatziki",
    blurb: "High-protein, balanced bowl with seasoned chicken, roasted potatoes, fresh veggies, feta and homemade tzatziki.",
    tags: ["High protein", "Whole foods"],
    prepMin: 15,
    cookMin: 60,
    nutrition: { calories: 640, protein: 55, carbs: 45, fat: 20 },
    groups: [
      { title: "Chicken", items: [
        { qty: 180, unit: "g", item: "chicken breast" },
        { qty: 1, unit: "tbsp", item: "olive oil" },
        { qty: 1, unit: "tsp", item: "dried oregano" },
        { qty: 0.5, unit: "tsp", item: "garlic powder" },
        { qty: 0.5, unit: "tsp", item: "paprika" },
        { item: "salt & black pepper", note: "to taste" },
      ]},
      { title: "Roasted potatoes", items: [
        { qty: 250, unit: "g", item: "potatoes (cubed)" },
        { qty: 1, unit: "tsp", item: "olive oil" },
        { qty: 0.5, unit: "tsp", item: "dried oregano" },
        { qty: 0.5, unit: "tsp", item: "garlic powder" },
        { item: "salt & black pepper", note: "to taste" },
      ]},
      { title: "Veggies & toppings", items: [
        { qty: 100, unit: "g", item: "cucumber (diced)" },
        { qty: 100, unit: "g", item: "cherry tomatoes (halved)" },
        { qty: 30, unit: "g", item: "red onion (thinly sliced)" },
        { qty: 30, unit: "g", item: "feta cheese (crumbled)" },
        { item: "fresh spinach or lettuce" },
      ]},
      { title: "Tzatziki", items: [
        { qty: 80, unit: "g", item: "Greek yogurt (2–10%)" },
        { qty: 40, unit: "g", item: "cucumber (grated)" },
        { qty: 1, unit: "clove", item: "garlic (minced)" },
        { qty: 1, unit: "tsp", item: "lemon juice" },
        { qty: 1, unit: "tsp", item: "fresh dill", note: "optional" },
      ]},
    ],
    method: [
      { title: "Roast the potatoes", steps: [
        "Preheat oven to 210°C (410°F).",
        "Toss potato cubes with olive oil, oregano, garlic powder, salt and pepper.",
        "Spread on a lined baking sheet.",
        "Roast 25–30 min, flipping halfway, until golden and crispy.",
      ]},
      { title: "Make the tzatziki", steps: [
        "Grate the cucumber and squeeze out excess water.",
        "Combine Greek yogurt, cucumber, garlic and lemon juice.",
        "Season with salt and pepper; add dill if using. Chill 10 min.",
      ]},
      { title: "Cook the chicken", steps: [
        "Season chicken with oregano, garlic powder, paprika, salt and pepper.",
        "Heat olive oil in a pan over medium-high heat.",
        "Cook 5–6 min per side until fully cooked and golden. Rest, then slice.",
      ]},
      { title: "Assemble", steps: [
        "Bed of spinach/lettuce, then potatoes, chicken, cucumber, tomatoes, red onion.",
        "Top with feta and tzatziki on the side. Enjoy.",
      ]},
    ],
    mealPrep: {
      fridgeDays: 4,
      reheat: "Microwave chicken + potatoes 90s; add cold veggies & tzatziki after.",
      tips: [
        "Store tzatziki and fresh veggies separately so nothing goes soggy.",
        "Batch-roast all the potatoes on one tray; cook chicken in 2 batches.",
        "Keep dressing in small jars — assemble bowls the morning you eat them.",
      ],
    },
  },
  {
    id: "lemon-garlic-salmon-quinoa",
    title: "Lemon Garlic Salmon & Quinoa Bowl",
    subtitle: "Salmon · quinoa · tahini",
    blurb: "Nutrient-packed bowl with flaky lemon-garlic salmon, protein-rich quinoa, roasted veg and creamy tahini dressing.",
    tags: ["High protein", "Whole foods"],
    prepMin: 15,
    cookMin: 35,
    nutrition: { calories: 620, protein: 43, carbs: 48, fat: 24 },
    groups: [
      { title: "Salmon", items: [
        { qty: 150, unit: "g", item: "salmon fillet" },
        { qty: 1, unit: "tbsp", item: "olive oil" },
        { qty: 1, unit: "clove", item: "garlic (minced)" },
        { item: "juice of 1/2 lemon" },
        { item: "salt & black pepper", note: "to taste" },
      ]},
      { title: "Quinoa", items: [
        { qty: 75, unit: "g", item: "quinoa (dry)" },
        { qty: 150, unit: "ml", item: "water" },
        { item: "pinch of salt" },
      ]},
      { title: "Roasted vegetables", items: [
        { qty: 100, unit: "g", item: "broccoli florets" },
        { qty: 100, unit: "g", item: "zucchini (sliced)" },
        { qty: 80, unit: "g", item: "red bell pepper (sliced)" },
        { qty: 50, unit: "g", item: "red onion (sliced)" },
        { qty: 1, unit: "tsp", item: "olive oil" },
        { item: "garlic powder, smoked paprika, oregano, onion powder, salt, pepper" },
      ]},
      { title: "Tahini dressing", items: [
        { qty: 2, unit: "tbsp", item: "tahini" },
        { qty: 1, unit: "tbsp", item: "lemon juice" },
        { qty: 1, unit: "tbsp", item: "water", note: "adjust for texture" },
        { qty: 1, unit: "clove", item: "garlic (minced)" },
        { item: "salt & black pepper", note: "to taste" },
      ]},
    ],
    method: [
      { title: "Cook the quinoa", steps: [
        "Rinse quinoa under cold water.",
        "Add quinoa, water and salt to a pot; bring to a boil, reduce to low.",
        "Cover and simmer 15 min until absorbed; fluff with a fork.",
      ]},
      { title: "Roast the vegetables", steps: [
        "Preheat oven to 220°C (425°F).",
        "Toss veg with olive oil and the seasonings until coated.",
        "Roast 18–20 min until lightly charred and tender.",
      ]},
      { title: "Make the tahini dressing", steps: [
        "Whisk tahini, lemon juice, water and garlic.",
        "Add water to reach desired consistency; season to taste.",
      ]},
      { title: "Cook the salmon", steps: [
        "Pat dry and season with salt and pepper.",
        "Heat olive oil over medium; add garlic 30s.",
        "Salmon skin-side down 4–5 min; flip 3–4 min. Squeeze lemon over.",
      ]},
      { title: "Assemble", steps: [
        "Quinoa base, roasted veg + arugula, salmon on top.",
        "Drizzle tahini; garnish with herbs or sesame.",
      ]},
    ],
    mealPrep: {
      fridgeDays: 3,
      freezerWeeks: 1,
      reheat: "Gently microwave 60–90s (salmon dries fast — stop when just warm).",
      tips: [
        "Cook quinoa and roast veg in full batches — they keep best.",
        "Salmon is best within 2–3 days; cook fresh later in the week if you can.",
        "Tahini dressing thickens cold — loosen with a splash of water before serving.",
      ],
    },
  },
  {
    id: "loaded-sweet-potato",
    title: "Loaded Sweet Potato",
    subtitle: "Sweet potato · lean beef · feta",
    blurb: "Nutrient-dense, high-protein meal with roasted sweet potato, seasoned lean beef, cottage cheese, fresh salsa and feta.",
    tags: ["High protein", "Whole foods"],
    prepMin: 15,
    cookMin: 60,
    nutrition: { calories: 610, protein: 48, carbs: 45, fat: 18 },
    groups: [
      { title: "Sweet potato", items: [
        { qty: 1, item: "medium sweet potato (250 g)" },
      ]},
      { title: "Filling", items: [
        { qty: 150, unit: "g", item: "lean ground beef (5% fat)" },
        { qty: 100, unit: "g", item: "cottage cheese" },
        { qty: 1, item: "medium tomato (80 g)" },
        { qty: 30, unit: "g", item: "red onion" },
        { qty: 20, unit: "g", item: "feta cheese" },
      ]},
      { title: "Seasoning", items: [
        { qty: 0.5, unit: "tsp", item: "sea salt" },
        { qty: 0.5, unit: "tsp", item: "black pepper" },
        { qty: 1, unit: "tsp", item: "smoked paprika" },
        { qty: 0.5, unit: "tsp", item: "garlic powder" },
      ]},
    ],
    method: [
      { title: "Roast the sweet potato", steps: [
        "Preheat oven to 220°C (425°F).",
        "Wash and pierce the skin with a fork; place on a lined sheet.",
        "Roast 45–60 min until soft and easily pierced.",
      ]},
      { title: "Cook the beef", steps: [
        "Heat a non-stick pan over medium.",
        "Add beef; season with salt, pepper, smoked paprika and garlic powder.",
        "Cook 6–8 min, breaking it up, until fully cooked.",
      ]},
      { title: "Make the salsa", steps: [
        "Dice the tomato and finely chop the red onion.",
        "Combine and mix; optional squeeze of lime.",
      ]},
      { title: "Assemble", steps: [
        "Slice the sweet potato lengthwise; layer cottage cheese.",
        "Top with beef, tomato-onion salsa, and crumbled feta.",
      ]},
    ],
    mealPrep: {
      fridgeDays: 4,
      freezerWeeks: 2,
      reheat: "Reheat potato + beef 2–3 min; add cold cottage cheese, salsa & feta after.",
      tips: [
        "Batch-roast sweet potatoes and brown all the beef at once.",
        "Keep cottage cheese, salsa and feta separate — add the day you eat.",
        "Beef freezes great — portion into bags and thaw overnight.",
      ],
    },
  },
  {
    id: "steak-taco-bowl",
    title: "Steak Taco Bowl",
    subtitle: "Steak · rice · black beans · lime crema",
    blurb: "Bold, protein-packed bowl with juicy steak, seasoned rice, black beans, fresh veggies and a zesty lime crema.",
    tags: ["High protein", "Whole foods"],
    prepMin: 15,
    cookMin: 30,
    nutrition: { calories: 630, protein: 46, carbs: 60, fat: 22 },
    groups: [
      { title: "Steak", items: [
        { qty: 150, unit: "g", item: "flank steak or sirloin" },
        { qty: 1, unit: "tsp", item: "olive oil" },
        { qty: 1, unit: "tsp", item: "chili powder" },
        { qty: 0.5, unit: "tsp", item: "smoked paprika" },
        { qty: 0.5, unit: "tsp", item: "garlic powder" },
        { item: "salt & black pepper", note: "to taste" },
      ]},
      { title: "Rice", items: [
        { qty: 75, unit: "g", item: "brown rice (dry)" },
        { qty: 150, unit: "ml", item: "water" },
        { item: "pinch of salt" },
        { item: "juice of 1/4 lime" },
      ]},
      { title: "Black beans", items: [
        { qty: 100, unit: "g", item: "black beans (cooked, rinsed)" },
        { qty: 0.5, unit: "tsp", item: "cumin" },
        { item: "pinch of salt" },
      ]},
      { title: "Veggies & toppings", items: [
        { qty: 50, unit: "g", item: "lettuce (shredded)" },
        { qty: 0.5, item: "red bell pepper (diced)" },
        { qty: 0.5, item: "small red onion (finely chopped)" },
        { qty: 50, unit: "g", item: "cherry tomatoes (halved)" },
        { qty: 50, unit: "g", item: "corn (cooked)" },
        { qty: 40, unit: "g", item: "avocado (sliced)" },
        { item: "fresh cilantro, lime wedges" },
        { qty: 20, unit: "g", item: "shredded cheddar / Mexican cheese" },
      ]},
      { title: "Lime crema", items: [
        { qty: 2, unit: "tbsp", item: "Greek yogurt" },
        { qty: 1, unit: "tbsp", item: "sour cream or light mayo" },
        { qty: 1, unit: "tsp", item: "lime juice" },
        { qty: 0.5, unit: "clove", item: "garlic (minced)" },
        { item: "pinch of salt; chili flakes", note: "optional" },
      ]},
    ],
    method: [
      { title: "Cook the rice", steps: [
        "Rinse rice; add rice, water, salt and lime to a pot.",
        "Boil, reduce to low, cover and simmer 20–25 min until absorbed.",
        "Rest 5 min covered; fluff with a fork.",
      ]},
      { title: "Cook the steak", steps: [
        "Pat dry; season with chili powder, paprika, garlic, salt and pepper.",
        "Sear in hot oil 3–4 min per side for medium-rare.",
        "Rest 5 min; slice against the grain.",
      ]},
      { title: "Warm beans & make crema", steps: [
        "Warm beans with cumin and salt 3–5 min.",
        "Whisk yogurt, sour cream, lime and garlic; season.",
      ]},
      { title: "Assemble", steps: [
        "Rice base; top with beans, steak, lettuce, pepper, onion, tomatoes, corn, avocado.",
        "Sprinkle cheese, drizzle crema, garnish cilantro + lime.",
      ]},
    ],
    mealPrep: {
      fridgeDays: 4,
      reheat: "Reheat rice + steak + beans 2 min; add avocado, crema & fresh veg after.",
      tips: [
        "Batch rice, beans and steak; slice steak just before storing.",
        "Avocado and crema go on fresh — never store sliced avocado in the box.",
        "Add lime juice when serving to keep everything bright.",
      ],
    },
  },
  {
    id: "teriyaki-beef-stir-fry",
    title: "Teriyaki Beef Stir-Fry",
    subtitle: "Beef · veggies · brown rice",
    blurb: "High-protein stir-fry with tender beef, colourful veggies and brown rice in a homemade teriyaki sauce.",
    tags: ["High protein", "Whole foods"],
    prepMin: 15,
    cookMin: 25,
    nutrition: { calories: 540, protein: 38, carbs: 55, fat: 16 },
    groups: [
      { title: "Beef", items: [
        { qty: 150, unit: "g", item: "lean beef (sirloin or flank)" },
        { qty: 1, unit: "tsp", item: "olive oil" },
        { item: "salt & black pepper", note: "to taste" },
      ]},
      { title: "Brown rice", items: [
        { qty: 60, unit: "g", item: "brown rice (dry)" },
        { qty: 150, unit: "ml", item: "water" },
        { item: "pinch of salt" },
      ]},
      { title: "Veggies", items: [
        { qty: 100, unit: "g", item: "broccoli florets" },
        { qty: 1, item: "red bell pepper (sliced)" },
        { qty: 1, item: "carrot (julienned)" },
        { qty: 0.5, item: "red onion (sliced)" },
        { qty: 50, unit: "g", item: "snap peas" },
        { qty: 1, unit: "tsp", item: "olive oil" },
      ]},
      { title: "Teriyaki sauce", items: [
        { qty: 2, unit: "tbsp", item: "low-sodium soy sauce" },
        { qty: 1, unit: "tbsp", item: "honey or maple syrup" },
        { qty: 1, unit: "tbsp", item: "rice vinegar" },
        { qty: 1, unit: "tsp", item: "sesame oil" },
        { qty: 1, unit: "clove", item: "garlic (minced)" },
        { qty: 1, unit: "tsp", item: "grated ginger" },
      ]},
      { title: "Toppings", items: [
        { qty: 1, unit: "tsp", item: "sesame seeds" },
        { qty: 1, item: "green onion (sliced)" },
      ]},
    ],
    method: [
      { title: "Cook the brown rice", steps: [
        "Rinse rice; add rice, water and salt to a pot.",
        "Boil, reduce to low, cover and simmer 18–20 min until absorbed.",
        "Rest 5 min; fluff with a fork.",
      ]},
      { title: "Make the teriyaki sauce", steps: [
        "Whisk soy sauce, honey, rice vinegar, sesame oil, garlic and ginger. Set aside.",
      ]},
      { title: "Cook the beef", steps: [
        "Slice beef thinly against the grain; season.",
        "Stir-fry in hot oil 2–3 min until browned; remove.",
      ]},
      { title: "Stir-fry veggies & combine", steps: [
        "Stir-fry broccoli, carrot, pepper, onion and snap peas 4–6 min until tender-crisp.",
        "Return beef, pour in sauce, toss 1–2 min until coated.",
      ]},
      { title: "Assemble", steps: [
        "Rice into bowls; top with beef + veg stir-fry.",
        "Garnish sesame seeds and green onion.",
      ]},
    ],
    mealPrep: {
      fridgeDays: 4,
      freezerWeeks: 2,
      reheat: "Microwave 2–3 min or quick re-stir-fry in a hot pan for best texture.",
      tips: [
        "Best meal-prep candidate — reheats beautifully, sauce keeps it moist.",
        "Make a double batch of teriyaki sauce and keep in a jar.",
        "Slightly undercook the veg so they don't go mushy on reheat.",
      ],
    },
  },
];
