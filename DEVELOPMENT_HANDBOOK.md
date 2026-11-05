# FitCustom Pro (个人专属健身记录 App) - 架构设计与开发思路全景手册

> **致 ZCODE 开发者与维护者**：
> 本文档记录了本项目的完整设计思路、业务规则、数据模型、避坑经验与工程流水线，旨在让你可以零成本无缝接盘，持续迭代与维护。

---

## 一、 项目背景与业务核心诉求

### 1. 训练分化体系（四分化循环 + 完全休息）
项目基于用户的真实健身训练日程打造，遵循经典的大肌群 + 小肌群分化循环：
1. **胸 ➕ 三头**（练后附加 20 分钟坡度快走有氧）
2. **背 ➕ 二头**（练后附加 20 分钟坡度快走有氧）
3. **肩 ➕ 腹部**（练后附加 20 分钟坡度快走有氧）
4. **腿部专注 (深蹲日)**（体力消耗极大，专注下肢力量，默认无有氧）
5. **完全休息日 (Rest Day)**（生理超量恢复，一键打卡，无多余输入，保证打卡周期不中断）

### 2. 真实器械计量适配（核心痛点）
健身房器械并非只有单一的杠铃哑铃重量：
- **重量 (kg)**：自由重量或标重器械；
- **插销片数 (片)**：龙门架或固定插销器械，用户往往只记插了几片；
- **滑轮比例 (Pulley Ratio)**：单滑轮 (1:1) 与双滑轮 (2:1)，在不同健身房发力手感不同，系统支持标明；
- **助力 / 自重**：如助力引体向上、自重深蹲。

---

## 二、 核心功能架构与数据模型设计

### 1. 递减超级组系统（Drop Sets / 跑架式超级组）
这是本项目最核心的专业级创新功能，位于 `src/types/index.ts`、`src/components/WorkoutView.tsx`、`src/components/PlansView.tsx`：
- **结构定义**：采用 **大组 (Round) ➔ 内部多阶连续递减重量与独立次数 (DropStage)** 树形结构；
- **数据模型**：
  ```ts
  export interface DropStage {
    id: string;
    weightOrPlates: number; // 阶梯重量/片数
    unit: ResistanceUnit;
    reps: number;           // 该阶梯完成次数
  }

  export interface WorkoutSet {
    id: string;
    setNumber: number;      // 第几大组（如第 1 大组、第 2 大组）
    unit: ResistanceUnit;
    weightOrPlates: number;
    reps: number;
    completed: boolean;     // 大组完成状态
    isDropSet?: boolean;    // 是否开启超级组
    dropStages?: DropStage[]; // 大组内的各个阶梯详情
  }
  ```
- **典型真实案例（10.08 肩部超级组飞鸟）**：
  - 一共有 4 个大组（大组数量可自由自定义增减）；
  - 每一大组内连续从 10kg 递减到 2.5kg：
    - `#1`: 10kg × 12次 ➔ `#2`: 7.5kg × 12次 ➔ `#3`: 5kg × 10次 ➔ `#4`: 2.5kg × 12次
  - 每个阶梯的重量与次数均有独立步进器，支持自由点击【+ 加一个递减重量】追加阶段；做完整个递减流程后打勾完成该大组。

### 2. 本地持久化与防数据复活机制（重要排坑经验）
位于 `src/utils/storage.ts`：
- **纯本地优先**：数据 100% 存储在客户端 `localStorage`，无外部网络依赖，地下室健身房弱网秒开；
- **防复活原则（曾踩坑点）**：
  - 历史内置数据（10.06 - 10.09 真实训练）仅在初次无数据时写入一次；
  - **严禁在 `getSessions()` 或 `getWeightLogs()` 中编写“检测缺少预置数据就自动补齐”的代码**，否则用户在前端点击删除某天后，页面一刷新就会被自动复活！当前版本已彻底根治此问题，删除即为永久删除。

### 3. 极简化与纯粹记录原则（防闪退经验）
- **不要引入危险的 Android 前台后台 Service**：
  - 移动端在 Android 14+ / Android 15 对后台 `ForegroundService` 限制极严；
  - 组数打勾（`toggleSetComplete`）严格保持为**纯同步的本地内存与 localStorage 状态翻转**，绝不调用任何未经用户授权的系统级服务，保证 100% 零闪退、零延迟。

### 4. 界面 UI 与移动端视口适配
- **全面屏状态栏避让垫片**：
  - 在 `src/App.tsx` 顶部配有专门的避让垫片：
    `<div className="h-[max(env(safe-area-inset-top),38px)] w-full shrink-0 bg-slate-50" />`
  - 确保任何挖孔屏、水滴屏手机打开后，页面标题都不会与系统时间、5G、电量图标重叠。
- **开练底栏 50/50 对称布局**：
  - 位于 `WorkoutView.tsx` 底部，使用 `grid grid-cols-2 gap-3`，左侧【放弃本次训练】与右侧【结束并保存记录】严格各占 50%，触控面积舒适。
- **SVG 贝塞尔平滑波动曲线**：
  - 位于 `src/components/WeightJournalView.tsx`，完全使用原生 SVG 三次贝塞尔曲线（Cubic Bézier）绘制，带渐变阴影与数据点气泡；
  - 联动支持【周视图 (近7天)】、【月视图 (近30天)】与【全部】三档无缝切换。

### 5. 统一会话构建器（修复计划页开练丢超级组）
位置：`src/utils/sessionBuilder.ts`（v2.3 新增）
- **踩坑背景**：「今日训练」页的 `startPlan` 与「计划分化」页 App.tsx 里的 `handleStartPlanFromPlansTab` 曾是**两份各自维护的内联构造代码**。计划页那份漏掉了 `isDropSet / dropStages` 处理——从计划页开练「肩 ➕ 腹部」超级组计划时，递减阶梯会整体丢失，变成普通组。
- **铁律**：**同一个业务动作只允许存在一份构造逻辑**。两条开练入口统一调用：
  ```ts
  buildSessionFromPlan(plan: WorkoutPlan, allExercises: Exercise[]): WorkoutSession
  ```
  内部处理：预设单位/滑轮回退、上次训练数据智能预填、超级组阶梯深拷贝注入（计划预设优先，其次上次训练，最后默认 10→7.5→5→2.5kg 四阶）。
