import { Image as ImageIcon, Video as VideoIcon, Send, Loader2, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
}: TribeComposerProps) => (
  <div className="mb-4 rounded-2xl p-3 border border-[hsl(18_95%_58%)]/25 bg-card/70">
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
      <div className="relative mt-2 rounded-xl overflow-hidden">
        <img loading="lazy" decoding="async" src={imagePreview} alt="Preview" className="w-full max-h-56 object-cover" />
        <button onClick={onClearImage}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80">
          <X size={14} />
        </button>
      </div>
    )}

    {/* Video preview */}
    {videoPreview && (
      <div className="relative mt-2 rounded-xl overflow-hidden bg-black">
        <video src={videoPreview} controls className="w-full max-h-56 object-contain" />
        <button onClick={onClearVideo}
          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center text-xs hover:bg-black/80">
          <X size={14} />
        </button>
      </div>
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
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={posting || hasVideo}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[hsl(18_95%_58%)] hover:bg-[hsl(18_95%_58%)]/10 transition-colors disabled:opacity-40"
          aria-label="Add image"
        >
          <ImageIcon size={16} />
        </button>
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={posting || hasImage}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[hsl(18_95%_58%)] hover:bg-[hsl(18_95%_58%)]/10 transition-colors disabled:opacity-40"
          aria-label="Add video"
        >
          <VideoIcon size={16} />
        </button>
        <span className="text-[10px] text-muted-foreground ml-1">{value.length}/500</span>
      </div>
      <Button
        onClick={onPost}
        size="sm"
        disabled={posting || (!value.trim() && !hasImage && !hasVideo)}
        className="bg-gradient-to-r from-[hsl(18_95%_58%)] to-gold text-background font-bold"
      >
        {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Post
      </Button>
    </div>
  </div>
);

export default TribeComposer;
