import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  badge?: ReactNode;
  content: ReactNode;
}

interface SegmentedTabsProps {
  tabs: TabItem[];
  defaultTabId?: string;
  className?: string;
  /** Title shown above the tab strip (optional) */
  title?: string;
  titleAccent?: string;
}

const SegmentedTabs = ({
  tabs,
  defaultTabId,
  className,
  title,
  titleAccent,
}: SegmentedTabsProps) => {
  const [active, setActive] = useState(defaultTabId || tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <div className={cn("rounded-2xl glass-card-gold p-3.5 relative overflow-hidden", className)}>
      {title && (
        <div className="flex items-center gap-2 mb-3 px-0.5">
          <span
            className="h-[3px] w-[3px] rounded-full"
            style={{ background: titleAccent || "hsl(var(--muted-foreground))", boxShadow: `0 0 8px ${titleAccent || "hsl(var(--muted-foreground))"}` }}
          />
          <p
            className="text-[10px] font-black uppercase tracking-[0.22em]"
            style={{ color: titleAccent || "hsl(var(--muted-foreground))" }}
          >
            {title}
          </p>
          <span
            className="flex-1 h-px"
            style={{
              background: `linear-gradient(to right, ${titleAccent || "hsl(var(--border))"}33, transparent)`,
            }}
          />
        </div>
      )}
      <div className="segmented-tabs-wrap mb-3.5">
        <div className="flex gap-0.5 p-[3px] rounded-full bg-[hsl(255_14%_8%)] border border-border/40 shadow-[inset_0_1px_2px_hsl(0_0%_0%/0.4)]">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={cn(
                  "flex-1 text-[10px] font-black uppercase tracking-[0.22em] py-1.5 px-1 rounded-full transition-all duration-300 relative",
                  isActive
                    ? "bg-gradient-to-b from-[hsl(42_88%_62%)] to-[hsl(42_78%_48%)] text-[hsl(260_18%_4%)] shadow-[0_2px_8px_-1px_hsl(var(--gold)/0.55),inset_0_1px_0_hsl(42_95%_75%/0.6)]"
                    : "text-muted-foreground/70 hover:text-foreground/90",
                )}
              >
                <span className="inline-flex items-center gap-1.5 justify-center">
                  {t.label}
                  {t.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative">{activeTab?.content}</div>
    </div>
  );
};

export default SegmentedTabs;
