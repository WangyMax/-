# v2.8.11 超级组真机不生效修复 —— 实施结果（data-code）

状态：complete（已提交，等待主模型审核，不代表已验收）

## 一、修改文件（允许写入范围内，4 个源文件）

| 文件 | 变更摘要 |
|---|---|
| `D:/Agent/Zcode/健身程序/FitCustomPro/src/data/initialExercises.ts` | `ex-sho-03` 补 `isDropSet: true` 与四阶 `dropStages` |
| `D:/Agent/Zcode/健身程序/FitCustomPro/src/utils/storage.ts` | `getExercises` 三条读取路径内置补丁 + 有改动写回 localStorage |
| `D:/Agent/Zcode/健身程序/FitCustomPro/src/components/ExerciseLibraryView.tsx` | 全部动作可编辑；内置动作锁名称/部位，保存保留原名称与原部位 |
| `D:/Agent/Zcode/健身程序/FitCustomPro/src/components/WeightJournalView.tsx` | 新增超级组切换、单侧互斥清标记、换动作透传并重建超级组、徽标与切换按钮 |

存储键集合（`STORAGE_KEYS`）与版本号（package.json `1.0.0`）均未改动；未新增任何键。

## 二、关键实现与定位

### 1. 数据源修复（initialExercises.ts）
- `ex-sho-03`（第 309 行）新增 `isDropSet: true`（第 316 行）与四阶阶梯（第 318-321 行）：
  `stg-sho03-1` 10kg×12、`stg-sho03-2` 7.5kg×12、`stg-sho03-3` 5kg×10、`stg-sho03-4` 2.5kg×12，与动作库/计划页默认阶梯一致。

### 2. 缓存升级（storage.ts）
- `BUILTIN_EXERCISE_PATCHES`（第 29-39 行）：只登记 `ex-sho-03` 一条，含 `isDropSet` 与默认四阶。
- `applyBuiltinExercisePatch`（第 42-56 行）：仅当 `ex.isDropSet` 缺失时补标记；`dropStages` 缺失时深拷贝默认四阶。返回是否发生改动。
- `getExercises`（第 489 行起）三条路径均执行补丁：
  - 缓存命中分支（第 490-496 行）：补丁幂等执行，有改动即写回；
  - 无本地数据分支（第 512-515 行）：补丁后落盘；
  - 有本地数据分支（第 519-527 行）：`try` 解析后补丁，有改动即写回（只影响 `ex-sho-03`）；
  - `catch` 兜底分支（第 528-533 行）同样补丁。
- 未写任何会话/计划数据迁移，未改任何存储键。

### 3. 动作库可编辑（ExerciseLibraryView.tsx）
- 列表卡片（第 351-372 行）：编辑按钮对全部动作开放，`onClick={() => openEditModal(ex)}`；删除按钮仅在 `ex.isCustom` 下渲染。
- 弹窗标题（第 386-388 行）：内置动作显示「编辑内置动作（名称与部位锁定）」。
- 名称输入框（第 405-420 行）内置时 `readOnly` 并置灰，附「内置动作名称不可修改」提示；目标肌肉群下拉（第 424-445 行）内置时 `disabled`，附「内置动作部位不可修改」提示。
- 保存（第 142-172 行）：`isBuiltinEdit` 为真时 `name`/`category` 取 `editingExercise` 原值，其余字段（单位、滑轮、单侧、超级组、阶梯、备注）按表单写入；内置记录不改 `isCustom`。超级组与单侧互斥沿用既有逻辑（第 161 行 `isUnilateral: newDropSet ? undefined : ...`）。
- 徽标渲染条件（第 324 行）仍依赖 `ex.isDropSet`，无需改动。

