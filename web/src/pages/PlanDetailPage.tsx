import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePlans, usePlan, useTrips, createTrip, checkinTrip } from '@/hooks/useApi'
import { DetailRail } from '@/components/DetailRail'
import { SectionNav } from '@/components/SectionNav'
import { ItineraryTimeline, type ItineraryItem } from '@/components/ItineraryTimeline'
import { GearChecklist } from '@/components/GearChecklist'
import { TaskChecklist } from '@/components/TaskChecklist'
import { DriveMap } from '@/components/DriveMap'
import { HikeMap } from '@/components/HikeMap'
import { sceneSVG } from '@/svg/scenes'
import type { TripDetailOut } from '@/api/types'

function CheckinButton({ trip, allTasksChecked, onCheckin }: { trip: TripDetailOut; allTasksChecked: boolean; onCheckin: () => void }) {
  const [pressing, setPressing] = useState(false)
  const [progress, setProgress] = useState(0)
  const done = trip.status === 'done'

  let timer: ReturnType<typeof setTimeout> | null = null
  let anim: ReturnType<typeof setInterval> | null = null

  const start = () => {
    if (done || !allTasksChecked) return
    setPressing(true)
    setProgress(0)
    const startAt = Date.now()
    anim = setInterval(() => {
      const p = Math.min((Date.now() - startAt) / 2000, 1)
      setProgress(p)
      if (p >= 1) {
        if (anim) clearInterval(anim)
        if (timer) clearTimeout(timer)
        onCheckin()
        setPressing(false)
        setProgress(0)
      }
    }, 50)
    timer = setTimeout(() => {
      if (anim) clearInterval(anim)
    }, 2050)
  }

  const stop = () => {
    if (anim) clearInterval(anim)
    if (timer) clearTimeout(timer)
    setPressing(false)
    setProgress(0)
  }

  if (done) {
    return (
      <button disabled className="w-full py-4 rounded-2xl bg-grass/30 text-grass-dk font-bold cursor-default">
        ✅ 已完成打卡
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={!allTasksChecked}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      className={`relative w-full py-4 rounded-2xl font-bold overflow-hidden transition-colors ${
        allTasksChecked ? 'bg-sun text-ink' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
      }`}
    >
      {pressing && (
        <div
          className="absolute inset-0 bg-coral/40 origin-left"
          style={{ transform: `scaleX(${progress})` }}
        />
      )}
      <span className="relative z-10">
        {allTasksChecked ? '长按 2 秒完成打卡' : '完成全部任务后打卡'}
      </span>
    </button>
  )
}

export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: plan, error, isLoading } = usePlan(id)
  const { data: allPlans } = usePlans()
  const { data: trips, mutate: mutateTrips } = useTrips()
  const [allTasksChecked, setAllTasksChecked] = useState(false)
  const [checkedIn, setCheckedIn] = useState(false)
  const [creating, setCreating] = useState(false)

  const trip = useMemo(() => {
    if (!trips || !id) return undefined
    return trips.find((t) => t.plan_id === id)
  }, [trips, id])

  if (isLoading) return <div className="p-8 text-center">加载中…</div>
  if (error || !plan) return <div className="p-8 text-center text-coral">计划不存在</div>

  const typeClass = `type-${plan.type.charAt(0)}`

  const handleCreateTrip = async () => {
    setCreating(true)
    try {
      await createTrip(plan.id, plan.date)
      await mutateTrips()
    } finally {
      setCreating(false)
    }
  }

  const handleCheckin = async () => {
    if (!trip) return
    try {
      await checkinTrip(trip.id)
      setCheckedIn(true)
      await mutateTrips()
      setTimeout(() => setCheckedIn(false), 5000)
    } catch (e) {
      // ignore; button will re-enable
    }
  }

  return (
    <div className="bg-paper">
      <section className="text-center pt-3">
        <div
          className="mx-auto max-w-[620px]"
          dangerouslySetInnerHTML={{ __html: sceneSVG(plan.theme, plan.mom) }}
        />
        <h1 className="text-3xl font-bold mt-2">{plan.emoji} {plan.title}</h1>
        <div className="flex justify-center gap-2 mt-2 flex-wrap">
          <span className={`badge ${typeClass}`}>{plan.type}</span>
          <span className="badge">{plan.date}</span>
          <span className="badge">{plan.location}</span>
          {plan.mom && <span className="badge badge-mom">👩 妈妈同行</span>}
          {trip?.status === 'done' && <span className="badge badge-done">✅ 已打卡</span>}
        </div>
      </section>

      <SectionNav />

      <div className="max-w-[1560px] mx-auto px-4 py-6 flex gap-6">
        {allPlans && <DetailRail plans={allPlans.filter((p) => !p.archived)} currentId={plan.id} />}

        <div className="flex-1 space-y-8">
          <section id="goal" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">本周目标</h2>
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
              <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">小勇士任务</h2>
              {trip ? (
                <TaskChecklist tripId={trip.id} tasks={plan.tasks} onAllChecked={setAllTasksChecked} />
              ) : (
                <p className="text-muted">创建出行计划后开启任务清单。</p>
              )}
            </section>
          )}

          <section id="itinerary" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">行程安排</h2>
            <ItineraryTimeline items={plan.itinerary as ItineraryItem[] | ItineraryItem[][]} dayNames={plan.day_names as string[] | undefined} />
          </section>

          <section id="route" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">路线</h2>
            <div className="space-y-4">
              <DriveMap tripId={trip?.id} plan={plan as Record<string, unknown>} />
              <HikeMap tripId={trip?.id} plan={plan as Record<string, unknown>} />
            </div>
          </section>

          <section id="gear" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">本周必带装备</h2>
            {plan.gear && (
              trip ? (
                <GearChecklist tripId={trip.id} base={plan.gear.base || []} special={plan.gear.special || []} />
              ) : (
                <p className="text-muted">创建出行计划后开启装备清单。</p>
              )
            )}
          </section>

          <section id="safety" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">安全要点</h2>
            <ul className="list-disc pl-5 space-y-2">
              {plan.safety?.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </section>

          <section id="review" className="bg-card rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-3 border-l-[8px] border-sun pl-3 rounded">回顾</h2>
            <ul className="list-disc pl-5 space-y-2">
              {plan.review?.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </section>

          <section className="bg-card rounded-2xl p-6 shadow-sm">
            {trip ? (
              <CheckinButton trip={trip} allTasksChecked={allTasksChecked} onCheckin={handleCheckin} />
            ) : (
              <button
                onClick={handleCreateTrip}
                disabled={creating}
                className="w-full py-4 rounded-2xl bg-sky text-white font-bold disabled:opacity-60"
              >
                {creating ? '创建中…' : '创建本次出行计划'}
              </button>
            )}
            {checkedIn && (
              <div className="mt-4 p-4 bg-gold/20 rounded-xl text-center font-bold text-ink">
                🎉 打卡成功！徽章将在成就抽屉中展示
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
