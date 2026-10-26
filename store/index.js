/* eslint-disable space-before-function-paren */
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const state = {
	title: "",
	// 登录状态
	isLogin: false,
	user: {
		realName: "",
		phoneNumber: "",
		username: ""
	},
	enterprise: {
		name: '',
		address: '',
		receipt: '',
		phone: ''
	},
	userId:"",
	enterpriseId:"",

}
const mutations = {
	muTitle(state, obj) {
		state.title = obj
	},
	muIsLogin(state, obj) {
		state.isLogin = obj
	},
	muUser(state, obj) {
		state.user = obj
	},
	muEnterprise(state, obj) {
		state.enterprise = obj
	},
	muEnterpriseId(state, obj) {
		state.enterpriseId = obj
	},
	muUserId(state, obj) {
		state.userId = obj
	}

}
const actions = {
	acIsLogin(context, obj) {
		context.commit('muIsLogin', obj)
	},
	acUser(context, obj) {
		context.commit('muUser', obj)
	},
	acEnterprise(context, obj) {
		context.commit('muEnterprise', obj)
	},
	acEnterpriseId(context, obj) {
		context.commit('muEnterpriseId', obj)
	},
	acUserId(context, obj) {
		context.commit('muUserId', obj)
	},


}
const store = new Vuex.Store({
	state,
	mutations,
	actions
})
export default store