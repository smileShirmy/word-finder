<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const tabs = [
  { name: "word-match", label: "词语匹配" },
  { name: "excel-to-json", label: "Excel 转 JSON 工具" },
];

function switchTab(name: string) {
  router.push({ name });
}
</script>

<template>
  <div class="app">
    <nav class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        :class="{ active: route.name === tab.name }"
        @click="switchTab(tab.name)"
      >
        {{ tab.label }}
      </button>
    </nav>
    <router-view />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
}

.tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #ddd;
  background: #f5f5f5;
  padding: 0 1rem;
}

.tabs button {
  padding: 1rem 1.5rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  color: #666;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tabs button:hover {
  color: #333;
}

.tabs button.active {
  color: #4caf50;
  border-bottom-color: #4caf50;
  background: white;
}
</style>
