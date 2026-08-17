import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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

const CoachMemoryScreen = () => {
  const navigate = useNavigate();
  const { memories, isLoading, add, remove } = useCoachMemory();
  const [draft, setDraft] = useState("");

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 page-header-premium px-4 pt-3 pb-2 flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Go back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-[hsl(var(--gold)/0.12)] flex items-center justify-center">
            <Brain size={14} className="text-gold" />
          </div>
          <h1 className="font-display text-base font-black">Coach memory</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 space-y-3">
        <p className="text-xs text-muted-foreground">
          Facts the Coach remembers about you. Capped at 30. Edit, delete, or add anything you want it to know.
        </p>

        <div className="surface-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-gold" />
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gold">Add a fact</p>
          </div>
          <div className="flex gap-2">
            <Input value={draft} onChange={e => setDraft(e.target.value.slice(0, 200))}
              placeholder="e.g. I race a 10k in October" />
            <Button variant="ember" size="icon-sm" aria-label="Add fact" disabled={!draft.trim()}
              onClick={async () => {
                try {
                  const id = await add(draft.trim());
                  if (!id) toast.info("Already remembered");
                  else { toast.success("Locked in"); hapticImpact("light"); }
                  setDraft("");
                } catch (e: any) { toast.error(friendlyError(e, "Failed")); }
              }}>
              <Plus size={16} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : memories.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="No memories yet"
            description="Chat with the Coach — it learns about you automatically and stores the highlights here."
          />
        ) : (
          <AnimatePresence initial={false}>
            {memories.map(m => (
              <motion.div key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="rounded-2xl border border-border/30 bg-card/40 px-4 py-3 flex items-start gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">{m.fact}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {SOURCE_LABEL[m.source] ?? m.source} · {new Date(m.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm"
                  onClick={async () => { await remove(m.id); hapticImpact("light"); }}
                  aria-label="Forget">
                  <Trash2 size={14} className="text-muted-foreground" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default CoachMemoryScreen;