### 4. 历史编辑超级组链（WeightJournalView.tsx）
- 默认四阶常量与深拷贝工厂：`EDIT_DEFAULT_DROP_STAGES` / `makeEditDefaultDropStages`（第 45-55 行），id 形如 `edit-stg-<时间戳>-<序>`。
- `editToggleDropSet`（第 349-369 行）：开启时每组清空 `unilateral/left/right`、置 `isDropSet: true`、深拷贝四阶、组单位置 `kg`、首字段取阶梯首阶；关闭时删除 `isDropSet` 与 `dropStages` 并保留原重量次数；开启时清除 `ex.isUnilateral`。
- `editToggleUnilateral`（第 328-345 行）：改为「切到单侧时清除该组超级组标记与阶梯」，不再是旧逻辑的 `if (s.isDropSet) return` 跳过。
- `editReplaceExercise`（第 394-442 行）：签名追加 `isDropSet?`、`dropStages?`；`asDrop = isDropSet && stages.length>0` 时按现有组数重建超级组大组（与 `editAddExercise` 的 `asDrop` 分支同写法，每组深拷贝阶梯、`unit: 'kg'`、首阶重量次数），并置 `ex.isUnilateral = undefined`；否则走原普通/单侧分支。
- `pick`（第 2011-2030 行）：换动作分支补上 `isDropSet: ex.isDropSet, dropStages: ex.dropStages`（新增动作分支原已有）。
- UI（第 1749 行 `isDrop` 判定；第 1784-1801 行）：与单侧按钮同一行新增「🔥 超级组」徽标与「设为超级组 / 取消超级组」切换按钮。

## 三、实际验证（本机 Git Bash，工作区 D:/Agent/Zcode/健身程序/FitCustomPro）

| 命令 | 结果 |
|---|---|
| `npx tsc --noEmit`（改动完成后） | 退出码 0，无输出 |
| `npx tsc --noEmit`（复核最终文件状态再跑一次） | 退出码 0，无输出 |
| `grep -n "ex-sho-03\|applyBuiltinExercisePatch" src/utils/storage.ts` | 补丁常量/函数与三条分支调用点均命中（第 29、42、492、514、523、530 行） |
| `grep -n "stg-sho03\|isDropSet" src/data/initialExercises.ts` | 第 316、318-321 行命中 |
| `grep -n "openEditModal(ex)\|ex.isCustom &&" src/components/ExerciseLibraryView.tsx` | 编辑入口对全部动作；`ex.isCustom &&` 仅剩第 314（自建标签）与第 361（删除按钮） |
| `grep -n "editToggleDropSet\|editToggleUnilateral = \|isDropSet: ex.isDropSet" src/components/WeightJournalView.tsx` | 第 328、349、2017、2025 行命中 |
| `grep -c "fitcustom_.*_v2" src/utils/storage.ts` | 6（与改动前一致）；package.json `version: 1.0.0` 未动 |

对照验收条件：1 类型检查通过；2 内置超级组飞鸟含标记与四阶；3 补丁覆盖缓存命中/无数据/有数据/兜底四条路径且只登记 `ex-sho-03` 一条；4 全库可编辑、删除仍仅自建、内置锁名称部位；5 历史编辑有超级组切换与徽标且与单侧双向互斥；6 换动作透传标记并重建超级组大组；7 未新增存储键、版本号未动。

## 四、未完成项与限制

1. 未覆盖项（按任务要求不纳入、不扩大表单重构）：历史编辑弹窗里的「自定义新动作」内联表单（WeightJournalView 第 2062-2170 行附近，状态见第 112 行 `historyCustomUnilateral`）只有「左右独立（单侧）」开关，没有超级组开关；按派发要求原样保留、未改。
2. 交互边界（按方案字面实现，报请主模型裁决，未自行改动）：`storage.ts` 补丁判据是「缺 `isDropSet`」。若用户在动作库中编辑内置 `ex-sho-03` 并关闭超级组后保存，`JSON.stringify` 会丢弃 `isDropSet: undefined`，下次冷启动读盘时会再次补回标记（同一次运行内因内存缓存不会回填）。即“内置动作取消超级组”不跨重启持久。若需持久，需另立方案（例如增加显式 `isDropSet: false` 的区分或独立的用户覆盖标记），本次未实施。
3. 仅做静态类型检查与源码级 grep 核验，未运行真机/模拟器打包与界面点按验证（不在本任务写入范围与工具能力内）；真机行为需主模型在验收阶段实际运行确认。
