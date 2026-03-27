import { defineStore } from "pinia";
import type { RouteRecordRaw } from 'vue-router'
import { constantRoutes, asyncRoutes } from "@/router"

interface PermissionState {
    routes: RouteRecordRaw[]
    addRoutes: RouteRecordRaw[]
}

export const hasPermission = (role: String, route: RouteRecordRaw) => {
    if (route.meta && route.meta.roles) {
        return route.meta.roles.includes(role);
    } else {
        return true;
    }
}

export const filterAsyncRoutes = (routes: RouteRecordRaw[], role: String) => {
    const res: RouteRecordRaw[] = [];

    routes.forEach(route => {
        let tmp = { ...route };
        if (hasPermission(role, tmp)) {
            if (tmp.children) {
                tmp.children = filterAsyncRoutes(tmp.children, role);
            }
            res.push(tmp);
        }
    })

    return res;
}

export const usePermissionStore = defineStore('permissions', {
    state: (): PermissionState => {
        return {
            routes: [],
            addRoutes: []
        }
    },
    getters: {},
    actions: {
        setRotes(routes: RouteRecordRaw[] ) {
            this.addRoutes = routes;
            this.routes = constantRoutes.concat(this.routes);
        },
        generateRoutes(role: String) {
            return new Promise(resolve => {
                let accessableRoutes: RouteRecordRaw[];
                if (role === 'Admin') {
                    accessableRoutes = asyncRoutes || [];
                } else {
                    accessableRoutes = filterAsyncRoutes(asyncRoutes, role);
                }
                this.setRotes(accessableRoutes);
                resolve(accessableRoutes);
            })
        }
    }
})