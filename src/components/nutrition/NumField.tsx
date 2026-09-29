import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

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
      <span className="text-meta font-bold text-muted-foreground truncate">
        {label}
        {required && <span aria-hidden> *</span>}
      </span>
      {unit && <span className="text-label text-muted-foreground/75 shrink-0">{unit}</span>}
    </span>
    <Input
      type="text"
      inputMode={mode}
      enterKeyHint="next"
      value={value}
      placeholder={placeholder}
      aria-required={required}
      aria-invalid={!!error}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 px-3 font-bold tabular-nums"
    />
    {error && (
      <span role="alert" className="block text-label text-[hsl(var(--ember))] mt-1 leading-snug">
        {error}
      </span>
    )}
  </label>
);

export default NumField;
