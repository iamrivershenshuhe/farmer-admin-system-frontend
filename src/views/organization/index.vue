<template>
  <div class="organization-page">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

import { useHeaderStore } from '@/stores/header';

const headerStore = useHeaderStore();

onMounted(() => {
  headerStore.setTabs([
    { label: '部門管理', to: '/organization/departments' },
    { label: '業務別管理', to: '/organization/business-types' },
    { label: '人員管理', to: '/organization/staff' },
  ]);
});

onUnmounted(() => {
  headerStore.clearTabs();
});
</script>

<style scoped>
.organization-page {
  max-width: 1400px;
  padding: 2rem;
  margin: 0 auto;
}
</style>
