export type QuestionEmployment = "Full-time" | "Intern";

export type QuestionLevel =
  | "Intern"
  | "New Grad"
  | "SDE-1"
  | "SDE-2"
  | "Senior"
  | "Staff"
  | "Principal";

export type QuestionDomain =
  | "OA"
  | "DSA"
  | "LLD"
  | "System Design"
  | "Fundamentals"
  | "Service"
  | "Project"
  | "Behavioral"
  | "Consulting"
  | "Full Stack"
  | "AI/ML"
  | "Data"
  | "Trading"
  | "PM"
  | "Mobile"
  | "Backend";

export type RealQuestion = {
  slug: string;
  title: string;
  prompt: string;
  example?: string;
  company: string;
  role: string;
  domain: QuestionDomain;
  employment: QuestionEmployment;
  level: QuestionLevel;
  years: number;
  publishedAt: string;
  comments: number;
  likes: number;
  body: string[];
  /** First page: one company, one level from intern → 20 years. */
  lead?: boolean;
};

/** Filter chips: product, service, fintech, consulting, trading. */
export const FEATURED_FILTER_COMPANIES = [
  "TCS",
  "Google",
  "Flipkart",
  "Accenture",
  "Amazon",
  "Infosys",
  "Goldman Sachs",
  "Swiggy",
] as const;

