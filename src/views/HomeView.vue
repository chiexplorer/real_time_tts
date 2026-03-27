<template>
    <div class="wrapper">
        <Header></Header>
        <SideBar></SideBar>
        <div class="content-box" :class="{'content-collapse': sidebar.collapse}">
            <router-view v-slot="{ Component }">
                <transition name="move" mode="out-in">
                    <keep-alive>
                        <component :is="Component"></component>
                    </keep-alive>
                </transition>
            </router-view>
        </div>
        
    </div>
    
</template>

<script lang="ts">
import { useSidebarStore } from '@/store/sidebar';
import Header from '@/components/Header.vue';
import SideBar from '@/components/SideBar.vue';

export default {
    name: 'HomeView',
    components: { Header, SideBar },
    setup() {
        const sidebar = useSidebarStore();
        return {
            sidebar,
        }
    },
}
</script>

<style>
    .wrapper {
        height: 100vh;
        overflow: hidden;
    }

    .content-box {
        position: absolute;
        left: 250px;
        right: 0;
        top: 70px;
        bottom: 0;
        padding-bottom: 30px;
        -webkit-transition: left 0.3s ease-in-out;
        background: #eef0fc;
        overflow: hidden;
    }

    .content {
        width: auto;
        height: 100%;
        padding: 20px;
        overflow-y: scroll;
        box-sizing: border-box;
    }

    .content::-webkit-scrollbar {
        width: 0;
    }

    .content-collapse {
        left: 65px;
    }
</style>