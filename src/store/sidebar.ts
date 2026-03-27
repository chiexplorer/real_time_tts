import { defineStore } from "pinia";

export const useSidebarStore = defineStore('sidebar', {
    state: () => {
        return {
            collapse: false,
            bgColor: '#324157',
            textColor: '@bfcbd9'
        }
    },
    getters: {},
    actions: {
        handleCollapse() {
            this.collapse = !this.collapse;
        },
    }
})