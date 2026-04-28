# Toonflow 二次开发手册

> 基于 Toonflow v1.1.6，面向二次开发的完整技术文档。

---

## 📌 项目概述

**Toonflow** 是一个 AI 短剧工厂应用，核心流程：**小说 → 剧本 → 分镜 → 素材生成 → 视频出片**。

技术栈：
- **后端**：Express + TypeScript + Socket.IO
- **前端**：Electron（桌面端），Vite 构建的 Web 前端在 `data/web/`
- **AI 层**：Vercel AI SDK（`ai` 包），支持多供应商可编程接入
- **数据库**：SQLite（本地），通过 `u.db()` 调用 Knex
- **向量记忆**：ONNX（`all-MiniLM-L6-v2`），本地向量检索

---

## 📁 目录结构速查

```
Toonflow-app/
├── src/
│   ├── app.ts                  # 应用入口，Express + Socket.IO 服务启动
│   ├── core.ts                 # 自动路由生成器（扫描 routes/ 自动注册）
│   ├── router.ts               # 自动生成的路由文件（勿手动编辑）
│   ├── env.ts                  # 环境变量判断（dev/prod/electron）
│   ├── err.ts                  # 全局错误处理
│   ├── logger.ts               # 日志配置
│   │
│   ├── agents/                 # 🤖 核心 Agent 模块
│   │   ├── scriptAgent/        # 编剧 Agent（小说→剧本）
│   │   │   ├── index.ts        # 决策层入口 + 子Agent调度
│   │   │   └── tools.ts        # Agent 工具集（查事件、取数据等）
│   │   └── productionAgent/    # 制作 Agent（剧本→视频）
│   │       ├── index.ts        # 决策层入口 + 子Agent调度
│   │       └── tools.ts        # Agent 工具集（资产管理、分镜操作等）
│   │
│   ├── routes/                 # 🌐 API 路由（文件即路由）
│   │   ├── project/            # 项目 CRUD
│   │   ├── script/             # 剧本相关
│   │   ├── novel/              # 小说管理
│   │   ├── assets/             # 素材管理
│   │   ├── assetsGenerate/     # 素材生成（图片批量生成等）
│   │   ├── agents/             # Agent 记忆管理
│   │   ├── artStyle/           # 画风管理
│   │   ├── cornerScape/        # 角落场景（音频绑定等）
│   │   ├── task/               # 任务管理
│   │   ├── setting/            # 设置
│   │   ├── login/              # 登录
│   │   ├── modelSelect/        # 模型选择
│   │   ├── production/         # 制作流程
│   │   ├── scriptAgent/        # 编剧Agent接口
│   │   └── ...
│   │
│   ├── socket/                 # 🔌 Socket.IO 实时通信
│   │   ├── index.ts            # Socket 初始化与事件分发
│   │   ├── resTool.ts          # 响应工具（消息推送、进度反馈）
│   │   └── routes/             # Socket 路由模块
│   │
│   ├── utils/                  # 🔧 工具函数
│   │   ├── db.ts               # 数据库操作封装（Knex/SQLite）
│   │   ├── ai.ts               # AI 调用统一封装（文本/图片/视频/TTS）
│   │   ├── vendor.ts           # 供应商系统核心（模型列表、请求转发）
│   │   ├── oss.ts              # 对象存储（素材文件管理）
│   │   ├── vm.ts               # VM 沙箱（执行供应商自定义代码）
│   │   ├── getPrompts.ts       # Prompt 获取
│   │   ├── getArtPrompt.ts     # 画风 Prompt
│   │   ├── getConfig.ts        # 配置读取
│   │   ├── getPath.ts          # 路径工具（区分 Electron/服务器）
│   │   ├── stripThink.ts       # 去除 AI 思考标签
│   │   ├── cleanNovel.ts       # 小说清洗
│   │   ├── taskRecord.ts       # 任务记录
│   │   ├── replaceUrl.ts       # URL 替换
│   │   ├── writeVersion.ts     # 版本写入
│   │   └── agent/              # Agent 相关工具
│   │       ├── memory.ts       # 🧠 记忆系统（短期/长期/向量检索）
│   │       ├── skillsTools.ts  # Skill 文件解析与工具生成
│   │       └── embedding.ts    # ONNX 向量嵌入
│   │
│   ├── lib/                    # 初始化与辅助
│   │   ├── initDB.ts           # 数据库初始化
│   │   ├── fixDB.ts            # 数据库修复迁移
│   │   └── responseFormat.ts   # 响应格式化
│   │
│   ├── middleware/             # Express 中间件
│   └── types/                  # TypeScript 类型定义
│
├── data/                       # 运行时数据目录
│   ├── skills/                 # 📝 Agent Skill 文件（可在线编辑）
│   │   ├── script_agent_decision.md      # 编剧决策层提示词
│   │   ├── script_agent_supervision.md   # 编剧监督层提示词
│   │   ├── script_execution_*.md         # 编剧执行子Agent提示词
│   │   ├── production_agent_decision.md  # 制作决策层提示词
│   │   ├── production_agent_supervision.md
│   │   ├── production_execution_*.md     # 制作执行子Agent提示词
│   │   ├── art_skills/                  # 画风相关 Skills
│   │   ├── production_skills/           # 制作相关 Skills
│   │   └── story_skills/                # 故事相关 Skills
│   │
│   ├── models/                 # AI 模型文件
│   │   └── all-MiniLM-L6-v2/  # ONNX 向量模型
│   │
│   ├── vendor/                 # 供应商自定义代码（可编程）
│   ├── web/                    # 前端构建产物
│   └── assets/                 # 素材文件
│
├── scripts/                    # 构建与打包脚本
│   ├── build.ts                # 后端构建
│   ├── main.ts                 # Electron 入口
│   └── install scripts/        # 安装脚本
│
├── package.json
├── tsconfig.json
├── Dockerfile
└── electron-builder.yml
```

