// ABOUTME: 模板库：覆盖 Mermaid 12 主要图类型的真实业务示例，用于“从模板新建”。
import type { Look, Theme } from "./model.ts";

export interface DiagramTemplate {
  id: string;
  kind: string;
  title: string;
  description: string;
  source: string;
  theme?: Theme;
  look?: Look;
}

export const templates: DiagramTemplate[] = [
  {
    id: "flowchart",
    kind: "流程图",
    title: "客服工单分派",
    description: "判断、回路与子图，适合业务流程和审批路径。",
    source: `flowchart TD
  new([客户提交工单]) --> classify{自动分类}
  classify -->|账单| billing[财务支持组]
  classify -->|技术问题| triage[一线技术支持]
  classify -->|无法识别| manual[人工分派]
  manual --> triage
  subgraph tech [技术支持]
    triage --> known{知识库有答案?}
    known -->|有| reply[回复解决步骤]
    known -->|没有| escalate[升级到二线工程师]
    escalate --> fix[定位并修复]
    fix --> reply
  end
  billing --> reply
  reply --> confirm{客户确认解决?}
  confirm -->|否| triage
  confirm -->|是| close([关闭工单并发送满意度调查])`,
  },
  {
    id: "sequence",
    kind: "时序图",
    title: "扫码支付",
    description: "参与者、激活条、条件分支与备注。",
    source: `sequenceDiagram
  autonumber
  actor 顾客
  participant App as 商家 App
  participant Pay as 支付网关
  participant Bank as 银行
  顾客->>App: 选择商品并下单
  App->>Pay: 创建支付单（订单号、金额）
  activate Pay
  Pay-->>App: 返回支付二维码
  App-->>顾客: 展示二维码
  顾客->>Bank: 扫码并确认付款
  Bank->>Pay: 扣款结果通知
  alt 扣款成功
    Pay->>App: 回调：支付成功
    App-->>顾客: 显示取餐号
  else 余额不足
    Pay->>App: 回调：支付失败
    App-->>顾客: 提示更换付款方式
  end
  deactivate Pay
  Note over App,Pay: 回调需校验签名并做幂等处理`,
  },
  {
    id: "class",
    kind: "类图",
    title: "订单领域模型",
    description: "类、属性、方法、继承与关联基数。",
    source: `classDiagram
  direction LR
  class Order {
    +String orderNo
    +OrderStatus status
    +Money total()
    +cancel(reason)
  }
  class OrderLine {
    +String sku
    +int quantity
    +Money unitPrice
  }
  class Customer {
    +String name
    +String phone
  }
  class Payment {
    <<abstract>>
    +Money amount
    +refund()
  }
  class CardPayment
  class WalletPayment
  Customer "1" --> "*" Order : 下单
  Order "1" *-- "1..*" OrderLine : 包含
  Order "1" --> "0..1" Payment : 支付
  Payment <|-- CardPayment
  Payment <|-- WalletPayment`,
  },
  {
    id: "state",
    kind: "状态图",
    title: "订单状态流转",
    description: "起止状态、复合状态与转换条件。",
    source: `stateDiagram-v2
  [*] --> 待支付
  待支付 --> 已取消: 超时 30 分钟
  待支付 --> 已支付: 支付成功
  已支付 --> 履约中
  state 履约中 {
    [*] --> 拣货
    拣货 --> 打包
    打包 --> 运输
    运输 --> [*]
  }
  履约中 --> 已签收: 客户签收
  已签收 --> 售后中: 申请退货
  售后中 --> 已退款: 审核通过
  已签收 --> [*]
  已退款 --> [*]
  已取消 --> [*]`,
  },
  {
    id: "er",
    kind: "实体关系图",
    title: "图书馆借阅数据库",
    description: "实体字段、主外键与一对多关系。",
    source: `erDiagram
  READER ||--o{ LOAN : borrows
  BOOK ||--o{ COPY : has
  COPY ||--o{ LOAN : "is lent in"
  BRANCH ||--o{ COPY : stores
  READER {
    int id PK
    string name
    string card_no UK
    date joined_at
  }
  BOOK {
    string isbn PK
    string title
    string author
  }
  COPY {
    int id PK
    string isbn FK
    int branch_id FK
    string shelf
  }
  LOAN {
    int id PK
    int reader_id FK
    int copy_id FK
    date due_on
    date returned_on
  }
  BRANCH {
    int id PK
    string name
  }`,
  },
  {
    id: "gantt",
    kind: "甘特图",
    title: "移动端 3.0 发布计划",
    description: "分区、依赖、里程碑与关键任务。",
    source: `gantt
  title 移动端 3.0 发布计划
  dateFormat YYYY-MM-DD
  axisFormat %m/%d
  tickInterval 1week
  excludes weekends
  section 设计
    需求评审          :done, req, 2026-11-02, 3d
    交互与视觉稿      :done, ui, after req, 6d
  section 开发
    账户与登录        :active, dev1, after ui, 8d
    订单与支付        :dev2, after ui, 10d
    推送通知          :dev3, after dev1, 4d
  section 测试与上线
    集成测试          :crit, qa, after dev2, 5d
    应用商店审核      :store, after qa, 3d
    正式发布          :milestone, after store, 0d`,
  },
  {
    id: "mindmap",
    kind: "思维导图",
    title: "季度复盘",
    description: "中心主题与多级分支，适合会议整理。",
    source: `mindmap
  root((Q3 复盘))
    做得好
      新客转化提升 18%
      客服响应缩短到 2 小时
    待改进
      发布频率不稳定
      夜间告警误报多
        调整阈值
        增加值班手册
    下季度重点
      会员体系上线
      数据看板统一
      招聘两名后端`,
  },
  {
    id: "timeline",
    kind: "时间线",
    title: "产品发展历程",
    description: "按时期分组的事件序列。",
    source: `timeline
  title 记账应用发展历程
  section 起步
    2021 : 个人项目上线 : 支持手动记账
    2022 : 接入银行卡账单导入
  section 增长
    2023 : 家庭共享账本 : 月活突破 10 万
    2024 : 预算提醒与分类报表
  section 平台化
    2025 : 开放 API : 发布桌面端
    2026 : 智能分类与年度报告`,
  },
  {
    id: "pie",
    kind: "饼图",
    title: "工单类型分布",
    description: "占比数据，显示数值。",
    source: `pie showData
  title 10 月客服工单类型
  "账单与发票" : 312
  "登录问题" : 186
  "功能咨询" : 154
  "缺陷反馈" : 97
  "其他" : 41`,
  },
  {
    id: "quadrant",
    kind: "象限图",
    title: "需求优先级评估",
    description: "两个维度上的定位与象限标注。",
    source: `quadrantChart
  title 需求优先级：价值 × 成本
  x-axis 低实现成本 --> 高实现成本
  y-axis 低用户价值 --> 高用户价值
  quadrant-1 规划排期
  quadrant-2 立即去做
  quadrant-3 暂缓
  quadrant-4 重新评估
  批量导出: [0.25, 0.82]
  深色模式: [0.35, 0.55]
  离线同步: [0.8, 0.86]
  自定义报表: [0.7, 0.42]
  动画引导: [0.2, 0.2]
  多语言: [0.62, 0.68]`,
  },
  {
    id: "journey",
    kind: "用户旅程",
    title: "新用户开户体验",
    description: "阶段、任务、满意度评分与参与者。",
    source: `journey
  title 新用户在线开户
  section 了解
    看到广告并进入官网: 4: 用户
    比较费率: 3: 用户
  section 注册
    填写手机号与验证码: 4: 用户
    上传身份证: 2: 用户, 审核系统
    人脸识别: 3: 用户, 审核系统
  section 激活
    设置交易密码: 4: 用户
    首次入金: 5: 用户, 客服`,
  },
  {
    id: "gitgraph",
    kind: "Git 分支图",
    title: "版本发布分支",
    description: "主干、特性分支、合并与热修复。",
    source: `gitGraph
  commit id: "v2.3.0"
  branch develop
  checkout develop
  commit id: "搜索改版"
  branch feature/export
  checkout feature/export
  commit id: "导出 PDF"
  commit id: "导出测试"
  checkout develop
  merge feature/export
  checkout main
  branch hotfix
  checkout hotfix
  commit id: "修复登录超时"
  checkout main
  merge hotfix tag: "v2.3.1"
  checkout develop
  merge main
  commit id: "准备 2.4"
  checkout main
  merge develop tag: "v2.4.0"`,
  },
  {
    id: "architecture",
    kind: "架构图",
    title: "Web 应用部署架构",
    description: "分组、服务与连接方向。",
    source: `architecture-beta
  group edge(cloud)[公网入口]
  group app(server)[应用集群]
  group data(database)[数据层]

  service cdn(internet)[CDN] in edge
  service lb(server)[负载均衡] in edge
  service api(server)[API 服务] in app
  service worker(server)[异步任务] in app
  service db(database)[PostgreSQL] in data
  service cache(disk)[Redis] in data

  cdn:R --> L:lb
  lb:R --> L:api
  api:B --> T:worker
  api:R --> L:db
  worker:R --> L:cache`,
  },
  {
    id: "xychart",
    kind: "XY 图表",
    title: "月度收入与目标",
    description: "柱状与折线组合图。",
    source: `xychart-beta
  title "2026 上半年收入（万元）"
  x-axis ["1月", "2月", "3月", "4月", "5月", "6月"]
  y-axis "收入" 0 --> 160
  bar [82, 76, 104, 118, 131, 142]
  line [90, 95, 100, 110, 120, 130]`,
  },
  {
    id: "sankey",
    kind: "桑基图",
    title: "注册转化漏斗",
    description: "流量来源与去向的数量关系（桑基图节点名仅支持英文/ASCII）。",
    source: `sankey-beta
Search,Website,4200
Social,Website,2600
Referral,Website,1300
Website,Sign-up started,3100
Website,Bounced,5000
Sign-up started,Account created,2400
Sign-up started,Abandoned,700`,
  },
  {
    id: "kanban",
    kind: "看板",
    title: "迭代看板",
    description: "列与卡片，显示负责人和优先级。",
    source: `kanban
  todo[待开始]
    t1[导出 PNG 支持透明背景]@{ assigned: '王敏', priority: 'High' }
    t2[模板缩略图懒加载]@{ assigned: '李浩' }
  doing[进行中]
    t3[错误行内标记]@{ assigned: '陈晨', priority: 'Very High' }
  review[评审中]
    t4[文件名安全处理]@{ assigned: '王敏' }
  done[已完成]
    t5[Markdown 代码块导入]`,
  },
  {
    id: "requirement",
    kind: "需求图",
    title: "登录安全需求追踪",
    description: "需求、风险等级与验证关系。",
    source: `requirementDiagram
  requirement login_limit {
    id: "SEC-1"
    text: "同一账号 5 分钟内失败 5 次后锁定"
    risk: high
    verifymethod: test
  }
  functionalRequirement second_factor {
    id: "SEC-2"
    text: "新设备登录需要短信验证码"
    risk: medium
    verifymethod: demonstration
  }
  element auth_service {
    type: "认证服务"
  }
  element load_test {
    type: "压测脚本"
  }
  auth_service - satisfies -> login_limit
  auth_service - satisfies -> second_factor
  load_test - verifies -> login_limit`,
  },
];

export function templateById(id: string): DiagramTemplate | undefined {
  return templates.find((template) => template.id === id);
}
