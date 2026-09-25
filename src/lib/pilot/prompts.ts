// What we ask, when we may ask it, and what it is worth knowing.
//
// The brief's governing rule is that feedback must not get in the way of the
// thing we are trying to observe: "Haluamme tarkkailla mahdollisimman
// luonnollista käyttäytymistä." So this catalogue is small on purpose — eight
// questions across fourteen days, at most one per app launch, and never one
// about a feature the tester has not actually used.
//
// The app is in English and the testers are Finnish. The questions are in
// Finnish because a question answered in the reader's own language gets a real
// answer; the rest of the app is untouched. All copy lives here, so what a
// tester is asked can be read in one file without opening a component.

/** What the app has watched this person actually do. Never why, never how well. */
export interface PilotSignals {
  checkedIn: boolean;
  trained: boolean;
  askedCoach: boolean;
  recovered: boolean;
  loggedFood: boolean;
}

export const NO_SIGNALS: PilotSignals = {
  checkedIn: false,
  trained: false,
  askedCoach: false,
  recovered: false,
  loggedFood: false,
};

export type PilotPromptKind = "checkpoint" | "contextual";

export interface PilotOption {
  /** Stored in pilot_feedback.choice — a slug, never the label. */
  v: string;
  label: string;
}

export interface PilotPrompt {
  id: string;
  kind: PilotPromptKind;
  /** Checkpoints only: the pilot day this becomes due. */
  day?: number;
  /** Contextual only: the tester must have done this, or we do not ask. */
  requires?: (s: PilotSignals) => boolean;
  title: string;
  /** Optional 1-5 scale. Omitted means the question has no scale. */
  scale?: { question: string; low: string; high: string };
  choice?: { question: string; options: PilotOption[] };
  comment?: { label: string; placeholder: string };
}

/**
 * The three checkpoints.
 *
 * One row each, because the schema already holds a scale, a choice and a
 * comment on one row — three prompt ids per checkpoint would triple the
 * bookkeeping to store the same three answers.
 *
 * Due on their day and never expire: somebody who does not open the app on day
 * 7 gets the day-7 question on day 8, which is still the question we wanted
 * asked. A checkpoint missed entirely is visible in admin_pilot_prompts.
 */
const CHECKPOINTS: PilotPrompt[] = [
  {
    id: "DAY1",
    kind: "checkpoint",
    day: 1,
    title: "Ensimmäinen päivä takana",
    scale: {
      question: "Kuinka selvää oli, mitä Whealthissa kuuluu tehdä?",
      low: "Täysin sekavaa",
      high: "Heti selvää",
    },
    choice: {
      question: "Mikä oli epäselvintä?",
      options: [
        { v: "nothing", label: "Ei mikään — pääsin alkuun" },
        { v: "where_to_start", label: "Mistä aloittaa" },
        { v: "what_app_is_for", label: "Mihin appi oikeastaan on" },
        { v: "too_much", label: "Liikaa asiaa kerralla" },
      ],
    },
    comment: {
      label: "Haluatko tarkentaa? (vapaaehtoinen)",
      placeholder: "Mikä jäi mietityttämään?",
    },
  },
  {
    id: "DAY7",
    kind: "checkpoint",
    day: 7,
    title: "Viikko takana",
    choice: {
      question: "Mikä on ollut tähän mennessä hyödyllisintä?",
      options: [
        { v: "checkin", label: "Päivittäinen check-in" },
        { v: "training", label: "Treeniohjelma" },
        { v: "coach", label: "AI Coach" },
        { v: "recovery", label: "Palautuminen" },
        { v: "nothing_yet", label: "Ei vielä mikään" },
      ],
    },
    comment: {
      label: "Mitä et löytänyt tai jäit kaipaamaan?",
      placeholder: "Vaikka jotain mitä luulit olevan, mutta et löytänyt",
    },
  },
  {
    id: "DAY14",
    kind: "checkpoint",
    day: 14,
    title: "Pilotti on ohi — kiitos",
    scale: {
      question: "Kuinka todennäköisesti jatkaisit Whealthin käyttöä?",
      low: "En jatkaisi",
      high: "Jatkan varmasti",
    },
    choice: {
      question: "Jos tämä maksaisi 8,99 € / kk, mitä tekisit?",
      options: [
        { v: "would_pay", label: "Maksaisin" },
        { v: "maybe_cheaper", label: "Ehkä halvemmalla" },
        { v: "not_yet", label: "En vielä — puuttuu jotain" },
        { v: "no", label: "En maksaisi" },
      ],
    },
    comment: {
      label: "Mikä ratkaisisi asian suuntaan tai toiseen?",
      placeholder: "Suoraan sanottuna",
    },
  },
];

