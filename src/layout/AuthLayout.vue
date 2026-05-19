<script setup lang="ts">
/**
 * 登入頁專用佈局
 * 提供全螢幕背景與置中容器，不包含側邊欄和頂部導航
 */
</script>

<template>
  <div class="auth-layout">
    <!-- 登入內容區域 -->
    <div class="auth-container">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.auth-layout {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;

  /* 簡約黑灰色漸變背景 */
  background: linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #0f0f0f 100%);
}

/* 內容容器 */
.auth-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 32rem;
  padding: 2rem;
}

/*
 * auth 頁專用：按鈕圓角由全域膠囊（--r-pill）改為圓角方（--r-md），
 * 與輸入框一致。單點覆寫，僅作用於 AuthLayout 內的三個 auth 視圖，
 * 不影響全域 BaseButton。
 */
.auth-container :deep(.base-button) {
  border-radius: var(--r-md);
}
</style>
