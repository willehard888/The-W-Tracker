import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
      },
      /**
       * Type scale.
       *
       * The app ran on two ladders at once: Tailwind's stock steps and its own
       * 10–27px range, the second written out 1201 times as `text-[Npx]`
       * because no name existed for it. These are the rungs it actually uses.
       *
       * VALUES ARE BARE STRINGS ON PURPOSE — do not "finish" them into
       * ["11px", "1.27"] tuples, and do not fold a rung into the stock name of
       * the same size. Both mistakes inject a line-height. An arbitrary
       * `text-[11px]` emits a font-size and nothing else, while stock
       * `.text-xs` is `font-size:.75rem;line-height:1rem` — so mapping
       * `text-[12px]` onto `text-xs` would hand 300-odd elements a leading
       * they never had. Most former `text-[11px]` sites inherit their leading
       * from elsewhere; that is why every rung here is size-only, and why
       * 12/14/16/18/20/24 get a rung of their own despite Tailwind having a
       * stock step at the same pixel value. The stock names stay valid for the
       * call sites that want the pair.
       *
       * Above 27px is display territory — one-off hero, celebration and
       * share-image sizes that should stay arbitrary. The ladder stops there,
       * and style-guard rule 19 polices only 0–27px for the same reason.
       */
      fontSize: {
        label: "11px", // the smallest text: Apple's smallest style is 11pt (Iipo's type scale); what an `.eyebrow` demotes to
        meta: "12px", // meta line, timestamp, caption
        dense: "13px", // dense body
        note: "14px", // secondary body
        read: "15px", // body
        copy: "16px", // long-form copy, and inputs iOS must not zoom
        lead: "17px", // emphasised body
        subhead: "18px", // subheading
        head: "20px", // heading
        title: "22px", // section title
        major: "24px", // large heading
        beat: "27px", // the opening beat (wf-screen-redesign §4)
      },
      // Elevation ladder (index.css --shadow-1..4): shadow-1 chip · shadow-2
      // card · shadow-3 sticky chrome · shadow-4 hero/modal.
      boxShadow: {
        1: "var(--shadow-1)",
        2: "var(--shadow-2)",
        3: "var(--shadow-3)",
        4: "var(--shadow-4)",
      },
      colors: {
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "foreground-muted": "hsl(var(--foreground-muted))",
        "foreground-faint": "hsl(var(--foreground-faint))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          soft: "hsl(var(--gold-soft))",
          light: "hsl(var(--gold-light))",
          dark: "hsl(var(--gold-dark))",
        },
        // The app's OTHER signature color — defined in index.css since the
        // rebrand but never exposed, which is why 21 files hardcoded the
        // literal hsl triple instead of writing text-ember.
        ember: {
          DEFAULT: "hsl(var(--ember))",
          light: "hsl(var(--ember-light))",
          dark: "hsl(var(--ember-dark))",
        },
        lava: {
          DEFAULT: "hsl(var(--lava))",
          deep: "hsl(var(--lava-deep))",
        },
        purple: {
          DEFAULT: "hsl(var(--purple))",
          light: "hsl(var(--purple-light))",
          dark: "hsl(var(--purple-dark))",
          muted: "hsl(var(--purple-muted))",
        },
        teal: {
          DEFAULT: "hsl(var(--teal))",
          light: "hsl(var(--teal-light))",
          dark: "hsl(var(--teal-dark))",
        },
        rose: {
          DEFAULT: "hsl(var(--rose))",
          light: "hsl(var(--rose-light))",
          dark: "hsl(var(--rose-dark))",
        },
        amber: {
          DEFAULT: "hsl(var(--amber))",
          light: "hsl(var(--amber-light))",
          dark: "hsl(var(--amber-dark))",
        },
        "xp-green": "hsl(var(--xp-green))",
        "streak-orange": "hsl(var(--streak-orange))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translate3d(0, 10px, 0)" },
          to: { opacity: "1", transform: "translate3d(0, 0, 0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "ember-rise": {
          "0%": { opacity: "0", transform: "translate3d(0, 6px, 0) scale(0.9)" },
          "30%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translate3d(0, -28px, 0) scale(1.1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both",
        "fade-in-up": "fade-in-up 0.38s cubic-bezier(0.16, 1.2, 0.32, 1) both",
        "scale-in": "scale-in 0.32s cubic-bezier(0.16, 1.2, 0.32, 1) both",
        "ember-rise": "ember-rise 5.5s ease-in infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
