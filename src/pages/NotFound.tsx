import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6 text-center">
      <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center mb-6">
        <span className="text-4xl">🔍</span>
      </div>
      <h1 className="font-display text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Button variant="gold-outline" onClick={() => navigate("/")}>
        <ArrowLeft size={14} />
        Back to Dashboard
      </Button>
    </div>
  );
};

export default NotFound;