---

## 🤖 Agent 架构详解

Toonflow 采用 **三层 Agent 协作体系**：

```
用户消息
    ↓
┌─────────────────────────┐
│   决策层 (Decision AI)   │  理解意图 → 拆解任务 → 调度子Agent
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│   执行层 (Sub Agents)     │  各司其职：骨架/改编/剧本/资产/分镜...
└──────────┬──────────────┘
           ↓
┌─────────────────────────┐
│   监督层 (Supervision)   │  质量审查 → 反馈修订
└─────────────────────────┘
```

### 编剧 Agent（ScriptAgent）

负责 **小说 → 剧本** 的全流程：

| Agent Key | 功能 | Skill 文件 |
|-----------|------|-----------|
| `scriptAgent:decisionAgent` | 理解用户意图，拆解任务 | `script_agent_decision.md` |
| `scriptAgent:storySkeletonAgent` | 提取故事骨架 | `script_execution_skeleton.md` |
| `scriptAgent:adaptationStrategyAgent` | 制定改编策略 | `script_execution_adaptation.md` |
| `scriptAgent:scriptAgent` | 生成剧本正文 | `script_execution_script.md` |
| `scriptAgent:supervisionAgent` | 审查剧本质量 | `script_agent_supervision.md` |

**核心工具**（`src/agents/scriptAgent/tools.ts`）：
- `get_novel_events` — 查询章节事件
- `get_planData` / `save_planData` — 读写工作区数据（骨架、策略、剧本）
- `get_chapters` — 获取小说章节内容
- `save_script` — 保存剧本

### 制作 Agent（ProductionAgent）

负责 **剧本 → 视频** 的全流程：

| Agent Key | 功能 | Skill 文件 |
|-----------|------|-----------|
| `productionAgent:decisionAgent` | 理解制作意图 | `production_agent_decision.md` |
| `productionAgent:deriveAssetsAgent` | 衍生资产生成 | `production_execution_derive_assets.md` |
| `productionAgent:generateAssetsAgent` | 素材生成（图片/视频） | `production_execution_generate_assets.md` |
| `productionAgent:directorPlanAgent` | 导演计划 | `production_execution_director_plan.md` |
| `productionAgent:storyboardGenAgent` | 分镜生成 | `production_execution_storyboard_gen.md` |
| `productionAgent:storyboardPanelAgent` | 分镜面板操作 | `production_execution_storyboard_panel.md` |
| `productionAgent:storyboardTableAgent` | 分镜表格管理 | `production_execution_storyboard_table.md` |
| `productionAgent:supervisionAgent` | 制作质量监督 | `production_agent_supervision.md` |

**核心工具**（`src/agents/productionAgent/tools.ts`）：
- `get_flowData` / `save_flowData` — 读写工作区数据（剧本、计划、资产、分镜）
- `generate_image` — 生成图片素材
- `generate_video` — 生成视频
- `batch_generate_image` — 批量图片生成
- `tts_generate` — 语音生成
- Skill 工具 — 自动从 `data/skills/` 目录加载

---

## 🧠 记忆系统

```
src/utils/agent/
├── memory.ts       # Memory 类：管理短期/长期/向量记忆
├── embedding.ts    # ONNX 嵌入模型加载与向量化
└── skillsTools.ts  # Skill 文件解析工具
```

**Memory 类核心能力**：
- **短期记忆**：最近的对话消息（N条）
- **长期摘要**：定期总结的历史对话
- **向量检索（RAG）**：基于 ONNX 的语义相似度搜索
- **Agent 工具**：`memory.getTools()` 返回 Agent 可调用的记忆工具

```typescript
// 使用示例
const memory = new Memory("scriptAgent", projectId);
await memory.add("user", "用户消息");
const mem = await memory.get("查询文本");
// mem.rag        → 语义相关记忆
// mem.summaries  → 历史摘要
// mem.shortTerm  → 近期对话
```

---

## 🔌 API 路由系统

路由采用 **文件系统路由**（`src/core.ts` 自动生成）：

