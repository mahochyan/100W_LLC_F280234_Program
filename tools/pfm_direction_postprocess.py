#!/usr/bin/env python3
"""
pfm_direction_postprocess.py — STAGE5A 两枪后自动方向判定与报告生成
(REMOTE_BENCH §9-10 / M 节)

输入：150k/170k 两枪 DSS dump 文本（run_pfm_direction_shot.js 的输出），
      或 --json <file>（相同字段的 JSON）。
输出：
  1. slope_raw_per_ms / slope_V_per_ms（用 window_cycles×(TBPRD+1)/60MHz 理论时长）
  2. 方向判定（NORMAL / REVERSED / INCONCLUSIVE，差异≥10% 阈值）
  3. 打印报告段；--write 更新 docs/STAGE5A_PFM_DIRECTION_REPORT.md 的填充
  4. --empirical 更新 tools/llc_empirical_plant.py 的 SHOT_150/SHOT_170

用法:
  python3 pfm_direction_postprocess.py \
    --shot150 shot_150k.log --shot170 shot_170k.log [--write]
模拟测试:
  python3 pfm_direction_postprocess.py --selftest
"""
import argparse
import json
import os
import re
import sys

GAIN = 0.008089325      # V/raw（board_calibration.h）
OFFSET = -0.063715
TBCLK = 60e6

FIELDS = [
    "start_raw", "end_raw", "max_raw", "window_cycles", "window_total",
    "TBPRD", "CMPA", "CMPB", "DBRED", "DBFED", "freq_hz",
    "start_timer2", "end_timer2", "fault", "ost", "pwm", "run_id_at_arm",
    "run_id_at_stop", "stop_raw", "elapsed_us",
]


def parse_dss_text(text, which):
    """从 DSS stdout 提取 'name = value' 字段（去掉空格下划线差异）。"""
    d = {}
    for m in re.finditer(r"(\w+)\s*=\s*([-\w.]+)", text):
        k = m.group(1).lower().replace(" ", "")
        v = m.group(2)
        if k in FIELDS or k in ("test_mode_rec", "result"):
            d[k] = v
    return d


def shot_dict(raw, which):
    if isinstance(raw, dict):
        return raw
    return parse_dss_text(raw, which)


def get_int(d, k):
    try:
        return int(float(d.get(k, "nan")))
    except (ValueError, TypeError):
        return None


def get_float(d, k):
    try:
        return float(d.get(k, "nan"))
    except (ValueError, TypeError):
        return None


def window_us(cycles, tbprd):
    if not cycles or not tbprd:
        return None
    return cycles * (tbprd + 1) / TBCLK * 1e6


def slope_raw_ms(delta_raw, window_us):
    if window_us and delta_raw is not None:
        return delta_raw / (window_us / 1000.0)
    return None


def evaluate(shot150, shot170):
    """返回判定 dict。"""
    def calc(s):
        start = get_int(s, "start_raw")
        end = get_int(s, "end_raw")
        tbprd = get_int(s, "TBPRD")
        cycles = get_int(s, "window_cycles")
        wus = window_us(cycles, tbprd)
        delta = (end - start) if (start is not None and end is not None) else None
        return {
            "start_raw": start, "end_raw": end,
            "tbprd": tbprd, "cycles": cycles, "window_us": wus,
            "delta_raw": delta,
            "slope_raw_ms": slope_raw_ms(delta, wus),
        }
    a = calc(shot150)
    b = calc(shot170)
    sa, sb = a["slope_raw_ms"], b["slope_raw_ms"]
    verdict = None
    diff = None
    if sa is not None and sb is not None:
        base = max(abs(sa), abs(sb))
        diff = (sa - sb) / base * 100.0 if base > 1e-12 else 0.0
        if abs(diff) >= 10.0:
            # 统一按"斜率更大即输出更多"（raw 增长为正；若为负则注意方向）
            if sa > sb:
                verdict = ("PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL",
                           "150k slope > 170k slope（差 %.1f%%≥10%%）：频率↑→输出↓，"
                           "V<目标→f↓" % diff)
            else:
                verdict = ("PFM_CONTROL_DIRECTION_REVERSED_IN_TEST_REGION",
                           "170k slope > 150k slope（差 %.1f%%≥10%%）：测试区间内方向相反，"
                           "保留实测，不套理论" % diff)
        else:
            verdict = ("PFM_DIRECTION_INCONCLUSIVE",
                       "两枪差异 %.1f%% < 10%%，停止真实功率，不自动扩大频率差" % diff)
    return {"150k": a, "170k": b, "slope_150": sa, "slope_170": sb,
            "diff_pct": diff, "verdict": verdict}


