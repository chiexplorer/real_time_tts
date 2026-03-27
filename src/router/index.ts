import type { RouteRecordRaw } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import HomeView from '@/views/HomeView.vue'

const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/', 
    component: HomeView,
		redirect: '/home',
		children: [
			{
				path: 'home',
				component: () => import('@/views/Content.vue'),
				name: 'Home',
			}
		],
	},

]

const asyncRoutes: RouteRecordRaw[] = [

]

const router = createRouter({
  history: createMemoryHistory(),
  routes: constantRoutes,
})

export { constantRoutes, asyncRoutes, router }