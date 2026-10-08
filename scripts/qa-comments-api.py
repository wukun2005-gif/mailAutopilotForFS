#!/usr/bin/env python3
"""
Data-layer acceptance tests for the deck comment system.

Talks straight to the Supabase REST API with the same anon key the browser
uses, so it tests the contract the front end actually depends on: what may be
written, what comes back, what is refused, and whether concurrent writers lose
anything.

Test data is tagged two ways so it can never be mistaken for a real comment:
  · deck_id  = qa-<run>          → invisible to the deck (the front end filters
                                    on its own deck_id), so nothing shows up for
                                    real readers
  · email    = the owner's own   → by design "your own comment never mails you",
                                    so the run cannot spam the owner's inbox
  · client_id = qa-<run>         → identifies every row this run created

Run:  python3 scripts/qa-comments-api.py
Out:  human-readable PASS/FAIL, plus JSON at /tmp/qa-api-results.json
"""

import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = (ROOT / "deck-html" / "comments.config.js").read_text(encoding="utf-8")
URL = re.search(r"supabaseUrl:\s*'([^']*)'", CFG).group(1)
KEY = re.search(r"supabaseAnonKey:\s*'([^']*)'", CFG).group(1)

RUN = "qa-" + time.strftime("%m%d-%H%M%S")
DECK = RUN                     # test deck: invisible to the real deck
OWNER_EMAIL = "wukun2005@gmail.com"   # → suppresses every notification by design
VIEW = "deck_comments_public"
TABLE = "deck_comments"

RESULTS = []


