<script setup lang="ts">
import { ref } from "vue";
import wordsData from "@/services/words";

const inputText = ref("");
const matchedWords = ref("");
const copySuccess = ref(false);
const selectedLevels = ref<number[]>([]);

// 动态计算等级范围
const maxLevel = Math.max(
  ...wordsData.map((item) => {
    const match = item.level.match(/(\d+)/g);
    if (!match) return 0;
    if (item.level.includes("~") && match[1]) {
      return parseInt(match[1]);
    }
    return Math.max(...match.map(Number));
  }),
);
const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);

function parseLevels(levelStr: string): number[] {
  const result: number[] = [];

  // 匹配范围格式: 7~9
  const rangeMatch = levelStr.match(/(\d+)~(\d+)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const start = parseInt(rangeMatch[1]);
    const end = parseInt(rangeMatch[2]);
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }

  // 匹配多等级格式: 1（3） -> [1, 3]
  const multiMatch = levelStr.match(/[\d]+/g);
  if (multiMatch) {
    return multiMatch.map(Number);
  }

  // 单个等级: 1
  const singleMatch = levelStr.match(/^(\d+)$/);
  if (singleMatch && singleMatch[1]) {
    return [parseInt(singleMatch[1])];
  }

  return [];
}

function itemMatchesLevel(item: (typeof wordsData)[number]): boolean {
  if (selectedLevels.value.length === 0) return true;

  const itemLevels = parseLevels(item.level);
  return itemLevels.some((l) => selectedLevels.value.includes(l));
}

function matchWords() {
  if (!inputText.value.trim()) return;

  const text = inputText.value;
  const wordMap = new Map(wordsData.map((item) => [item.word, item]));

  const matched: (typeof wordsData)[number][] = [];
  for (let i = 0; i < text.length; i++) {
    for (let j = i + 1; j <= text.length; j++) {
      const substr = text.slice(i, j);
      const item = wordMap.get(substr);
      if (item && !matched.find((m) => m.word === item.word) && itemMatchesLevel(item)) {
        matched.push(item);
      }
    }
  }

  matchedWords.value = matched
    .map((item) => {
      const id = String(item.id).padEnd(10);
      const level = item.level.padEnd(6);
      const word = item.word.padEnd(10);
      const pinyin = item.pinyin.padEnd(20);
      const pos = item.partOfSpeech;
      return `${id}${level}${word}${pinyin}${pos}`;
    })
    .join("\n");
}

function copyToClipboard() {
  if (matchedWords.value) {
    navigator.clipboard.writeText(matchedWords.value);
    copySuccess.value = true;
    setTimeout(() => {
      copySuccess.value = false;
    }, 2000);
  }
}

function toggleLevel(level: number) {
  const index = selectedLevels.value.indexOf(level);
  if (index === -1) {
    selectedLevels.value.push(level);
  } else {
    selectedLevels.value.splice(index, 1);
  }
}
</script>

<template>
  <div class="container">
    <h1>词语匹配工具</h1>

    <div class="filter-section">
      <label>筛选等级:</label>
      <div class="level-checkboxes">
        <label v-for="level in levels" :key="level" class="checkbox-label">
          <input
            type="checkbox"
            :checked="selectedLevels.includes(level)"
            @change="toggleLevel(level)"
          />
          {{ level }}
        </label>
      </div>
    </div>

    <div class="input-section">
      <label>请输入文本:</label>
      <textarea v-model="inputText" rows="6" placeholder="请输入需要匹配的文本..."></textarea>
    </div>

    <div class="action-section">
      <button @click="matchWords">匹配</button>
    </div>

    <div class="output-section" v-if="matchedWords">
      <div class="output-header">
        <label>匹配结果:</label>
        <button @click="copyToClipboard" :class="{ success: copySuccess }">
          {{ copySuccess ? "已复制" : "复制" }}
        </button>
      </div>
      <textarea v-model="matchedWords" rows="15"></textarea>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
  font-family: sans-serif;
}

h1 {
  margin-bottom: 2rem;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-section > label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.level-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
}

.checkbox-label:has(input:checked) {
  background: #e8f5e9;
  border-color: #4caf50;
}

.checkbox-label input {
  cursor: pointer;
}

.input-section,
.output-section {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

textarea {
  width: 100%;
  padding: 0.75rem;
  font-family: monospace;
  font-size: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
}

textarea:focus {
  outline: none;
  border-color: #4caf50;
}

.action-section {
  margin-bottom: 1.5rem;
}

button {
  padding: 0.6rem 1.5rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background: #45a049;
}

button.success {
  background: #2196f3;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.output-header label {
  margin-bottom: 0;
}
</style>
