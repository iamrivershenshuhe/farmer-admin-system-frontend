import type { Message } from '@/types';

export function getMockAIResponse(userMessage: string, useRAG: boolean): Message {
  return {
    id: `msg_${Date.now()}_ai`,
    content: `這是 AI 的回覆：\n\n您說：「${userMessage}」\n\n這是一個模擬回覆，實際應該連接後端 API。\n\n支援 **Markdown** 語法，包括：\n- 列表\n- **粗體**\n- *斜體*\n- \`程式碼\`\n\n\`\`\`javascript\nconsole.log('Hello World')\n\`\`\`${useRAG ? '\n\n已啟用 RAG 檢索' : ''}`,
    role: 'assistant',
    timestamp: new Date(),
    references: useRAG
      ? [
          {
            documentId: 'doc_1',
            chunkId: 'chunk_1',
            docTitle: '模擬文檔',
            snippet:
              '這是文檔中的一段引用內容，用於測試 RAG 參考來源的顯示效果。點擊可以預覽文檔。',
            finalScore: 0.95,
            relevanceScore: 0.95,
          },
          {
            documentId: 'doc_2',
            chunkId: 'chunk_2',
            docTitle: '測試報告',
            snippet: '這是另一份文檔的測試內容，確保多個來源也能正常顯示。',
            finalScore: 0.88,
            relevanceScore: 0.88,
          },
        ]
      : undefined,
  };
}