```
src/routes/
├── project/addProject.ts      → POST /api/project/addProject
├── project/getProject.ts      → GET  /api/project/getProject
├── script/addScript.ts        → POST /api/script/addScript
├── assetsGenerate/generateAssets.ts  → POST /api/assetsGenerate/generateAssets
└── ...
```

**新增路由**：在 `src/routes/` 下创建 `.ts` 文件，导出 Express Router 即可，开发环境自动注册。

---

## 🤖 可编程供应商系统

Toonflow 支持在设置中心编写自定义供应商逻辑，运行在 VM 沙箱中（`src/utils/vm.ts`）。

核心文件：
- `src/utils/vendor.ts` — 供应商注册、模型列表、请求转发
- `src/utils/vm.ts` — 安全沙箱执行用户代码
- `data/vendor/` — 存储用户编写的供应商代码
- `src/lib/vendor.json` — 供应商模板定义

---

## 📝 Skill 文件系统

Agent 的核心提示词外化为 Markdown 文件（`data/skills/`），支持在线编辑、即时生效。

**Skill 文件格式**：
```markdown
---
name: agent_name
description: Agent 描述
tools: [tool1, tool2]    # 可用工具列表
---

# Role
你是一个...

## 任务
1. ...
2. ...
```

**工具类 Skill**（`art_skills/`、`production_skills/`、`story_skills/`）：
- 通过 `createSkillTools()` 自动解析为 Agent 可调用的工具
- 支持带参数的 Prompt 模板

---

## 🗄️ 数据库

SQLite + Knex，主要表（`src/types/database.d.ts`）：
- `o_project` — 项目（小说名称、类型、画风、模型配置）
- `o_novel` — 小说章节（内容、事件图谱）
- `o_script` — 剧本
- `o_asset` — 素材（角色/道具/场景/片段）
- `o_storyboard` — 分镜
- `o_agentDeploy` — Agent 模型部署配置
- `o_vendor` — 供应商配置

调用方式：
```typescript
import u from "@/utils";

// 查询
const project = await u.db("o_project").where("id", id).first();

// 写入
await u.db("o_script").insert({ name, content, projectId });

// 更新
await u.db("o_project").where("id", id).update({ name: "新名称" });
```

---

## 🚀 二次开发常见场景

### 1. 新增一个子 Agent

1. 在 `data/skills/` 创建 Skill 文件（如 `production_execution_xxx.md`）
2. 在 `src/utils/ai.ts` 的 `AiType` 中注册类型
3. 在对应 Agent 的 `index.ts` 中的 `createSubAgent()` 注册子Agent
4. 在数据库 `o_agentDeploy` 表配置模型

### 2. 新增 API 路由

在 `src/routes/` 下创建文件，导出 Router：

```typescript
// src/routes/myFeature/doSomething.ts
import { Router } from "express";
const router = Router();
router.post("/doSomething", async (req, res) => {
  const result = await u.db("o_xxx").select("*");
  res.json({ code: 0, data: result });
});
export default router;
// → POST /api/myFeature/doSomething
```

### 3. 新增 Agent 工具

在对应 Agent 的 `tools.ts` 中添加：

```typescript
my_tool: tool({
  description: "工具描述",
  inputSchema: z.object({
    param1: z.string().describe("参数说明"),
  }),
  execute: async ({ param1 }) => {
    // 业务逻辑
    return "结果";
  },
}),
```

### 4. 接入新 AI 供应商

在设置中心的供应商管理页面编写供应商代码（或直接编辑 `data/vendor/` 下的文件），参考 `src/lib/vendor.json` 中的模板。

### 5. 修改 Agent 行为（最简单）

**直接编辑 Skill 文件**（`data/skills/*.md`），无需重启即可生效（部分需重启）。

---

## 🛠 开发环境搭建

```bash
# 安装依赖
yarn install

# 开发模式（后端热重载）
yarn dev

# 开发模式（Electron 桌面端）
yarn dev:gui

# 生产构建
yarn build

# 打包 Electron 应用
yarn dist:win     # Windows
yarn dist:mac     # macOS
```

**依赖核心**：
- `ai` — Vercel AI SDK（LLM 调用）
- `express` + `socket.io` — HTTP + WebSocket
- `knex` + `better-sqlite3` — 数据库
- `electron` — 桌面端
- `onnxruntime-node` — 本地向量嵌入

---

## 💡 二开注意事项

1. **`src/router.ts` 是自动生成的**，不要手动编辑，会被覆盖
2. **Skill 文件是修改 Agent 行为的首选方式**，优先改 MD 而不是改 TS
3. **`@/` 路径别名**指向 `src/`（tsconfig paths 配置）
4. **`u.db()`** 是全局数据库实例，直接操作 SQLite
5. **`u.Ai.Text()`** 统一了 AI 文本调用，传入 Agent key 自动解析模型
6. **Socket 通信**用于 Agent 实时进度推送，新增功能时考虑是否需要实时反馈
7. **供应商代码运行在 VM 沙箱中**，有安全隔离，但不要在核心逻辑中依赖特定供应商
