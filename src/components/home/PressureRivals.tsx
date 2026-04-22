import SegmentedTabs from "@/components/home/SegmentedTabs";
import RankPressureCard from "@/components/RankPressureCard";
import LiveRivals from "@/components/LiveRivals";

interface PressureRivalsProps {
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

const PressureRivals = ({
  userId,
  tier,
  rank,
  totalUsers,
  percentile,
  hasRank,
  rankScore,
  daysAtTier,
  className,
}: PressureRivalsProps) => {
  return (
    <SegmentedTabs
      title="Rank Pressure"
      titleAccent="hsl(var(--gold))"
      className={className}
      tabs={[
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

export default PressureRivals;