def report_text(r):
    a, b = r["150k"], r["170k"]
    lines = []
    lines.append("# STAGE5A PFM 方向判定（实板两枪，自动生成）\n")
    def row(k, v): lines.append(f"| {k} | {v} |")
    lines.append("### TEST_150K / TEST_170K")
    lines.append("| 字段 | 150k | 170k |")
    lines.append("|---|---|---|")
    for k in ["start_raw", "end_raw", "max_raw", "delta_raw", "tbprd", "cycles",
              "window_us", "slope_raw_ms"]:
        va = a.get(k); vb = b.get(k)
        if k == "window_us" and va is not None: va = f"{va:.1f}"
        if k == "window_us" and vb is not None: vb = f"{vb:.1f}"
        if k == "slope_raw_ms" and va is not None: va = f"{va:.2f}"
        if k == "slope_raw_ms" and vb is not None: vb = f"{vb:.2f}"
        lines.append(f"| {k} | {va if va is not None else '—'} | {vb if vb is not None else '—'} |")
    va = (a["start_raw"] * GAIN + OFFSET) if a["start_raw"] is not None else None
    vb = (b["start_raw"] * GAIN + OFFSET) if b["start_raw"] is not None else None
    ea = (a["end_raw"] * GAIN + OFFSET) if a["end_raw"] is not None else None
    eb = (b["end_raw"] * GAIN + OFFSET) if b["end_raw"] is not None else None
    lines.append(f"| start_V / end_V | {va:.3f} / {ea:.3f} | {vb:.3f} / {eb:.3f} |")
    lines.append(f"| slope V/ms | {(a['slope_raw_ms']*GAIN if a['slope_raw_ms'] is not None else '—'):.4f} | "
                 f"{(b['slope_raw_ms']*GAIN if b['slope_raw_ms'] is not None else '—'):.4f} |")
    lines.append("")
    if r["verdict"]:
        lines.append(f"## 判定：{r['verdict'][0]}")
        lines.append(f">{r['verdict'][1]}")
        lines.append("")
        if r["verdict"][0].startswith("PFM_CONTROL_DIRECTION_CONFIRMED"):
            lines.append("当 VOUT 低于目标：frequency 应**降低**；"
                         "VOUT 高于目标：frequency 应**升高**（依据实测）。")
    lines.append("")
    lines.append(f"slope_150={r['slope_150']:.2f} raw/ms  slope_170={r['slope_170']:.2f} raw/ms  "
                 f"diff={r['diff_pct']:.1f}%")
    return "\n".join(lines)


def write_empirical(r):
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "llc_empirical_plant.py")
    s = open(p).read()
    def setv(s, m, val):
        a, b = s, None
        s = re.sub(rf'"{m}":\s*None', f'"{m}": {val}', s)
        return s
    s = setv(s, "start_raw", int(r["150k"]["start_raw"]) if r["150k"]["start_raw"] is not None else "None")
    s = setv(s, "end_raw", int(r["150k"]["end_raw"]) if r["150k"]["end_raw"] is not None else "None")
    # 170k 一组用第二匹配（SHOT_170）
    parts = s.split("SHOT_170")
    head = parts[0]
    s = open(p).read()
    # 更稳：按块替换
    import re as _re
    def block(s, name):
        m = _re.search(rf"SHOT_{name} = \{{[^}}]*\}}", s)
        return m.group(0) if m else None
    b150 = block(s, "150")
    b170 = block(s, "170")
    nr150 = f'SHOT_150 = {{"start_raw": {int(r["150k"]["start_raw"]) if r["150k"]["start_raw"] is not None else "None"}, "end_raw": {int(r["150k"]["end_raw"]) if r["150k"]["end_raw"] is not None else "None"}, "window_us": 300.0}}'
    nr170 = f'SHOT_170 = {{"start_raw": {int(r["170k"]["start_raw"]) if r["170k"]["start_raw"] is not None else "None"}, "end_raw": {int(r["170k"]["end_raw"]) if r["170k"]["end_raw"] is not None else "None"}, "window_us": 300.0}}'
    s = s.replace(b150, nr150).replace(b170, nr170)
    open(p, "w").write(s)
    return p


