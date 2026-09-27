import type { ReactNode } from "react";

type TokenKind =
  | "keyword"
  | "decl"
  | "builtin"
  | "function"
  | "type"
  | "param"
  | "string"
  | "number"
  | "comment"
  | "plain";

type LangFamily = "python" | "javascript" | "java" | "cpp" | "go" | "rust" | "generic";

const KEYWORDS: Record<LangFamily, Set<string>> = {
  python: new Set([
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "False",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "None",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "True",
    "try",
    "while",
    "with",
    "yield",
  ]),
  javascript: new Set([
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "let",
    "new",
    "null",
    "of",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "undefined",
    "var",
    "void",
    "while",
    "yield",
  ]),
  java: new Set([
    "abstract",
    "assert",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "false",
    "final",
    "finally",
    "float",
    "for",
    "if",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "true",
    "try",
    "void",
    "volatile",
    "while",
  ]),
  cpp: new Set([
    "alignas",
    "alignof",
    "and",
    "and_eq",
    "asm",
    "auto",
    "bitand",
    "bitor",
    "bool",
    "break",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "constexpr",
    "continue",
    "decltype",
    "default",
    "delete",
    "do",
    "double",
    "else",
    "enum",
    "explicit",
    "export",
    "extern",
    "false",
    "float",
    "for",
    "friend",
    "goto",
    "if",
    "inline",
    "int",
    "long",
    "mutable",
    "namespace",
    "new",
    "noexcept",
    "not",
    "not_eq",
    "nullptr",
    "operator",
    "or",
    "or_eq",
    "private",
    "protected",
    "public",
    "register",
    "return",
    "short",
    "signed",
    "sizeof",
    "static",
    "struct",
    "switch",
    "template",
    "this",
    "throw",
    "true",
    "try",
    "typedef",
    "typename",
    "union",
    "unsigned",
    "using",
    "virtual",
    "void",
    "volatile",
    "while",
    "xor",
    "xor_eq",
  ]),
  go: new Set([
    "break",
    "case",
    "chan",
    "const",
    "continue",
    "default",
    "defer",
    "else",
    "fallthrough",
    "for",
    "func",
    "go",
    "goto",
    "if",
    "import",
    "interface",
    "map",
    "package",
    "range",
    "return",
    "select",
    "struct",
    "switch",
    "type",
    "var",
  ]),
  rust: new Set([
    "as",
    "async",
    "await",
    "break",
    "const",
    "continue",
    "crate",
    "dyn",
    "else",
    "enum",
    "extern",
    "false",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "match",
    "mod",
    "move",
    "mut",
    "pub",
    "ref",
    "return",
    "self",
    "Self",
    "static",
    "struct",
    "super",
    "trait",
    "true",
    "type",
    "unsafe",
    "use",
    "where",
    "while",
  ]),
  generic: new Set(),
};

const BUILTINS: Record<LangFamily, Set<string>> = {
  python: new Set([
    "print",
    "len",
    "range",
    "enumerate",
    "max",
    "min",
    "sum",
    "abs",
    "input",
    "zip",
    "map",
    "filter",
    "sorted",
    "reversed",
    "any",
    "all",
    "isinstance",
    "hasattr",
    "getattr",
    "setattr",
    "open",
    "iter",
    "next",
  ]),
  javascript: new Set([
    "console",
    "Math",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "parseInt",
    "parseFloat",
    "JSON",
    "Promise",
    "Map",
    "Set",
    "Error",
  ]),
  java: new Set(["System", "String", "Math", "Arrays", "List", "Map", "Set", "HashMap", "ArrayList"]),
  cpp: new Set(["std", "cout", "cin", "vector", "string", "map", "set", "endl"]),
  go: new Set(["fmt", "len", "make", "append", "cap", "copy", "panic", "recover"]),
  rust: new Set(["println", "print", "vec", "String", "Option", "Result", "Some", "None", "Ok", "Err"]),
  generic: new Set(),
};

/** Type / constructor names (LeetCode-style teal). */
const TYPES: Record<LangFamily, Set<string>> = {
  python: new Set([
    "int",
    "str",
    "float",
    "bool",
    "list",
    "dict",
    "set",
    "tuple",
    "bytes",
    "object",
    "List",
    "Dict",
    "Set",
    "Tuple",
    "Optional",
    "Union",
    "Any",
    "Callable",
    "Iterable",
    "Iterator",
    "Sequence",
    "Mapping",
    "Deque",
    "DefaultDict",
    "Counter",
  ]),
  javascript: new Set([
    "string",
    "number",
    "boolean",
    "any",
    "unknown",
    "never",
    "void",
    "Record",
    "Partial",
    "Readonly",
    "Array",
    "Promise",
    "Map",
    "Set",
  ]),
  java: new Set([
    "int",
    "long",
    "double",
    "float",
    "boolean",
    "char",
    "byte",
    "short",
    "void",
    "String",
    "Integer",
    "Long",
    "Double",
    "Boolean",
    "List",
    "Map",
    "Set",
    "Queue",
    "Stack",
  ]),
  cpp: new Set([
    "int",
    "long",
    "double",
    "float",
    "bool",
    "char",
    "void",
    "string",
    "vector",
    "map",
    "set",
    "pair",
    "unordered_map",
    "unordered_set",
  ]),
  go: new Set(["int", "int64", "float64", "string", "bool", "byte", "rune", "error", "map", "chan"]),
  rust: new Set(["i32", "i64", "u32", "u64", "f32", "f64", "bool", "char", "str", "String", "Vec", "Option", "Result"]),
  generic: new Set(),
};