export const REAL_QUESTIONS: RealQuestion[] = [
  {
    slug: "tcs-intern-second-largest-and-keys",
    title: "Find the second-largest number, then explain primary vs foreign key",
    prompt:
      "Part A: given an integer array, return the second-largest distinct value. If it does not exist, return -1. Part B: in two sentences, what is a primary key and what is a foreign key? Give one table example.",
    example: "[4, 4, 1, 9, 9] → 4. Employee(id PK) and Order(employee_id FK → Employee.id).",
    company: "TCS",
    role: "Software Engineer Intern",
    domain: "Service",
    employment: "Intern",
    level: "Intern",
    years: 0,
    publishedAt: "2026-09-18",
    comments: 1,
    likes: 4,
    lead: true,
    body: [
      "TCS NQT / intern service round. They want a correct loop, not a fancy heap. Track largest and second while you walk. Skip duplicates of the max.",
      "For keys: primary key uniquely identifies a row. Foreign key points at another table's primary key. They often ask what happens if you delete a parent row — mention restrict vs cascade.",
    ],
  },
  {
    slug: "infosys-newgrad-url-and-sql",
    title: "What happens when you type a URL? Then write the manager-salary SQL",
    prompt:
      "Part A: walk through what happens after a user types https://example.com and hits enter — DNS, TCP, TLS, HTTP, browser render. Part B: table Employee(id, name, salary, managerId). Return names of employees who earn strictly more than their manager.",
    example:
      "Joe salary 70k, manager Sam 60k → Joe. Henry 80k, manager Max 90k → not in the result.",
    company: "Infosys",
    role: "Systems Engineer",
    domain: "Fundamentals",
    employment: "Full-time",
    level: "New Grad",
    years: 1,
    publishedAt: "2026-09-17",
    comments: 2,
    likes: 6,
    lead: true,
    body: [
      "New-grad service + product hybrid. For the URL: DNS lookup, TCP handshake, TLS, HTTP GET, HTML/CSS/JS parse, layout. Keep it to 8–10 spoken sentences.",
      "SQL: self-join Employee e to Employee m on e.managerId = m.id where e.salary > m.salary. CEO with NULL managerId drops out of the join — that is correct.",
    ],
  },
  {
    slug: "cognizant-sde1-resume-project",
    title: "Walk through one resume project: what you built, what broke, what you would redo",
    prompt:
      "Pick one project on your resume. In 4–5 minutes cover: the problem, your role, the architecture, one failure in production or in testing, and what you would change if you started again. They will interrupt with follow-ups on your stack.",
    example:
      "A college campus app with a Node API and Postgres. You owned the attendance module. The failure was a missing index on (student_id, date) that timed out on 50k rows.",
    company: "Cognizant",
    role: "Programmer Analyst",
    domain: "Project",
    employment: "Full-time",
    level: "SDE-1",
    years: 2,
    publishedAt: "2026-09-16",
    comments: 0,
    likes: 3,
    lead: true,
    body: [
      "Service-company project deep-dive. Speak in first person. Numbers help: users, latency, row counts. Do not list every library.",
      "They probe: why this database, how you deployed, who on-called, what you would do differently. If you cannot explain a line on the resume, they will park there.",
    ],
  },
  {
    slug: "accenture-consulting-dau-drop",
    title: "A payments app lost 10% daily active users — how do you investigate?",
    prompt:
      "You are the analyst on a UPI-style app. DAU fell 10% week over week. The PM wants a plan in 20 minutes: what you would measure, which cuts (city, OS, new vs old users), and what you would ship first if the drop is real.",
    example:
      "Android 12 in two states dropped. iOS and other states are flat. New-user activation is fine. Hypothesis: a Play Store update broke login on those devices.",
    company: "Accenture",
    role: "Business Analyst",
    domain: "Consulting",
    employment: "Full-time",
    level: "SDE-1",
    years: 3,
    publishedAt: "2026-09-15",
    comments: 3,
    likes: 8,
    lead: true,
    body: [
      "Consulting / BA case. Structure: confirm the metric, segment (geo, platform, tenure), check instrumentation, then product vs outage vs seasonality.",
      "They want a first action, not a 20-slide plan. Say what you would look at in the warehouse today and what you would ask engineering to hot-fix if a release matches the drop.",
    ],
  },
  {
    slug: "flipkart-sde2-inventory-flash-sale",
    title: "Build inventory that does not oversell in a flash sale",
    prompt:
      "Design and code an inventory service. Support: add a SKU with stock, place an order, cancel an order, and start a flash sale on a SKU with a max units per user. Two checkouts at the same time must not sell more units than you have.",
    example:
      "SKU A has 2 units. User 1 and user 2 both order 2 at the same time. Only one order succeeds. The other is rejected.",
    company: "Flipkart",
    role: "SDE-2",
    domain: "LLD",
    employment: "Full-time",
    level: "SDE-2",
    years: 4,
    publishedAt: "2026-09-14",
    comments: 3,
    likes: 7,
    lead: true,
    body: [
      "Machine coding / LLD. Split stock into available and reserved. placeOrder succeeds only if available >= qty. Flash sale: per-user cap + sale window.",
      "In production: one row per SKU with a version column or a row lock so two checkouts cannot both write stock = 0.",
    ],
  },
  {
    slug: "phonepe-data-running-total",
    title: "SQL: running total of successful payments per user per day",
    prompt:
      "Table payments(user_id, paid_at, amount, status). Write SQL that, for status = 'success' only, returns each user, each calendar day, that day's total, and a running total of amount for that user ordered by day.",
    example:
      "User 7: 1 Sep ₹100, 1 Sep ₹50, 3 Sep ₹20 → day 1 Sep total 150 running 150; 3 Sep total 20 running 170.",
    company: "PhonePe",
    role: "Data Analyst",
    domain: "Data",
    employment: "Full-time",
    level: "SDE-2",
    years: 5,
    publishedAt: "2026-09-13",
    comments: 2,
    likes: 9,
    lead: true,
    body: [
      "Filter success, truncate paid_at to date, GROUP BY user_id, day for the daily total. Then SUM(daily_total) OVER (PARTITION BY user_id ORDER BY day) for the running total.",
      "They ask about timezones (IST vs UTC) and whether a refund row should subtract — say you would add a type column and treat refund as negative.",
    ],
  },
  {
    slug: "razorpay-backend-idempotent-capture",
    title: "Make payment capture safe when the client retries",
    prompt:
      "API: capture(paymentId, amount, idempotencyKey). The client may send the same request twice if the network drops. The same key must return the first result and must not capture twice. A different key on the same payment must not capture twice either. A refund can arrive in the same second.",
    example:
      "capture(p1, 100, key-A) succeeds. Retry with key-A returns the same success. capture(p1, 100, key-B) is rejected.",
    company: "Razorpay",
    role: "Backend Engineer",
    domain: "Backend",
    employment: "Full-time",
    level: "SDE-2",
    years: 6,
    publishedAt: "2026-09-12",
    comments: 5,
    likes: 14,
    lead: true,
    body: [
      "Idempotency row unique on (merchantId, key) plus a payment row with status. One transaction. Same key → stored response. Lock the payment row so refund cannot interleave.",
      "Refund rejects unless status is already captured.",
    ],
  },
  {
    slug: "cred-android-debounce-search",
    title: "Debounce search so the list does not flicker",
    prompt:
      "Android screen: a search box hits an API that returns after a random delay. Debounce typing, cancel the in-flight call when the query changes, ignore late responses for an old query, and update the list without flashing items that are already on screen.",
    example:
      "User types \"cre\" then \"cred\". The \"cre\" response arrives last — it must not replace the \"cred\" results.",
    company: "CRED",
    role: "Android Engineer",
    domain: "Mobile",
    employment: "Full-time",
    level: "Senior",
    years: 7,
    publishedAt: "2026-09-11",
    comments: 0,
    likes: 2,
    lead: true,
    body: [
      "Debounce ~300 ms. Cancel the previous coroutine job. Tag each request with a query id and drop stale results. Use ListAdapter / DiffUtil so rows do not flash.",
      "Process death: restore the text, refetch, do not restore stale results.",
    ],
  },
  {
    slug: "swiggy-pm-rain-day-priority",
    title: "Pick 3 features for rain-day delivery and say what you cut",
    prompt:
      "It is monsoon. Delivery ETAs are slipping. You may ship only three changes this week across the rider app, the customer app, and the restaurant tool. What are the three, why those, what metric moves, and what do you explicitly not do?",
    example:
      "Ship: rain surcharge banner, batch nearby drops, pause non-SLA restaurants. Do not ship a new loyalty program this week.",
    company: "Swiggy",
    role: "Product Manager",
    domain: "PM",
    employment: "Full-time",
    level: "Senior",
    years: 8,
    publishedAt: "2026-09-10",
    comments: 4,
    likes: 11,
    lead: true,
    body: [
      "PM round. Frame the user (customer, rider, restaurant), the constraint (one week, three bets), and the metric (on-time %, cancel rate).",
      "They push on trade-offs: surcharge hurts conversion; batching hurts individual ETA. Name the kill criteria after 7 days.",
    ],
  },
  {
    slug: "atlassian-senior-search-acl",
    title: "Design search that never shows a page the user cannot open",
    prompt:
      "Users search across spaces of documents. Results must be ranked. A user must never see a hit for a page they cannot open. Edits should appear in search within a few seconds. The author who just saved should see their own edit immediately.",
    example:
      "User A cannot open Space Legal. Search for \"contract\" must not return Legal pages, even if they are the best text match.",
    company: "Atlassian",
    role: "Software Engineer",
    domain: "System Design",
    employment: "Full-time",
    level: "Senior",
    years: 10,
    publishedAt: "2026-09-09",
    comments: 3,
    likes: 8,
    lead: true,
    body: [
      "Write path: edit → event → indexer. Read path: query → search cluster with ACL filter → hydrate titles. Cache the user's allowed space ids.",
      "Ranking: title, recent edit in your space, then org popularity. Read-your-writes for the author from the primary.",
    ],
  },
  {
    slug: "uber-staff-city-matching",
    title: "Match riders to cabs at city scale when drivers move every few seconds",
    prompt:
      "Design matching for one city: ~50k drivers, locations updating every few seconds, a rider request must return a cab (or a reject) in under a second. Talk through geo index, fairness, surge, and what you drop if the matcher is overloaded.",
    example:
      "South Bombay at 7 pm. Nearest cab is 80 m away but has a 0.2 accept rate. Second-nearest is 200 m with 0.8 accept. Say which you dispatch and why.",
    company: "Uber",
    role: "Software Engineer",
    domain: "System Design",
    employment: "Full-time",
    level: "Staff",
    years: 12,
    publishedAt: "2026-09-08",
    comments: 3,
    likes: 10,
    lead: true,
    body: [
      "Grid or geo-hash cells. Update only the cell a driver leaves and enters. Query rider cell + neighbors. Score is not only distance: ETA, accept rate, a small tie-break.",
      "Overload: widen the cell, skip ranking, or queue. Do not rebuild a global tree every tick.",
    ],
  },
  {
    slug: "meta-ml-feed-ranking",
    title: "Design a ranking model for a home feed — and what you do when it is down",
    prompt:
      "You own ranking for a follow-graph feed. Features can include recency, affinity, and a lightweight model. The ranker will go down. Design training, serving, and the degraded path so the user never sees a blank feed.",
    example:
      "Ranker 5xx. Cache still has the last 50 post ids. Serve them in recency order in <200 ms. Log the degrade.",
    company: "Meta",
    role: "ML Engineer",
    domain: "AI/ML",
    employment: "Full-time",
    level: "Staff",
    years: 14,
    publishedAt: "2026-09-07",
    comments: 6,
    likes: 15,
    lead: true,
    body: [
      "Candidate generation from the follow graph + celebrity pull. Features: recency, author affinity, completion. Train offline, serve a small model on cached ids.",
      "Degrade: recency-only from the cache. Never block the feed on ranking. They will ask how you detect offline/online skew.",
    ],
  },
  {
    slug: "goldman-quant-stale-feed",
    title: "Detect a stale market-data feed, then count odd-zero windows in a tick series",
    prompt:
      "Part A: you consume a last-trade feed. How do you know the feed is stale versus the market is quiet? What do you page on? Part B: given an integer array of tick flags, count subarrays whose count of zeros is odd.",
    example:
      "No print for 800 ms on NIFTY while the heartbeat is alive → stale, not quiet. Array [0,1,0] → 4 odd-zero slices.",
    company: "Goldman Sachs",
    role: "Quantitative Analyst",
    domain: "Trading",
    employment: "Full-time",
    level: "Staff",
    years: 15,
    publishedAt: "2026-09-06",
    comments: 2,
    likes: 7,
    lead: true,
    body: [
      "Trading / quant. Stale vs quiet: heartbeat vs last-print vs exchange clock. Page if heartbeat dies or last-print age exceeds a per-symbol threshold while the book is still crossing.",
      "Part B is a prefix-parity count: even/odd zero prefixes. They want you to finish it, not skip it as 'just coding'.",
    ],
  },
  {
    slug: "amazon-principal-order-tracking",
    title: "Design order tracking for India-scale commerce",
    prompt:
      "Customers open an order and must see the current state (placed, packed, out for delivery, delivered) within a second. Sellers and 3PLs write events. Design APIs, storage, and what you do on a region outage during Big Billion Days. This is a principal-level scope conversation, not a coding pad.",
    example:
      "10M orders/day peak. A tracking page is read-heavy. Event 'out for delivery' from a 3PL can arrive twice. The customer must see one state.",
    company: "Amazon",
    role: "Principal Engineer",
    domain: "System Design",
    employment: "Full-time",
    level: "Principal",
    years: 18,
    publishedAt: "2026-09-05",
    comments: 5,
    likes: 12,
    lead: true,
    body: [
      "Event log per order, current-state projection in a store keyed by order id, cache on the read path. Idempotent event ids. 3PL retries must not flicker state backward without a rule.",
      "Outage: serve last-known state from cache, queue writes, do not take the place-order path down because tracking is sick.",
    ],
  },
  {
    slug: "google-principal-config-rollout",
    title: "Design a config rollout service used by every Google client",
    prompt:
      "Mobile and server clients fetch feature flags and config. You must roll out to 1% of users, pause on error-rate, and roll back in minutes. A bad flag must not take down search. Talk through targeting, caching, and who can press the button.",
    example:
      "Flag dark_mode to 1% Android in India. Error rate on that cohort doubles. Auto-pause and revert that flag only.",
    company: "Google",
    role: "Principal Engineer",
    domain: "System Design",
    employment: "Full-time",
    level: "Principal",
    years: 20,
    publishedAt: "2026-09-04",
    comments: 4,
    likes: 13,
    lead: true,
    body: [
      "Principal design. Versions of a config blob, targeting (platform, country, user-hash buckets), client cache + polling, a kill switch that does not depend on the same path as the bad flag.",
      "Authz: who can roll to 100%. Metrics: error rate on the treated cohort vs holdout. They care more about blast radius than about drawing a CDN.",
    ],
  },
  {
    slug: "microsoft-intern-unique-paths",
    title: "Count unique paths in a grid with blocked cells",
    prompt:
      "You are given an m × n grid. 0 is open, 1 is a wall. Start at the top-left cell. You may move only right or down. How many ways can you reach the bottom-right cell? Return the answer modulo 1,000,000,007.",
    example: "[[0,0,0],[0,1,0],[0,0,0]] → 2.",
    company: "Microsoft",
    role: "Software Engineer Intern",
    domain: "OA",
    employment: "Intern",
    level: "Intern",
    years: 0,
    publishedAt: "2026-09-03",
    comments: 0,
    likes: 3,
    body: [
      "OA / intern coding. dp[i][j] = ways to reach that cell. Walls are 0. First row and column stay 1 until a wall.",
    ],
  },
  {
    slug: "google-dsa-islands",
    title: "Count islands in a binary grid",
    prompt:
      "Given an m × n grid of '1' (land) and '0' (water), count islands. Land is connected up, down, left, or right — not diagonally.",
    example: "Three separate land blobs → 3.",
    company: "Google",
    role: "Software Engineer",
    domain: "DSA",
    employment: "Full-time",
    level: "New Grad",
    years: 1,
    publishedAt: "2026-09-02",
    comments: 2,
    likes: 9,
    body: [
      "Flood-fill each unseen land cell. Mention BFS if the grid is huge. Follow-up: islands that do not touch the border.",
    ],
  },
  {
    slug: "meta-lru-cache",
    title: "Implement an LRU cache with O(1) get and put",
    prompt:
      "Cache of capacity C. get(key) returns the value or -1. put inserts or updates. If full, evict the least recently used key. Both operations O(1).",
    example: "C=2. put 1, put 2, get 1, put 3 evicts 2.",
    company: "Meta",
    role: "Software Engineer",
    domain: "DSA",
    employment: "Full-time",
    level: "SDE-2",
    years: 5,
    publishedAt: "2026-09-01",
    comments: 6,
    likes: 18,
    body: [
      "Hashmap + doubly linked list. Follow-up is LFU if time remains.",
    ],
  },
  {
    slug: "wipro-service-oops-and-join",
    title: "Explain inheritance vs composition, then write an inner join vs left join",
    prompt:
      "Part A: when do you use inheritance, when composition? One example each from a payroll app. Part B: tables Employee and Department. Show the difference between INNER JOIN and LEFT JOIN when some employees have no department.",
    example:
      "INNER JOIN drops employees with NULL department_id. LEFT JOIN keeps them with NULL department name.",
    company: "Wipro",
    role: "Project Engineer",
    domain: "Fundamentals",
    employment: "Full-time",
    level: "SDE-1",
    years: 2,
    publishedAt: "2026-08-30",
    comments: 1,
    likes: 2,
    body: [
      "Service-company fundamentals. Inheritance is an is-a (PermanentEmployee is an Employee). Composition is has-a (Employee has a BankAccount).",
      "They often add: can Java have multiple inheritance of classes? No — interfaces yes.",
    ],
  },
  {
    slug: "deloitte-ba-stakeholder",
    title: "A client wants the report tomorrow and the data is dirty — what do you do?",
    prompt:
      "The partner promised a dashboard tomorrow. You found 12% of rows with missing region. The client meeting cannot move. How do you communicate, what do you ship, and what do you explicitly mark as not reliable?",
    example:
      "Ship the dashboard with a 'region unknown' bucket, a footnote, and a follow-up date to backfill. Do not silently drop the 12%.",
    company: "Deloitte",
    role: "Business Analyst",
    domain: "Consulting",
    employment: "Full-time",
    level: "SDE-1",
    years: 3,
    publishedAt: "2026-08-28",
    comments: 2,
    likes: 5,
    body: [
      "Consulting behavioral + judgment. Name the risk, offer a scoped deliverable, do not hide the hole. They listen for whether you protect the client from a wrong number.",
    ],
  },
  {
    slug: "adobe-fullstack-checkout",
    title: "Build a cart page: coupons, paise, and no flicker on update",
    prompt:
      "Full-stack slice. Cart: add, change qty, remove, subtotal. Coupons FLAT100, 10PERCENT, BUY2GET1 — some cannot stack. Money in paise. The list must not flash when a coupon recalculates.",
    example: "Two of SKU A at ₹300 with BUY2GET1 → pay ₹300.",
    company: "Adobe",
    role: "Full Stack Engineer",
    domain: "Full Stack",
    employment: "Full-time",
    level: "SDE-2",
    years: 6,
    publishedAt: "2026-08-26",
    comments: 2,
    likes: 6,
    body: [
      "Coupon engine is a pure function. Integer paise. Diff the line items. They will ask where the rule lives — client vs server. Server is source of truth; client can preview.",
    ],
  },
  {
    slug: "apple-ios-offline-queue",
    title: "Queue photo uploads when the phone is offline, then drain in order",
    prompt:
      "iOS app: user can queue up to 20 photo uploads. If the network drops, persist the queue. On reconnect, upload in the original order, show per-item progress, and do not duplicate a photo if the app is killed mid-upload.",
    example:
      "3 photos queued on airplane mode. App killed. Relaunch on wifi → all 3 upload once, in the same order.",
    company: "Apple",
    role: "iOS Engineer",
    domain: "Mobile",
    employment: "Full-time",
    level: "Senior",
    years: 8,
    publishedAt: "2026-08-24",
    comments: 1,
    likes: 4,
    body: [
      "Persist job ids + local file URLs. Idempotency key per photo so a retry does not create two server objects. Background URLSession if they ask about app-in-background.",
    ],
  },
  {
    slug: "amazon-behavioral-ownership",
    title: "Tell me about a launch you rolled back — numbers, not adjectives",
    prompt:
      "Amazon bar-raiser style. A launch you owned went wrong. What was the customer impact (orders/hour, error rate), what did you do in the first hour, who did you tell, and what changed in the process after?",
    example:
      "Checkout error rate 0.2% → 4% for 18 minutes. ~2,100 failed checkouts. You flipped the flag, posted in the war room, wrote the COE the next day.",
    company: "Amazon",
    role: "SDE-2",
    domain: "Behavioral",
    employment: "Full-time",
    level: "Senior",
    years: 8,
    publishedAt: "2026-08-22",
    comments: 4,
    likes: 9,
    body: [
      "Leadership Principles: Ownership, Dive Deep. Situation, action, number. They will ask what you would do differently — have one process change, not 'I would try harder'.",
    ],
  },
  {
    slug: "infosys-oa-string-window",
    title: "Smallest substring of S that contains all characters of T",
    prompt:
      "Given S and T, return the shortest substring of S that contains every character of T, including duplicates. If none, return empty string.",
    example: "S = ADOBECODEBANC, T = ABC → BANC. T = AA and S = A → empty.",
    company: "Infosys",
    role: "Digital Specialist Engineer",
    domain: "OA",
    employment: "Full-time",
    level: "SDE-1",
    years: 2,
    publishedAt: "2026-08-20",
    comments: 0,
    likes: 3,
    body: [
      "Sliding window with a need-count. Duplicates in T are the usual fail.",
    ],
  },
  {
    slug: "tcs-nqt-process-thread",
    title: "Process vs thread, then normalize this order table to 3NF",
    prompt:
      "Part A: process vs thread — memory, crash behavior, when you pick which. Part B: a table Orders(order_id, customer_name, customer_city, item, item_price, qty). What is wrong, and how do you put it in third normal form?",
    example:
      "customer_city belongs with Customer, item_price with Item. Orders should keep ids and qty.",
    company: "TCS",
    role: "Assistant System Engineer",
    domain: "Fundamentals",
    employment: "Full-time",
    level: "New Grad",
    years: 1,
    publishedAt: "2026-08-18",
    comments: 1,
    likes: 4,
    body: [
      "Service fundamentals. Threads share memory; a bad thread can take the process down. 3NF: no transitive dependency. Split Customer and Item out.",
    ],
  },
  {
    slug: "flipkart-frontend-machine-coding",
    title: "Machine-code a coupon cart in 90 minutes",
    prompt:
      "Same cart rules as a Flipkart UI round: add/remove/qty, FLAT100 / 10PERCENT / BUY2GET1, exclusion groups, paise. They review component split more than CSS.",
    example: "Removing an item must recompute BUY2GET1.",
    company: "Flipkart",
    role: "Frontend Engineer",
    domain: "Full Stack",
    employment: "Full-time",
    level: "SDE-2",
    years: 4,
    publishedAt: "2026-08-16",
    comments: 2,
    likes: 6,
    body: [
      "Pure coupon function. Call out bugs before they find them.",
    ],
  },
  {
    slug: "swiggy-sre-oncall",
    title: "P99 checkout latency doubled after a deploy — first 15 minutes",
    prompt:
      "You are on-call. Checkout P99 went 200 ms → 900 ms after a deploy 12 minutes ago. Error rate is still 0.3%. What do you look at, when do you roll back, and what do you tell the incident channel?",
    example:
      "Rollback at minute 8 because a new Redis pool size saturates connections. Customer-facing copy: 'elevated latency, placing an order still works'.",
    company: "Swiggy",
    role: "Site Reliability Engineer",
    domain: "Backend",
    employment: "Full-time",
    level: "Senior",
    years: 9,
    publishedAt: "2026-08-14",
    comments: 3,
    likes: 8,
    body: [
      "SRE. Dashboards: latency, sat, errors, deploy diff, dependency (Redis, DB). Rollback is cheaper than a 40-minute bisect during dinner peak. Write the timeline in the channel as you go.",
    ],
  },
  {
    slug: "goldman-sde-merge-calendars",
    title: "Find the earliest free slot that fits two trading-desk calendars",
    prompt:
      "Each person has busy intervals and working hours. Find the earliest slot of length D that is free for both. [1,2] and [2,3] overlap (inclusive ends).",
    example: "A busy 9:00–10:30, B busy 10:00–11:00, D = 30 → 11:00–11:30.",
    company: "Goldman Sachs",
    role: "Software Engineer",
    domain: "DSA",
    employment: "Full-time",
    level: "SDE-2",
    years: 5,
    publishedAt: "2026-08-12",
    comments: 1,
    likes: 5,
    body: [
      "Merge, invert to free, intersect. One coding question on a trading desk loop is normal — the rest of the loop is systems and markets.",
    ],
  },
  {
    slug: "capgemini-service-oops",
    title: "Design classes for a library: book, copy, member, loan",
    prompt:
      "Low-level design, service-company style. A library has books (ISBN), multiple copies, members, and loans. Support checkout, return, and 'list overdue copies'. No need for a web server — classes and methods.",
    example:
      "ISBN 978-X has 3 copies. Member M1 checks out copy 2. listOverdue() on day+15 returns that loan if the period is 14 days.",
    company: "Capgemini",
    role: "Software Engineer",
    domain: "LLD",
    employment: "Full-time",
    level: "SDE-1",
    years: 3,
    publishedAt: "2026-08-10",
    comments: 0,
    likes: 2,
    body: [
      "Book vs Copy is the point. Loan holds member + copy + due date. They ask about a copy that is lost — a status enum beats a boolean.",
    ],
  },
];