- **维护约定**：日后修改开练预填规则只改 `sessionBuilder.ts`，**严禁**在任何组件里再写内联的会话构造代码。

### 6. localStorage 解析缓存与 React 引用语义（v2.3 重要避坑）
位置：`src/utils/storage.ts` 顶部 `cache` 对象
- **踩坑背景**：训练页曾在**渲染函数体里**每次渲染调用 `getSessions()`，全量 `JSON.parse`；打字改备注时每按一次按键触发一次重渲染，5 个动作就要解析数十遍全量历史。现已改为：`get*` 首次解析后写入进程内缓存，后续读取零 parse；`save*` 写穿（localStorage + 缓存同步更新）。
- **核心避坑（差点翻车点）——React setState 引用语义**：
  - 项目里大量「mutate → save → `setState(StorageService.get*())`」的刷新模式；
  - React 的 `setState` 收到**与当前 state 相同的对象引用**时会静默 bail-out，**不重渲染**；
  - 若 `save*` 把调用方传入的**同一数组引用**写回缓存，`get*` 返回同一引用 → setState 失效 → 打卡后界面完全不动（旧版每次 `JSON.parse` 都返回新引用，所以碰巧正常，缓存上线后此问题立即暴露）；
  - **因此所有 `save*` 必须缓存浅拷贝**：`cache.xxx = [...list];`（当前代码有注释标注，勿删）。
- **另外两条配套约定**：
  - `restoreOfficialData()` / `resetAllData()` 直接 `setItem/removeItem` 绕过了 `save*`，**必须手动同步或清空缓存**（当前代码已处理）；
  - `importBackupJson()` 内部走 `save*`，自动继承缓存更新，无需额外处理。
- **改缓存相关代码时三查**：① 新写入路径是否更新了缓存；② 是否浅拷贝（防引用 bail-out）；③ restore/reset 是否同步。

### 7. 渲染路径零 IO 原则（v2.3 性能基线）
- **任何组件的渲染函数体内禁止调用 `StorageService.get*`**：数据一律进 React state，变更时显式刷新（先 `StorageService.addSession/deleteSession` 再 `setSessions(StorageService.getSessions())`）。
- **「上次训练参考」用一次扫描建 Map**：`WorkoutView` 中用 `useMemo` 把 sessions 扫成 `Map<exerciseId, 最近完成日志>`，替代原先每张动作卡片各自全量查找（O(N×M) → O(N)）。语义与 `getLastExerciseLog` 完全一致：按日期降序取首个含已完成组的命中。
- 休息日打卡横幅读的是 **sessions** 不是 plans——刷新横幅务必 `setSessions`，早期版本误写成 `setPlans` 导致打卡后横幅不出现，已修复。

### 8. 本地日期铁律：v2.4 UTC 时区 bug 排坑
- **踩坑背景**：`new Date().toISOString().split('T')[0]` 取的是 UTC 日期。北京时间（UTC+8）下每天 0:00–8:00 返回的是**前一天**（已用节点脚本演示验证：模拟 10-11 早7点取到 10-10）。影响面：休息日横幅匹配、训练归档日期、体重打卡默认日期、备份文件名。
- **铁律**：所有“今天是几号”场景必须调 `src/utils/date.ts` 的 `todayLocalDate()`，**禁止**再写 `toISOString().split('T')` 取日期。唯一例外是 `exportBackupJson` 的 `exportedAt` 时间戳——那里要的就是 UTC ISO 格式，正确无误。
- **同期验证后刻意不动的东西**（防止后人盲改）：
  - `浮点精度`：曾怀疑 `updateSetField ±2.5` 会累积误差，验证后推翻—2.5 是二进制精确表示，任意有限小数加减在 double 精度内无可见误差。
  - `window.confirm ×3` + `alert ×4`：存量的全是用户点击后同步触发，没有真机复现证据证明会被 WebView 拦截，保持现状。若日后真机复现拦截，参照 WeightJournalView 内建确认弹窗的方式替换。
  - `toggleFavorite / updateExerciseUnit / resetAllData` 暂无 UI 调用，但是数据层 API 集合的正常成员，留着无害不删。
  - `restType / rpe` 类型字段暂无消费，纯类型声明零运行时成本，不动类型定义。
  - `VIBRATE` 权限声明在 Manifest 里残留（JS 层零调用、原生源码零残留，删流体云功能时漏删）——无害声明，下次动原生层时顺手清理。

### 9. APK 固定签名铁律：v2.5 覆盖安装保数据
- **踩坑背景**：GitHub Actions 每次用全新虚拟机 + 临时 debug 签名打包，每版签名都不同。Android 规定签名不同的同包名 APK 不能覆盖安装，用户只能卸载重装，卸载会清空 localStorage——用户 10-09 之后的体重与休息日数据因此失夺。
- **修法**：仓库内固定 keystore（`android/fitcustom.keystore`，密码 `fitcustom`，有效期 30 年）+ `android/key.properties` 写死配置并提交，`app/build.gradle` 的 debug/release 均用该签名。CI 无需额外配置，每次打包签名自动一致。
- **铁律**：**绝不更换或删除 keystore**；CI 签名配置不得删除；每次发版后验证新旧包签名证书指纹一致。从 v2.5 起所有版本支持直接覆盖安装，手机本地数据无缝保留。
- **备注**：v2.5 与旧版签名不同，需最后一次卸载重装；之后永不再需要卸载。

### 10. 休息日补签功能（v2.6 新增）
- 位置：WorkoutView “今日完全休息”下方的“之前漏打卡了？”行。选过去某天日期点“补签休息”即可。
- 规则：只能补今天之前的日期（输入框 max 限制 + handler 双重校验）；当天已有任何训练/休息记录则拒绝重复补签。提示用页内文字，不依赖原生弹窗。
- 补签记录的 notes 标为“完全休息（补签）”，便于在历史里区分。

