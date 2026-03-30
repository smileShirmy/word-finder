<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import wordsData from "@/services/words";
import Sortable from "sortablejs";

interface MatchResult {
  id: string;
  word: string;
  pinyin: string;
  level: string;
  partOfSpeech: string;
  totalCount: number; // 在所有文本中出现的总次数（每个文本算一次）
  textIds: number[]; // 出现在哪些文本中（文本ID数组）
}

interface TextInput {
  id: number;
  text: string;
  results: MatchResult[];
  copySuccess: boolean;
}

const textInputs = ref<TextInput[]>([{ id: 1, text: "", results: [], copySuccess: false }]);
const selectedLevels = ref<number[]>([]);
let nextId = 2;
const allCopySuccess = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const sortableInstances = ref<Map<number, Sortable>>(new Map()); // 存储每个卡片的 sortable 实例

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

  // 匹配中文括号范围格式: 5（7-9）或 5（7~9）
  const bracketRangeMatch = levelStr.match(/(\d+)[（(](\d+)[-~](\d+)[）)]/);
  if (bracketRangeMatch && bracketRangeMatch[1] && bracketRangeMatch[2] && bracketRangeMatch[3]) {
    const mainLevel = parseInt(bracketRangeMatch[1]);
    const rangeStart = parseInt(bracketRangeMatch[2]);
    const rangeEnd = parseInt(bracketRangeMatch[3]);
    result.push(mainLevel);
    for (let i = rangeStart; i <= rangeEnd; i++) {
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

function matchWords(inputIndex: number) {
  const inputItem = textInputs.value[inputIndex];
  if (!inputItem?.text.trim()) return;

  const wordMap = new Map(wordsData.map((item) => [item.word, item]));
  const matchedWords = new Set<string>();
  const text = inputItem.text;

  // 匹配文本中的词语（只记录是否出现，不统计出现次数）
  for (let i = 0; i < text.length; i++) {
    for (let j = i + 1; j <= text.length; j++) {
      const substr = text.slice(i, j);
      const item = wordMap.get(substr);
      if (item && !matchedWords.has(item.word) && itemMatchesLevel(item)) {
        matchedWords.add(item.word);
      }
    }
  }

  // 转换为数组并排序
  inputItem.results = Array.from(matchedWords)
    .map((word) => {
      const item = wordMap.get(word)!;
      return {
        id: String(item.id),
        word: item.word,
        pinyin: item.pinyin,
        level: item.level,
        partOfSpeech: item.partOfSpeech,
        totalCount: 1, // 初始时总次数为1（当前文本）
        textIds: [], // 初始为空，由 updateGlobalCounts 填充
      };
    })

  // 更新全局次数
  updateGlobalCounts();

  // 初始化拖拽
  initSortable(inputIndex);
}

// 更新所有文本中词语的全局出现次数
function updateGlobalCounts() {
  const countMap = new Map<string, { count: number; textIds: number[] }>();

  // 统计所有文本中每个词语出现的文本数量和文本序号列表
  textInputs.value.forEach((inputItem, index) => {
    inputItem.results.forEach((result) => {
      const current = countMap.get(result.word) || { count: 0, textIds: [] };
      countMap.set(result.word, {
        count: current.count + 1,
        textIds: [...current.textIds, index + 1], // 使用 index+1 作为文本序号
      });
    });
  });

  // 更新每个结果的 totalCount 和 textIds
  textInputs.value.forEach((inputItem) => {
    inputItem.results.forEach((result) => {
      const data = countMap.get(result.word);
      if (data) {
        result.totalCount = data.count;
        result.textIds = data.textIds;
      }
    });
  });
}

function addInputText() {
  textInputs.value.push({
    id: nextId++,
    text: "",
    results: [],
    copySuccess: false,
  });
  // 自动滚动到页面底部
  setTimeout(() => {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  }, 100);
  // 初始化新卡片的拖拽
  const newIndex = textInputs.value.length - 1;
  initSortable(newIndex);
}

function removeInputText(index: number) {
  if (textInputs.value.length > 1) {
    // 清理拖拽实例
    destroySortable(index);
    textInputs.value.splice(index, 1);
    // 更新全局次数
    updateGlobalCounts();
  }
}

function deleteMatchResult(inputIndex: number, word: string) {
  const inputItem = textInputs.value[inputIndex];
  if (!inputItem) return;
  
  // 直接从当前文本中删除该词
  inputItem.results = inputItem.results.filter((r) => r.word !== word);
  // 更新全局次数
  updateGlobalCounts();
}

function copyToClipboard(inputIndex: number) {
  const inputItem = textInputs.value[inputIndex];
  if (!inputItem?.results.length) return;
  
  const text = inputItem.results
    .map((item) => {
      const id = String(item.id).padEnd(10);
      const level = item.level.padEnd(6);
      const word = item.word.padEnd(10);
      const pinyin = item.pinyin.padEnd(20);
      const pos = item.partOfSpeech;
      //  [共出现${item.totalCount}次]
      return `${id}${level}${word}${pinyin}${pos}`;
    })
    .join("\n");
  navigator.clipboard.writeText(text);
  inputItem.copySuccess = true;
  setTimeout(() => {
    inputItem.copySuccess = false;
  }, 2000);
}

function scrollToText(textId: number) {
  const element = document.getElementById(`text-${textId}`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    // 添加高亮效果
    element.classList.add("highlight");
    setTimeout(() => {
      element.classList.remove("highlight");
    }, 2000);
  }
}

function saveToFile() {
  const data = {
    version: "1.0",
    timestamp: new Date().toISOString(),
    textInputs: textInputs.value.map((item) => ({
      id: item.id,
      text: item.text,
      results: item.results,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  // 格式化时间：年月日时分秒
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
  
  a.download = `word-finder-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importFromFile(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.textInputs && Array.isArray(data.textInputs)) {
        // 导入文本和匹配结果
        textInputs.value = data.textInputs.map((item: any) => ({
          id: item.id,
          text: item.text || "",
          results: item.results || [],
          copySuccess: false,
        }));

        // 更新 nextId
        const maxId = Math.max(...data.textInputs.map((item: any) => item.id));
        nextId = maxId + 1;

        // 更新全局次数统计
        updateGlobalCounts();

        alert("导入成功！");
      } else {
        alert("文件格式不正确！");
      }
    } catch (error) {
      alert("解析文件失败，请确保是有效的 JSON 文件！");
    }
  };
  reader.readAsText(file);

  // 清空 input 以便重复导入同一文件
  target.value = "";
}

function copyAllTexts() {
  const allParts: string[] = [];

  textInputs.value.forEach((inputItem, index) => {
    // 添加文本
    allParts.push(`${index + 1}. ${inputItem.text || ""}`);
    allParts.push(""); // 空行

    // 添加匹配结果
    if (inputItem.results.length > 0) {
      const results = inputItem.results
        .map((item) => {
          const id = String(item.id).padEnd(10);
        const level = item.level.padEnd(6);
          const word = item.word.padEnd(10);
          const pinyin = item.pinyin.padEnd(20);
          const pos = item.partOfSpeech;
          return `${id}${level}${word}${pinyin}${pos}`;
        })
        .join("\n");
      allParts.push(results);
    }
    allParts.push(""); // 空行
  });

  const fullText = allParts.join("\n").trim();
  navigator.clipboard.writeText(fullText);
  allCopySuccess.value = true;
  setTimeout(() => {
    allCopySuccess.value = false;
  }, 2000);
}

function toggleLevel(level: number) {
  const index = selectedLevels.value.indexOf(level);
  if (index === -1) {
    selectedLevels.value.push(level);
  } else {
    selectedLevels.value.splice(index, 1);
  }
}

// 初始化拖拽排序
function initSortable(index: number) {
  nextTick(() => {
    const listElement = document.querySelector(`#match-list-${index}`) as HTMLElement;
    if (!listElement) return;

    // 如果已存在实例,先销毁
    if (sortableInstances.value.has(index)) {
      sortableInstances.value.get(index)?.destroy();
    }

    // 创建新的 sortable 实例
    const sortable = Sortable.create(listElement, {
      animation: 150,
      handle: ".drag-handle", // 使用拖拽手柄
      ghostClass: "drag-ghost", // 拖拽时的样式
      dragClass: "drag-item", // 正在拖拽的元素样式
      onEnd: (evt) => {
        const oldIndex = evt.oldIndex;
        const newIndex = evt.newIndex;
        if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) {
          // 更新数组顺序
          const inputItem = textInputs.value[index];
          if (inputItem) {
            const [removed] = inputItem.results.splice(oldIndex, 1);
            if (removed) {
              inputItem.results.splice(newIndex, 0, removed);
            }
          }
        }
      },
    });

    sortableInstances.value.set(index, sortable);
  });
}

// 清理拖拽实例
function destroySortable(index: number) {
  const instance = sortableInstances.value.get(index);
  if (instance) {
    instance.destroy();
    sortableInstances.value.delete(index);
  }
}

// 组件挂载时初始化
onMounted(() => {
  textInputs.value.forEach((_, index) => {
    initSortable(index);
  });
});
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

    <div class="text-inputs-wrapper">
      <div v-for="(inputItem, index) in textInputs" :key="inputItem.id" :id="`text-${index + 1}`" class="text-input-card">
        <div class="card-header">
          <h3>文本 {{ index + 1 }}</h3>
          <button v-if="textInputs.length > 1" @click="removeInputText(index)" class="remove-card-btn">
            删除此卡片
          </button>
        </div>

        <div class="input-section">
          <textarea
            v-model="inputItem.text"
            rows="6"
            placeholder="请输入需要匹配的文本..."
          ></textarea>
        </div>

        <div class="action-section">
          <button @click="matchWords(index)" class="match-btn">匹配</button>
        </div>

        <div class="output-section" v-if="inputItem.results.length > 0">
          <div class="output-header">
            <label>匹配结果 (共 {{ inputItem.results.length }} 个词语):</label>
            <button
              @click="copyToClipboard(index)"
              :class="{ success: inputItem.copySuccess }"
            >
              {{ inputItem.copySuccess ? "已复制" : "复制" }}
            </button>
          </div>
          <ul :id="`match-list-${index}`" class="match-list">
            <li
              v-for="item in inputItem.results"
              :key="item.word"
              class="match-item"
            >
              <div class="drag-handle" title="拖拽调整顺序">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="6" r="1.5"/>
                  <circle cx="15" cy="6" r="1.5"/>
                  <circle cx="9" cy="12" r="1.5"/>
                  <circle cx="15" cy="12" r="1.5"/>
                  <circle cx="9" cy="18" r="1.5"/>
                  <circle cx="15" cy="18" r="1.5"/>
                </svg>
              </div>
              <div class="item-info">
                <span class="item-id">{{ item.id }}</span>
                <span class="item-level">{{ item.level }}</span>
                <span class="item-word">{{ item.word }}</span>
                <span class="item-pinyin">{{ item.pinyin }}</span>
                <span class="item-pos">{{ item.partOfSpeech }}</span>
                <span class="item-count">共出现 {{ item.totalCount }} 次</span>
                <span class="item-text-ids">
                  文本:
                  <span
                    v-for="textId in item.textIds"
                    :key="textId"
                    class="text-id-link"
                    @click="scrollToText(textId)"
                  >
                    {{ textId }}
                  </span>
                </span>
              </div>
              <button @click="deleteMatchResult(index, item.word)" class="delete-btn">删除</button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="add-section">
      <button @click="addInputText" class="add-btn">添加新的文本输入框</button>
    </div>

    <!-- 悬浮按钮组 -->
    <div class="floating-buttons">
      <div class="floating-btn" @click="copyAllTexts" :class="{ success: allCopySuccess }">
        {{ allCopySuccess ? "已复制" : "复制全部" }}
      </div>
      <div class="floating-btn save-btn" @click="saveToFile">
        保存
      </div>
      <div class="floating-btn import-btn" @click="() => fileInput?.click()">
        导入
      </div>
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        style="display: none;"
        @change="importFromFile"
      />
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  font-family: sans-serif;
}

h1 {
  margin-bottom: 2rem;
}

.filter-section {
  margin-bottom: 2rem;
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

.text-inputs-wrapper {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-bottom: 2rem;
}

.text-input-card {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 1.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.card-header h3 {
  margin: 0;
  color: #333;
  font-size: 1.2rem;
}

.remove-card-btn {
  padding: 0.4rem 1rem;
  background: #f44336;
  font-size: 0.9rem;
}

.remove-card-btn:hover {
  background: #d32f2f;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

textarea {
  box-sizing: border-box;
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

.input-section {
  margin-bottom: 1rem;

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

button.add-btn {
  background: #ff9800;
  padding: 0.8rem 2rem;
  font-size: 1.1rem;
}

button.add-btn:hover {
  background: #f57c00;
}

button.match-btn {
  min-width: 120px;
}

.add-section {
  text-align: center;
  padding: 1rem;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.output-header label {
  margin-bottom: 0;
}

.match-list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 400px;
  overflow-y: auto;
  background: white;
}

.match-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #eee;
  transition: background 0.2s;
  cursor: default;
}

.match-item:last-child {
  border-bottom: none;
}

.match-item:hover {
  background: #f5f5f5;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  cursor: grab;
  color: #999;
  margin-right: 0.5rem;
  user-select: none;
  flex-shrink: 0;
}

.drag-handle:hover {
  color: #666;
}

.drag-handle:active {
  cursor: grabbing;
}

/* 拖拽时的样式 */
.drag-ghost {
  opacity: 0.4;
  background: #e8f5e9;
}

.drag-item {
  background: #fff3e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transform: scale(1.02);
}

.item-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  flex-wrap: wrap;
}

.item-id {
  font-family: monospace;
  color: #666;
  min-width: 70px;
  font-size: 0.9rem;
}

.item-level {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.85rem;
  font-weight: 500;
  min-width: 55px;
  text-align: center;
}

.item-word {
  font-weight: 600;
  color: #333;
  font-size: 1.1rem;
  min-width: 70px;
}

.item-pinyin {
  color: #666;
  font-family: monospace;
  min-width: 120px;
  font-size: 0.9rem;
}

.item-pos {
  color: #888;
  font-size: 0.9rem;
  min-width: 60px;
}

.item-count {
  background: #fff3e0;
  color: #f57c00;
  padding: 0.2rem 0.6rem;
  border-radius: 3px;
  font-weight: 500;
  font-size: 0.9rem;
}

.item-text-ids {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #666;
  font-size: 0.9rem;
}

.text-id-link {
  background: #e8f5e9;
  color: #2e7d32;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.text-id-link:hover {
  background: #c8e6c9;
  color: #1b5e20;
  transform: scale(1.1);
}

.text-input-card.highlight {
  box-shadow: 0 0 0 4px #ff9800;
  transition: box-shadow 0.3s;
}

.delete-btn {
  padding: 0.4rem 1rem;
  background: #f44336;
  font-size: 0.9rem;
}

.delete-btn:hover {
  background: #d32f2f;
}

.floating-buttons {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  z-index: 1000;
}

.floating-btn {
  text-align: center;
  padding: 1rem 1.5rem;
  background: #9c27b0;
  color: white;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(156, 39, 176, 0.4);
  transition: all 0.3s;
}

.floating-btn:hover {
  background: #7b1fa2;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(156, 39, 176, 0.5);
}

.floating-btn.success {
  background: #2e7d32;
  box-shadow: 0 4px 12px rgba(46, 125, 50, 0.4);
}

.floating-btn.success:hover {
  background: #1b5e20;
}

.save-btn {
  background: #1976d2;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.4);
}

.save-btn:hover {
  background: #1565c0;
  box-shadow: 0 6px 16px rgba(25, 118, 210, 0.5);
}

.import-btn {
  background: #f57c00;
  box-shadow: 0 4px 12px rgba(245, 124, 0, 0.4);
}

.import-btn:hover {
  background: #e65100;
  box-shadow: 0 6px 16px rgba(245, 124, 0, 0.5);
}
</style>
