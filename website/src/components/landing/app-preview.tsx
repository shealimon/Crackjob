"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CrackLogo } from "@/components/crack-logo";

const DSA_APPROACH =
  "Scan every cell. On land ('1'), increment the island count and DFS/BFS to mark the whole connected component as water so it is never counted twice.";

const DSA_CODE_PLAIN = `class Solution:
  def numIslands(self, grid):
    if not grid: return 0
    R, C = len(grid), len(grid[0])
    n = 0
    def dfs(r, c):
      if r<0 or c<0 or r>=R or c>=C or grid[r][c]!="1":
        return
      grid[r][c] = "0"
      dfs(r+1,c); dfs(r-1,c)
      dfs(r,c+1); dfs(r,c-1)
    for r in range(R):
      for c in range(C):
        if grid[r][c] == "1":
          n += 1; dfs(r, c)
    return n`;

/**
 * Hero demo of the REAL Crackjob desktop app UI
 * (toolbar + response overlay) — not a third-party clone.
 */

type Phase =
  | "idle"
  | "started"
  | "keys-h"
  | "shot"
  | "keys-enter"
  | "dsa-answer"
  | "sql-keys-h"
  | "sql-shot"
  | "sql-keys-enter"
  | "sql-answer"
  | "ds-keys-h"
  | "ds-shot"
  | "ds-keys-enter"
  | "ds-answer"
  | "listening-beh"
  | "audio-beh-q"
  | "keys-enter-beh"
  | "beh-answer"
  | "listening-hld"
  | "audio-hld-q"
  | "keys-enter-hld"
  | "hld-answer";

type ProblemKind = "dsa" | "sql" | "ds";

const DSA_QUESTION = {
  title: "Number of Islands",
  meta: "Medium · Coding · Screenshot",
  line: "Count islands of connected '1's in the grid (4-direction).",
  body: "Given an m x n 2D binary grid which represents a map of '1's (land) and '0's (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.",
  example:
    'Input: grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]] → Output: 3',
  constraints: ["m == grid.length, n == grid[i].length", "1 ≤ m, n ≤ 300", "grid[i][j] is '0' or '1'"],
};

const SQL_QUESTION = {
  title: "Employees Earning More Than Managers",
  meta: "Medium · SQL · Screenshot",
  line: "Write a SQL query to find employees who earn more than their managers.",
  body: "Table Employee contains employee information: id, name, salary, and managerId (nullable). Write a solution to find the names of employees whose salary is strictly greater than their manager's salary. Return the result table in any order.",
  schema:
    "Employee(id INT PK, name VARCHAR, salary INT, managerId INT NULL) — managerId references Employee.id",
  example:
    "Input: id=1 Joe 70000 mgr=3; id=2 Henry 80000 mgr=4; id=3 Sam 60000 mgr=NULL; id=4 Max 90000 mgr=NULL → Output: Joe (only Joe earns more than his manager Sam)",
  constraints: [
    "1 ≤ Employee.id ≤ 1000",
    "salary is a positive integer",
    "managerId is either NULL or a valid Employee.id",
  ],
};

const DS_QUESTION = {
  title: "Fraud detection on imbalanced data",
  meta: "Medium · Data Science · Screenshot",
  line: "Build & evaluate a fraud model when positives are ~0.2% of transactions.",
  body: "You are given historical credit-card transactions. About 0.2% are fraudulent. Design an end-to-end approach: problem framing, features, model choice, how you handle class imbalance, evaluation metrics, and what you would ship to production (including monitoring).",
  example:
    "Constraint: maximize fraud recall while keeping precision ≥ 0.85 so the review queue stays manageable. Use time-based validation (train on past weeks, test on future week) — no random shuffle.",
  constraints: [
    "Severe class imbalance (~1:500)",
    "Label delay possible (chargebacks arrive late)",
    "Must explain top drivers to risk ops",
  ],
};

const SQL_CODE = `<span class="kw">SELECT</span> e.name <span class="kw">AS</span> Employee
<span class="kw">FROM</span> Employee e
<span class="kw">INNER JOIN</span> Employee m
&nbsp;&nbsp;<span class="kw">ON</span> e.managerId = m.id
<span class="kw">WHERE</span> e.salary &gt; m.salary;`;

const DS_CODE = `<span class="kw">from</span> sklearn.metrics <span class="kw">import</span> precision_recall_curve
<span class="cm"># time-based split + class_weight / scale_pos_weight</span>
<span class="var">model</span>.<span class="fn">fit</span>(X_train, y_train, sample_weight=w)
<span class="var">p</span> = <span class="var">model</span>.<span class="fn">predict_proba</span>(X_test)[:, <span class="num">1</span>]
<span class="cm"># pick threshold where precision &gt;= 0.85, max recall</span>`;

const BEH_QUESTION = {
  title: "Tell me about a conflict with a teammate",
  meta: "Behavioral · Audio",
  line: "Describe a time you disagreed on a technical decision — what happened, and what did you do?",
};

const HLD_QUESTION = {
  title: "Design Instagram News Feed",
  meta: "Hard · System Design · Audio",
  line: "Design a news feed that serves personalized posts to 500M DAU with <200ms p99 read latency worldwide.",
};

