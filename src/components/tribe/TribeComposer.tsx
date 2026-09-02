import { Image as ImageIcon, Video as VideoIcon, Send, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import MediaPreview from "@/components/media/MediaPreview";

export interface TribeComposerProps {
  value: string;
  onChange: (v: string) => void;
  imagePreview: string | null;
  videoPreview: string | null;
  onClearImage: () => void;
  onClearVideo: () => void;
  fileRef: React.RefObject<HTMLInputElement>;
  videoInputRef: React.RefObject<HTMLInputElement>;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVideoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  posting: boolean;
  hasImage: boolean;
  hasVideo: boolean;
  onPost: () => void;
  progressLabel?: string | null;
}

/**
 * Tribe post composer (text + image/video with previews). Extracted verbatim
 * from TribeDetail.tsx; all state and upload handlers stay owned by the parent.
 */
const TribeComposer = ({
  value,
  onChange,
  imagePreview,
  videoPreview,
  onClearImage,
  onClearVideo,
  fileRef,
  videoInputRef,
  onImageSelect,
  onVideoSelect,
  posting,
  hasImage,
  hasVideo,
  onPost,
  progressLabel,
}: TribeComposerProps) => (
  <div className="mb-4 rounded-2xl p-3 border border-[hsl(var(--ember))]/25 bg-card/70">
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Share with your tribe…"
      rows={3}
      maxLength={500}
      className="border-0 bg-transparent focus-visible:ring-0 resize-none"
    />

    {/* Image preview */}
    {imagePreview && (
      <MediaPreview imageSrc={imagePreview} progressLabel={progressLabel} onClear={onClearImage} />
    )}

    {/* Video preview */}
    {videoPreview && (
      <MediaPreview videoSrc={videoPreview} progressLabel={progressLabel} onClear={onClearVideo} />
    )}

    <div className="flex items-center justify-between mt-2">
      <div className="flex items-center gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          hidden
          onChange={onImageSelect}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          hidden
          onChange={onVideoSelect}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground before:absolute before:-inset-2 before:content-['']"
          disabled={posting || hasVideo}
          onClick={() => fileRef.current?.click()}
          aria-label="Add image"
        >
          <ImageIcon size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground before:absolute before:-inset-2 before:content-['']"
          disabled={posting || hasImage}
          onClick={() => videoInputRef.current?.click()}
          aria-label="Add video"
        >
          <VideoIcon size={16} />
        </Button>
        <span className="text-[11px] text-muted-foreground ml-1">{value.length}/500</span>
      </div>
      {/* This className used to repaint the button with a flat left-to-right
          gradient, overriding PRIMARY_EMBER's machined bezel on the one shared
          Button in this file. Dropping the override is the whole fix. */}
      <Button
        variant="ember"
        size="sm"
        loading={posting}
        disabled={!value.trim() && !hasImage && !hasVideo}
        onClick={onPost}
      >
        <Send size={14} /> Post
      </Button>
    </div>
  </div>
);

export default TribeComposer;
