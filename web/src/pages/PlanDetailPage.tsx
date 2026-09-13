import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  usePlans,
  usePlan,
  useTrips,
  useTrip,
  useMyBadges,
  useTaskStates,
} from "@/hooks/useApi";
import { createTrip, checkinTrip } from "@/api/client";
import { tripContent } from "@/utils/content";
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
    await checkinTrip(trip.id);
    await Promise.all([mutateTrips(), detail.mutate(), badges.mutate()]);
    setCheckedIn(true);
  };

  return (
    <div className="bg-paper">
      <section className="text-center pt-3">
        <div
          className="mx-auto max-w-[620px]"
          dangerouslySetInnerHTML={{ __html: sceneSVG(plan.theme, plan.mom) }}
        />
        <h1 className="text-3xl font-bold mt-2">
          {plan.emoji} {plan.title}
        </h1>
        <div className="flex justify-center gap-2 mt-2 flex-wrap">
          <span className={`badge ${typeClass}`}>{plan.type}</span>
          <span className="badge">{plan.date}</span>
          <span className="badge">{plan.location}</span>
          {plan.mom && <span className="badge badge-mom">👩 妈妈同行</span>}
          {trip?.status === "done" && (
            <span className="badge badge-done">✅ 已打卡</span>
          )}
        </div>
      </section>

      <SectionNav />

      <div className="max-w-[1560px] mx-auto px-4 py-6 flex gap-6">
        {allPlans && (
          <DetailRail
            plans={allPlans.filter((p) => !p.archived)}
            currentId={plan.id}
          />
        )}

        <div className="flex-1 min-w-0 space-y-8">
          <section id="goal" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
              本周目标
            </h2>
            <p className="text-lg mb-4">{plan.goal}</p>
            {plan.tips && plan.tips.length > 0 && (
              <div className="bg-sky/20 rounded-xl p-4">
                <h3 className="font-bold mb-2">爸爸的小抄</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {plan.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {plan.tasks && plan.tasks.length > 0 && (
            <section id="tasks" className="bg-card rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
                小勇士任务
              </h2>
              {trip ? (
                <PersistedChecklist
                  key={`tasks-${trip.id}`}
                  tripId={trip.id}
                  items={plan.tasks}
                  kind="tasks"
                />
              ) : (
                <div>
                  <ul>
                    {plan.tasks.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-muted">创建出行计划后开启任务清单。</p>
                </div>
              )}
            </section>
          )}

          <section id="itinerary" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
              行程安排
            </h2>
            <ItineraryTimeline
              items={plan.itinerary as ItineraryItem[] | ItineraryItem[][]}
              dayNames={plan.day_names as string[] | undefined}
            />
          </section>

          <section id="route" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
              路线
            </h2>
            <div className="space-y-4">
              <RouteMaps plan={plan} />
            </div>
          </section>

          <section id="gear" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
              本周必带装备
            </h2>
            {plan.gear &&
              (trip ? (
                <PersistedChecklist
                  key={`gear-${trip.id}`}
                  tripId={trip.id}
                  items={[
                    ...(plan.gear.base || []),
                    ...(plan.gear.special || []),
                  ]}
                  kind="gear"
                />
              ) : (
                <div>
                  <ul>
                    {[
                      ...(plan.gear.base || []),
                      ...(plan.gear.special || []),
                    ].map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-muted">创建出行计划后开启装备清单。</p>
                </div>
              ))}
          </section>

          <section id="safety" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
              安全要点
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              {plan.safety?.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </section>

          <section id="review" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">
              回顾
            </h2>
            <ul className="list-disc pl-5 space-y-2">
              {plan.review?.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </section>

          <section className="bg-card rounded-2xl p-6 shadow-sm">
            {trip ? (
              <CheckinButton
                key={trip.id}
                done={trip.status === "done"}
                onCheckin={handleCheckin}
              />
            ) : (
              <button
                onClick={handleCreateTrip}
                disabled={creating}
                className="w-full py-4 rounded-2xl bg-sky text-white font-bold disabled:opacity-60"
              >
                {creating ? "创建中…" : "创建本次出行计划"}
              </button>
            )}
            {actionError && <p role="alert">{actionError}</p>}
            {checkedIn && (
              <div className="mt-4 p-4 bg-sun/20 rounded-xl text-center font-bold text-ink">
                <div role="status" className="badge-celebration">
                  {allTasksChecked ? "🌟 满星通关！" : "🎉 打卡成功！"}
                  <p>
                    {plan.badge?.icon} {plan.badge?.name}
                  </p>
                  <Link to="/?panel=badges">去看看徽章墙 →</Link>
                  <button className="ml-4" onClick={() => setCheckedIn(false)}>
                    继续看计划
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
