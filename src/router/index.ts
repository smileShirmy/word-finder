import { createRouter, createWebHistory } from 'vue-router'
import ExcelToJson from '@/views/ExcelToJson.vue'
import BlankPage from '@/views/BlankPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/excel-to-json'
    },
    {
      path: '/excel-to-json',
      name: 'excel-to-json',
      component: ExcelToJson
    },
    {
      path: '/blank',
      name: 'blank',
      component: BlankPage
    }
  ],
})

export default router