### 11. 数字输入框可清空原则（v2.7 修复）
- **踩坑背景**：受控 `type="number"` 输入框若写 `value={数字}` + `onChange={parseInt(v) || 1}`，用户清空时空字符串 parse 出 NaN 立刻被 `|| 1` 填回 1——“12次”只能删掉 2，1 永远留着。
- **铁律**：所有数字输入框必须允许清空——`value={数字 || ''}`，onChange 判断 `e.target.value === ''` 时写 0/undefined 而不是默认值。校验后移到保存/结算时清洗（见 PlansView handleSavePlan 的 sanitized 逻辑）。
- 涉及面：计划编辑的目标组数/次数/预设负荷、超级组阶梯重量/次数，训练记录的每组重量/次数与阶梯值。

### 12. v2.8 界面烕新架构（专注模式 + 历史与体重创意升级）
- **专注模式**：WorkoutView 开练后一屏只显示一个动作（focusIdx 切换），通过 onFocusModeChange 通知 App 隐藏底部导航防误触；右下角悬浮“结束”钮进底部确认抽屉归档。所有训练数据操作逻辑与 v2.7 完全一致，只收纳界面。
- **分化罗盘**：顶部“胸➔背➔肩➔腿➔休”横条，按历史记录推断上次分化与建议下次，只是建议不强制。今日状态卡把开练/休息/补签合成三段切换。
- **规格胶囊 + 大组行**：单位/滑轮 7 个按钮收成 1 个胶囊，点开底部抽屉修改；组行整行可点打钩，按钮 44px。超级组默认折叠一行摘要，有氧/备注默认折叠（腿日自动隐藏有氧）。
- **训练历史**：统计条（累计/本周/连续打卡/总组数）、近8周活动日历（点格子过滤）、每场容量与用时、类型筛选。容量/统计计算在 `src/utils/stats.ts`，纯函数无侧效。
- **体重记录**：目标体重（`WEIGHT_GOAL` 键，进备份）+曲线目标虚线、趋势洞察横幅（近7天均值对比）、近6周打卡日历、时段过滤。
- **统一确认抽屉**：`src/components/ConfirmSheet.tsx`，代替全应用 window.confirm/alert（现已清零）。新增确认场景必须用它。
- **动效基线**：index.css 的 fade-in/sheet-up/check-pop/card-in 纯 CSS 动效，不依赖任何原生服务（手册第 3 节铁律不动）。

### 13. v2.8.2 删除确认框被底部导航遮挡修复
- **踩坑背景**：用户手机上点历史训练删除，确认抽屉弹出来但取消/确认删除按钮被底部导航盖住，只能看到标题描述。原因是底部导航与全部弹窗抽屉同为 z-50，后渲染的导航在同一层级盖住了抽屉按钮（用户截图证实）。
- **修法**：全部底部弹窗提到 z-[70]（ConfirmSheet、PlansView 新建/编辑与挑选动作、WorkoutView 规格/加动作/完成祝贺、ExerciseLibraryView 新增动作），底部导航保持 z-50；ConfirmSheet 弹层底边加 `env(safe-area-inset-bottom)` 安全区。
- **验证**：390×844 手机视口下删除确认框完整可见，确认删除按钮在最上层可点，点确认后记录删除；npm run build 通过。注意桌面预览点击曾受自动化后端状态影响，结论以 DOM 几何测量与截图为准。

### 14. v2.8.3 历史可改 + 动作归位 + 单侧记录
- **问题① 历史记录可编辑**：日志页训练卡片展开态加编辑入口，弹窗可改每组重量/次数（含单侧左右）、删组、改训练与动作备注，保存走 `addSession` 同 id 写回并刷新；休息日仅备注可改。验证：隔离记录 60kg 改 65kg 保存后同 id 写回，容量同步更新。
- **问题② 自定义动作归位**：`addCustomExercise` 由 `unshift` 置顶改为同部位分组末尾插入；`getExercises` 两条路径稳定归一化（部位顺序→内置优先→原顺序）；动作库列表按部位分组渲染组头。验证：新建肱三头单侧动作后位于肱三头分组末尾（数组 idx 39/49），带用户自建与左右独立徽标及编辑/删除按钮。
- **问题③ 每个动作可标单侧**：`Exercise.isUnilateral`（动作库新增/编辑开关）→ `PlanExerciseTarget.isUnilateral`（计划页普通动作开关，超级组不提供）→ 开练 `ExerciseLog.isUnilateral` + 每组 `left/right` → 训练页左右两列分别记录 → 统计左右累加。单侧只做普通组，超级组阶梯不支持分侧。验证：单侧计划开练每组左右列正常，320px 下 scrollWidth 等于 clientWidth 无溢出。
- **数据红线**：无新增存储键，旧数据缺字段走原分支；弹窗保持 z-[70]；备份恢复逻辑不动。

### 15. v2.8.4 历史完整编辑
- **背景**：v2.8.3 的历史编辑只能改重量次数、删组、改备注，用户要求动作、组数、个数、重量、单双侧、名字都能改。
- **修法**：动作名改为可直接输入的文本框（仅改本条记录）；动作行加单双侧切换、换动作、删动作；组列表加“加一组”；列表底部加“新增动作”；换动作与新增动作共用动作挑选弹窗（z-80，盖在编辑弹窗之上）。换动作保留组数与备注，重量次数沿用原组，单侧按新动作标记重建左右。
- **验证**：编辑弹窗展示改名框、单双侧切换、换动作、删动作、加一组、新增动作入口；tsc 与构建通过。

### 16. v2.8.5 历史单侧行对齐
- **背景**：历史编辑弹窗单侧两行中，左行有组号与单位后缀而右行没有，输入框错位（用户手机截图证实）。
- **修法**：两行统一为同一网格列（左右标签、重量、×、次数、单位），两侧输入框上下对齐。
- **验证**：390 视口截图确认左右两行对齐；tsc 与构建通过。

