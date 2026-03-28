<template>
  <div class="sidebar">
    <el-menu
        default-active="onRoutes"
        class="el-menu-vertical"
        :collapse="isCollapse"
        :background-color="sidebar.bgColor"
        :text-color="sidebar.textColor"
        router
    >
        <template v-for="item in permissions.routes" :key="item.path">
            <template v-if="item.children">
                <el-sub-menu :index="item.path">
                    <template #title v-if="item.meta">
                        <el-icon>
                            <component :is="item.meta.icon"></component>
                        </el-icon>
                    </template>
                    <template v-for="subItem in item.children" :key="subItem.path">
                        <el-sub-menu :index="subItem.path">
                            <template #title v-if="subItem.meta">
                                <el-icon>
                                    {{ subItem.meta.title }}
                                </el-icon>
                            </template>
                        </el-sub-menu>
                    </template>
                </el-sub-menu>
            </template>
            <template v-else>
                <el-menu-item v-if="item.meta" :index="item.path" :key="item.path">
                    <el-icon>
                        <component :is="item.meta.icon"></component>
                    </el-icon>
                    <template #title> {{ item.meta.title }} </template>
                </el-menu-item>
            </template>
        </template>
    </el-menu>
  </div>
</template>

<script>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useSidebarStore } from '@/store/sidebar';
import { usePermissionStore } from '@/store/permissions';

export default {
    name: 'SideBar',
    setup() {
        const route = useRoute();
        const permissions = usePermissionStore();
        const sidebar = useSidebarStore();
        const onRoutes = computed(() => {
            return route.path;
        })

        return {
            sidebar,
            route,
            onRoutes,
            permissions
        }
    }
}
</script>

<style scoped>
    .sidebar{
        display: block;
        position: absolute;
        left: 0;
        top: 70px;
        bottom: 0;
        overflow-y: scroll;
    }

    .sidebar::-webkit-scrollbar {
        width: 0;
    }

    .el-menu-vertical:not(.el-menu--collapse) {
        width: 250px;
    }

    .el-menu-vertical {
        min-height: 100%;
    }
</style>