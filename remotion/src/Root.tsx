import { Composition } from "remotion";
import { FlameLoop } from "./FlameLoop";

// 3-second perfectly loopable flame at 30fps, square so it fits inline circles
// and big streak panels alike.
export const RemotionRoot = () => (
  <Composition
    id="flame"
    component={FlameLoop}
    durationInFrames={90}
    fps={30}
    width={512}
    height={512}
  />
);
