import { http, HttpResponse } from 'msw';

import type { ChatSseEvent, MessageFeedbackPayload, RenameConversationPayload } from '@/types/chat';

import { resolvePrincipal } from './_helpers';

/**
 * Chat MSW handlers — 對齊 v1.2 API 契約 (api-spec.md §3.7) + SSE 串流契約。
 *
 * 端點覆蓋：
 *  - POST   /chat/message                     SSE（若 Accept: text/event-stream）/ 退化 JSON（v1 兼容）
 *  - GET    /chat/conversations               對話列表
 *  - POST   /chat/conversations               建立對話
 *  - PATCH  /chat/conversations/:id           重新命名（v1.2 新增）
 *  - DELETE /chat/conversations/:id           軟刪除
 *  - GET    /chat/conversations/:id/messages  分頁訊息
 *  - POST   /chat/messages/:id/feedback       upsert feedback
 *  - DELETE /chat/messages/:id/feedback       清除 feedback
 *
 * Mock 行為：固定回 1 條 mock conversation；feedback 不持久化。
 * 真實後端接上後僅需把 VITE_USE_MOCK=false，前端不需改動。
 */

const ENVELOPE = (data: unknown, code = 0, message = 'success') => ({
  code,
  message,
  data,
  timestamp: Date.now(),
});

/**
 * 序列化 SSE 事件區塊（兩個 \n 結尾為 SSE 規範要求）。
 */
function sseBlock(ev: ChatSseEvent): string {
  return `event: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`;
}

/**
 * 假 SSE 串流：以 ReadableStream 推送 meta → 3× token → done 序列。
 * 對齊 sse-streaming-contract.md §5 範例。
 */
function buildMockSseStream(content: string, useRAG: boolean): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const messageId = `m-mock-${Date.now()}`;
  const conversationId = 'conv-mock-123';

  const fullAnswer = `這是針對「${content}」的模擬回覆。${useRAG ? '\n\n此回覆已結合 RAG 知識庫檢索內容 [1]。' : ''}`;
  // 將 fullAnswer 拆成 4–6 字一塊，模擬逐 token 推送
  const chunks: string[] = [];
  for (let i = 0; i < fullAnswer.length; i += 5) {
    chunks.push(fullAnswer.slice(i, i + 5));
  }

  const events: ChatSseEvent[] = [
    {
      type: 'meta',
      data: {
        conversationId,
        messageId,
        rewrittenQuery: null,
        asOfDate: null,
        model: 'mock-llm-2024',
        rerankFallback: false,
      },
    },
    ...chunks.map((delta, index): ChatSseEvent => ({ type: 'token', data: { delta, index } })),
    {
      type: 'done',
      data: {
        messageId,
        completed: true,
        references: useRAG
          ? [
              {
                chunkId: 'chunk-mock-1',
                documentId: 'DOC001',
                docTitle: '農會信用部業務規章',
                breadcrumb: [
                  { level: 'doc', label: '《農會信用部業務規章》' },
                  { level: 'article', label: '第 12 條' },
                ],
                docType: 'public_regulation' as const,
                authorityLevel: 'regulation' as const,
                articleNo: '第 12 條',
                snippet: '相關規章內容節錄：申請資格包含具有農保資格之農民...',
                finalScore: 1.04,
                relevanceScore: 1.04,
              },
            ]
          : [],
        citations: useRAG
          ? {
              '1': {
                chunkId: 'chunk-mock-1',
                documentId: 'DOC001',
                docTitle: '農會信用部業務規章',
                breadcrumb: [
                  { level: 'doc', label: '《農會信用部業務規章》' },
                  { level: 'article', label: '第 12 條' },
                ],
                docType: 'public_regulation',
                authorityLevel: 'regulation',
              },
            }
          : {},
        usage: {
          promptTokens: 1024,
          completionTokens: chunks.length,
          latencyMs: chunks.length * 20,
          firstTokenLatencyMs: 80,
        },
      },
    },
  ];

  return new ReadableStream({
    async start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(sseBlock(ev)));
        // 模擬逐 token 延遲，讓前端能看到串流效果
        if (ev.type === 'token') {
          await new Promise((r) => setTimeout(r, 20));
        }
      }
      controller.close();
    },
  });
}

