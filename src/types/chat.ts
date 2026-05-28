/**
 * Chat 相關型別定義
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.7)、SSE 串流契約 (sse-streaming-contract.md)、
 * 與 OpenAPI Message / Citation / DocumentReference schema。
 */

// 訊息角色
export type MessageRole = 'user' | 'assistant' | 'system';

/** 使用者對 assistant message 的品質回饋 (POST /chat/messages/{id}/feedback) */
export type FeedbackRating = 'good' | 'bad';

/**
 * Citation 為「答覆文字中 `[N]` 標記」的解析結果 (key 為 1-based 字串 index)。
 * Shape 對齊 openapi.yaml#Citation。
 */
export interface Citation {
  chunkId?: string;
  documentId?: string;
  docTitle?: string;
  breadcrumb?: import('./rag').BreadcrumbItem[];
  docType?: import('./knowledge').DocType;
  authorityLevel?: import('./rag').AuthorityLevel;
  articleNo?: string | null;
  rerankScore?: number;
  finalScore?: number;
}

/** Message metadata (assistant 訊息附帶；對齊 openapi.yaml#Message.metadata) */
export interface MessageMetadata {
  provider?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs?: number;
  firstTokenLatencyMs?: number;
  rerankFallback?: boolean;
  /** PII 命中統計（不含原文） */
  piiFindings?: Array<Record<string, unknown>>;
}

// 單條訊息
export interface Message {
  id: string;
  /** 對話 ID（後端 message 必帶；client-side optimistic UI 可暫缺） */
  conversationId?: string;
  content: string;
  role: MessageRole;
  /**
   * v1 別名 = `createdAt`；前端 client-side 累積為 Date。
   * 後端固定回 ISO 8601 string；前端 store 在收 message 時轉 Date。
   * @deprecated 改用 {@link createdAt}；v2.0 將移除。
   */
  timestamp: Date;
  /** v1.2 canonical：訊息建立時間 (ISO 8601 UTC string)。後端 DB 欄位。 */
  createdAt?: string;
  /** Stage 6 query rewrite 後的 query（後端內部 RAG 流程使用；assistant message 才有） */
  rewrittenQuery?: string | null;
  /** 場景 ii 歷史時點查詢日期 (YYYY-MM-DD)；場景 i 為 null */
  queryAsOfDate?: string | null;
  /** Stage 11 解析結果：1-based citation map */
  citations?: Record<string, Citation> | null;
  /** Reranker Top-5 引用清單（assistant message 才有） */
  references?: import('./rag').DocumentReference[]; // RAG 引用來源
  /** Provider / token / latency 等品質指標 */
  metadata?: MessageMetadata | null;
  /** 客戶端斷線造成截斷 */
  interrupted?: boolean;
  isStreaming?: boolean;
  attachments?: import('./upload').UploadedFile[]; // 文件附件
  /**
   * 使用者對此訊息的品質回饋（後端持久化；不影響 retrieval score）。
   * 對齊 v1.2 POST/DELETE `/chat/messages/{id}/feedback`。
   * 後端 schema 允許 null（未設定），前端 UI 將 null 視同 undefined。
   */
  feedback?: FeedbackRating;
}

// 對話
export interface Conversation {
  id: string;
  /** 對話擁有者 (v1.2 後端必帶；前端 client-only 對話可暫缺) */
  userId?: string;
  title: string;
  messageCount?: number;
  /**
   * v1 兼容：前端 client-side 累積；後端列表 endpoint 不返回此欄位，
   * 唯一 source of truth 為 `GET /chat/conversations/{id}/messages` 分頁查詢。
   */
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

// 聊天狀態
export interface ChatState {
  conversations: Conversation[];
  currentConversationId: string | null;
  isLoading: boolean;
  error: string | null;
}

// ===== Feedback API payload =====

/** POST /chat/messages/{id}/feedback body */
export interface MessageFeedbackPayload {
  rating: FeedbackRating;
  /** 選填留言；≤ 1000 字 */
  comment?: string;
}

/** Feedback row (response of POST /chat/messages/{id}/feedback) */
export interface MessageFeedback {
  id: string;
  messageId: string;
  userId: string;
  rating: FeedbackRating;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== Rename conversation =====

/** PATCH /chat/conversations/{id} body */
export interface RenameConversationPayload {
  title: string; // 1–30 字元 (Unicode codepoint)
}

// ===== SSE Events (POST /chat/message) =====
//
// 規格：standard/sse-streaming-contract.md
// 後端逐 chunk 推送；前端以 fetch + ReadableStream 解析。

/** SSE meta event — 首事件，後端建立 assistant message 並回 messageId */
export interface SseMetaEvent {
  conversationId: string;
  messageId: string;
  /** Stage 6 改寫後 query（若觸發） */
  rewrittenQuery?: string | null;
  /** 場景 ii 歷史時點 (YYYY-MM-DD)；場景 i 為 null */
  asOfDate?: string | null;
  /** LLM model 字串（e.g. claude-sonnet-4-6-20260301） */
  model: string;
  /** Reranker 故障退化為 Retriever Top-5 + AUTHORITY_BONUS 即 true */
  rerankFallback: boolean;
}

/** SSE token event — 逐 token 推送 */
export interface SseTokenEvent {
  /** 本次推送的 token / 文字片段（可為單字或多字） */
  delta: string;
  /** 連線內 token 序號（可選；後端可不送） */
  index?: number;
}

/** SSE citation event — v1.2 保留欄位（v1.2 不使用；citations 統一在 done 附送） */
export interface SseCitationEvent {
  number: number;
  chunkId: string;
  documentId: string;
  breadcrumb?: import('./rag').BreadcrumbItem[];
}

/** SSE heartbeat event — 每 15 秒一次 keep-alive */
export interface SseHeartbeatEvent {
  /** Unix 毫秒時間戳 */
  ts: number;
}

/** SSE done event — 結束事件，附帶 references / citations / usage */
export interface SseDoneEvent {
  messageId: string;
  /** true = 正常結束；false = 部分完成（截斷 / 斷線 / token budget） */
  completed: boolean;
  references?: import('./rag').DocumentReference[];
  citations?: Record<string, Citation>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    latencyMs?: number;
    firstTokenLatencyMs?: number;
  };
}

/** SSE error event — 連線建立後錯誤（LLM 全失敗 / PII block 等） */
export interface SseErrorEvent {
  /** 業務錯誤碼 (ApiErrorCode) */
  code: number;
  /** 使用者友善訊息 (zh-TW) */
  message: string;
  /** 若觸發降級回退（Generator 全失效），附 fallback chunks */
  fallback?: {
    answerType: 'fallback_chunks';
    chunks: import('./rag').DocumentReference[];
  } | null;
}

/**
 * SSE 事件聯集（discriminated union by `type`）。
 * 前端 `sendMessageSse` async generator 即 yield 此型別。
 */
export type ChatSseEvent =
  | { type: 'meta'; data: SseMetaEvent }
  | { type: 'token'; data: SseTokenEvent }
  | { type: 'citation'; data: SseCitationEvent }
  | { type: 'heartbeat'; data: SseHeartbeatEvent }
  | { type: 'done'; data: SseDoneEvent }
  | { type: 'error'; data: SseErrorEvent };
