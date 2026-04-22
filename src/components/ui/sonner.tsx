import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast surface-glass !rounded-xl !border-0 !text-foreground group-[.toaster]:shadow-[0_8px_28px_-8px_hsl(0_0%_0%/0.55)]",
          title: "!text-display-md !text-foreground",
          description: "!text-body text-fg-muted",
          actionButton:
            "!bg-[hsl(var(--gold))] !text-[hsl(var(--primary-foreground))] !font-semibold",
          cancelButton: "!bg-[hsl(0_0%_100%/0.06)] !text-fg-muted",
          success: "[&_[data-icon]]:text-[hsl(var(--gold))]",
          error: "[&_[data-icon]]:text-[hsl(var(--destructive))]",
          warning: "[&_[data-icon]]:text-[hsl(var(--amber))]",
          info: "[&_[data-icon]]:text-[hsl(var(--teal))]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
