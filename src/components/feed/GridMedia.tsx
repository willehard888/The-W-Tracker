import { Play } from "lucide-react";
import AppImage from "@/components/ui/app-image";
import { useSignedMediaUrl } from "@/lib/signed-url";

/**
 * One media-grid tile (profile post grids). Private-bucket media resolves
 * through signed URLs — images inside AppImage, videos via the hook here
 * (<video> has no signing wrapper). Anon viewers never reach this: RLS
 * returns no posts without a session.
 */
const GridMedia = ({ src, isVideo, alt }: { src: string; isVideo: boolean; alt: string }) => {
  const signedVideo = useSignedMediaUrl(isVideo ? src : null);
  if (isVideo) {
    return (
      <>
        {signedVideo && (
          <video
            // #t=0.1 seeks the browser to 0.1s so it decodes and paints that
            // frame as a poster — preload="metadata" alone leaves the tile
            // black since these grid videos never play. Fragment doesn't touch
            // the signed query string.
            src={`${signedVideo}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <span className="absolute top-1.5 right-1.5">
          <Play aria-hidden size={14} className="text-foreground drop-shadow-lg" fill="currentColor" />
        </span>
      </>
    );
  }
  return (
    <AppImage
      src={src}
      width={320}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
};

export default GridMedia;
