// ABOUTME: 示例规格对应的内置图书馆服务，数据只在内存中，服务重启后恢复初始馆藏。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  publishedYear?: number;
  copies: number;
  available: number;
}
interface Member {
  id: string;
  name: string;
  email?: string;
  joinedAt: string;
}
interface Loan {
  id: string;
  bookId: string;
  memberId: string;
  status: "active" | "returned" | "overdue";
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
}

const BASE = "/api/sample/library/v1";
const LIMIT = 500;

export function createLibrary(now: () => Date = () => new Date()) {
  const books: Book[] = [
    { id: "bk_101", title: "城市的河流", author: "林岚", isbn: "9787100000017", publishedYear: 2021, copies: 2, available: 1 },
    { id: "bk_102", title: "社区花园手册", author: "陈立秋", isbn: "9787100000024", publishedYear: 2019, copies: 1, available: 1 },
    { id: "bk_103", title: "旧街巷的四季", author: "许知远方", isbn: "9787100000031", publishedYear: 2023, copies: 3, available: 3 },
    { id: "bk_104", title: "给孩子的天文课", author: "王一舟", isbn: "9787100000048", publishedYear: 2020, copies: 2, available: 2 },
  ];
  const members: Member[] = [
    { id: "mb_1001", name: "周小满", email: "xiaoman@example.org", joinedAt: "2025-03-14" },
    { id: "mb_1002", name: "高明远", email: "mingyuan@example.org", joinedAt: "2024-11-02" },
  ];
  const loans: Loan[] = [
    { id: "ln_5001", bookId: "bk_101", memberId: "mb_1002", status: "active", borrowedAt: "2026-10-12T09:30:00.000Z", dueAt: "2026-11-02T09:30:00.000Z", returnedAt: null },
  ];
  const sequence = { book: 105, member: 1003, loan: 5002 };
  return { books, members, loans, next: (kind: keyof typeof sequence) => sequence[kind]++, now };
}

type Library = ReturnType<typeof createLibrary>;
const json = (value: unknown, status = 200) => Response.json(value, { status });
const problem = (status: number, title: string, detail: string) =>
  new Response(JSON.stringify({ type: "about:blank", title, status, detail }), {
    status,
    headers: { "content-type": "application/problem+json; charset=utf-8" },
  });
const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null;
const integer = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;

function authorized(request: { headers: Record<string, string | string[] | undefined> }) {
  const bearer = String(request.headers.authorization ?? "");
  const key = String(request.headers["x-librarian-key"] ?? "");
  return /^Bearer\s+\S+/i.test(bearer) || key.trim().length > 0;
}
const unauthorized = () =>
  problem(401, "需要登录", "请在 Authorize 中填写 bearerAuth 令牌（示例服务接受任意非空值）或 X-Librarian-Key。");

function bookInput(body: unknown, existing?: Book): Book | string {
  const value = record(body);
  const title = text(value.title, 200),
    author = text(value.author, 120);
  if (!title || !author) return "title 与 author 必填，长度分别不超过 200 与 120 个字符。";
  if (value.isbn !== undefined && (typeof value.isbn !== "string" || !/^\d{13}$/.test(value.isbn)))
    return "isbn 需要是 13 位数字。";
  if (value.publishedYear !== undefined && integer(value.publishedYear, 1450, 2100) === null)
    return "publishedYear 需要是 1450–2100 的整数。";
  const copies = value.copies === undefined ? (existing?.copies ?? 1) : integer(value.copies, 0, 99);
  if (copies === null) return "copies 需要是 0–99 的整数。";
  const lent = existing ? existing.copies - existing.available : 0;
  if (copies < lent) return `仍有 ${lent} 本借出，copies 不能小于 ${lent}。`;
  return {
    id: existing?.id ?? "",
    title,
    author,
    isbn: typeof value.isbn === "string" ? value.isbn : undefined,
    publishedYear: typeof value.publishedYear === "number" ? value.publishedYear : undefined,
    copies,
    available: copies - lent,
  };
}

function refresh(library: Library) {
  const now = library.now().toISOString();
  for (const loan of library.loans)
    if (loan.status === "active" && loan.dueAt < now) loan.status = "overdue";
}

