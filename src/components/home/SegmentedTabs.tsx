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
    <div className={cn("rounded-2xl glass-card-gold p-3 relative overflow-hidden", className)}>
      {title && (
        <p
          className="text-[10px] font-black uppercase tracking-[0.22em] mb-2 px-1"
          style={{ color: titleAccent || "hsl(var(--muted-foreground))" }}
        >
          {title}
        </p>
      )}
      <div className="segmented-tabs-wrap mb-3">
        <div className="flex gap-1 p-1 rounded-xl bg-secondary/60 border border-border/60">
          {tabs.map((t) => {
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={cn(
                  "flex-1 text-[11px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-all relative",
                  isActive
                    ? "bg-gradient-to-br from-gold/90 to-gold-dark text-primary-foreground shadow-[0_2px_10px_-2px_hsl(42_78%_54%/0.6)]"
                    : "text-muted-foreground hover:text-foreground",
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