def call(path, method="GET", body=None, headers=None):
    req = urllib.request.Request(
        f"{URL}/rest/v1/{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "apikey": KEY,
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
            **(headers or {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, raw[:200]


def row(**kw):
    base = {
        "deck_id": DECK, "page_key": "qa-page", "page_index": 0,
        "page_title": "QA page", "author": "QA bot",
        "body": "qa", "client_id": RUN,
    }
    base.update(kw)
    return base


def check(name, ok, detail=""):
    RESULTS.append({"case": name, "pass": bool(ok), "detail": str(detail)[:220]})
    print(("  PASS  " if ok else "  FAIL  ") + name + ("" if ok else "   → " + str(detail)[:180]))


print(f"\n=== 数据层契约测试   run={RUN}  deck={DECK} ===\n")

# ── D1 读视图：可用，且不含 email 列 ────────────────────────────────────────
st, data = call(f"{VIEW}?select=*&limit=1")
cols = sorted(data[0].keys()) if isinstance(data, list) and data else []
check("D1 读视图返回 200", st == 200, st)
check("D2 视图不暴露 email 列", "email" not in cols, cols)

# ── D3 原表对 anon 不可读（邮箱隔离的另一半）───────────────────────────────
st, data = call(f"{TABLE}?select=id&limit=1")
check("D3 anon 读原表被拒（401）", st == 401, f"{st} {data}")

# ── D4 正常写入 ─────────────────────────────────────────────────────────────
st, data = call(f"{TABLE}", "POST", row(body="[QA] plain insert"),
                {"Prefer": "return=minimal"})
check("D4 正常插入返回 201", st == 201, f"{st} {data}")

# ── D5 已知坑回归：带 representation 回读会被拒 ─────────────────────────────
st, data = call(f"{TABLE}", "POST", row(body="[QA] representation readback"),
                {"Prefer": "return=representation"})
check("D5 回读新行被拒（401，前端不得加 .select()）", st == 401, f"{st} {data}")

# ── D6 空正文被拒 ───────────────────────────────────────────────────────────
st, data = call(f"{TABLE}", "POST", row(body=""), {"Prefer": "return=minimal"})
check("D6 空正文被拒", st >= 400, f"{st} {data}")

# ── D7 超长正文被拒（>2000）────────────────────────────────────────────────
st, data = call(f"{TABLE}", "POST", row(body="x" * 2001), {"Prefer": "return=minimal"})
check("D7 超长正文（2001）被拒", st >= 400, f"{st} {data}")

# ── D8 非法邮箱被拒 ─────────────────────────────────────────────────────────
st, data = call(f"{TABLE}", "POST", row(email="not-an-email"), {"Prefer": "return=minimal"})
check("D8 非法邮箱被拒", st >= 400, f"{st} {data}")

# ── D9 超长引用被拒（>500）─────────────────────────────────────────────────
st, data = call(f"{TABLE}", "POST", row(quote="q" * 501), {"Prefer": "return=minimal"})
check("D9 超长引用（501）被拒", st >= 400, f"{st} {data}")

# ── D10 孤儿回复被外键挡住 ─────────────────────────────────────────────────
st, data = call(f"{TABLE}", "POST",
                row(parent_id="00000000-0000-0000-0000-0000000000aa", body="[QA] orphan"),
                {"Prefer": "return=minimal"})
check("D10 指向不存在父评论的回复被拒", st >= 400, f"{st} {data}")

# ── D11 特殊字符往返一致（emoji / 中文 / 引号 / 换行 / HTML 标签）───────────
TRICKY = "[QA] 中文测试 emoji 🚀🔥 引号 \" ' 反斜杠 \\ 换行\n第二行\t制表 <script>alert(1)</script> & <b>bold</b>"
st, _ = call(f"{TABLE}", "POST", row(body=TRICKY), {"Prefer": "return=minimal"})
ok_write = st == 201
st, data = call(f"{VIEW}?select=body&client_id=eq.{RUN}&body=like.*emoji*")
got = data[0]["body"] if isinstance(data, list) and data else None
check("D11 特殊字符写入成功", ok_write, st)
check("D12 特殊字符读回完全一致（无转义/截断）", got == TRICKY,
      f"len in={len(TRICKY)} out={len(got) if got else 0}")

# ── D13 并发写入不丢 ────────────────────────────────────────────────────────
N = 20
def burst(i):
    return call(f"{TABLE}", "POST", row(body=f"[QA] concurrent {i}"),
                {"Prefer": "return=minimal"})[0]

with ThreadPoolExecutor(max_workers=N) as ex:
    codes = list(ex.map(burst, range(N)))
ok_codes = sum(1 for c in codes if c == 201)
st, data = call(f"{VIEW}?select=id&client_id=eq.{RUN}&body=like.*concurrent*")
stored = len(data) if isinstance(data, list) else -1
check(f"D13 并发 {N} 条全部写入成功", ok_codes == N, f"201×{ok_codes} codes={sorted(set(codes))}")
check(f"D14 并发数据无丢失（库里查到 {stored}/{N}）", stored == N, f"{stored}")

# ── D15 更新走视图可用 ──────────────────────────────────────────────────────
st, data = call(f"{VIEW}?select=id&client_id=eq.{RUN}&limit=1")
target = data[0]["id"] if isinstance(data, list) and data else None
st, _ = call(f"{VIEW}?id=eq.{target}", "PATCH", {"resolved": True},
             {"Prefer": "return=minimal"})
check("D15 通过视图更新（resolve）成功", st in (200, 204), st)

# ── D16 已知坑回归：更新原表被拒 ────────────────────────────────────────────
st, data = call(f"{TABLE}?id=eq.{target}", "PATCH", {"resolved": False},
                {"Prefer": "return=minimal"})
check("D16 直接更新原表被拒（401，前端必须走视图）", st == 401, f"{st} {data}")

# ── D17 软删除生效（deleted 标记可见，数据未消失）───────────────────────────
st, _ = call(f"{VIEW}?id=eq.{target}", "PATCH", {"deleted": True},
             {"Prefer": "return=minimal"})
st, data = call(f"{VIEW}?select=id,deleted&id=eq.{target}")
flagged = bool(data) and data[0].get("deleted") is True
check("D17 软删除标记写入成功且行仍在（不丢数据）", flagged, data)

# ── D18 硬删除不可用（避免误删）─────────────────────────────────────────────
st, data = call(f"{VIEW}?id=eq.{target}", "DELETE", None, {"Prefer": "return=minimal"})
check("D18 硬删除不可用（无 delete 策略）", st >= 400, f"{st} {data}")

# ── 汇总 ────────────────────────────────────────────────────────────────────
passed = sum(1 for r in RESULTS if r["pass"])
print(f"\n--- 数据层：{passed}/{len(RESULTS)} 通过 ---\n")
Path("/tmp/qa-api-results.json").write_text(
    json.dumps({"run": RUN, "deck": DECK, "results": RESULTS,
                "passed": passed, "total": len(RESULTS)}, ensure_ascii=False, indent=2),
    encoding="utf-8")
sys.exit(0 if passed == len(RESULTS) else 1)
