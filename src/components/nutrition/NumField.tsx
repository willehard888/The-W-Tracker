import { cn } from "@/lib/utils";

/**
 * One labelled numeric field for the nutrition forms. Text input with the
 * native decimal/numeric keypad (no custom keypad to maintain); the error
 * sits under the field, never in a toast.
 */
const NumField = ({
  label,
  value,
  onChange,
  unit,
  required,
  error,
  mode = "decimal",
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  required?: boolean;
  error?: string | null;
  mode?: "decimal" | "numeric";
  placeholder?: string;
  className?: string;
}) => (
  <label className={cn("block min-w-0", className)}>
    <span className="flex items-baseline justify-between gap-2">
      <span className="text-[12px] font-bold text-muted-foreground truncate">
        {label}
        {required && <span aria-hidden> *</span>}
      </span>
      {unit && <span className="text-[11px] text-muted-foreground/70 shrink-0">{unit}</span>}
    </span>
    <input
      type="text"
      inputMode={mode}
      enterKeyHint="next"
      value={value}
      placeholder={placeholder}
      aria-required={required}
      aria-invalid={!!error}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "mt-1 w-full surface-inset rounded-xl h-11 px-3 text-[15px] font-bold tabular-nums outline-none focus:border-gold/50 transition-colors",
        error && "border-destructive/60",
      )}
    />
    {error && (
      <span role="alert" className="block text-[11px] text-[hsl(var(--ember))] mt-1 leading-snug">
        {error}
      </span>
    )}
  </label>
);

export default NumField;