const SOLUTION_CODE = `<span class="kw">class</span> <span class="fn">Solution</span>:
&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">numIslands</span>(<span class="var">self</span>, <span class="var">grid</span>):
&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> <span class="kw">not</span> <span class="var">grid</span>: <span class="kw">return</span> <span class="num">0</span>
&nbsp;&nbsp;&nbsp;&nbsp;<span class="var">R</span>, <span class="var">C</span> = <span class="fn">len</span>(<span class="var">grid</span>), <span class="fn">len</span>(<span class="var">grid</span>[<span class="num">0</span>])
&nbsp;&nbsp;&nbsp;&nbsp;<span class="var">n</span> = <span class="num">0</span>
&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">dfs</span>(<span class="var">r</span>, <span class="var">c</span>):
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> <span class="var">r</span>&lt;<span class="num">0</span> <span class="kw">or</span> <span class="var">c</span>&lt;<span class="num">0</span> <span class="kw">or</span> <span class="var">r</span>&gt;=<span class="var">R</span> <span class="kw">or</span> <span class="var">c</span>&gt;=<span class="var">C</span> <span class="kw">or</span> <span class="var">grid</span>[<span class="var">r</span>][<span class="var">c</span>]!=<span class="str">"1"</span>:
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="var">grid</span>[<span class="var">r</span>][<span class="var">c</span>] = <span class="str">"0"</span>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="fn">dfs</span>(<span class="var">r</span>+<span class="num">1</span>,<span class="var">c</span>); <span class="fn">dfs</span>(<span class="var">r</span>-<span class="num">1</span>,<span class="var">c</span>)
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="fn">dfs</span>(<span class="var">r</span>,<span class="var">c</span>+<span class="num">1</span>); <span class="fn">dfs</span>(<span class="var">r</span>,<span class="var">c</span>-<span class="num">1</span>)
&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">for</span> <span class="var">r</span> <span class="kw">in</span> <span class="fn">range</span>(<span class="var">R</span>):
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">for</span> <span class="var">c</span> <span class="kw">in</span> <span class="fn">range</span>(<span class="var">C</span>):
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">if</span> <span class="var">grid</span>[<span class="var">r</span>][<span class="var">c</span>] == <span class="str">"1"</span>:
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="var">n</span> += <span class="num">1</span>; <span class="fn">dfs</span>(<span class="var">r</span>, <span class="var">c</span>)
&nbsp;&nbsp;&nbsp;&nbsp;<span class="kw">return</span> <span class="var">n</span>`;

/** Types approach + code inside the single Response window (DSA answer). */
function DsaTypingAnswer({ active }: { active: boolean }) {
  const [approach, setApproach] = useState("");
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setApproach("");
      setCode("");
      setDone(false);
      return;
    }
    let cancelled = false;
    let i = 0;
    let j = 0;
    let timer = 0;
    setApproach("");
    setCode("");
    setDone(false);

    const typeApproach = () => {
      if (cancelled) return;
      i += 2;
      setApproach(DSA_APPROACH.slice(0, i));
      if (i < DSA_APPROACH.length) {
        timer = window.setTimeout(typeApproach, 14);
      } else {
        timer = window.setTimeout(typeCode, 180);
      }
    };
    const typeCode = () => {
      if (cancelled) return;
      j += 3;
      setCode(DSA_CODE_PLAIN.slice(0, j));
      if (j < DSA_CODE_PLAIN.length) {
        timer = window.setTimeout(typeCode, 10);
      } else {
        setDone(true);
      }
    };
    timer = window.setTimeout(typeApproach, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active]);

  if (!active) return null;

  return (
    <>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
        Approach
        {!done ? <span className="ml-2 font-medium normal-case tracking-normal text-white/40">Typing…</span> : null}
      </p>
      <p className="text-[12.5px] leading-6 text-white/85">
        {approach}
        {!done && approach.length < DSA_APPROACH.length ? (
          <span className="app-preview-cursor ml-0.5 inline-block h-[1em] w-[2px] align-[-0.1em] bg-[#d4af37]" />
        ) : null}
      </p>
      {approach.length >= DSA_APPROACH.length ? (
        <p className="mt-2 text-[12px] text-white/55">
          <span className="text-[#d4af37]">Time</span> O(m·n) ·{" "}
          <span className="text-[#d4af37]">Space</span> O(m·n)
        </p>
      ) : null}
      {code.length > 0 || done ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[rgba(8,14,12,0.55)]">
          <div className="border-b border-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d4af37]/90">
            Python3
          </div>
          <pre className="app-preview-code overflow-x-auto px-3 py-2.5 font-mono text-[11.5px] leading-5 text-[#e8dcc8] whitespace-pre-wrap">
            {done ? (
              <code dangerouslySetInnerHTML={{ __html: SOLUTION_CODE }} />
            ) : (
              <>
                {code}
                <span className="app-preview-cursor ml-0.5 inline-block h-[1em] w-[2px] align-[-0.15em] bg-[#d4af37]" />
              </>
            )}
          </pre>
        </div>
      ) : null}
    </>
  );
}

