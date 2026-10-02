import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Target, Moon, BarChart3, Mail } from "lucide-react";
import { DoorRow } from "@/components/coach/rows";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * The Coach landing's doors, as type-only hairline rows. Trainer profile +
 * Coach memory live in the PageBar menu, so only the doors with no other
 * home sit here. The weekly letter's door appears once a letter exists —
 * it had no door at all after the old Home card left.
 */
const CoachFooterLinks = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: letter } = useQuery({
    queryKey: ["weekly-briefing-latest", user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_briefings")
        .select("id, headline, viewed_at")
        .eq("user_id", user!.id)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });
  const links = [
    { icon: Target, label: "North Star goal", sub: undefined as string | undefined, path: "/coach/goal" },
    { icon: Moon, label: "Evening reflection", sub: undefined, path: "/coach/reflect" },
    { icon: BarChart3, label: "Weekly review", sub: undefined, path: "/coach/progress" },
    ...(letter ? [{ icon: Mail, label: "Weekly letter", sub: letter.headline, path: `/briefing/${letter.id}` }] : []),
  ];

  return (
    <div className="divide-y divide-border/35 border-t border-border/35">
      {links.map((l) => (
        <DoorRow key={l.path} icon={l.icon} label={l.label} sub={l.sub} onClick={() => navigate(l.path)} />
      ))}
    </div>
  );
};

export default CoachFooterLinks;
