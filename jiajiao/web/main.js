import App from './App'



// #ifndef VUE3
import Vue from 'vue'
Vue.config.productionTip = false;
import {
	api,
	url,
	ossHost
} from './comm/api.js';
import TabBar from '@/components/tabBar/tabBar.vue'
Vue.component('TabBar', TabBar)
import TabBar1 from '@/components/tabBar1/tabBar1.vue'
Vue.component('TabBar1', TabBar1)
import uView from './uni_modules/vk-uview-ui';
Vue.use(uView);
Vue.prototype.api = api
Vue.prototype.imgUrl = ossHost
Vue.prototype.call = function() {

}
App.mpType = 'app'
const app = new Vue({
	...App
})

app.$mount()
// #endif

// #ifdef VUE3
// 引入 uView UI


import {
	createSSRApp
} from 'vue'

export function createApp() {
	const app = createSSRApp(App)
	// 使用 uView UI
	return {
		app
	}
}
// #endif