export function registerSampleApi(app: WorkbenchServer, library: Library = createLibrary()) {
  app.route("GET", BASE + "/status", () =>
    json({ status: "ok", books: library.books.length, time: library.now().toISOString() }),
  );
  app.route("GET", BASE + "/books", ({ url }) => {
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const available = url.searchParams.get("available");
    const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
    const matched = library.books.filter(
      (book) =>
        (!q || book.title.toLowerCase().includes(q) || book.author.toLowerCase().includes(q)) &&
        (available !== "true" || book.available > 0),
    );
    return json({ items: matched.slice((page - 1) * pageSize, page * pageSize), total: matched.length, page, pageSize });
  });
  app.route("POST", BASE + "/books", ({ request, body }) => {
    if (!authorized(request)) return unauthorized();
    if (library.books.length >= LIMIT) return problem(400, "馆藏已满", "示例服务最多保存 500 本书。");
    const book = bookInput(body);
    if (typeof book === "string") return problem(400, "字段无效", book);
    book.id = "bk_" + library.next("book");
    library.books.push(book);
    return json(book, 201);
  });
  app.route("GET", BASE + "/books/:bookId", ({ params }) => {
    const book = library.books.find((item) => item.id === params.bookId);
    return book ? json(book) : problem(404, "未找到", `没有编号为 ${params.bookId} 的图书。`);
  });
  app.route("PUT", BASE + "/books/:bookId", ({ request, params, body }) => {
    if (!authorized(request)) return unauthorized();
    const index = library.books.findIndex((item) => item.id === params.bookId);
    if (index < 0) return problem(404, "未找到", `没有编号为 ${params.bookId} 的图书。`);
    const book = bookInput(body, library.books[index]);
    if (typeof book === "string") return problem(400, "字段无效", book);
    library.books[index] = book;
    return json(book);
  });
  app.route("DELETE", BASE + "/books/:bookId", ({ request, params }) => {
    if (!authorized(request)) return unauthorized();
    const index = library.books.findIndex((item) => item.id === params.bookId);
    if (index < 0) return problem(404, "未找到", `没有编号为 ${params.bookId} 的图书。`);
    if (library.loans.some((loan) => loan.bookId === params.bookId && loan.status !== "returned"))
      return problem(409, "仍在借出", "这本书还有未归还的借阅，归还后才能下架。");
    library.books.splice(index, 1);
    return new Response(null, { status: 204 });
  });
  app.route("GET", BASE + "/members", ({ request }) =>
    authorized(request) ? json(library.members) : unauthorized(),
  );
  app.route("POST", BASE + "/members", ({ request, body }) => {
    if (!authorized(request)) return unauthorized();
    const value = record(body);
    const name = text(value.name, 80);
    if (!name) return problem(400, "字段无效", "name 必填，最多 80 个字符。");
    if (value.email !== undefined && (typeof value.email !== "string" || !/^[^@\s]+@[^@\s]+$/.test(value.email)))
      return problem(400, "字段无效", "email 格式不正确。");
    if (library.members.length >= LIMIT) return problem(400, "读者已满", "示例服务最多保存 500 位读者。");
    const member: Member = {
      id: "mb_" + library.next("member"),
      name,
      email: typeof value.email === "string" ? value.email : undefined,
      joinedAt: library.now().toISOString().slice(0, 10),
    };
    library.members.push(member);
    return json(member, 201);
  });
  app.route("GET", BASE + "/members/:memberId", ({ request, params }) => {
    if (!authorized(request)) return unauthorized();
    const member = library.members.find((item) => item.id === params.memberId);
    return member ? json(member) : problem(404, "未找到", `没有编号为 ${params.memberId} 的读者。`);
  });
  app.route("GET", BASE + "/loans", ({ request, url }) => {
    if (!authorized(request)) return unauthorized();
    refresh(library);
    const memberId = url.searchParams.get("memberId");
    const status = url.searchParams.get("status");
    return json(
      library.loans.filter(
        (loan) => (!memberId || loan.memberId === memberId) && (!status || loan.status === status),
      ),
    );
  });
  app.route("POST", BASE + "/loans", ({ request, body }) => {
    if (!authorized(request)) return unauthorized();
    const value = record(body);
    const book = library.books.find((item) => item.id === value.bookId);
    const member = library.members.find((item) => item.id === value.memberId);
    if (!book || !member) return problem(400, "字段无效", "bookId 或 memberId 不存在。");
    const days = value.days === undefined ? 21 : integer(value.days, 1, 60);
    if (days === null) return problem(400, "字段无效", "days 需要是 1–60 的整数。");
    if (book.available < 1) return problem(409, "暂无可借副本", `《${book.title}》已全部借出。`);
    if (library.loans.length >= LIMIT) return problem(400, "记录已满", "示例服务最多保存 500 条借阅。");
    const borrowed = library.now();
    const loan: Loan = {
      id: "ln_" + library.next("loan"),
      bookId: book.id,
      memberId: member.id,
      status: "active",
      borrowedAt: borrowed.toISOString(),
      dueAt: new Date(borrowed.getTime() + days * 86_400_000).toISOString(),
      returnedAt: null,
    };
    book.available--;
    library.loans.push(loan);
    return json(loan, 201);
  });
  app.route("POST", BASE + "/loans/:loanId/return", ({ request, params }) => {
    if (!authorized(request)) return unauthorized();
    const loan = library.loans.find((item) => item.id === params.loanId);
    if (!loan) return problem(404, "未找到", `没有编号为 ${params.loanId} 的借阅。`);
    if (loan.status !== "returned") {
      loan.status = "returned";
      loan.returnedAt = library.now().toISOString();
      const book = library.books.find((item) => item.id === loan.bookId);
      if (book) book.available = Math.min(book.copies, book.available + 1);
    }
    return json(loan);
  });
  // 0.3.0 示例规格使用的只读接口，保留以兼容旧文档。
  app.route("GET", "/api/demo/health", () => ({
    status: "ok",
    service: "API 参考台",
    time: new Date().toISOString(),
  }));
}
