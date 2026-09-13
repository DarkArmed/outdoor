import { useAuth } from './auth/AuthContext'
import { sceneSVG, actIconSVG } from './svg/scenes'

export default function App() {
  const { user, login, logout } = useAuth()

  if (!user) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">户外大冒险 · T2 验证</h1>
        <p className="mb-4 text-muted">这是前端脚手架与核心模块验证页。T3 页面在另一个分支实现。</p>
        <button
          onClick={() => login('demo@example.com', 'demo123')}
          className="bg-sky text-ink font-bold px-6 py-2 rounded-full"
        >
          登录测试账号
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-6">
        <span className="font-bold">已登录：{user.email}</span>
        <button onClick={logout} className="bg-coral text-white px-4 py-2 rounded-full font-bold">退出</button>
      </header>

      <h2 className="text-xl font-bold mb-4">主题场景验证</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {['water', 'hike', 'camp', 'cycle', 'redleaf', 'snow'].map((theme) => (
          <div key={theme} className="bg-card rounded-2xl overflow-hidden shadow-sm">
            <div dangerouslySetInnerHTML={{ __html: sceneSVG(theme) }} />
            <div className="p-2 text-center font-bold">{theme}</div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold mb-4">活动图标验证</h2>
      <div className="flex flex-wrap gap-2">
        {['出发去徒步', '到浅滩踩水', '野餐', '篝火晚会', '看星星'].map((text) => (
          <div key={text} className="flex items-center gap-2 bg-card px-3 py-2 rounded-full">
            <div className="w-8 h-8" dangerouslySetInnerHTML={{ __html: actIconSVG(text) }} />
            <span className="text-sm">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