def selftest():
    print("=== 判定逻辑自检（3 例）===")
    # CASE NORMAL: 150k delta 大
    s150 = {"start_raw": 1244, "end_raw": 1330, "max_raw": 1335,
            "window_cycles": 45, "window_total": 45, "TBPRD": 399,
            "CMPA": 200, "CMPB": 100, "DBRED": 36, "DBFED": 36,
            "freq_hz": "150000", "elapsed_us": "311",
            "fault": "0", "ost": "1", "pwm": "0"}
    s170 = {"start_raw": 1244, "end_raw": 1260, "max_raw": 1262,
            "window_cycles": 51, "window_total": 51, "TBPRD": 352,
            "CMPA": 176, "CMPB": 88, "DBRED": 36, "DBFED": 36,
            "freq_hz": "169971", "elapsed_us": "341",
            "fault": "0", "ost": "1", "pwm": "0"}
    r = evaluate(s150, s170)
    print(f"[NORMAL 例] slope150={r['slope_150']:.2f} slope170={r['slope_170']:.2f} "
          f"diff={r['diff_pct']:.1f}% -> {r['verdict'][0]}")
    assert r["verdict"][0] == "PFM_CONTROL_DIRECTION_CONFIRMED_NORMAL"
    # CASE REVERSED
    s170r = dict(s170); s170r["end_raw"] = 1360
    r = evaluate(s150, s170r)
    print(f"[REVERSE 例] slope150={r['slope_150']:.2f} slope170={r['slope_170']:.2f} "
          f"diff={r['diff_pct']:.1f}% -> {r['verdict'][0]}")
    assert r["verdict"][0] == "PFM_CONTROL_DIRECTION_REVERSED_IN_TEST_REGION"
    # CASE INCONCLUSIVE
    s170i = dict(s170); s170i["end_raw"] = 1329   # delta≈85，与 150k 接近 → 差异<10%
    r = evaluate(s150, s170i)
    print(f"[INCONC 例] slope150={r['slope_150']:.2f} slope170={r['slope_170']:.2f} "
          f"diff={r['diff_pct']:.1f}% -> {r['verdict'][0]}")
    assert r["verdict"][0] == "PFM_DIRECTION_INCONCLUSIVE"
    print("自检 3 例全部通过 ✓")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shot150", help="150k 枪 DSS 输出文件")
    ap.add_argument("--shot170", help="170k 枪 DSS 输出文件")
    ap.add_argument("--json", help="两枪 JSON {shot150:{...}, shot170:{...}}")
    ap.add_argument("--write", action="store_true", help="更新报告 + empirical plant")
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    if args.json:
        with open(args.json) as fh:
            j = json.load(fh)
        s150, s170 = j["shot150"], j["shot170"]
    elif args.shot150 and args.shot170:
        s150 = parse_dss_text(open(args.shot150).read(), "150")
        s170 = parse_dss_text(open(args.shot170).read(), "170")
    else:
        print("需 --shot150/--shot170 文件或 --json；或 --selftest")
        return 2

    r = evaluate(s150, s170)
    txt = report_text(r)
    print(txt)
    if args.write:
        doc = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "docs",
                           "STAGE5A_PFM_DIRECTION_REPORT.md")
        open(doc, "w").write(txt)
        emp = write_empirical(r)
        print("\n已写入:", doc)
        print("已更新:", emp)
    return 0


if __name__ == "__main__":
    sys.exit(main())
