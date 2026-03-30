import { createRouter, createWebHashHistory } from "vue-router";
import ExcelToJson from "@/views/ExcelToJson.vue";
import WordMatch from "@/views/WordMatch.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      redirect: "/word-match",
    },
    {
      path: "/word-match",
      name: "word-match",
      component: WordMatch,
    },
    {
      path: "/excel-to-json",
      name: "excel-to-json",
      component: ExcelToJson,
    },
  ],
});

export default router;
