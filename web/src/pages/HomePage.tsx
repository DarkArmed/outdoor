import { useSearchParams } from "react-router-dom";
import { ArchiveGrid } from "@/components/ArchiveGrid";
import { SafetyBanner } from "@/components/SafetyBanner";
import { BadgeWall, FootprintMap } from "@/components/Achievements";
import { usePlans, useProfile } from "@/hooks/useApi";
import { PlanCard } from "@/components/PlanCard";
import { MonthRail } from "@/components/MonthRail";
import { BadgeDrawer } from "@/components/BadgeDrawer";
import { sceneSVG } from "@/svg/scenes";
import {
  groupPlansByMonth,
  heroSubtitle,
  MONTHS,
  siteTitle,
} from "@/utils/date";

export function HomePage() {
  const { data: plans, error, isLoading } = usePlans();
  const { data: profile } = useProfile();
  const [params, setParams] = useSearchParams();
  const panel = params.get("panel") === "footprint" ? "footprint" : "badges";
  const drawerOpen = ["badges", "footprint"].includes(
    params.get("panel") || "",
  );
  const openDrawer = (value: "badges" | "footprint") =>
    setParams((p) => {
      p.set("panel", value);
      return p;
    });
  const closeDrawer = () =>
    setParams((p) => {
      p.delete("panel");
      return p;
    });
  if (isLoading) return <div className="p-8 text-center">加载中…</div>;
  if (error) return <div className="p-8 text-center text-coral">加载失败</div>;

  const activePlans = plans?.filter((p) => !p.archived) || [];
  const grouped = groupPlansByMonth(activePlans);
  const child = profile?.child as
    { name?: string; birthYear?: number } | undefined;
  const age = child?.birthYear
    ? new Date().getFullYear() - child.birthYear
    : null;

  const scrollToMonth = (key: string) => {
    const el = document.getElementById(`month-${key}`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="bg-paper">
      {/* Hero */}
      <section className="text-center pt-4 pb-1 bg-gradient-to-b from-sky to-paper">
        <div
          className="mx-auto max-w-[560px]"
          dangerouslySetInnerHTML={{ __html: sceneSVG("hero", false) }}
        />
        <h1 className="mt-3 text-4xl font-bold text-ink drop-shadow-[2px_2px_0_#FFD93D]">
          {siteTitle(child?.name)}
        </h1>
        <p className="text-lg text-gray-700 mt-1">
          {heroSubtitle(
            child?.name,
            age,
            profile?.home_city,
            profile?.family_travelers?.[0],
          )}
        </p>
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={() => openDrawer("badges")}
            className="bg-white/80 hover:bg-white px-4 py-2 rounded-full font-bold shadow-sm"
          >
            🏅 徽章墙
          </button>
          <button
            onClick={() => openDrawer("footprint")}
            className="bg-white/80 hover:bg-white px-4 py-2 rounded-full font-bold shadow-sm"
          >
            🗺️ 足迹地图
          </button>
        </div>
      </section>

      {/* Main */}
      <div className="max-w-[1560px] mx-auto px-4 pb-12 flex gap-6">
        <MonthRail onSelect={scrollToMonth} />

        <div className="flex-1 min-w-0 space-y-8">
          {MONTHS.map((m) => (
            <section key={m.key} id={`month-${m.key}`} className="scroll-mt-4">
              <h2 className="text-2xl font-bold mb-4 pl-3 border-l-[8px] border-sun rounded">
                {m.label} · {m.desc}
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4">
                {grouped[m.key].map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>
            </section>
          ))}

          <ArchiveGrid plans={plans || []} />
          <SafetyBanner />
        </div>
      </div>

      <BadgeDrawer
        open={drawerOpen}
        panel={panel}
        onClose={closeDrawer}
        onPanelChange={openDrawer}
        badges={<BadgeWall />}
        footprint={<FootprintMap />}
      />
    </div>
  );
}