### 17. v2.8.6 记录改名 + 历史导入计划
- **记录改名**：历史编辑弹窗头部标题改为可编辑输入框，仅改本条记录的 `planName`，不影响计划库。验证：自由训练改名后同 id 写回，列表更新。
- **历史导入计划**：计划编辑页加“从过往训练导入”按钮，挑选非休息日历史记录后，用该场已完成组的重量次数生成计划预设（含单侧左右、超级组阶梯、有氧设置），替换当前动作编排。验证：导入后计划名带模板后缀，动作预设与历史一致。
- **数据红线**：导入为新建/编辑中的本地组装，不写历史；无新增存储键；弹窗层级 z-80 盖在编辑弹窗之上。

### 18. v2.8.7 自由训练自建动作 + 训练中切换单侧
- **问题**：自由训练只能从动作库添加，首次使用时动作库里没有想要的动作用户无法新增；单侧只能在动作库或计划里预设，训练中才发现要分侧就改不了。
- **修法**：添加动作弹窗内加可折叠「自定义新动作」表单（名称/部位/单位/滑轮/单侧/备注），保存走 `addCustomExercise` 写入动作库并调用 `addExerciseToCurrent` 直接加入本次训练（`createAndAddCustomExercise`）；规格抽屉加「记录方式」一行开关（双侧/左右手分开），切换走 `changeRecordMode`：开启时为普通组补 `left/right`（默认取主字段），关闭时清分侧标记但保留主字段与左右数据；勾选「同时记住到动作库」才写回 `Exercise.isUnilateral`。超级组阶梯不支持分侧，开关置灰并提示。
- **接口**：`WorkoutView` 新增 `onRefreshExercises` 属性，由 `App.tsx` 传入已有的 `refreshExercises`。
- **验证**：自由训练新建单侧动作后入库且加入训练、左右两栏正常；规格抽屉切双侧后单栏显示且数据不丢、可再切回；320px 下 scrollWidth 等于 clientWidth 无溢出；tsc 与构建通过。

### 19. v2.8.8 智能分化识别 + 自由训练自拟名称 + 防滚动穿透与状态栏加固
- **问题① 自由训练名称自拟与历史编辑自建动作**：
  - 自由训练专注模式顶部名称改为支持直接点击内联编辑（带铅笔提示），输入后回车或点完成保存，实时更新 `activeSession.planName`。
  - 历史记录编辑的挑选动作弹窗（`WeightJournalView`）同步补齐折叠式「自定义新动作」表单，保存后写入动作库并立即带入当前编辑的历史会话。
- **问题② 智能分化罗盘推断（告别盲目兜底为胸）**：
  - 重构推断算法为 `inferSessionCategory`：优先遍历会话实际完成动作的肌肉部位（`session.exercises` 的 `category`），将 `chest/triceps` 归为胸、`back/biceps` 归为背、`shoulder/abs` 归为肩、`leg` 归为腿，按完成组数最高者判定为当场实际分化日；
  - 仅在动作列表为空时回退到计划名称关键字匹配；无法推断时绝不盲目兜底为“胸”。
  - 自由训练练背在首页罗盘准确显示“背·今天 ➔ 肩·建议下次”。
- **问题③ 防滚动穿透与状态栏安全避让加固**：
  - 新增 `useLockBodyScroll` 全局 Hook（带引用计数支持多层嵌套），当模态框打开时自动为 `body` 注入 `.modal-open`（`overflow: hidden; touch-action: none`），关闭时还原；
  - 所有模态框内部滚动列表添加 `.modal-scroll` 与 `overscroll-contain`，彻底消除滑动穿透与下层图层联动；
  - `App.tsx` 顶部系统垫片高度从 38px 提高到 `max(env(safe-area-inset-top), 46px)`，为 Android 打孔屏留出充裕空间；
  - 所有底部抽屉弹窗外层蒙层增加 `pt-[max(env(safe-area-inset-top),46px)]`，卡片增加 `max-h-[calc(100vh-max(env(safe-area-inset-top),46px)-16px)]` 约束，确保弹窗顶部绝不侵入系统状态栏。
- **验证**：真机视口（390×844 及 320px）全流程通过；无新增存储键；tsc 与构建通过。

### 20. v2.8.9 历史记录动作规格抽屉（单位与滑轮比例修改）
- **问题**：在历史记录编辑中新增动作（如绳索跪姿卷腹）时，只能使用默认单位（片）且无法选择单双滑轮，限制了历史数据的准确补记。
- **修法**：在 `WeightJournalView` 历史编辑的每个动作卡片动作名输入框下方，新增规格胶囊按钮（如“规格 插销 · 双滑轮 (2:1)”）；点击打开独立的规格抽屉（`z-[80]`），支持切换计量单位（片/kg/助力/自重）与滑轮比例（普通/单滑轮1:1/双滑轮2:1）；切换后通过 `editChangeUnit` 与 `editChangePulley` 将该动作的所有组（`sets`）的 `unit` 和 `pulleyRatio` 同步更新，保存时同 id 写回。
- **验证**：子代理按 L2 审核通过（生成 review 记录）；390 视口实测“绳索跪姿卷腹”从“插销 2:1”切换为“重量 kg 1:1”，保存后落盘数据及界面单位均实时更新；tsc 与构建通过。

### 21. v2.8.10 动作库超级组 + 历史默认4组 + 训练新增留空
- **问题① 超级组入口缺失**：超级组开关只在计划编辑页有，动作库表单无入口；`Exercise` 类型无超级组字段。修法：类型加 `isDropSet/dropStages`；动作库表单加超级组开关与阶梯编辑器（默认 10/7.5/5/2.5kg 四阶），与单侧互斥，列表卡片加徽标。
- **问题② 历史新增3组**：`editAddExercise` 硬编码 `[1,2,3]`。修法：改为 4 组；超级组动作生成 4 个大组（阶梯深拷贝）。
- **问题③ 训练新增复用数据**：`addExerciseToCurrent` 从上次记录复制重量次数。修法：4 组重量次数与左右值全部写 0（输入框按可清空原则显示为空），仅保留单位滑轮规格推断；一键带入功能不动。
- **验证**：两子代理并行实施并按 L2 审核通过；390 视口实测超级组开关与阶梯展开、入库含 4 阶、历史新增 4 组、训练新增 4 组空白；tsc 与构建通过。注意：留空组若不填就打勾完成，摘要会显示 0 值，属设计直接后果。

