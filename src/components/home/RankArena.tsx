import SegmentedTabs from "@/components/home/SegmentedTabs";
import DailyStatusPulse from "@/components/DailyStatusPulse";
import RankPressureCard from "@/components/RankPressureCard";
import LiveRivals from "@/components/LiveRivals";

interface RankArenaProps {
  userId: string;
  tier: string;
  rank: number | null;
  totalUsers: number;
  percentile: number;
  hasRank: boolean;
  rankScore?: number;
  daysAtTier?: number;
  className?: string;
}

const RankArena = ({
  userId,
  tier,
  rank,
  totalUsers,
  percentile,
  hasRank,
  rankScore,
  daysAtTier,
  className,
}: RankArenaProps) => {
  return (
    <SegmentedTabs
      title="Rank Arena"
      titleAccent="hsl(var(--gold))"
      className={className}
      tabs={[
        {
          id: "today",
          label: "Today",
          content: (
            <DailyStatusPulse
              userId={userId}
              rank={rank ?? 0}
              score={rankScore ?? 0}
              totalUsers={totalUsers}
            />
          ),
        },
        {
          id: "pressure",
          label: "Pressure",
          content: (
            <RankPressureCard
              tier={tier}
              rank={rank}
              totalUsers={totalUsers}
              percentile={percentile}
              hasRank={hasRank}
              rankScore={rankScore}
              daysAtTier={daysAtTier}
            />
          ),
        },
        {
          id: "rivals",
          label: "Rivals",
          content: <LiveRivals userId={userId} myScore={rankScore ?? 0} />,
        },
      ]}
    />
  );
};

export default RankArena;
