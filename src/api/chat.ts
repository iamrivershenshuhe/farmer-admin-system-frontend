/**
 * Chat API
 *
 * 對齊 v1.2 API 契約 (api-spec.md §3.7) + SSE 串流契約 (sse-streaming-contract.md)。
 *
 * 端點：
 *  - GET    /chat/conversations               對話列表
 *  - GET    /chat/conversations/{id}          對話詳情
 *  - POST   /chat/conversations               建立對話
 *  - PATCH  /chat/conversations/{id}          重新命名（v1.2 新增）
 *  - DELETE /chat/conversations/{id}          軟刪除
 *  - GET    /chat/conversations/{id}/messages 對話訊息分頁
 *  - POST   /chat/message                     SSE 串流回覆（v1.2 強制 SSE）
 *  - POST   /chat/messages/{id}/feedback      upsert 按讚/倒讚（v1.2 新增）
 *  - DELETE /chat/messages/{id}/feedback      清除 feedback（v1.2 新增）
 */

import { API_BASE_URL, API_VERSION } from '@/config';
import type { ApiResponse, PaginationParams, PaginationResponse } from '@/types/api';
import type {
  ChatSseEvent,
  Conversation,
  Message,
  MessageFeedback,
  MessageFeedbackPayload,
  RenameConversationPayload,
} from '@/types/chat';
import { httpClient } from '@/utils/request';

/**
 * SendMessageRequest — POST /chat/message body
 *
 * 對齊 api-spec §3.7.6：
 *  - `content` 為 v1.2 canonical；`query` 為 v1 別名（後端兩者皆受）
 *  - `useRAG` 預設 true；false 跳過 retrieve / rerank
 *  - `asOfDate` 為場景 ii 歷史時點查詢日期 (YYYY-MM-DD)；v1.2 後端固定 Top-5
 */
export interface SendMessageRequest {
  /** null 時後端建立新對話，在 meta event 回傳 conversationId */
  conversationId?: string | null;
  /** v1.2 canonical；≤ 5,000 字元 */
  content?: string;
  /**
   * @deprecated v1 別名 = `content`；v2.0 將移除。
   */
  query?: string;
  useRAG?: boolean;
  /**
   * 場景 ii 歷史時點查詢日期 (ISO 8601 西元年 YYYY-MM-DD)。
   * v1.2 後端接受；前端 UI 暫無 picker，留 contract 給 v1.3。
   */
  asOfDate?: string | null;
  /** v1.2 後端固定 Top-5；保留欄位 */
  topK?: number;
}

/**
 * @deprecated v1 非 SSE 兼容回應；v1.2 chat/message 強制 SSE，請改用 {@link sendMessageSse}。
 */
export interface SendMessageResponse {
  conversationId: string;
  message: Message;
}

export interface GetConversationsResponse {
  items: Conversation[];
}

// ============================================================================
// SSE 串流：POST /chat/message
// ============================================================================

/**
 * 解析 SSE block 為 ChatSseEvent。
 * 容錯：未知 event type 直接回 null（不 throw，讓 caller 跳過）。
 */
function parseSseBlock(block: string): ChatSseEvent | null {
  const lines = block.split('\n');
  let eventType: string | null = null;
  // SSE data field 可分多行；以 data: 開頭逐行累積
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  if (!eventType || dataLines.length === 0) return null;
  const dataStr = dataLines.join('\n');
  let parsed: unknown;
  try {
    parsed = JSON.parse(dataStr);
  } catch {
    return null;
  }
  switch (eventType) {
    case 'meta':
    case 'token':
    case 'citation':
    case 'heartbeat':
    case 'done':
    case 'error':
      return { type: eventType, data: parsed } as ChatSseEvent;
    default:
      return null;
  }
}

/**
 * 讀取 access token（與 utils/request.ts 邏輯一致；不附 Bearer 則 ApiError fail）。
 */
function readAccessTokenForSse(): string | null {
  const raw = localStorage.getItem('auth_token');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string } | string;
    if (typeof parsed === 'string') return parsed;
    return parsed.accessToken ?? null;
  } catch {
    return raw;
  }
}

/**
 * SSE 串流：POST /chat/message
 *
 * 對齊 sse-streaming-contract.md：
 *  - Response Content-Type: `text/event-stream`
 *  - 事件序列：`meta` → `token`* → `[heartbeat]` → `done` | `error`
 *  - 連線斷線：abort signal 觸發 → 後端標 `messages.interrupted=true`
 *  - 重連策略：v1.2 不支援 resumable streaming，前端自行重發
 *
 * **不使用 EventSource**：EventSource 不支援 POST body / 自訂 headers。
 * 改用 `fetch` + ReadableStream 解析 SSE 串流。
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * for await (const ev of sendMessageSse({ conversationId, content }, controller.signal)) {
 *   switch (ev.type) {
 *     case 'meta': // 建立 assistant message，存 messageId
 *     case 'token': // append ev.data.delta 到 content
 *     case 'done': // 寫入 references / citations / usage
 *     case 'error': // 顯示錯誤
 *   }
 * }
 * // 中斷：controller.abort();
 * ```
 */
