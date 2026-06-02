import { defineStore } from 'pinia';
import { ref } from 'vue';

import { getConversations, sendMessageSse } from '@/api/chat';
import { CHAT } from '@/config';
import type { Conversation, Message } from '@/types/chat';

export const useChatStore = defineStore(
  'chat',
  () => {
    const conversations = ref<Conversation[]>([]);
    const currentConversationId = ref<string | null>(null);
    const isLoading = ref<boolean>(false);
    const error = ref<string | null>(null);

    // 進行中的 SSE 串流 AbortController：以 conversationId 為鍵，
    // 讓 deleteConversation / 同會話新訊息可主動中斷舊串流。
    const abortControllers = new Map<string, AbortController>();

    /**
     * 取消串流：指定 conversationId 則只清該會話；省略則全部清。
     */
    const cancelStreaming = (conversationId?: string): void => {
      if (conversationId !== undefined) {
        const c = abortControllers.get(conversationId);
        if (c) {
          c.abort();
          abortControllers.delete(conversationId);
        }
        return;
      }
      abortControllers.forEach((c) => c.abort());
      abortControllers.clear();
    };

    /**
     * 創建新對話（本地）
     */
    const createConversation = (): Conversation => {
      const newConversation: Conversation = {
        id: `conv_${Date.now()}`,
        title: '新對話',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      conversations.value.unshift(newConversation);
      currentConversationId.value = newConversation.id;
      return newConversation;
    };

    /**
     * 設置當前對話
     */
    const setCurrentConversation = (conversationId: string | null): void => {
      currentConversationId.value = conversationId;
    };

    /**
     * 刪除對話
     */
    const deleteConversation = async (conversationId: string): Promise<void> => {
      try {
        // 清掉此會話進行中的假串流 timer，避免在已釋放訊息物件上繼續 mutate
        cancelStreaming(conversationId);
        // httpClient.delete(`/chat/conversations/${conversationId}`)
        // 本地刪除
        const index = conversations.value.findIndex((c) => c.id === conversationId);
        if (index !== -1) {
          conversations.value.splice(index, 1);
        }

        // 如果刪除的是當前對話，清除當前對話 ID
        if (currentConversationId.value === conversationId) {
          currentConversationId.value = null;
        }
      } catch (err) {
        error.value = err instanceof Error ? err.message : '刪除對話失敗';
        throw err;
      }
    };

    /**
     * 發送訊息（樂觀更新）
     */
    const sendMessage = async (
      conversationId: string | undefined,
      content: string,
      attachments?: import('@/types').UploadedFile[],
      useRAG = true
    ): Promise<string> => {
      let targetConversationId = conversationId;

      try {
        // 1. 立即創建或獲取對話
        if (!targetConversationId) {
          const newConv = createConversation();
          targetConversationId = newConv.id;
        }

        const conversation = conversations.value.find((c) => c.id === targetConversationId);
        if (!conversation) throw new Error('對話不存在');

        // 2. 立即添加用戶訊息（樂觀更新）
        const userMessage: Message = {
          id: `msg_${Date.now()}`,
          content,
          role: 'user',
          timestamp: new Date(),
          attachments, // 添加附件
        };

        conversation.messages.push(userMessage);

        // 3. 如果是第一條訊息，立即更新標題
        if (conversation.messages.length === 1) {
          conversation.title =
            content.slice(0, CHAT.MAX_CONVERSATION_TITLE_LENGTH) +
            (content.length > CHAT.MAX_CONVERSATION_TITLE_LENGTH ? '...' : '');
        }

        conversation.updatedAt = new Date();

        // 4. 背景處理 AI 回覆
        handleAIResponse(targetConversationId, content, useRAG);

        return targetConversationId;
      } catch (err) {
        error.value = err instanceof Error ? err.message : '發送訊息失敗';
        throw err;
      }
    };

    /**
     * 背景處理 AI 回覆 — 消費真實後端 SSE 串流 (POST /chat/message)。
     *
     * meta：記住後端 conversationId 於 conversation.serverId（不改本地 id）並建立 assistant 佔位訊息;
     * token：逐 delta 累加 content;
     * done：收束 references / citations，isStreaming = false;
     * error：顯示訊息並附 fallback chunks（若有）。使用者主動中斷 (abort) 不視為錯誤。
     */
    const handleAIResponse = async (
      conversationId: string,
      userMessage: string,
      useRAG: boolean
    ): Promise<void> => {
      const conversation = conversations.value.find((c) => c.id === conversationId);
      if (!conversation) return;

      // 本地 conv_ id 非後端 UUID → 首則送 null 讓後端建立對話；之後用 serverId 延續。
      // 不重鍵本地 id（否則破壞路由 /chat/:id 綁定，畫面會找不到該對話）。
      const isLocalId = conversationId.startsWith('conv_');
      cancelStreaming(conversationId); // 防禦：中斷此會話既有串流
      const controller = new AbortController();
      abortControllers.set(conversationId, controller);

      let placeholder: Message | null = null;

      try {
        isLoading.value = true;
        error.value = null;

        for await (const ev of sendMessageSse(
          {
            conversationId: conversation.serverId ?? (isLocalId ? null : conversationId),
            content: userMessage,
            useRAG,
          },
          controller.signal
        )) {
          if (ev.type === 'meta') {
            conversation.serverId = ev.data.conversationId; // 記住後端對話 id（供後續訊息）
            placeholder = {
              id: ev.data.messageId,
              conversationId: ev.data.conversationId,
              content: '',
              role: 'assistant',
              timestamp: new Date(),
              rewrittenQuery: ev.data.rewrittenQuery ?? null,
              isStreaming: true,
              metadata: { model: ev.data.model, rerankFallback: ev.data.rerankFallback },
            };
            conversation.messages.push(placeholder);
            // 取陣列中的反應式代理：直接 mutate 原始物件不會觸發 Vue 反應式更新 / persist。
            placeholder = conversation.messages[conversation.messages.length - 1];
            conversation.updatedAt = new Date();
            isLoading.value = false; // 首事件到 → 隱藏 typing indicator，改由 isStreaming 呈現
          } else if (ev.type === 'token') {
            if (placeholder) placeholder.content += ev.data.delta;
          } else if (ev.type === 'done') {
            if (placeholder) {
              placeholder.references = ev.data.references;
              placeholder.citations = ev.data.citations ?? null;
              placeholder.interrupted = ev.data.completed === false;
              placeholder.isStreaming = false;
            }
          } else if (ev.type === 'error') {
            error.value = ev.data.message;
            if (placeholder) {
              if (!placeholder.content) placeholder.content = ev.data.message;
              if (ev.data.fallback?.chunks) placeholder.references = ev.data.fallback.chunks;
              placeholder.interrupted = true;
              placeholder.isStreaming = false;
            }
          }
          // heartbeat / citation：忽略（citations 統一在 done 附送）
        }
      } catch (err) {
        // 使用者主動中斷 (abort) 不算錯誤
        if (!controller.signal.aborted) {
          error.value = err instanceof Error ? err.message : 'AI 回覆失敗';
        }
        if (placeholder) placeholder.isStreaming = false;
      } finally {
        abortControllers.delete(conversationId);
        isLoading.value = false;
      }
    };

    /**
     * 載入對話列表（從後端）
     */
    const loadConversations = async (): Promise<void> => {
      try {
        isLoading.value = true;
        error.value = null;

        const res = await getConversations();
        conversations.value = res.data.items.map((conv) => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: (conv.messages || []).map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      } catch (err) {
        error.value = err instanceof Error ? err.message : '載入對話列表失敗';
      } finally {
        isLoading.value = false;
      }
    };

    return {
      conversations,
      currentConversationId,
      isLoading,
      error,
      createConversation,
      setCurrentConversation,
      deleteConversation,
      sendMessage,
      loadConversations,
      cancelStreaming,
    };
  },
  {
    persist: {
      key: 'chat-state',
      pick: ['conversations'],
    },
  }
);
