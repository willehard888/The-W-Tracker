import { ScanBarcode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * The honest dead end of a barcode scan. Nothing is ever fabricated for an
 * unknown code, and the copy says so — the two exits are the user's own
 * data (create the food) or a name search.
 */
const BarcodeMiss = ({
  barcode,
  onCreate,
  onSearch,
  rateLimited,
}: {
  barcode: string;
  onCreate: () => void;
  onSearch: () => void;
  /** Upstream databases throttled us — the code may exist, try later. */
  rateLimited?: boolean;
}) => (
  <EmptyState
    icon={ScanBarcode}
    title="Not found. Nothing was invented."
    description={
      rateLimited
        ? `The food databases are busy right now. Barcode ${barcode} may exist — try again in a minute, or add it yourself.`
        : `Barcode ${barcode} isn't in our databases yet.`
    }
    action={
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button variant="ember-outline" onClick={onCreate} className="w-full">
          Create food with this barcode
        </Button>
        <Button variant="ghost" onClick={onSearch} className="w-full">
          Search by name
        </Button>
      </div>
    }
  />
);

export default BarcodeMiss;
