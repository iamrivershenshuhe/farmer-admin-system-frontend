/**
 * RAG 相關型別定義
 *
 * 對齊 v1.2 OpenAPI schema (openapi.yaml#DocumentReference / #Citation / #BreadcrumbItem)。
 */

import type { Message } from './chat';
import type { DocType } from './knowledge';

// 文件
export interface Document {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  category?: string;
  tags?: string[];
  description?: string;
  chunks?: number; // 切片數量
  vectorized: boolean; // 是否已向量化
}

// 向量切片
export interface VectorChunk {
  id: string;
  documentId: string;
  content: string;
  vector: number[];
  metadata?: Record<string, unknown>;
}

// RAG 查詢請求
export interface RAGQueryRequest {
  conversationId?: string;
  query: string;
  useRAG: boolean;
  topK?: number; // 檢索前 K 個相關文件
}

// RAG 查詢回應
export interface RAGQueryResponse {
  conversationId: string;
  message: Message;
  references?: DocumentReference[];
}

/**
 * Authority level（檢索 rerank 排名軸；與 docType 正交）。
 * 對齊 [TSD-01 §4 / CONTEXT.md §Knowledge]。
 */
export type AuthorityLevel = 'law' | 'regulation' | 'directive' | 'internal' | 'sop';

/**
 * Breadcrumb 結構化路徑 item。
 * 對齊 openapi.yaml#BreadcrumbItem。
 */
export interface BreadcrumbItem {
  /** 文件結構層級 */
  level:
    | 'doc'
    | 'chapter'
    | 'section'
    | 'article'
    | 'clause'
    | 'public_doc_field'
    | 'step'
    | 'segment';
  /** 顯示文字（e.g.「《農會法》」、「第 33 條」、「步驟 4」） */
  label: string;
}

/**
 * 文件引用（assistant message 附帶 references[]）。
 *
 * Shape 對齊 openapi.yaml#DocumentReference。後端 reference dict 恆發出
 * `docTitle` / `snippet` / `finalScore` / `breadcrumb`，並仍附 `relevanceScore`
 * 別名；舊 `documentName` / `content` 欄位後端從未發出，已於 v1.3 移除。
 */
export interface DocumentReference {
  chunkId: string;
  documentId: string;
  /**
   * 文件標題 (v1.2 canonical)；對應後端 `docTitle`，即 KnowledgeDocument.filename。
   */
  docTitle: string;
  /**
   * 結構化麵包屑路徑 (v1.2 canonical)；UI 渲染 chip / tooltip 使用。
   */
  breadcrumb?: BreadcrumbItem[];
  /** 文件類別 */
  docType?: DocType;
  /** 法規階層（rerank 加權用；公開法規常為 `law` / `regulation`） */
  authorityLevel?: AuthorityLevel;
  /** 條號（公開法規 / 內部規章） */
  articleNo?: string | null;
  /** 公文文號（電子公文 doc_type） */
  officialNo?: string | null;
  /** 步驟序號（作業手冊 doc_type） */
  stepNo?: number | null;
  /** 引文片段（v1.2 canonical），約 200–500 字 */
  snippet: string;
  /** Reranker 原始分數 */
  rerankScore?: number;
  /** 最終分數（含 AUTHORITY_BONUS） */
  finalScore: number;
  /**
   * @deprecated v1 別名 = `finalScore`；後端仍附此值。v2.0 將移除。
   */
  relevanceScore?: number;
}

// 上傳文件請求
export interface UploadDocumentRequest {
  file: File;
  category?: string;
  tags?: string[];
  description?: string;
}

// 上傳文件回應
export interface UploadDocumentResponse {
  document: Document;
}