export const QUESTIONS_PAGE_SIZE = 10;

export const QUESTION_SORTS = ["level", "newest", "oldest"] as const;
export type QuestionSort = (typeof QUESTION_SORTS)[number];

export function getRealQuestion(slug: string): RealQuestion | undefined {
  return REAL_QUESTIONS.find((item) => item.slug === slug);
}

export function companyQuestionCounts(): { company: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of REAL_QUESTIONS) {
    counts.set(item.company, (counts.get(item.company) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count || a.company.localeCompare(b.company));
}

export function featuredQuestionCompanies(): { company: string; count: number }[] {
  const counts = new Map(companyQuestionCounts().map((row) => [row.company, row.count]));
  return FEATURED_FILTER_COMPANIES.map((company) => ({
    company,
    count: counts.get(company) ?? 0,
  })).filter((row) => row.count > 0);
}

export function formatQuestionDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = months[(month || 1) - 1] ?? "Jan";
  return `${day} ${monthLabel} ${year}`;
}

export function formatQuestionYears(years: number): string {
  if (years <= 0) return "0 years";
  if (years === 1) return "1 year";
  return `${years} years`;
}

function compareQuestions(a: RealQuestion, b: RealQuestion, sort: QuestionSort): number {
  if (sort === "level") {
    const byYears = a.years - b.years;
    if (byYears !== 0) return byYears;
    return a.company.localeCompare(b.company);
  }
  const delta = a.publishedAt.localeCompare(b.publishedAt);
  return sort === "oldest" ? delta : -delta;
}

