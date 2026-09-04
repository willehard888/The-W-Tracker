import type { ReactNode } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * One meal slot as a SECTION, not a card: a diary is read as a whole day, and
 * a segmented control would hide three quarters of it. Header carries the
 * slot's kcal and the two actions; items render as hairline rows below.
 * `xs` buttons sit under the 44 pt floor, so both get the house hit-area
 * expansion (`before:-inset-2`).
 */
const DiarySlot = ({
  label,
  kcal,
  onAdd,
  onCopyYesterday,
  onClear,
  hasItems,
  children,
  className,
}: {
  label: string;
  kcal: number;
  onAdd: () => void;
  onCopyYesterday?: () => void;
  onClear?: () => void;
  hasItems: boolean;
  children?: ReactNode;
  className?: string;
}) => (
  <section aria-label={label} className={cn("pt-4", className)}>
    <div className="flex items-center gap-2 min-h-11">
      <h2 className="text-[13px] font-bold">{label}</h2>
      <span className="text-[12px] tabular-nums text-muted-foreground">
        {hasItems ? `${Math.round(kcal)} kcal` : ""}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={onAdd}
          className="relative before:absolute before:-inset-2 before:content-[''] text-foreground/80"
        >
          <Plus aria-hidden /> Add
        </Button>
        {(onCopyYesterday || onClear) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`${label} options`}
                className="relative before:absolute before:-inset-2 before:content-[''] text-muted-foreground"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCopyYesterday && (
                <DropdownMenuItem onSelect={onCopyYesterday}>Copy yesterday's {label.toLowerCase()}</DropdownMenuItem>
              )}
              {onClear && hasItems && (
                <DropdownMenuItem onSelect={onClear} className="text-destructive">
                  Clear {label.toLowerCase()}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
    {hasItems ? (
      <div className="divide-y divide-border/35">{children}</div>
    ) : (
      <button
        type="button"
        onClick={onAdd}
        className="w-full min-h-11 text-left text-[13px] text-muted-foreground/80 active:opacity-70"
      >
        Nothing logged
      </button>
    )}
  </section>
);

export default DiarySlot;