function QaBlock({
  kind,
  title,
  meta,
  children,
}: {
  kind: "q" | "a";
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  const isQ = kind === "q";
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold ${
          isQ
            ? "bg-white/10 text-white/80"
            : "bg-[#d4af37]/20 text-[#d4af37] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.28)]"
        }`}
      >
        {isQ ? "Q" : "A"}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-[14px] font-semibold text-white/90">{title}</p>
          {meta ? <p className="mt-0.5 text-[11px] text-white/40">{meta}</p> : null}
        </div>
        <div className="rounded-xl border border-white/8 bg-black/20 px-3.5 py-3 text-[12.5px] leading-6 text-white/85">
          {children}
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.35rem] items-center justify-center rounded-[5px] border border-[#d4af37]/40 bg-[#11100e] px-1 py-0.5 font-mono text-[10px] font-bold text-[#e2c56a]">
      {children}
    </kbd>
  );
}

function HotkeyPill({
  label,
  keys,
  hot = false,
  icon,
}: {
  label: string;
  keys: string[];
  hot?: boolean;
  icon: "cam" | "star" | "eye";
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1.5 text-[11px] font-semibold whitespace-nowrap transition sm:gap-1.5 sm:px-2.5 sm:text-[11.5px] ${
        hot
          ? "border-[#d4af37]/50 bg-[#d4af37]/15 text-white"
          : "border-white/10 bg-white/[0.06] text-[#d8cfc3]"
      }`}
    >
      {icon === "cam" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#c9a961]">
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ) : null}
      {icon === "star" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#c9a961]">
          <path
            d="M12 3l1.6 4.9H19l-4 2.9 1.5 4.9L12 13.8 7.5 15.7 9 10.8l-4-2.9h5.4L12 3Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
      {icon === "eye" ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[#c9a961]">
          <path
            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ) : null}
      {label}
      <span className="ml-0.5 inline-flex items-center gap-1 text-white/35">
        {keys.map((k) => (
          <Kbd key={k}>{k === "Ctrl" ? "⌘" : k === "Enter" ? "⏎" : k}</Kbd>
        ))}
      </span>
    </span>
  );
}

