import { cn } from "@/lib/utils";
import { EVIDENCE_META, type EvidenceTier } from "@/lib/wellness-framework";

interface Props {
  evidence: EvidenceTier;
  className?: string;
  size?: "xs" | "sm";
}

const EvidenceChip = ({ evidence, className, size = "xs" }: Props) => {
  const meta = EVIDENCE_META[evidence];
  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex items-center gap-1 font-black tracking-[0.16em] uppercase rounded-md border whitespace-nowrap",
        meta.chip,
        size === "xs" ? "text-[8.5px] px-1 py-px" : "text-[10px] px-1.5 py-0.5",
        className,
      )}
    >
      <span className="h-1 w-1 rounded-full bg-current opacity-80" aria-hidden />
      {meta.label}
    </span>
  );
};

export default EvidenceChip;
