# 历史记录动作规格抽屉与单位滑轮编辑 — 实施结果

## 状态

complete

## 修改文件

- `D:/Agent/Zcode/健身程序/FitCustomPro/src/components/WeightJournalView.tsx`（唯一业务代码改动文件）

## 关键实现（含行号）

1. 模块级简标映射（只读，供胶囊与抽屉复用）
   - `EDIT_UNIT_SHORT`（第 33-38 行）：plates`插销` / kg`重量` / assisted`助力` / bodyweight`自重`
   - `EDIT_PULLEY_SHORT`（第 39-44 行）：none`普通器械` / `1:1``单滑轮` / `2:1``双滑轮`

2. 状态与防穿透
   - `const [editSpecExIdx, setEditSpecExIdx] = useState<number | null>(null);`（第 89 行），声明在 `useLockBodyScroll` 之前，避免 TDZ。
   - `useLockBodyScroll(editingSession !== null || editSpecExIdx !== null || confirmState.open || showGoalEditor);`（第 92 行）：抽屉打开时纳入 body 滚动锁，杜绝滚动穿透。

3. 同步更新函数（均走既有 `patchEditing` 不可变深拷贝草稿，保存时由 `saveEditSession` 同 id 写回）
   - `editChangeUnit(exIdx, unit)`（第 297-304 行）：写 `ex.currentUnit = unit` 并 `ex.sets.forEach(s => s.unit = unit)`。
   - `editChangePulley(exIdx, ratio)`（第 306-313 行）：写 `ex.pulleyRatio = ratio` 并 `ex.sets.forEach(s => s.pulleyRatio = ratio)`。
   - 两者均含 `if (!ex) return;` 越界保护。

4. 规格胶囊按钮（第 1684-1700 行，位于动作名输入框正下方）
   - 展示 `EDIT_UNIT_SHORT[e.currentUnit] · EDIT_PULLEY_SHORT[e.pulleyRatio]`，滑轮非 none 时追加 ` (1:1|2:1)`，例如 `插销 · 双滑轮 (2:1)`。
   - `onClick={() => setEditSpecExIdx(exIdx)}` 打开对应动作的规格抽屉。
   - 图标 `Layers` / `Pencil` 已在既有 import（第 6 行）中，无新增依赖。

5. 规格抽屉渲染（第 1861-1915 行，位于编辑弹窗之后、换/加动作挑选弹窗之前）
   - 外壳 `fixed inset-0 z-[80] ... pt-[max(env(safe-area-inset-top),46px)]`，内层 `modal-scroll overscroll-contain` + `max-h-[calc(100vh-max(env(safe-area-inset-top),46px)-16px)] overflow-y-auto`，符合安全区避让与防穿透要求。
   - 计量单位 4 选：`plates / kg / assisted / bodyweight`，选中态 `bg-blue-600`。
   - 滑轮比例 3 选：`none / 1:1 / 2:1`，选中态 `bg-indigo-600`。
   - 守卫 `editingSession && editSpecExIdx !== null && editingSession.exercises[editSpecExIdx]`，被删动作不会渲染抽屉；遮罩点击与「完成」按钮均 `setEditSpecExIdx(null)`。
   - 抽屉 `z-[80]` 高于编辑弹窗 `z-[70]`，层级正确。

## 未改动项（符合排除要求）

- 未新增任何存储键；落盘仍复用 `saveEditSession` 既有逻辑与 `StorageService`。
- 未修改 WorkoutView / PlansView / ExerciseLibraryView / types / storage / sessionBuilder / stats / android / 构建配置。
- 保留上一版历史编辑的自建动作折叠表单与改名逻辑，仅在其上追加规格能力。

## 实际验证

- 命令：`cd D:/Agent/Zcode/健身程序/FitCustomPro && npx tsc --noEmit`
- 结果：退出码 0，无类型错误（`strict` + `noUnusedLocals` + `noUnusedParameters` 全开）。

## 验收对照

1. 类型检查通过：是（tsc 退出码 0）。
2. 历史编辑每个动作均有规格胶囊展示当前单位与滑轮：是（第 1684 行，动作卡片动作名下方）。
3. 胶囊可弹出抽屉、可改单位为片/kg/助力/自重并同步整组：是（第 1879 行调用 `editChangeUnit`，同步 `currentUnit` + 全部 `sets.unit`）。
4. 可改滑轮为普通/1:1/2:1并同步整组：是（第 1896 行调用 `editChangePulley`，同步 `pulleyRatio` + 全部 `sets.pulleyRatio`）。
5. 弹窗层级与防穿透正常、无新增存储键：是（z-80 高于 z-70，纳入 useLockBodyScroll，无新存储键）。

## 未完成项与限制

- 未做浏览器/GUI 实机交互验证（本次为纯类型与静态核对，验收条件仅要求 `npx tsc --noEmit`）。
- `dropStages` 阶梯各自的 `unit` 不随动作单位切换改变（与开练页 `changeExerciseUnit` 行为一致，任务仅要求同步 `sets` 的 `unit`）。
