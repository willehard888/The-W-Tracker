// Push copy for 1v1 battle events. The in-app notification row (written by
// tg_battle_notify in SQL) carries the numbers; the push carries one line in
// the product's voice and a route. Kinds not listed here are not battle pushes.

export type BattlePushKind =
  | "battle_challenge"
  | "battle_accepted"
  | "battle_declined"
  | "battle_halfway"
  | "battle_resolved";

export const BATTLE_PUSH_KINDS: BattlePushKind[] = [
  "battle_challenge",
  "battle_accepted",
  "battle_declined",
  "battle_halfway",
  "battle_resolved",
];

export const isBattlePushKind = (kind: string): kind is BattlePushKind =>
  (BATTLE_PUSH_KINDS as string[]).includes(kind);

/** `name` is the actor's handle with the @ ("@mogger888") or "Someone". */
export const battlePushCopy = (kind: BattlePushKind, name: string): { title: string; body: string; data: { route: string } } => {
  switch (kind) {
    case "battle_challenge":
      return { title: "Battle challenge", body: `${name} challenged you. Accept from your notifications.`, data: { route: "/notifications" } };
    case "battle_accepted":
      return { title: "Battle on", body: `${name} accepted. It starts tomorrow.`, data: { route: "/battles" } };
    case "battle_declined":
      return { title: "Challenge declined", body: `${name} passed on this one. Pick another discipline or another friend.`, data: { route: "/battles" } };
    case "battle_halfway":
      return { title: "Halfway", body: `Halfway through your battle with ${name}. The standing is in the arena.`, data: { route: "/battles" } };
    case "battle_resolved":
      return { title: "Battle decided", body: `Your battle with ${name} is decided. See the result.`, data: { route: "/battles" } };
  }
};
