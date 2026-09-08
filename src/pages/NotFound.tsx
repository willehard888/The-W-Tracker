import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm home-rise">
        <h1 className="font-display font-black text-[27px] leading-[1.04] tracking-tight">There's nothing here.</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          That link doesn't lead anywhere. Today is one tap away.
        </p>
        <Button variant="ember" size="xl" className="mt-6 w-full" onClick={() => navigate("/", { replace: true })}>
          Back to Today
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
