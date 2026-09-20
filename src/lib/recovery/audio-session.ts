// The native audio session, for the one screen that speaks.
//
// Two things the web view cannot do on its own: keep playing when the screen
// locks, and be heard when the ring switch is off. Both come from an
// AVAudioSession in the `.playback` category, which the app claims while a
// guided session runs and gives back when it ends — leaving the rest of the
// app (feed video, the recovery chime) exactly as it was.
import { registerPlugin, Capacitor } from "@capacitor/core";

interface RecoveryAudioPlugin {
  activate(): Promise<void>;
  deactivate(): Promise<void>;
}

const plugin = registerPlugin<RecoveryAudioPlugin>("RecoveryAudio");

const native = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("RecoveryAudio");

/** Claim playback. Failure is silent: the voice still plays, just not locked. */
export const holdAudioSession = async (): Promise<void> => {
  if (!native()) return;
  await plugin.activate().catch(() => {});
};

export const releaseAudioSession = async (): Promise<void> => {
  if (!native()) return;
  await plugin.deactivate().catch(() => {});
};