function uniqueCompanyFirst(items: RealQuestion[]): RealQuestion[] {
  const seen = new Set<string>();
  const head: RealQuestion[] = [];
  const tail: RealQuestion[] = [];
  for (const item of items) {
    const key = item.company.toLowerCase();
    if (seen.has(key)) tail.push(item);
    else {
      seen.add(key);
      head.push(item);
    }
  }
  return [...head, ...tail];
}

export function filterRealQuestions(
  items: readonly RealQuestion[],
  {
    company,
    query,
    sort = "level",
  }: {
    company?: string;
    query?: string;
    sort?: QuestionSort;
  },
): RealQuestion[] {
  const needle = query?.trim().toLowerCase() ?? "";
  const filtered = items.filter((item) => {
    if (company && item.company.toLowerCase() !== company.toLowerCase()) return false;
    if (!needle) return true;
    const haystack =
      `${item.title} ${item.prompt} ${item.company} ${item.role} ${item.level} ${item.domain} ${item.years}`.toLowerCase();
    return haystack.includes(needle);
  });
  filtered.sort((a, b) => compareQuestions(a, b, sort));
  if (company) return filtered;
  if (sort === "level") {
    const lead = filtered.filter((item) => item.lead);
    const rest = filtered.filter((item) => !item.lead);
    return [...lead, ...rest];
  }
  return uniqueCompanyFirst(filtered);
}