export async function* sendMessageSse(
  request: SendMessageRequest,
  signal?: AbortSignal
): AsyncGenerator<ChatSseEvent, void, void> {
  const accessToken = readAccessTokenForSse();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE_URL}/${API_VERSION}/chat/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal,
  });

  if (!res.ok) {
    throw new Error(`SSE HTTP ${res.status}`);
  }
  if (!res.body) {
    throw new Error('SSE response missing body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔（CRLF 亦兼容）
      // 切塊後保留最後不完整片段於 buffer
      let separatorIdx: number;
      while ((separatorIdx = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + 2);
        // 兼容 \r\n\r\n
        const trimmed = block.replace(/\r$/, '');
        const ev = parseSseBlock(trimmed);
        if (ev) yield ev;
      }
    }
    // flush 剩餘片段（後端應在 done/error 後立即關連線；此為保險）
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const ev = parseSseBlock(buffer.trim());
      if (ev) yield ev;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
}

/**
 * @deprecated v1.2 起 /chat/message 強制 SSE，請改用 {@link sendMessageSse}。
 *
 * 此函式維持 mock / 舊測試兼容；接到真實後端後將回 415 或 SSE 串流，
 * 兩者皆無法解析為 JSON，呼叫端應於 v1.3 完成 SSE 遷移。
 */
export const sendMessage = async (
  request: SendMessageRequest
): Promise<ApiResponse<SendMessageResponse>> => {
  // 兼容映射：若 caller 只傳 `query`，補上 `content`（後端兩者皆受）
  const body: SendMessageRequest = {
    ...request,
    content: request.content ?? request.query,
  };
  return httpClient.post<SendMessageResponse>('/chat/message', body);
};

// ============================================================================
// 對話 (Conversations)
// ============================================================================

/**
 * 取得對話列表 (GET /chat/conversations)
 *
 * v1.2 後端分頁；前端目前傳統一 envelope，store 端 normalize。
 */
export const getConversations = async (
  params?: PaginationParams
): Promise<ApiResponse<GetConversationsResponse>> => {
  return httpClient.get<GetConversationsResponse>('/chat/conversations', { params });
};

/**
 * 取得單一對話 (GET /chat/conversations/{id})
 */
export const getConversation = async (conversationId: string): Promise<ApiResponse<Conversation>> =>
  httpClient.get<Conversation>(`/chat/conversations/${conversationId}`);

/**
 * 建立空對話 (POST /chat/conversations)
 */
export const createConversation = async (title?: string): Promise<ApiResponse<Conversation>> =>
  httpClient.post<Conversation>('/chat/conversations', title ? { title } : {});

/**
 * 重新命名對話 (PATCH /chat/conversations/{id}) — v1.2 新增
 *
 * 後端：self only（admin 不代改）；title 1–30 字元。
 * 重新命名後 title 被鎖定，後續新訊息不再覆寫 (TSD-02 §13.5)。
 */
export const renameConversation = async (
  conversationId: string,
  payload: RenameConversationPayload
): Promise<ApiResponse<Conversation>> =>
  httpClient.patch<Conversation>(`/chat/conversations/${conversationId}`, payload);

/**
 * 軟刪除對話 (DELETE /chat/conversations/{id})
 */
export const deleteConversation = async (conversationId: string): Promise<ApiResponse<null>> =>
  httpClient.delete<null>(`/chat/conversations/${conversationId}`);

/**
 * 對話訊息分頁 (GET /chat/conversations/{id}/messages)
 *
 * 後端為對話訊息的唯一 source of truth；
 * 前端 client-side `Conversation.messages` 為 client cache（v1 兼容）。
 */
export const getConversationMessages = async (
  conversationId: string,
  params?: PaginationParams
): Promise<ApiResponse<PaginationResponse<Message>>> =>
  httpClient.get<PaginationResponse<Message>>(`/chat/conversations/${conversationId}/messages`, {
    params,
  });

// ============================================================================
// Message Feedback (v1.2 新增)
// ============================================================================

/**
 * 對 assistant message 提交按讚/倒讚 + 選填留言 (POST /chat/messages/{id}/feedback)
 *
 * 對齊 api-spec §3.7.8：
 *  - 一筆 (message, user) 至多一筆；resubmit 覆寫
 *  - Feedback 不影響 retrieval 加分或 reranker score；純品質訊號
 *  - 對 `role≠assistant` 訊息送會回 `code: 20003`
 */
export const submitMessageFeedback = async (
  messageId: string,
  payload: MessageFeedbackPayload
): Promise<ApiResponse<MessageFeedback>> =>
  httpClient.post<MessageFeedback>(`/chat/messages/${messageId}/feedback`, payload);

/**
 * 清除 message feedback (DELETE /chat/messages/{id}/feedback) — v1.2 新增
 *
 * idempotent：若未存在亦回 200。
 */
export const clearMessageFeedback = async (messageId: string): Promise<ApiResponse<null>> =>
  httpClient.delete<null>(`/chat/messages/${messageId}/feedback`);