### 22. v2.8.11 超级组真机不生效修复（内置标记 + 全库可编辑 + 历史一键切换）
- **问题① 内置超级组飞鸟无标记**：`ex-sho-03` 只有名称含“超级组”字样，无 `isDropSet/dropStages` 字段，徽标渲染条件命中不了，真机列表与你截图一致无徽标。修法：数据源补标记与默认四阶（10×12/7.5×12/5×10/2.5×12）；`getExercises` 四条读取路径加单条内置补丁并有改写回，老手机不清数据也能生效，只碰 `ex-sho-03` 一条。
- **问题② 动作库只能看不能改**：列表编辑按钮仅 `ex.isCustom` 可见，内置动作点不了。修法：编辑入口放开到全部动作，删除仍仅自建；内置编辑时名称与部位锁定只读，保存保留原名原部位，其余规格照表单写入。
- **问题③ 历史编辑无超级组开关**：已有普通组（如飞鸟/侧平举）无法一键转超级组，换动作还丢标记。修法：每组动作行加“🔥超级组”徽标与“设为超级组/取消超级组”切换（`editToggleDropSet`，开时深拷贝默认四阶并清单侧，关时保留重量次数）；切单侧改为清除超级组标记；`editReplaceExercise` 追加标记参数并按组数重建大组；挑选弹窗换动作分支补透传。
- **验证**：单 data-code 子代理实施并按 L2 审核通过（review-v2811.json accepted）；390 视口实测超级组飞鸟带“🔥超级组·4阶”、全库 48 个编辑入口、历史编辑 5 组动作行均有切换且点开翻转为取消；tsc 与构建通过。已知限制（历史自定义新动作内联表单无超级组开关，**已于 v2.9.0 补齐，见 24 节**）；内置动作关超级组保存后冷启动会补回（取消不跨重启持久，**已于 v2.9.0 修复，见 24 节**）。
- **数据红线**：无新增存储键；版本号 versionCode 30 / versionName 2.8.11。

### 23. v2.8.12 状态栏避让 + 移除恢复按钮 + 原生导出备份
- **问题① 状态栏重叠（一加 ACE5 PRO）**：targetSdk 36 强制 edge-to-edge，WebView 绘制到状态栏下；部分机型 CSS env(safe-area-inset-top) 返回 0，原 46px 兜底不足。修法：MainActivity 在 onCreate 给 android.R.id.content 注册 WindowInsets 监听，取 systemBars 与 displayCutout insets 的最大值设置 left/top/right padding，bottom 保持 0；同时移除 App.tsx 的 CSS 垫片，避免原生避让后再叠加造成双倍留白。
- **问题② 恢复按钮**：按用户要求移除「恢复 10.06-10.09 真实记录」入口与 handleRestoreOfficialData，备份区仅保留导出与导入两个按钮；StorageService.restoreOfficialData 保留未删。
- **问题③ 真机导出无反应**：Android WebView 不支持 a.download 触发下载。修法：新增 @capacitor/filesystem 与 @capacitor/share，原生端把 exportBackupJson 写入 Directory.Cache 后调用系统分享面板；成功、用户取消、失败三类均有备份卡片内就近提示（5 秒自动消失），Web 端保留 Blob 下载。
- **验证**：单 data-code 子代理实施并按 L2 审核通过（review-v2812.json accepted）；主模型重跑 tsc 与构建通过；cap sync 确认两个插件已注册；真机顶距与分享面板待用户覆盖安装确认。
- **数据红线**：无新增存储键；导出 JSON 结构未变；版本号 versionCode 31 / versionName 2.8.12。

### 24. v2.9.0 用药记录与提醒（隔天服药，第一个非训练模块）
- **需求**：长期隔天服用非那雄胺（48h 一次），经常忘；要「可设时间 + 每 48h 提醒 + 一键打卡 + 历史看漏服 + 提醒开关」，且视觉与既有四页一致。
- **模块边界（关键设计）**：用药属于「与训练无关的周期事件」，因此**不进 WorkoutSession / WeightLog 结构**，单列三个存储键 `fitcustom_med_config_v2` / `fitcustom_med_doses_v2` / `fitcustom_med_snooze_v2`，避免污染既有数据模型与统计（`sessionVolumes`、`computeStreak` 等一行未改）。
- **文件分工**（三层，便于以后加第二个药）：
  - `src/utils/medication.ts`：纯函数层（无 localStorage、无 React）。槽位按「首剂日期 + 间隔天数」用 `shiftLocalDate` 生成，全本地时间；`getMedicationState(config, doses, now)` 一次算出 todaySlot / dueSlot / upcoming / nextDueAt / overdueMs / isDue / takenToday / streak / stats / history / chain。
  - `src/utils/medicationReminder.ts`：原生通知层。`notificationIdForSlot(dateStr) = 71_000_000 + diffLocalDays('2024-01-01', dateStr)`，id 只跟应服日绑定，**同一天重复排程必然覆盖同一条通知**，撤销时按 id 区间精确 cancel，不会误杀别的通知。
  - `src/utils/useMedication.ts`：状态中枢 hook，App 层调用一次，用药页与全局到点弹层共用同一份快照（打卡后底部红点立即消失）。
