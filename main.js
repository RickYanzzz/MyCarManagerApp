
// #ifndef VUE3
import Vue from 'vue'
import App from './App'
import api from "./common/api"
import commoms from "./common/js/common.js"
import store from "./store"

Vue.config.productionTip = false

Vue.prototype.$api = api

Vue.prototype.$commons = commoms

App.mpType = 'app'

const app = new Vue({
	store,
    ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import App from './App.vue'
import common from './common/js/common.js'
export function createApp() {
  const app = createSSRApp(App)
  return {
    app
  }
}
// #endif