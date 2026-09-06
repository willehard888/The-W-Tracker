import { fmtDate } from "@/lib/format";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageBar from "@/components/ui/page-bar";
import { Input } from "@/components/ui/input";
import EmptyState from "@/components/ui/empty-state";
import { useCoachMemory } from "@/hooks/use-coach-memory";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { hapticImpact } from "@/lib/haptics";
import { friendlyError } from "@/lib/error-copy";

const SOURCE_LABEL: Record<string, string> = {
  chat: "From chat",
  reflection: "From reflection",
  manual: "You added",
  system: "System",
};

/** /coach/memory — the facts the Coach carries. A composer, then hairline rows. */
const CoachMemoryScreen = () => {
  const navigate = useNavigate();
  const { memories, isLoading, add, remove } = useCoachMemory();
  const [draft, setDraft] = useState("");

  const addFact = async () => {
    const fact = draft.trim();
    if (!fact) return;
    try {
      const id = await add(fact);
      if (!id) toast.info("Already remembered");
      else { toast.success("Locked in"); hapticImpact("light"); }
      setDraft("");
    } catch (e: any) { toast.error(friendlyError(e, "Failed")); }
  };

  return (
    <div className="min-h-full">
      <PageBar title="Coach memory" onBack={() => navigate(-1)} />

      <div className="px-4 pt-4 pb-6">
        <header className="home-rise">
          <h2 className="font-display font-black text-[22px] leading-[1.06] tracking-tight">What the Coach knows about you.</h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-snug">
            Capped at 30. Add anything it should know; forget anything it shouldn't.
          </p>
        </header>

        <div className="home-rise home-rise-1 mt-4 flex items-center gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 200))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addFact(); } }}
            placeholder="e.g. I race a 10k in October"
            enterKeyHint="done"
            className="h-11 rounded-xl"
          />
          <Button variant="ember" size="icon" className="h-11 w-11 min-h-11 shrink-0 rounded-xl" aria-label="Add fact" disabled={!draft.trim()} onClick={addFact}>
            <Plus size={16} />
          </Button>
        </div>

        <div className="home-rise home-rise-2 mt-4">
          {isLoading ? (
            <p className="text-[12px] text-muted-foreground">Loading…</p>
          ) : memories.length === 0 ? (
            <EmptyState
              icon={Brain}
              title="No memories yet"
              description="Chat with the Coach — it learns about you automatically and stores the highlights here."
            />
          ) : (
            <div className="divide-y divide-border/35 border-t border-border/35">
              <AnimatePresence initial={false}>
                {memories.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    className="py-3 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] leading-relaxed">{m.fact}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {SOURCE_LABEL[m.source] ?? m.source} · {fmtDate(m.created_at)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="-mr-2 -mt-1 shrink-0"
                      onClick={async () => { await remove(m.id); hapticImpact("light"); }}
                      aria-label="Forget"
                    >
                      <Trash2 size={14} className="text-muted-foreground" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoachMemoryScreen;
