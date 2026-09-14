import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  usePlans,
  usePlan,
  useTrips,
  useTrip,
  useMyBadges,
  useTaskStates,
} from "@/hooks/useApi";
import { createTrip, checkinTrip, fetchMilestones } from "@/api/client";
import { tripContent } from "@/utils/content";
import { BadgeCelebration } from "@/components/BadgeCelebration";
import { CheckinButton } from "@/components/CheckinButton";
import { DetailRail } from "@/components/DetailRail";
import { SectionNav } from "@/components/SectionNav";
import {
  ItineraryTimeline,
  type ItineraryItem,
} from "@/components/ItineraryTimeline";
import { PersistedChecklist } from "@/components/PersistedChecklist";
import { RouteMaps } from "@/components/RouteMaps";
import { sceneSVG } from "@/svg/scenes";

export function PlanDetailPage() {
  const { id } = useParams();
  return <PlanDetail key={id} />;
}

function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: template, error, isLoading } = usePlan(id);
  const { data: allPlans } = usePlans();
  const {
    data: trips,
    error: tripsError,
    isLoading: tripsLoading,
    mutate: mutateTrips,
  } = useTrips();
  const [params, setParams] = useSearchParams();
  const requested = params.get("trip");
  const chosen = requested
    ? trips?.find((t) => t.id === Number(requested) && t.plan_id === id)
    : trips?.filter((t) => t.plan_id === id).sort((a, b) => b.id - a.id)[0];
  const detail = useTrip(chosen?.id);
  const trip = detail.data;
  const badges = useMyBadges();
  const taskStates = useTaskStates(trip?.id);
  const [checkedIn, setCheckedIn] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = contentRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-enter");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.1 },
    );
    root
      .querySelectorAll("section[id], .it-item")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [template, trip]);

  const [newMilestones, setNewMilestones] = useState<
    { icon: string; name: string }[]
  >([]);
  useEffect(() => {
    if (template)
      document.title = `${trip ? tripContent(trip, template).title : template.title} · 户外大冒险`;
    return () => {
      document.title = "户外大冒险";
    };
  }, [template, trip]);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState("");
  if (tripsError) return <p role="alert">出行加载失败，请刷新重试。</p>;
  if (isLoading || tripsLoading)
    return <div className="p-8 text-center">加载中…</div>;
  if (error || !template)
    return <div className="p-8 text-center text-coral">计划不存在</div>;
  if (requested && trips && !chosen)
    return (
      <p role="alert" className="p-8">
        出行不存在或无权访问。
      </p>
    );
  if (chosen && !trip)
    return (
      <p role="status" className="p-8">
        {detail.error ? "出行加载失败，请刷新重试。" : "加载出行…"}
      </p>
    );
  const plan = trip ? tripContent(trip, template) : template;
  const allTasksChecked = Boolean(
    plan.tasks.length &&
    plan.tasks.every((_, i) =>
      taskStates.data?.some((t) => t.task_idx === i && t.checked),
    ),
  );
  const typeClass = `type-${plan.type.charAt(0)}`;

  const handleCreateTrip = async () => {
    setCreating(true);
    try {
      const created = await createTrip({
        plan_id: plan.id,
        planned_date: plan.id.slice(0, 10),
      });
      await mutateTrips();
      setParams({ trip: String(created.id) });
    } catch {
      setActionError("创建失败，请重试。");
    } finally {
      setCreating(false);
    }
  };

  const handleCheckin = async () => {
    if (!trip) return;
    const previous = new Set(badges.data?.map((b) => b.badge_id) || []);
    await checkinTrip(trip.id);
    const [, , unlocked, rules] = await Promise.all([
      mutateTrips(),
      detail.mutate(),
      badges.mutate(),
      fetchMilestones(),
    ]);
    setNewMilestones(
      rules.filter(
        (m) =>
          !previous.has(m.id) && unlocked?.some((b) => b.badge_id === m.id),
      ),
    );
    setCheckedIn(true);
  };

  return (
    <div className="legacy-page detail-layout">
      {allPlans && (
        <DetailRail
          plans={allPlans.filter((p) => !p.archived)}
          currentId={plan.id}
        />
      )}
      <div className="detail-content" ref={contentRef}>
        <section className="detail-hero">
          <div
            dangerouslySetInnerHTML={{ __html: sceneSVG(plan.theme, plan.mom) }}
          />
          <h1>
            {plan.emoji} {plan.title}
          </h1>
          <div className="badges">
            <span className={`badge ${typeClass}`}>{plan.type}</span>
            <span className="badge">🗓️ {plan.date}</span>
            <span className="badge">📍 {plan.location}</span>
            <span className="badge">🚗 {String(plan.drive?.time || "")}</span>
            {plan.mom && <span className="badge badge-mom">👩 妈妈同行</span>}
            {trip?.status === "done" && (
              <span className="badge">✅ 已打卡</span>
            )}
          </div>
        </section>
        <SectionNav hasTasks={plan.tasks.length > 0} />
        <section id="goal">
          <h2>🎯 本周目标</h2>
          <div className="goal-box">{plan.goal}</div>
          {plan.tips?.length > 0 && (
            <div className="tip-box">
              <strong>💡 爸爸的小抄：</strong>
              <ul>
                {plan.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
        {plan.tasks.length > 0 && (
          <section id="tasks">
            <h2>🗡️ 小勇士任务</h2>
            <PersistedChecklist
              key={`tasks-${trip?.id}`}
              tripId={trip?.id}
              items={plan.tasks}
              kind="tasks"
            />
            <p className="muted">全部完成 + 打卡，徽章升级为满星版 🌟</p>
          </section>
        )}
        <section id="itinerary">
          <h2>🕐 行程安排</h2>
          <ItineraryTimeline
            items={plan.itinerary as ItineraryItem[] | ItineraryItem[][]}
            dayNames={plan.day_names}
          />
        </section>
        <section id="route">
          <h2>🗺️ 路线图</h2>
          <RouteMaps plan={plan} />
        </section>
        <section id="gear">
          <h2>🎒 本周必带装备（点一下打勾）</h2>
          <PersistedChecklist
            key={`gear-${trip?.id}`}
            tripId={trip?.id}
            items={[...(plan.gear.base || []), ...(plan.gear.special || [])]}
            baseCount={plan.gear.base?.length || 0}
            kind="gear"
          />
        </section>
        <section id="safety">
          <h2>🛡️ 安全要点</h2>
          <ul className="safety-list">
            {plan.safety.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
        <section id="review">
          <h2>📝 回来以后聊一聊</h2>
          <div className="review-box">
            <ul>
              {plan.review.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </section>
        <section id="checkin">
          {trip ? (
            plan.badge && (
              <CheckinButton
                key={trip.id}
                done={trip.status === "done"}
                badge={{ icon: plan.badge.icon, name: plan.badge.name }}
                onCheckin={handleCheckin}
              />
            )
          ) : (
            <button
              className="checkin-btn"
              disabled={creating}
              onClick={handleCreateTrip}
            >
              {creating ? "创建中…" : "创建本次出行计划"}
            </button>
          )}
          {actionError && <p role="alert">{actionError}</p>}
        </section>
        {checkedIn && plan.badge && (
          <BadgeCelebration
            badge={{ icon: plan.badge.icon, name: plan.badge.name }}
            fullStar={allTasksChecked}
            milestones={newMilestones}
            onClose={() => setCheckedIn(false)}
          />
        )}
      </div>
    </div>
  );
}
