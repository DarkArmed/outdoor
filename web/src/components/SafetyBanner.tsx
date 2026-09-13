const DEFAULT_RULES = [
  '💦 下水穿救生衣，浅滩不过膝，大人不离眼',
  '🪨 湿石头不踩，滑倒最危险',
  '🧴 帽子防晒霜，水要喝够',
  '🗺️ 离线地图先下好',
  '😊 累了就回家，下次还想来',
]

export function SafetyBanner({ rules = DEFAULT_RULES }: { rules?: readonly string[] }) {
  return (
    <section aria-label="安全口诀" className="bg-safety-bg border-[3px] border-dashed border-coral rounded-[20px] px-6 pt-2 pb-5 mt-10">
      <h2 className="text-2xl font-bold my-4">🛡️ 安全口诀（每次出发前念一遍）</h2>
      <ul>{rules.map((rule, index) => <li key={index} className="py-1 text-lg">{rule}</li>)}</ul>
    </section>
  )
}