/**
 * The contextual questions.
 *
 * `requires` is the brief's hardest rule made mechanical: never ask about a
 * feature the tester has not used. A tester who never opened the coach is not
 * asked what they thought of it — that silence is itself the finding, and it is
 * already visible in the funnel. What we would learn by asking is only how it
 * feels to be asked about something you never found.
 */
const CONTEXTUAL: PilotPrompt[] = [
  {
    id: "AFTER_FIRST_CHECKIN",
    kind: "contextual",
    requires: (s) => s.checkedIn,
    title: "Check-in tehty",
    choice: {
      question: "Tuntuiko check-in vaivan arvoiselta?",
      options: [
        { v: "worth_it", label: "Kyllä" },
        { v: "too_long", label: "Kesti liian kauan" },
        { v: "unclear_value", label: "En tajunnut mitä hyödyn" },
        { v: "no", label: "Ei oikeastaan" },
      ],
    },
  },
  {
    id: "AFTER_FIRST_WORKOUT",
    kind: "contextual",
    requires: (s) => s.trained,
    title: "Ensimmäinen treeni tehty",
    choice: {
      question: "Osuiko treeni kohdalleen?",
      options: [
        { v: "just_right", label: "Sopiva" },
        { v: "too_hard", label: "Liian kova" },
        { v: "too_easy", label: "Liian kevyt" },
        { v: "too_long", label: "Liian pitkä" },
        { v: "wrong_for_me", label: "Ei sopinut minulle" },
      ],
    },
    comment: { label: "Miksi? (vapaaehtoinen)", placeholder: "" },
  },
  {
    id: "COACH_TRUST",
    kind: "contextual",
    requires: (s) => s.askedCoach,
    title: "AI Coach",
    choice: {
      question: "Luotitko siihen mitä coach vastasi?",
      options: [
        { v: "trusted", label: "Kyllä" },
        { v: "unsure", label: "En osannut sanoa" },
        { v: "too_generic", label: "Liian yleistä" },
        { v: "wrong", label: "Tuntui väärältä" },
      ],
    },
    comment: { label: "Mikä vastauksessa ratkaisi? (vapaaehtoinen)", placeholder: "" },
  },
  {
    id: "RECOVERY_VALUE",
    kind: "contextual",
    requires: (s) => s.recovered,
    title: "Palautuminen",
    choice: {
      question: "Teitkö palautumisen uudelleen — vai jäikö se yhteen kertaan?",
      options: [
        { v: "repeat", label: "Tein uudelleen" },
        { v: "once", label: "Jäi yhteen kertaan" },
        { v: "forgot", label: "Unohdin että se on siellä" },
      ],
    },
  },
  {
    // Answers the brief's question about personalisation directly, and only
    // once there is enough behind them for the question to mean anything.
    id: "FEELS_PERSONAL",
    kind: "contextual",
    requires: (s) => s.trained && s.checkedIn,
    title: "Yksi kysymys",
    scale: {
      question: "Tuntuuko Whealth tehdyltä juuri sinulle?",
      low: "Geneeriseltä",
      high: "Kuin minulle tehty",
    },
    comment: { label: "Mistä se tuntuu siltä? (vapaaehtoinen)", placeholder: "" },
  },
];

export const PILOT_PROMPTS: PilotPrompt[] = [...CHECKPOINTS, ...CONTEXTUAL];

export const promptById = (id: string): PilotPrompt | undefined =>
  PILOT_PROMPTS.find((p) => p.id === id);

/** The always-available door. Not in the catalogue: never triggered, only chosen. */
export const FREEFORM_PROMPT_ID = "FREEFORM";

export const FREEFORM_KINDS: PilotOption[] = [
  { v: "bug", label: "Jokin on rikki" },
  { v: "confusing", label: "Jokin on sekavaa" },
  { v: "idea", label: "Idea tai toive" },
  { v: "other", label: "Muuta" },
];

export const FREEFORM_COPY = {
  title: "Kerro meille",
  question: "Mistä on kyse?",
  commentLabel: "Kerro omin sanoin",
  // Said plainly, because we cannot enforce it technically and a pilot tester
  // writing into a box has no way of knowing where the text goes.
  placeholder: "Mitä tapahtui tai mitä toivoisit? Älä kirjoita tähän terveystietoja.",
  submit: "Lähetä",
  sent: "Kiitos — luemme tämän.",
};
