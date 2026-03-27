<template>
  <div class="header">
    <h2>实时TTS系统</h2>
    <div class="collapse-sidebar" @click="collapseSidebarChange">
        <el-icon v-if="sidebar.collapse">
            <Expand />
        </el-icon>
        <el-icon v-else>
            <Fold />
        </el-icon>
    </div>
  </div>
</template>

<script type="ts">
import { onMounted } from 'vue';
import { ElIcon } from 'element-plus';
import { useSidebarStore } from '@/store/sidebar';

export default {
    name: 'Header',
    components: { ElIcon },
    setup() {        
        const sidebar = useSidebarStore();
        const collapseSidebarChange = () => {
            sidebar.handleCollapse();
        }

        onMounted(() => {
            if (document.body.clientWidth < 1500) {
                collapseSidebarChange();
            }
        })

        return {
            sidebar,
            collapseSidebarChange,
        }
    }
}
</script>

<style>
    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-sizing: border-box;
        width: 100%;
        height: 70px;
        border-bottom: 1px solid #ddd;
    }
</style>