- **待处理槽位的判定规则（踩坑后定的）**：`dueSlot` 只取「≤ 今天的最近一个槽位」，且它没有记录时才算待办。最初写成「从今天往前找第一个没打卡的槽位」，结果用户补打卡今天的之后，首页仍停在很久以前的待补槽位（测试 S3：due=11-03 而 11-05 已服）。改成只认最近槽位后，更早的空缺统一沉到历史里显示「漏服」，每行都有「补记」按钮，既有交代又不挡今天的操作。
- **提醒策略**：
  - 原生用 `@capacitor/local-notifications` 一次性排 16 条单次通知（48h 间隔≈32 天），每次配置/打卡/回前台都先撤后排（幂等）。
  - `isExactNotification: false` + `allowWhileIdle: true`：插件源码里 exact 为真且缺「闹钟与提醒」权限时会**直接跳系统设置页**（打断用户），故选择非精确 + Doze 可用，代价是最多晚几分钟。
  - 权限：`POST_NOTIFICATIONS` 等由插件 manifest 合并，App 清单无需手改；未授权时页面给黄色提示条 + 「开启通知权限」；拒绝后只是不响，不阻塞打卡。
  - 点通知进 App：App.tsx 监听 `localNotificationActionPerformed`，带 `extra.medicationSlot` 的直接切到用药页并撤掉该条通知。
  - 页内兜底：`reminderEnabled && isDue && now >= snoozeUntil && 不在用药页` 时弹全局 Sheet，关闭 = snooze 1 小时（落盘，重启仍生效）。
- **顺手修掉的既有问题**：
  - 内置超级组冷启动复活：`applyBuiltinExercisePatch` 原来用 `!ex.isDropSet` 判断，用户关掉后落盘 `false` 又被改回 `true`；改为只在 `typeof ex.isDropSet === 'undefined'` 时补默认值（区分「从未写入」与「用户选了否」）。
  - 白屏无自救：新增 `src/components/ErrorBoundary.tsx`，`main.tsx` 包住 `<App />`，渲染异常时给「页面出错了」卡片 + 重新加载，并提示数据在 localStorage、可先去日志页导出备份。
  - 历史新增动作不能建超级组：v2.8.11 留下的缺口（历史编辑里自定义新动作只能建成普通动作，事后要再点一次「设为超级组」）。表单并入「递减超级组（4 阶梯）」开关，勾选时强制 kg 单重并清空单侧（与 `editToggleDropSet` 同一规则），保存即带默认四阶。
  - 备份漏数据：`exportBackupJson` 升到 `version: '2.1'`，带上 `medication` / `medicationDoses`；`importBackupJson` 对缺失字段容忍（旧备份照常导入）；日志页文案改为四类数据，导入成功后 `window.dispatchEvent(new Event(MED_CHANGED_EVENT))` 让用药状态重读。
- **验证**：`npx tsc --noEmit` 与 `npm run build` 通过；用 esbuild 打包 `medication.ts` 在 node 里跑 6 组场景（未到点/逾期 30 分/已服/漏两天/逾期补记/跳过）确认 dueSlot、isDue、late、streak、stats 全部符合预期；`npx cap sync android` 确认 `capacitor.build.gradle` 已注册 `:capacitor-local-notifications`。真机响铃待覆盖安装确认。
- **数据红线**：新增 3 个存储键，旧键与结构零改动；版本号 versionCode 39 / versionName 2.9.0；CI `tag_name: v2.9.0`。

### 25. v2.9.1 用药入口下移 + 默认 12:00 + 系统日历（导航回归 4 项）
- **需求（用户第二轮）**：撤掉底部第 5 个「用药」Tab，第 4 项改名「每天记录体重」；用药入口挪到「计划分化」页并带小红点；提醒改成隔天中午 12:00；尽可能把提醒也落到系统日历里。
- **导航回归 4 项**：`src/App.tsx` 的 `navTabs` 回到 4 项、容器 `grid-cols-5` → `grid-cols-4`；`TabId` 仍保留 `'medication'`——它现在是「计划分化」的**二级页**而不是导航项，`navActiveId = activeTab === 'medication' ? 'plans' : activeTab` 让导航高亮跟着父级走，用药页左上角新增返回按钮（`MedicationViewProps.onBack`）。
- **第 4 项语义**：标签「每天记录体重」；`WeightJournalViewProps` 新增 `initialSubTab?: 'training' | 'weight'`（默认 `'training'`），App 传 `'weight'`，打开即落在体重子页签，训练历史仍在同页第二个子页签——只加了一个可选属性，没有拆组件、没有改数据。
- **入口卡**：`PlansViewProps` 新增可选 `medication?: { due: boolean; summary: string; onOpen: () => void }`，在页头下渲染一条卡片（accent-soft 圆形 Pill 图标、待服时 danger 小红点 + 「待服用」Badge、ChevronRight）。摘要由 App 算好传入（到点显示「…12:00 已到点，记得打卡」，否则显示周期 / 时间 / 下次应服日），**PlansView 不读用药存储**，保持计划页对用药模块零依赖。
- **默认时间**：`DEFAULT_MED_REMINDER_TIME` 从 `'21:00'` 改为 `'12:00'`，`FALLBACK_MINUTES` 同步为 `12 * 60`（历史数据没写时间时也按中午解释）。
- **系统日历（新增 `src/utils/calendarIcs.ts`）**：
  - 为什么不直写 CalendarContract：需要 `READ/WRITE_CALENDAR` 运行时权限 + 自研原生插件，还得自己挑可写日历、写 Reminders 表，一旦失败就是「静默不提醒」；`.ics` 里带 `RRULE:FREQ=DAILY;INTERVAL=<stepDays>` 与 `VALARM TRIGGER:-PT0M`，用户导入一次后由系统日历自己隔天提醒，App 被清理也不受影响。
  - `buildMedicationIcs(config, fromDate?, now?)`：DTSTART 取「今天或之后最近、且时间点还没过」的槽位（用 `shiftLocalDate` 往后挪一格，避免迁到过去），用**浮动本地时间**（不带 Z），换时区不漂移；UID 绑定起始槽位日，重复导入是更新而不是堆叠；描述里写明「导入后由系统日历负责提醒」与 App 内记录路径。
  - 折行按 RFC 5545（75 八位字节内，中文按 3 字节算，续行以空格开头），`foldIcsLines` 按**字符边界**切，不会把汉字劈成半个。
  - `exportMedicationIcs(config)`：原生端 `Filesystem.writeFile(Directory.Cache)` + `Share.share({ files: [uri] })`（用户取消分享不算失败）；Web 端退化成 Blob + `a[download]`。任何异常只返回 `{ ok: false, message }`，不往 React 里抛。
  - 页面：「系统日历提醒」卡片 + 4 步导入说明 + 导出结果 Sheet，并提示日历事件与 App 通知是两套提醒，重复提醒时删掉一边。
