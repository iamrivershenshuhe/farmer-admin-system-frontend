<script setup lang="ts">
import { RouterView } from 'vue-router';

import Toast from '@/components/common/Toast.vue';
import { useTheme } from '@/composables/useTheme';

const { initTheme } = useTheme();
initTheme();
</script>

<template>
  <div class="app-root">
    <RouterView />
    <Toast />
  </div>
</template>

<style scoped>
.app-root {
  height: 100%;
  min-height: 100vh;
  color: var(--text);
  background: var(--bg);
}
</style>
