# MAINLINE STATUS — after 200k/DB140 requalification

> main @ `eade849`（未改动）。本页只整理主线当前状态。

## VALID
- Stage5 accepted
- VOUT calibration
- formal 250k → 150k SoftStart
- Comparator / TZ
- ADC sync
- 150k PFM direction shot PASS（RUN_ID 0x250C5A15，OUT `5a07cf39...`，PFM_DIRECTION_150K_PASS）

## PENDING
- 170k PFM direction shot（RUN_ID 0x250C5A17，`PFM_DIRECTION_170K_PENDING`）
- hardware PFM direction acceptance（`STAGE5A_PFM_DIRECTION_ACCEPTED = 0`）

## FAILED BUT ISOLATED（保留在独立分支，不入 main）
- 200k/DB140 multi-edge diagnostic（`requalify/200k-db140-trip-evidence` @ ef2bb20）
  - `REQUALIFICATION_POINT_FAILED` / `NOT_PRODUCTION_BASELINE` / `DO_NOT_RETRY`
  - 诊断工具：`diag/200k-3cycle-trip-snapshot` @ 409e3cf（仅未来诊断，不复制功率行为进 main）

## BENCH LATER（需台架，后续主线）
- IPRI absolute calibration
- Vds / Vgs
- ZVS
- trip waveform
- thermal / full-load

## 下一步主线
- 返回已验证的正式 SoftStart 路径
- 继续 PFM / automatic regulation 工作