- **验证**：`npx tsc --noEmit`、`npm run build`、`npx cap sync android` 全绿；esbuild 打包在 node 里跑 ICS 用例（11-01 起隔天 12:00、now=11-05 12:00）得到 `DTSTART:20261107T120000` / `RRULE:FREQ=DAILY;INTERVAL=2`（今天的槽位已过点，自动挪到下一格）；SSR 冒烟：用药页含「系统日历提醒」与返回按钮、计划页带入口卡时含「用药管理 / 待服用 / 每 2 天一次」、不传 `medication` 时不渲染入口、App 导航四项标签齐全且为 `grid-cols-4`。
- **数据红线**：无新增存储键（日历文件是临时产物，不落 localStorage）；版本号 versionCode 40 / versionName 2.9.1；CI `tag_name: v2.9.1`。

### 26. v2.9.2 通知权限自诊断 + .ics 真正能被系统日历打开（两个线上 Bug）
- **用户反馈（真机 v2.9.1）**：① 到点提醒开关已打开，界面仍提示「还没有通知权限」，右侧按钮点了没反应；② 导出的 .ics 在「打开方式」里没有系统日历，打开后文件里只有一句话。
- **Bug ② 根因（两条叠加，都在第三方插件侧）**：
  1. 写盘文件名用了中文 `fitcustom-用药提醒.ics`。`@capacitor/share` 的 `SharePlugin.shareFiles()` 用 `MimeTypeMap.getSingleton().getMimeTypeFromExtension(getFileExtensionFromUrl(url))` 反推类型，中文名取不到扩展名 → `type == null` → `intent.setType("*/*")` → 分享面板里只剩文本类 App，日历不出现。
  2. 分享时同时传了 `text`。`SharePlugin.java:117-122` 只要 `text != null` 就 `putExtra(EXTRA_TEXT)` 并 `setTypeAndNormalize("text/plain")`，接收方把整个 intent 当纯文本打开——用户看到的「文件里只有一句话」正是那段 text。
- **修法**：`MED_ICS_FILE_NAME` 改成 ASCII `fitcustom-medication.ics`（中文名只做展示常量 `MED_ICS_DISPLAY_NAME`）；分享文件**不再传 text**；并且不再只依赖分享面板——新增自研插件用 `ACTION_VIEW + text/calendar` 直达日历导入（国内 ROM 日历多只注册 VIEW，不注册 SEND）。
- **新原生插件 `MedicationNative`**（`android/app/src/main/java/com/fitcustom/pro/MedicationNativePlugin.java`，零第三方依赖）：
  - `notificationsEnabled()` → `NotificationManagerCompat.from(ctx).areNotificationsEnabled()`，返回 `{enabled, sdkInt}`；
  - `openNotificationSettings()` → API≥O 用 `Settings.ACTION_APP_NOTIFICATION_SETTINGS` + `EXTRA_APP_PACKAGE`，否则回落 `ACTION_APPLICATION_DETAILS_SETTINGS`，两级 try/catch，返回 `{opened}`；
  - `openIcsFile({uri})` → `file:` 走 `FileProvider.getUriForFile(ctx, pkg + ".fileprovider", file)`（复用 Manifest 里已有的 provider 与 `res/xml/file_paths.xml` 的 `<cache-path path=".">`），然后 `Intent.ACTION_VIEW.setDataAndType(uri, "text/calendar")` + `setClipData(ClipData.newRawUri(...))` + `FLAG_GRANT_READ_URI_PERMISSION`，拿不到 Activity 时返回 `{opened:false}` 让 JS 回退分享。
  - **注册位置铁律**：`MainActivity.onCreate()` 里 `registerPlugin(...)` 必须在 `super.onCreate(...)` **之前**（Bridge 在 super 里组装，之后注册无效）。
- **Bug ① 根因**：`LocalNotificationsPlugin` 的 `checkPermissions()` 在 API≥33 走 Capacitor 运行时权限（可能长期停在 `prompt`），而 `permissionsCallback` 只用 `areNotificationsEnabled()` 返回 granted/denied、永不返回 prompt；加上 Android 13+ 用户在二次拒绝后系统不再弹对话框，`requestPermissions()` 的 Promise 也可能长时间不回——两种表现都像「点了没反应」。
- **修法（`src/utils/medicationReminder.ts` + 新 `src/utils/medicationNative.ts`）**：
  - 双路校验：`decide(pluginPermission, nativeEnabled)` —— `prompt`/`unsupported` 原样返回，`granted` 但系统层面 `areNotificationsEnabled()===false` 判为 `denied`，其余取插件值；`ReminderPermissionInfo{permission, pluginPermission, nativeEnabled, error?}` 把原始值透传给界面。
  - `requestReminderPermissionInfo()` 用 `withTimeout(api.requestPermissions(), 6_000)`，超时后回读真实状态并带 `error:'request_timeout'`，界面不再"卡在提示上"。
  - 界面：`permission !== 'granted'` 时始终给出可点按钮（`prompt` → 「开启通知权限」，非 `unsupported` → 「打开系统通知设置」，外加「重新检测」），点击后显示忙态与结论；`granted` 时显示「通知已开启 · 已排期 N 条」；面板底部一行诊断（运行时权限 / 系统通知 / 排期条数 / 错误）。
  - `useMedication` 的 controller 新增 `permissionInfo`、`scheduled`、`syncError`、`recheckPermission`、`openNotificationSettings`；`requestPermission` 改为返回 `ReminderPermissionInfo`。