export const chatHandlers = [
  // POST /chat/message — SSE 串流（v1.2 強制）或 v1 兼容 JSON 退化
  http.post('*/api/v1/chat/message', async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      content?: string;
      query?: string;
      useRAG?: boolean;
      asOfDate?: string | null;
    };
    const content = body.content ?? body.query ?? '';
    const useRAG = body.useRAG ?? true;

    // 依 Accept header 判斷：text/event-stream → SSE；否則退化 JSON（v1 路徑）
    const accept = request.headers.get('Accept') ?? '';
    if (accept.includes('text/event-stream')) {
      const stream = buildMockSseStream(content, useRAG);
      return new HttpResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // v1 兼容 JSON（@deprecated 路徑；真實後端會回 415）
    return HttpResponse.json(
      ENVELOPE({
        conversationId: 'conv-mock-123',
        message: {
          id: `msg-${Date.now()}`,
          conversationId: 'conv-mock-123',
          role: 'assistant',
          content: `這是針對「${content}」的模擬回覆。${useRAG ? '\n\n此回覆已結合 RAG 知識庫檢索內容。' : ''}`,
          createdAt: new Date().toISOString(),
          isStreaming: false,
          references: useRAG
            ? [
                {
                  chunkId: 'chunk-mock-1',
                  documentId: 'DOC001',
                  docTitle: '農會信用部業務規章',
                  snippet: '相關規章內容節錄：申請資格包含具有農保資格之農民...',
                  finalScore: 1.04,
                  relevanceScore: 1.04,
                },
              ]
            : [],
        },
      })
    );
  }),

  // GET /chat/conversations — 對話列表
  http.get('*/api/v1/chat/conversations', () =>
    HttpResponse.json(
      ENVELOPE({
        items: [
          {
            id: 'conv-mock-123',
            userId: 'USER001',
            title: '關於農業補貼的詢問',
            messageCount: 6,
            createdAt: '2026-04-01T10:00:00Z',
            updatedAt: '2026-04-03T12:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })
    )
  ),

  // GET /chat/conversations/:id — 對話詳情
  http.get('*/api/v1/chat/conversations/:id', ({ params }) =>
    HttpResponse.json(
      ENVELOPE({
        id: params.id,
        userId: 'USER001',
        title: '關於農業補貼的詢問',
        messageCount: 6,
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: '2026-04-03T12:00:00Z',
      })
    )
  ),

  // POST /chat/conversations — 建立空對話
  http.post('*/api/v1/chat/conversations', async ({ request }) => {
    const user = resolvePrincipal(request);
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const now = new Date().toISOString();
    return HttpResponse.json(
      ENVELOPE({
        id: `conv-${Date.now()}`,
        userId: user?.id ?? 'USER001',
        title: body.title ?? '新對話',
        messageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
    );
  }),

  // PATCH /chat/conversations/:id — 重新命名（v1.2 新增）
  http.patch('*/api/v1/chat/conversations/:id', async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as RenameConversationPayload;
    const title = body.title?.trim();
    if (!title || title.length === 0 || title.length > 30) {
      return HttpResponse.json(ENVELOPE(null, 20003, 'title 長度需在 1–30 字元'));
    }
    return HttpResponse.json(
      ENVELOPE({
        id: params.id,
        userId: 'USER001',
        title,
        messageCount: 4,
        createdAt: '2026-04-01T10:00:00Z',
        updatedAt: new Date().toISOString(),
      })
    );
  }),

  // DELETE /chat/conversations/:id — 軟刪除
  http.delete('*/api/v1/chat/conversations/:id', () =>
    HttpResponse.json(ENVELOPE(null, 0, '對話已刪除'))
  ),

  // GET /chat/conversations/:id/messages — 分頁訊息
  http.get('*/api/v1/chat/conversations/:id/messages', ({ params }) =>
    HttpResponse.json(
      ENVELOPE({
        items: [
          {
            id: 'msg-mock-1',
            conversationId: params.id,
            role: 'user',
            content: '請說明農會法第 5 條',
            createdAt: '2026-04-03T11:59:00Z',
            interrupted: false,
          },
          {
            id: 'msg-mock-2',
            conversationId: params.id,
            role: 'assistant',
            content: '農會法第五條規定...[1]...',
            createdAt: '2026-04-03T12:00:00Z',
            citations: {
              '1': {
                chunkId: 'chunk-mock-1',
                documentId: 'DOC001',
                docTitle: '農會法',
                breadcrumb: [
                  { level: 'doc', label: '《農會法》' },
                  { level: 'article', label: '第 5 條' },
                ],
                docType: 'public_regulation',
                authorityLevel: 'law',
              },
            },
            references: [
              {
                chunkId: 'chunk-mock-1',
                documentId: 'DOC001',
                docTitle: '農會法',
                breadcrumb: [
                  { level: 'doc', label: '《農會法》' },
                  { level: 'article', label: '第 5 條' },
                ],
                docType: 'public_regulation',
                authorityLevel: 'law',
                articleNo: '第 5 條',
                snippet: '依據農會法第 5 條規定...',
                finalScore: 1.104,
                relevanceScore: 1.104,
              },
            ],
            metadata: {
              provider: 'mock',
              model: 'mock-llm-2024',
              promptTokens: 1024,
              completionTokens: 64,
              latencyMs: 1840,
              firstTokenLatencyMs: 320,
              rerankFallback: false,
            },
            interrupted: false,
            feedback: null,
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      })
    )
  ),

  // POST /chat/messages/:id/feedback — upsert feedback（v1.2 新增）
  http.post('*/api/v1/chat/messages/:id/feedback', async ({ params, request }) => {
    const user = resolvePrincipal(request);
    const body = (await request.json().catch(() => ({}))) as MessageFeedbackPayload;
    if (body.rating !== 'good' && body.rating !== 'bad') {
      return HttpResponse.json(ENVELOPE(null, 20003, 'rating 必須為 good 或 bad'));
    }
    const now = new Date().toISOString();
    return HttpResponse.json(
      ENVELOPE({
        id: `f-${Date.now()}`,
        messageId: params.id,
        userId: user?.id ?? 'USER001',
        rating: body.rating,
        comment: body.comment ?? null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }),

  // DELETE /chat/messages/:id/feedback — 清除 feedback (idempotent)
  http.delete('*/api/v1/chat/messages/:id/feedback', () =>
    HttpResponse.json(ENVELOPE(null, 0, 'ok'))
  ),
];
