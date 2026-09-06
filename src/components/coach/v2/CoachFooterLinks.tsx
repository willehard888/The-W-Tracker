import { useNavigate } from "react-router-dom";
import { Target, Moon, BarChart3 } from "lucide-react";
import { DoorRow } from "@/components/coach/rows";

/**
 * The Coach landing's doors, as type-only hairline rows. Trainer profile +
 * Coach memory live in the PageBar menu, so only the doors with no other
 * home sit here.
 */
const CoachFooterLinks = () => {
  const navigate = useNavigate();
  const links = [
    { icon: Target, label: "Long-term goal", path: "/coach/goal" },
    { icon: Moon, label: "Evening reflection", path: "/coach/reflect" },
    { icon: BarChart3, label: "Weekly review", path: "/coach/progress" },
  ];

  return (
    <div className="divide-y divide-border/35 border-t border-border/35">
      {links.map((l) => (
        <DoorRow key={l.path} icon={l.icon} label={l.label} onClick={() => navigate(l.path)} />
      ))}
    </div>
  );
};

export default CoachFooterLinks;