/** Keywords that introduce a named declaration (next identifier = name). */
const DECL_KEYWORDS = new Set(["def", "class", "function", "fn", "func"]);

/** `def` and language equivalents — highlighted green. */
const DEF_KEYWORDS = new Set(["def", "function", "fn", "func"]);

const SPECIAL_PARAMS = new Set(["self", "cls", "this", "super"]);

function resolveLangFamily(language: string): LangFamily {
  const key = language.trim().toLowerCase();
  if (["python", "py"].includes(key)) return "python";
  if (["javascript", "js", "typescript", "ts", "tsx", "jsx"].includes(key)) return "javascript";
  if (["java"].includes(key)) return "java";
  if (["cpp", "c++", "c", "csharp", "cs"].includes(key)) return "cpp";
  if (["go", "golang"].includes(key)) return "go";
  if (["rust", "rs"].includes(key)) return "rust";
  return "generic";
}

function span(kind: TokenKind, text: string, key: string) {
  if (!text) return null;
  if (kind === "plain") return text;
  return (
    <span key={key} className={`ic-hl-${kind}`}>
      {text}
    </span>
  );
}

function peekCall(line: string, afterWord: number): boolean {
  let j = afterWord;
  while (j < line.length && (line[j] === " " || line[j] === "\t")) j += 1;
  return line[j] === "(";
}

function classifyWord(
  word: string,
  family: LangFamily,
  expectDeclName: boolean,
  isCall: boolean,
): TokenKind {
  const keywords = KEYWORDS[family];
  const builtins = BUILTINS[family];
  const types = TYPES[family];

  if (expectDeclName) return "function";
  if (DEF_KEYWORDS.has(word)) return "decl";
  if (keywords.has(word)) return "keyword";
  if (SPECIAL_PARAMS.has(word) && (family === "python" || family === "javascript" || family === "java")) {
    return "param";
  }
  if (builtins.has(word)) return "builtin";
  if (types.has(word)) return "type";
  if (isCall) return "function";
  return "plain";
}

function tokenizeLine(
  line: string,
  family: LangFamily,
  state: { expectDeclName: boolean },
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const push = (kind: TokenKind, text: string) => {
    const node = span(kind, text, `${key}`);
    if (node) nodes.push(node);
    key += 1;
  };

  while (i < line.length) {
    const rest = line.slice(i);

    const hashComment = family === "python" || family === "generic" ? rest.match(/^#[^\n]*/) : null;
    if (hashComment) {
      push("comment", hashComment[0]);
      i += hashComment[0].length;
      continue;
    }

    const slashComment = rest.match(/^\/\/[^\n]*/);
    if (slashComment) {
      push("comment", slashComment[0]);
      i += slashComment[0].length;
      continue;
    }

    const tripleQuote =
      family === "python" ? rest.match(/^("""[\s\S]*?"""|'''[\s\S]*?''')/) : null;
    if (tripleQuote) {
      push("string", tripleQuote[0]);
      i += tripleQuote[0].length;
      continue;
    }

    const str =
      rest.match(/^"(?:\\.|[^"\\])*"?/) ||
      rest.match(/^'(?:\\.|[^'\\])*'?/) ||
      rest.match(/^`(?:\\.|[^`\\])*`?/);
    if (str) {
      push("string", str[0]);
      i += str[0].length;
      continue;
    }

    const num = rest.match(/^(?:0x[0-9a-fA-F]+|\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (num) {
      push("number", num[0]);
      i += num[0].length;
      continue;
    }

    const word = rest.match(/^[A-Za-z_]\w*/);
    if (word) {
      const w = word[0];
      const after = i + w.length;
      const isCall = peekCall(line, after);
      const kind = classifyWord(w, family, state.expectDeclName, isCall);

      if (state.expectDeclName) {
        state.expectDeclName = false;
      } else if (DECL_KEYWORDS.has(w)) {
        state.expectDeclName = true;
      }

      push(kind, w);
      i = after;
      continue;
    }

    // Non-word char — declaration name can still follow after spaces
    if (rest[0] !== " " && rest[0] !== "\t" && rest[0] !== "(") {
      // punctuation other than spacing/paren ends decl wait only for name;
      // keep expectDeclName through spaces until the name is found
    }
    push("plain", rest[0]);
    i += 1;
  }

  return nodes;
}

export function highlightCode(code: string, language: string): ReactNode {
  const family = resolveLangFamily(language);
  const lines = code.split("\n");
  const state = { expectDeclName: false };

  return (
    <>
      {lines.map((line, lineIndex) => (
        <span key={`line-${lineIndex}`} className="ic-hl-line">
          {tokenizeLine(line, family, state)}
          {lineIndex < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </>
  );
}
