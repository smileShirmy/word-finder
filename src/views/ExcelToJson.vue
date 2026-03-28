<script setup lang="ts">
import * as XLSX from "xlsx";
import { ref } from "vue";

interface WordItem {
  id: number;
  level: string;
  word: string;
  pinyin: string;
  partOfSpeech: string;
}

const jsonOutput = ref("");

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });
    if (!workbook.SheetNames[0]) {
      return;
    }
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) {
      return;
    }
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

    const result: WordItem[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row[0] && row[2]) {
        result.push({
          id: Number(row[0]) || i,
          level: String(row[1] || ""),
          word: String(row[2] || ""),
          pinyin: String(row[3] || ""),
          partOfSpeech: String(row[4] || ""),
        });
      }
    }

    jsonOutput.value = JSON.stringify(result, null, 2);
  };
  reader.readAsArrayBuffer(file);
}

function copyToClipboard() {
  if (jsonOutput.value) {
    navigator.clipboard.writeText(jsonOutput.value);
    alert("已复制到剪贴板!");
  }
}
</script>

<template>
  <div class="container">
    <h1>Excel 转 JSON 工具</h1>

    <div class="upload-section">
      <input type="file" accept=".xlsx,.xls" @change="handleFileUpload" />
      <p class="hint">请上传 xlsx 文件，第一行为表头</p>
    </div>

    <div class="output-section" v-if="jsonOutput">
      <div class="output-header">
        <h3>JSON 输出:</h3>
        <button @click="copyToClipboard">复制到剪贴板</button>
      </div>
      <textarea v-model="jsonOutput" rows="20" readonly></textarea>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: sans-serif;
}

h1 {
  margin-bottom: 2rem;
}

.upload-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 2px dashed #ccc;
  border-radius: 8px;
}

.hint {
  color: #666;
  font-size: 0.9rem;
  margin-top: 0.5rem;
}

.output-section {
  margin-top: 2rem;
}

.output-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

button {
  padding: 0.5rem 1rem;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background: #45a049;
}

textarea {
  width: 100%;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.9rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: vertical;
}
</style>
