# 临时诊断：打开单篇笔记页，检查 __INITIAL_STATE__ 与 DOM 结构
from playwright.sync_api import sync_playwright
from sources.xhs import COOKIE_PATH, BROWSER_UA

pw = sync_playwright().start()
browser = pw.chromium.launch(headless=False)
ctx = browser.new_context(user_agent=BROWSER_UA, viewport={"width": 1280, "height": 900},
                          locale="zh-CN", storage_state=str(COOKIE_PATH))
page = ctx.new_page()
page.goto("https://www.xiaohongshu.com/explore/6a853d9d00000000280316a7",
          wait_until="domcontentloaded", timeout=30_000)
page.wait_for_timeout(5_000)
print("URL:", page.url)
probe = page.evaluate("""() => {
  const s = window.__INITIAL_STATE__;
  const out = {hasState: !!s};
  if (s) {
    out.noteKeys = s.note ? Object.keys(s.note) : null;
    const map = s.note && s.note.noteDetailMap;
    out.mapKeys = map ? Object.keys(map) : null;
    if (map) {
      const k = Object.keys(map)[0];
      const d = map[k];
      out.firstKey = k;
      out.hasNote = !!(d && d.note);
      if (d && d.note) out.noteFieldKeys = Object.keys(d.note).slice(0, 30);
    }
  }
  out.titleEl = !!document.querySelector('#detail-title, .title');
  out.descEl = !!document.querySelector('#detail-desc, .desc .note-text, .note-text');
  out.imgCount = document.querySelectorAll('img').length;
  return out;
}""")
print(probe)
page.screenshot(path="xhs_diag2.png", full_page=False)
browser.close()
pw.stop()