- **验证**：`npx tsc --noEmit`、`npm run build`、`npx cap sync android` 全绿；esbuild + node 的 ICS 用例确认文件名纯 ASCII、`13:00` 导出时起始槽位自动挪到 `2026-11-07`、`DTSTART:20261107T120000`、`RRULE:FREQ=DAILY;INTERVAL=2`、`TRIGGER:-PT0M`；SSR 冒烟覆盖 4 种权限态（prompt 有「开启通知权限」、denied 有「打开系统通知设置」、granted 显示「已排期」且无警告条、unsupported 只留「重新检测」）。
- **数据红线**：无新增存储键；versionCode 41 / versionName 2.9.2；CI `tag_name: v2.9.2`。Java 侧只新增一个插件文件 + `MainActivity` 一行注册，未改任何 Capacitor 官方插件源码（升级插件不会覆盖丢失）。

### 27. v2.8.17 日志页顶部双标签高亮
- **问题**：日志页「历史训练记录 / 体重与生活日志」两栏选中态只是白底加极细描边，在灰底容器上几乎看不出哪栏被选中。
- **修法**：选中态改为实色填充——训练记录用蓝底白字（bg-blue-600），体重日志用绿底白字（bg-emerald-600），各带同色阴影；未选中改为浅灰字，悬停时才显示白底。容器底色由 slate-200/70 调浅为 slate-100，内阴影去掉改用外阴影，让选中色块更跳。
- **验证**：390 视口实测两栏切换均正确高亮，截图确认蓝/绿实色块与白字对比清晰；tsc 与构建通过。
- **数据红线**：纯样式改动，无逻辑与存储变更；版本号 versionCode 36 / versionName 2.8.17。

---

## 三、 工程结构目录速查

```
健身应用程序/
├── .github/
│   └── workflows/
│       └── build-apk.yml          # GitHub Actions 云端自动构建打包工作流
├── android/
│   ├── fitcustom.keystore         # 固定签名密钥库（不可更换删除）
│   ├── key.properties             # 签名配置（密码 fitcustom，随仓库提交）
│   └── (Capacitor Android 原生容器工程)
│   ├── app/
│   │   ├── build.gradle           # 原生编译配置（版本号 versionCode/versionName、签名配置）
│   │   └── src/main/
│   │       ├── AndroidManifest.xml # 原生清单文件
│   │       └── java/com/fitcustom/pro/MainActivity.java # 原生入口
├── src/
│   ├── components/
│   │   ├── WorkoutView.tsx        # 今日训练主看板、开练面板、超级组专属面板
│   │   ├── PlansView.tsx          # 训练计划管理、编辑弹窗、动作负荷预设
│   │   ├── ExerciseLibraryView.tsx # 标准动作库、部位筛选、动作搜索、收藏
│   │   ├── WeightJournalView.tsx  # 日志记录中心：统计+日历+容量+目标曲线
│   │   ├── MedicationView.tsx     # 用药管理：今日状态卡、打卡、历史与漏服、提醒设置
│   │   ├── ErrorBoundary.tsx      # 全局渲染兜底：白屏救急卡片 + 重新加载
│   │   └── ConfirmSheet.tsx       # 全应用统一底部确认抽屉
│   ├── data/
│   │   ├── initialExercises.ts    # 预置官方完整动作库字典
│   │   └── initialPlans.ts        # 预置四大循环分化计划（含预设重量与超级组）
│   ├── types/
│   │   └── index.ts               # TypeScript 核心数据接口定义
│   ├── utils/
│   │   ├── sessionBuilder.ts      # 统一会话构建器：计划→进行中训练的唯一构造入口（含超级组阶梯注入）
│   │   ├── date.ts                # 本地日期工具：todayLocalDate，禁止再用 toISOString 取日期
│   │   ├── stats.ts               # 纯函数统计：容量/时长/连续打卡/周次数
│   │   ├── medication.ts          # 用药纯函数：48h 槽位、待办判定、依从率、格式化
│   │   ├── medicationReminder.ts   # 原生本地通知：幂等排程/撤销、通知 id 与应服日绑定
│   │   ├── useMedication.ts       # 用药状态中枢 hook：App 层单例，页面与弹层共用
│   │   └── storage.ts             # 数据持久化封装、进程内解析缓存、版本迁移、备份导出导入
│   ├── App.tsx                    # 主视图容器、顶部安全垫片、磨砂底部导航
│   └── main.tsx                   # 前端挂载入口
├── capacitor.config.ts            # Capacitor 移动端配置文件
├── package.json                   # 依赖与脚本定义
├── tailwind.config.js             # 视觉原子化样式配置
├── vite.config.ts                 # Vite 打包配置
└── DEVELOPMENT_HANDBOOK.md        # 本手册
```

---

## 四、 后续开发与日常维护工作流

在 ZCODE 中打开本目录后，日常维护只需使用以下标准命令：

### 1. 本地启动与调试
```bash
# 启动本地快速预览
npm run dev

# 浏览器打开 http://localhost:5173
```

### 2. 编译与 Android 原生同步
修改任何前端代码后，运行：
```bash
# 1. 执行 TypeScript 校验与生产编译
npm run build

# 2. 将编译产物同步到 android/ 原生工程
npx cap sync android
```

### 3. 一键发布新版本并自动生成 APK
当你完成功能改动并准备出新安装包时：
1. **递增版本号**：
   - 打开 `android/app/build.gradle`，将 `versionCode` 增加 1，将 `versionName` 设为新版本（如 `"2.3"`）；
   - 打开 `.github/workflows/build-apk.yml`，将 `tag_name` 设为相应版本（如 `v2.3.0`）；
2. **提交并推送代码**：
   ```bash
   git add -A
   git commit -m "feat: 你的更新说明"
   git push origin main
   ```
3. **获取安装包**：
   - GitHub Actions 会自动在云端完成打包；
   - 约 1.5 分钟后，可在 GitHub Releases 页面直接获取公开的直链下载：
     `https://github.com/WangyMax/-/releases`
     手机浏览器点开直接下载，免登录、免解压！