/** Real Crackjob toolbar chrome */
function CrackToolbar({
  live,
  hearing = false,
  startHot,
  shotHot,
  answerHot,
}: {
  live: boolean;
  hearing?: boolean;
  startHot?: boolean;
  shotHot?: boolean;
  answerHot?: boolean;
}) {
  return (
    <div className="inline-flex max-w-full flex-nowrap items-center justify-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-[rgba(16,13,10,0.55)] px-2 py-1.5 shadow-[0_14px_40px_rgb(0_0_0_/0.4)] backdrop-blur-[22px] sm:gap-2 sm:px-3 sm:py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {live ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#e5484d]/45 bg-[rgba(229,72,77,0.15)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#ffb4b4]">
          <span className="size-2.5 rounded-[2px] bg-[#ff6b6b]" />
          Done
        </span>
      ) : (
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#dabb6a] to-[#b8924a] px-3.5 py-1.5 text-[13px] font-semibold text-[#1a1408] shadow-[inset_0_1px_0_rgb(255_255_255_/0.25)] transition ${
            startHot ? "scale-105 ring-2 ring-[#d4af37]/55" : ""
          }`}
        >
          <CrackLogo className="size-5" />
          Start
        </span>
      )}

      <span className="hidden h-[22px] w-px bg-white/12 sm:block" />

      <span className="flex items-center gap-1 px-0.5" aria-hidden>
        <span className="flex h-3.5 items-end gap-[2px]">
          {[35, 70, 100, 55, 80].map((h, i) => (
            <span
              key={i}
              className={`w-[2px] rounded-full ${
                hearing || live ? "bg-[#3dcc7a]" : "bg-white/30"
              } ${hearing ? "app-preview-wave-bar" : ""}`}
              style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
            />
          ))}
        </span>
        <span
          className={`grid size-7 place-items-center rounded-full border ${
            hearing || live
              ? "border-[#3dcc7a]/35 bg-[#3dcc7a]/12 text-[#3dcc7a]"
              : "border-white/10 bg-white/[0.06] text-white/40"
          }`}
        >
          <svg viewBox="0 0 12 12" className="size-2.5" fill="currentColor">
            <path d="M3.5 2.2v7.6L10 6z" />
          </svg>
        </span>
      </span>

      <HotkeyPill label="Screenshot" keys={["Ctrl", "H"]} icon="cam" hot={shotHot} />
      <HotkeyPill label="Answer" keys={["Ctrl", "Enter"]} icon="star" hot={answerHot} />
      <HotkeyPill label="Show/Hide" keys={["Ctrl", "B"]} icon="eye" />

      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d4af37]/32 bg-[rgba(212,175,55,0.1)] px-2.5 py-1.5 text-[11px] font-semibold text-[#c9a961]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l1.4 4.3H18l-3.5 2.6 1.3 4.3L12 12.8 8.2 13.2l1.3-4.3L6 6.3h4.6L12 2z" />
        </svg>
        Upgrade
        <span className="rounded bg-gradient-to-b from-[#e4c56e] to-[#b8924a] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-[#1a1408]">
          PRO
        </span>
      </span>

      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-[#c9a961]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </span>
    </div>
  );
}

function BigKeys({ keys }: { keys: string[] }) {
  return (
    <div className="app-preview-cmd flex items-center gap-4">
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="flex items-center gap-4">
          {i > 0 ? <span className="text-[2rem] font-light text-white/40">+</span> : null}
          <kbd className="app-preview-key inline-flex min-h-[3.5rem] min-w-[4.75rem] items-center justify-center rounded-[1.1rem] border border-white/16 bg-[rgba(40,36,32,0.72)] px-5 font-sans text-[1.45rem] font-semibold capitalize text-white shadow-[0_16px_48px_rgb(0_0_0_/0.5)] backdrop-blur-xl sm:min-h-[3.85rem] sm:min-w-[5.25rem] sm:text-[1.6rem]">
            {k}
          </kbd>
        </span>
      ))}
    </div>
  );
}

export function AppPreview() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (reduce) {
      setPhase("dsa-answer");
      return;
    }
    const steps: Array<{ at: number; phase: Phase }> = [
      { at: 0, phase: "idle" },
      { at: 2200, phase: "started" },
      { at: 4000, phase: "keys-h" },
      { at: 5500, phase: "shot" },
      { at: 7800, phase: "keys-enter" },
      { at: 8200, phase: "dsa-answer" },
      // Hold so slow left slide + answer are visible
      { at: 14500, phase: "sql-keys-h" },
      { at: 16000, phase: "sql-shot" },
      { at: 18000, phase: "sql-keys-enter" },
      { at: 18400, phase: "sql-answer" },
      { at: 24500, phase: "ds-keys-h" },
      { at: 26000, phase: "ds-shot" },
      { at: 28000, phase: "ds-keys-enter" },
      { at: 28400, phase: "ds-answer" },
      { at: 33500, phase: "listening-beh" },
      { at: 35500, phase: "audio-beh-q" },
      { at: 38000, phase: "keys-enter-beh" },
      { at: 38400, phase: "beh-answer" },
      { at: 45000, phase: "listening-hld" },
      { at: 47000, phase: "audio-hld-q" },
      { at: 50000, phase: "keys-enter-hld" },
      { at: 50400, phase: "hld-answer" },
    ];
    const loopMs = 60000;
    let timers: number[] = [];
    let loop = 0;
    const run = () => {
      timers.forEach(clearTimeout);
      timers = steps.map((s) => window.setTimeout(() => setPhase(s.phase), s.at));
      loop = window.setTimeout(run, loopMs);
    };
    run();
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(loop);
    };
  }, [reduce]);

  const live = phase !== "idle";
  const problemKind: ProblemKind | null =
    phase === "started" ||
    phase === "keys-h" ||
    phase === "shot" ||
    phase === "keys-enter" ||
    phase === "dsa-answer"
      ? "dsa"
      : phase === "sql-keys-h" ||
          phase === "sql-shot" ||
          phase === "sql-keys-enter" ||
          phase === "sql-answer"
        ? "sql"
        : phase === "ds-keys-h" ||
            phase === "ds-shot" ||
            phase === "ds-keys-enter" ||
            phase === "ds-answer"
          ? "ds"
          : null;
  const showProblem = problemKind !== null;
  const audioRound =
    phase === "listening-beh" ||
    phase === "audio-beh-q" ||
    phase === "keys-enter-beh" ||
    phase === "beh-answer" ||
    phase === "listening-hld" ||
    phase === "audio-hld-q" ||
    phase === "keys-enter-hld" ||
    phase === "hld-answer";
  const showOverlay = live;
  const showDsa = phase === "dsa-answer";
  const showSql = phase === "sql-answer";
  const showDs = phase === "ds-answer";
  const showBeh = phase === "beh-answer";
  const showHld = phase === "hld-answer";
  const bigOutput = showBeh || showHld || showSql || showDs;
  // IC-style: Response stays centered, then slowly drifts left for coding (DSA / SQL) answers
  const slideOutputLeft = showDsa || showSql;
  const showShotHint =
    phase === "shot" ||
    phase === "keys-enter" ||
    phase === "sql-shot" ||
    phase === "sql-keys-enter" ||
    phase === "ds-shot" ||
    phase === "ds-keys-enter";
  const hearing =
    phase === "listening-beh" ||
    phase === "audio-beh-q" ||
    phase === "listening-hld" ||
    phase === "audio-hld-q";
  const keysH =
    phase === "keys-h" ||
    phase === "shot" ||
    phase === "sql-keys-h" ||
    phase === "sql-shot" ||
    phase === "ds-keys-h" ||
    phase === "ds-shot";
  const keysEnter =
    phase === "keys-enter" ||
    phase === "sql-keys-enter" ||
    phase === "ds-keys-enter" ||
    phase === "keys-enter-beh" ||
    phase === "keys-enter-hld";
  const answering = showDsa || showSql || showDs || showBeh || showHld || keysEnter;
  const emptyHint =
    phase === "started" ||
    phase === "keys-h" ||
    phase === "sql-keys-h" ||
    phase === "ds-keys-h";

  return (
    <div className="app-preview flex w-full flex-col" aria-label="Crackjob app demo">
      {/* Top overlay — pinned at section top, never moves */}
      <div className="relative z-30 flex shrink-0 justify-center px-3 pb-4 pt-1 sm:pb-5">
        <CrackToolbar
          live={live}
          hearing={hearing}
          startHot={phase === "idle"}
          shotHot={keysH}
          answerHot={answering}
        />
      </div>

      {/* Stage — always dark laptop frame; only inner background changes by round */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-white/10 sm:rounded-[1.5rem] ${
          bigOutput || audioRound
            ? "min-h-[40rem] sm:min-h-[48rem] lg:min-h-[54rem]"
            : "min-h-[34rem] sm:min-h-[42rem] lg:min-h-[48rem]"
        }`}
      >
        <div className="absolute inset-0 bg-[#0c0a08]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(90,50,22,0.35),transparent_55%)]" />
        <div
          className="absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "radial-gradient(1.4px 1.4px at 12% 22%, rgba(255,255,255,.55), transparent),radial-gradient(1px 1px at 28% 60%, rgba(255,255,255,.4), transparent),radial-gradient(1.6px 1.6px at 55% 28%, rgba(255,255,255,.5), transparent),radial-gradient(1px 1px at 78% 70%, rgba(255,255,255,.35), transparent),radial-gradient(1.2px 1.2px at 88% 18%, rgba(255,255,255,.45), transparent)",
          }}
        />

        {/* Audio rounds: laptop meeting window (same black stage, different content) */}
        {audioRound ? (
          <div className="absolute inset-3 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#12100e] shadow-[0_20px_60px_rgb(0_0_0_/0.45)] sm:inset-5">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#1a1612] px-3">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[11px] text-white/40">
                {phase.includes("hld") || phase === "hld-answer"
                  ? "System Design Interview"
                  : "Behavioral Interview"}{" "}
                · Live
              </span>
              <span className="ml-auto rounded-md bg-[#3dcc7a]/15 px-2 py-0.5 text-[10px] font-medium text-[#3dcc7a]">
                In call
              </span>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center bg-[#0e0c0a]">
              <div className="px-6 text-center">
                <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-white/35">
                    <path
                      d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M4 20c1.5-3.5 4.2-5 8-5s6.5 1.5 8 5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="text-[14px] font-medium text-white/55">Laptop interview in progress</p>
                <p className="mt-1 text-[12px] text-white/30">Listening for the next question…</p>
              </div>
            </div>
            <div className="flex h-11 shrink-0 items-center justify-center gap-3 border-t border-white/[0.07] bg-[#18140f]">
              {["Mute", "Video", "Share", "Leave"].map((label) => (
                <span
                  key={label}
                  className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium sm:text-[11px] ${
                    label === "Leave"
                      ? "bg-[#e5484d]/20 text-[#ffb4b4]"
                      : "bg-white/[0.06] text-white/50"
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {showProblem && problemKind ? (
          <div className="absolute inset-3 flex flex-col overflow-hidden rounded-xl border border-[#d4af37]/12 bg-[#14110e] shadow-[0_20px_60px_rgb(0_0_0_/0.45)] sm:inset-5">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#1a1612] px-3 py-1.5">
              <span className="text-[11px] text-white/40">
                {problemKind === "dsa" ? "Graph" : problemKind === "sql" ? "SQL" : "ML"}
              </span>
              <span className="text-white/20">·</span>
              <span className="text-[11px] text-white/40">
                {problemKind === "dsa" ? "DFS" : problemKind === "sql" ? "Joins" : "Classification"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                  ▶ Run
                </span>
                <span className="rounded-md border border-[#3dcc7a]/35 bg-[#3dcc7a]/15 px-2.5 py-1 text-[11px] font-medium text-[#3dcc7a]">
                  Submit
                </span>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
              <div className="flex min-h-0 flex-col border-b border-white/[0.07] md:border-b-0 md:border-r">
                <div className="flex shrink-0 gap-4 border-b border-white/[0.07] px-4 pt-2.5">
                  <span className="border-b-2 border-[#d4af37] pb-2 text-[12px] font-medium text-[#e8d4a0]">
                    Description
                  </span>
                  <span className="pb-2 text-[12px] text-white/35">Solutions</span>
                </div>
                <div className="app-preview-scroll min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4 text-[13px] leading-6 text-[#c8c0b6]">
                  {problemKind === "dsa" ? (
                    <>
                      <p>
                        Given an{" "}
                        <code className="rounded bg-white/[0.06] px-1 font-mono text-[12px] text-[#e8dcc8]">
                          m x n
                        </code>{" "}
                        2D binary grid which represents a map of{" "}
                        <code className="rounded bg-white/[0.06] px-1 font-mono text-[12px] text-[#e8dcc8]">
                          &apos;1&apos;
                        </code>
                        s (land) and{" "}
                        <code className="rounded bg-white/[0.06] px-1 font-mono text-[12px] text-[#e8dcc8]">
                          &apos;0&apos;
                        </code>
                        s (water), return the number of islands.
                      </p>
                      <p>
                        An island is surrounded by water and is formed by connecting adjacent lands
                        horizontally or vertically. You may assume all four edges of the grid are all
                        surrounded by water.
                      </p>
                      <div>
                        <p className="mb-1.5 font-semibold text-[#e8d4a0]">Example 1:</p>
                        <div className="rounded-lg border border-white/[0.08] bg-[#0c0a08]/80 px-3 py-2.5 font-mono text-[11.5px] leading-5 text-white/75">
                          <p>
                            <span className="text-white/45">Input:</span> grid =
                            [[&quot;1&quot;,&quot;1&quot;,&quot;0&quot;,&quot;0&quot;,&quot;0&quot;],[&quot;1&quot;,&quot;1&quot;,&quot;0&quot;,&quot;0&quot;,&quot;0&quot;],[&quot;0&quot;,&quot;0&quot;,&quot;1&quot;,&quot;0&quot;,&quot;0&quot;],[&quot;0&quot;,&quot;0&quot;,&quot;0&quot;,&quot;1&quot;,&quot;1&quot;]]
                          </p>
                          <p className="mt-1">
                            <span className="text-white/45">Output:</span>{" "}
                            <span className="text-[#d4af37]">3</span>
                          </p>
                          <p className="mt-1.5 font-sans text-[12px] leading-5 text-[#a89f93]">
                            Explanation: There are three islands in the picture above.
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-[#e8d4a0]">Constraints:</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-white/50">
                          <li>m == grid.length</li>
                          <li>n == grid[i].length</li>
                          <li>1 ≤ m, n ≤ 300</li>
                          <li>grid[i][j] is &apos;0&apos; or &apos;1&apos;</li>
                        </ul>
                      </div>
                    </>
                  ) : null}
                  {problemKind === "sql" ? (
                    <>
                      <p>{SQL_QUESTION.body}</p>
                      <div>
                        <p className="mb-1.5 font-semibold text-[#e8d4a0]">Schema:</p>
                        <div className="rounded-lg border border-white/[0.08] bg-[#0c0a08]/80 px-3 py-2.5 font-mono text-[11px] leading-5 text-white/70">
                          {SQL_QUESTION.schema}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 font-semibold text-[#e8d4a0]">Example 1:</p>
                        <div className="rounded-lg border border-white/[0.08] bg-[#0c0a08]/80 px-3 py-2.5 text-[12px] leading-5 text-white/75">
                          {SQL_QUESTION.example}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-[#e8d4a0]">Constraints:</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-white/50">
                          {SQL_QUESTION.constraints.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : null}
                  {problemKind === "ds" ? (
                    <>
                      <p>{DS_QUESTION.body}</p>
                      <div>
                        <p className="mb-1.5 font-semibold text-[#e8d4a0]">Success criteria:</p>
                        <div className="rounded-lg border border-white/[0.08] bg-[#0c0a08]/80 px-3 py-2.5 text-[12px] leading-5 text-white/75">
                          {DS_QUESTION.example}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-[#e8d4a0]">Constraints:</p>
                        <ul className="list-disc space-y-0.5 pl-4 text-[12px] text-white/50">
                          {DS_QUESTION.constraints.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-col bg-[#100e0c]">
                <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.07] px-3 py-2">
                  <span className="text-[12px] font-medium text-[#e8d4a0]">&lt;/&gt; Code</span>
                  <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/65">
                    {problemKind === "sql" ? "MySQL ▾" : "Python3 ▾"}
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
                  <pre className="app-preview-code font-mono text-[12.5px] leading-7 text-[#e8dcc8]">
                    <code
                      dangerouslySetInnerHTML={{
                        __html:
                          problemKind === "sql"
                            ? `<span class="cm">-- write your query</span>`
                            : problemKind === "ds"
                              ? `<span class="cm"># notebook cell — model + eval</span>`
                              : `<span class="kw">class</span> <span class="fn">Solution</span>:
&nbsp;&nbsp;<span class="kw">def</span> <span class="fn">numIslands</span>(<span class="var">self</span>, <span class="var">grid</span>):
&nbsp;&nbsp;&nbsp;&nbsp;
`,
                      }}
                    />
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Output starts centered; DSA / SQL answers slowly slide left (IC-style) */}
        <div className="absolute inset-x-0 top-3 bottom-14 z-20 flex justify-center px-3 sm:top-4 sm:bottom-16">
          <div
            className={`app-preview-output flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-white/12 bg-[rgba(18,15,12,0.55)] shadow-[0_24px_70px_rgb(0_0_0_/0.45)] backdrop-blur-[16px] ${
              showOverlay ? "opacity-100" : "pointer-events-none opacity-0"
            } ${
              bigOutput
                ? "max-w-[46rem] sm:max-w-[52rem] lg:max-w-[56rem]"
                : "max-w-[38rem] sm:max-w-[42rem] lg:max-w-[44rem]"
            } ${slideOutputLeft ? "is-left" : "is-center"}`}
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
              <CrackLogo className="size-5" />
              <span className="text-[13px] font-semibold text-[#d4af37]">Response</span>
              <span className="text-[13px] text-white/35">Transcripts</span>
            </div>

            <div className="app-preview-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              {emptyHint ? (
                <p className="pt-8 text-center text-[13px] text-white/40">
                  Capture a screenshot or listen — answers appear here.
                </p>
              ) : null}

              {showShotHint ? (
                <p className="rounded-lg border border-[#d4af37]/25 bg-[#d4af37]/10 px-3 py-2.5 text-[13px] text-[#e8d4a0]">
                  Screenshot ready — press <span className="font-semibold">Ctrl + Enter</span> to
                  solve.
                </p>
              ) : null}

              {phase === "listening-beh" || phase === "listening-hld" ? (
                <p className="pt-6 text-center text-[14px] text-white/70">
                  Hearing interviewer…
                  <span className="app-preview-cursor ml-0.5 inline-block h-[1.05em] w-[2px] align-[-0.1em] bg-[#d4af37]" />
                </p>
              ) : null}

              {phase === "audio-beh-q" || phase === "keys-enter-beh" ? (
                <>
                  <QaBlock kind="q" title={BEH_QUESTION.title} meta={BEH_QUESTION.meta}>
                    <p>{BEH_QUESTION.line}</p>
                  </QaBlock>
                  <p className="pl-8 text-[12px] text-white/45">
                    Waiting for <span className="text-white/70">Ctrl + Enter</span>…
                  </p>
                </>
              ) : null}

              {phase === "audio-hld-q" || phase === "keys-enter-hld" ? (
                <>
                  <QaBlock kind="q" title={HLD_QUESTION.title} meta={HLD_QUESTION.meta}>
                    <p>{HLD_QUESTION.line}</p>
                  </QaBlock>
                  <p className="pl-8 text-[12px] text-white/45">
                    Waiting for <span className="text-white/70">Ctrl + Enter</span>…
                  </p>
                </>
              ) : null}

              {showDsa ? (
                <>
                  <QaBlock kind="q" title={DSA_QUESTION.title} meta={DSA_QUESTION.meta}>
                    <p>{DSA_QUESTION.body}</p>
                    <p className="mt-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-2 font-mono text-[11px] leading-5 text-white/65">
                      {DSA_QUESTION.example}
                    </p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-white/50">
                      {DSA_QUESTION.constraints.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </QaBlock>
                  <QaBlock kind="a" title="Answer" meta="DFS flood-fill · O(m·n)">
                    <DsaTypingAnswer active={showDsa} />
                  </QaBlock>
                </>
              ) : null}

              {showSql ? (
                <>
                  <QaBlock kind="q" title={SQL_QUESTION.title} meta={SQL_QUESTION.meta}>
                    <p>{SQL_QUESTION.body}</p>
                    <p className="mt-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-2 font-mono text-[11px] leading-5 text-white/65">
                      {SQL_QUESTION.schema}
                    </p>
                    <p className="mt-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-2 text-[11px] leading-5 text-white/65">
                      {SQL_QUESTION.example}
                    </p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-white/50">
                      {SQL_QUESTION.constraints.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </QaBlock>
                  <QaBlock kind="a" title="Answer" meta="Self-join · INNER JOIN · O(n)">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Approach
                    </p>
                    <p>
                      Alias the same table twice: <code className="text-[#e8dcc8]">e</code> for the
                      employee and <code className="text-[#e8dcc8]">m</code> for the manager. Join on{" "}
                      <code className="text-[#e8dcc8]">e.managerId = m.id</code>, then keep rows where{" "}
                      <code className="text-[#e8dcc8]">e.salary &gt; m.salary</code>. Select the
                      employee name (and optionally ids) for the result set.
                    </p>
                    <p className="mt-2 text-[12px] text-white/55">
                      Edge cases: NULL <code className="text-[#e8dcc8]">managerId</code> never joins
                      (CEO / top-level) — correctly dropped. Equal salaries are excluded by the
                      strict &gt; comparison.
                    </p>
                    <p className="mt-2 text-[12px] text-white/55">
                      Alternative: correlated subquery{" "}
                      <code className="text-[#e8dcc8]">
                        WHERE salary &gt; (SELECT salary FROM Employee m WHERE m.id = e.managerId)
                      </code>{" "}
                      — join is usually clearer and optimizer-friendly.
                    </p>
                    <div className="app-preview-code-in mt-3 overflow-hidden rounded-xl border border-white/10 bg-[rgba(8,14,12,0.55)]">
                      <div className="border-b border-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d4af37]/90">
                        MySQL
                      </div>
                      <pre
                        className="app-preview-code overflow-x-auto px-3 py-2.5 font-mono text-[12px] leading-6 text-[#e8dcc8]"
                        dangerouslySetInnerHTML={{ __html: SQL_CODE }}
                      />
                    </div>
                  </QaBlock>
                </>
              ) : null}

              {showDs ? (
                <>
                  <QaBlock kind="q" title={DS_QUESTION.title} meta={DS_QUESTION.meta}>
                    <p>{DS_QUESTION.body}</p>
                    <p className="mt-2 rounded-md border border-white/8 bg-black/25 px-2.5 py-2 text-[11px] leading-5 text-white/65">
                      {DS_QUESTION.example}
                    </p>
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[12px] text-white/50">
                      {DS_QUESTION.constraints.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </QaBlock>
                  <QaBlock kind="a" title="Answer" meta="Imbalance · PR curve · Production">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Problem framing
                    </p>
                    <p>
                      Rare positives (~0.2%). Accuracy is meaningless — always predicting
                      &quot;legit&quot; is ~99.8% accurate. Frame as cost-sensitive classification:
                      maximize fraud recall subject to precision ≥ 0.85 so human review stays
                      feasible.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Features
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-white/80">
                      <li>Velocity: txn count / amount in 1h &amp; 24h per card, device, IP</li>
                      <li>Graph: shared devices, shipping addresses, BIN vs shipping country</li>
                      <li>Behavioral: time-of-day, MCC drift vs user history, amount z-score</li>
                      <li>Avoid leakage: no post-fraud labels or future aggregates in features</li>
                    </ul>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Model &amp; imbalance
                    </p>
                    <p>
                      Gradient boosting (LightGBM/XGBoost) with{" "}
                      <code className="text-[#e8dcc8]">scale_pos_weight</code> or sample weights.
                      Optional focal loss / undersample majority inside training folds only.
                      Calibrate probabilities (isotonic) before thresholding.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Evaluation &amp; ship
                    </p>
                    <p>
                      Time-based split; report PR-AUC and recall@precision=0.85. Shadow-deploy vs
                      rules, watch drift &amp; label delay. SHAP / gain for ops explainability.
                    </p>
                    <div className="app-preview-code-in mt-3 overflow-hidden rounded-xl border border-white/10 bg-[rgba(8,14,12,0.55)]">
                      <div className="border-b border-white/8 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d4af37]/90">
                        Python · sketch
                      </div>
                      <pre
                        className="app-preview-code overflow-x-auto px-3 py-2.5 font-mono text-[11.5px] leading-5 text-[#e8dcc8]"
                        dangerouslySetInnerHTML={{ __html: DS_CODE }}
                      />
                    </div>
                  </QaBlock>
                </>
              ) : null}

              {showBeh ? (
                <>
                  <QaBlock kind="q" title={BEH_QUESTION.title} meta={BEH_QUESTION.meta}>
                    <p>{BEH_QUESTION.line}</p>
                  </QaBlock>
                  <QaBlock kind="a" title="Answer" meta="STAR · Conflict & ownership">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Situation
                    </p>
                    <p>
                      On a payments migration, a senior teammate wanted one shared Postgres for
                      ledger + wallet to ship in two weeks. I wanted separate services so a wallet bug
                      couldn&apos;t corrupt money movement.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Task
                    </p>
                    <p>
                      Resolve the disagreement without slipping the launch date or creating a fragile
                      architecture we&apos;d regret on-call.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Action
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-white/80">
                      <li>Wrote a 1-pager: failure modes, blast radius, rollback story</li>
                      <li>Proposed a 3-day spike: separate DBs + thin shared ledger API</li>
                      <li>Invited the teammate to co-own the spike metrics (p99, dual-write lag)</li>
                      <li>Escalated once with options A/B/C — not personalities — to our EM</li>
                    </ul>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      Result
                    </p>
                    <p>
                      We shipped the hybrid design on schedule. Two months later a wallet outage stayed
                      isolated; ledger kept settling. I made sure credit was shared in the postmortem —
                      the relationship stayed strong because the debate stayed on data.
                    </p>
                  </QaBlock>
                </>
              ) : null}

              {showHld ? (
                <>
                  <QaBlock kind="q" title={HLD_QUESTION.title} meta={HLD_QUESTION.meta}>
                    <p>{HLD_QUESTION.line}</p>
                  </QaBlock>
                  <QaBlock kind="a" title="Answer" meta="Hard · Feed · Fan-out · Cache · Rank">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      1. Clarify &amp; requirements
                    </p>
                    <p>
                      Functional: follow graph, post create, home feed (ranked), pagination, media.
                      Non-functional: 500M DAU, &lt;200ms p99 read globally, write availability over
                      strict consistency for likes/views; strong consistency for auth &amp; create-post
                      ack.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      2. Back-of-envelope
                    </p>
                    <p>
                      ~10 feed reads / user / day → ~5B reads/day ≈ 60k QPS avg, ~250–400k peak.
                      Writes ≪ reads. Celebrity fan-out is the hotspot — hybrid push/pull required.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      3. High-level components
                    </p>
                    <ul className="list-disc space-y-1 pl-4 text-white/80">
                      <li>API gateway → Feed / Post / Graph / Media / Ranking services</li>
                      <li>Cassandra / Dynamo for timelines; Postgres for user metadata</li>
                      <li>Redis for hot timelines + session; CDN for media</li>
                      <li>Kafka for async fan-out &amp; ranking feature updates</li>
                    </ul>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      4. Feed generation (deep dive)
                    </p>
                    <p>
                      Normal users: fan-out on write — push postId into followers&apos; Redis ZSETs
                      (score = rank or time). Celebrities: fan-out on read — pull recent posts at
                      query time and merge. Home API merges cached timeline + celebrity pull, calls
                      Ranking (recency, affinity, ML features), returns cursor page.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      5. Multi-region &amp; failure
                    </p>
                    <p>
                      Active-active reads with regional caches; posts replicate async. If ranking is
                      down, fall back to reverse-chron. Idempotent Kafka consumers; dead-letter for
                      poison fan-out jobs.
                    </p>
                    <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d4af37]/90">
                      6. Tradeoffs
                    </p>
                    <p>
                      Pure push = fast reads, blows up for mega-influencers. Pure pull = simple writes,
                      slow/expensive reads. Hybrid is the industry default. Ranking freshness vs
                      latency: score offline / nearline, serve with short TTL.
                    </p>
                  </QaBlock>
                </>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-2.5">
              {hearing ? (
                <span className="rounded-full border border-[#3dcc7a]/35 bg-[#3dcc7a]/12 px-2.5 py-1 text-[11px] text-[#3dcc7a]">
                  Listening…
                </span>
              ) : null}
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/65">
                ↑ Scroll Up ⌘↑
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/65">
                ↓ Scroll Down ⌘↓
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/65">
                New ⌘G
              </span>
            </div>
          </div>
        </div>

        {!live ? (
          <p className="absolute bottom-10 left-1/2 z-10 w-full -translate-x-1/2 px-6 text-center text-[13px] text-white/40">
            Press Start when the interview begins
          </p>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-40 flex justify-center sm:bottom-5">
          {keysH && !keysEnter && !showDsa && !showSql && !showDs && !showBeh && !showHld ? (
            <BigKeys keys={["Ctrl", "H"]} />
          ) : null}
          {keysEnter ? <BigKeys keys={["Ctrl", "↵"]} /> : null}
        </div>

        {phase === "keys-h" ? (
          <div
            className="app-preview-flash pointer-events-none absolute inset-0 z-30 bg-white/30"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
