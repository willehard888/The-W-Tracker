import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface XpPopProps {
  amount: number;
  trigger: boolean;
  className?: string;
}

const XpPop = ({ amount, trigger, className }: XpPopProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger || amount <= 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 1000);
    return () => clearTimeout(t);
  }, [trigger, amount]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "absolute pointer-events-none z-30 font-display font-black text-gold text-sm",
        className
      )}
      style={{
        animation: "xp-pop 1s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      +{amount} XP
    </div>
  );
};

export default XpPop;
