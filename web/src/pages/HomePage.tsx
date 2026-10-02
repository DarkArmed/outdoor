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
    <div className="legacy-page">
      <header className="hero">
        <div dangerouslySetInnerHTML={{ __html: sceneSVG("hero", false) }} />
        <h1>🏕️ {siteTitle(child?.name)}</h1>
        <p className="subtitle">
          {heroSubtitle(
            child?.name,
            age,
            profile?.home_city,
            profile?.family_travelers?.[0],
          )}
        </p>
        <nav className="hero-links">
          <button className="hero-link" onClick={() => openDrawer("badges")}>
            🏅 徽章墙
          </button>
          <button className="hero-link" onClick={() => openDrawer("footprint")}>
            🗺️ 足迹地图
          </button>
        </nav>
      </header>
      <div className="home-main">
        <div className="home-layout">
          <MonthRail onSelect={scrollToMonth} />
          <div className="home-content">
            {MONTHS.map((m) => (
              <section className="month-row" key={m.key} id={`month-${m.key}`}>
                <h2>
                  {m.label} · {m.desc}
                </h2>
                <div className="row-scroll">
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
