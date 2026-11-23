import { Composition } from "remotion";
import { KinSplash, SPLASH_FRAMES, SPLASH_FPS } from "./KinSplash";

export const Root = () => (
  <>
    {/* Phone splash, portrait. */}
    <Composition
      id="KinSplash"
      component={KinSplash}
      durationInFrames={SPLASH_FRAMES}
      fps={SPLASH_FPS}
      width={1080}
      height={1920}
    />
    {/* Same motion on a square canvas, for the web and social posts. */}
    <Composition
      id="KinSplashSquare"
      component={KinSplash}
      durationInFrames={SPLASH_FRAMES}
      fps={SPLASH_FPS}
      width={1080}
      height={1080}
    />
  </>
);
