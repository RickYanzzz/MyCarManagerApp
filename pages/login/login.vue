<template>
	<view>
		<loginPassword :themeColor="themeColor" :logoUrl="logoUrl" @loginFun="loginFun"></loginPassword>

	</view>
</template>

<script>
	import loginPassword from '@/components/ay-login/login-password.vue';
	export default {
		components: {
			loginPassword,

		},
		data() {
			return {
				themeColor: '#6EA0F7',
				logoUrl: 'https://cdn.pixabay.com/photo/2016/11/23/17/55/beach-1854072__340.jpg',

			}
		},
		onLoad() {
			let that = this;

		},
		mounted() {


		},

		methods: {
			loginFun(e) {
				const that = this
				uni.showLoading({
					title: '登录中...'
				})
				that.$api.login({
					"phoneNumber": e.username,
					"password": e.password
				}).then(res => {
					if (res.data.status == 0) {
						uni.hideLoading()
						uni.showToast({
							title: "您的账号已被禁用，请与管理员联系！",
							icon: "error",
							fail() {

							}
						})
						return
					}
					uni.setStorageSync("userInfo", res.data)
					that.$store.dispatch("acUser", res.data)
					that.$store.dispatch("acUserId", res.data._id)
					that.$api.get_enterprise({
						enterpriseId: res.data.enterpriseId
					}).then(res1 => {

						uni.hideLoading()

						that.$store.dispatch("acEnterpriseId", res1.data._id)
						uni.setStorageSync("enterprise", res1.data)
						that.$store.dispatch("acEnterprise", res1.data)
						uni.navigateTo({
							url: '/pages/index/index'
						})
						// uni.switchTab({
						// 	url: '/pages/index/index'
						// });

					}).catch(err => {
						uni.hideLoading()
					})
				



				}).catch(err => {
					console.log("err==", JSON.stringify(err));
					uni.hideLoading()
					let detail = ''
					if (err && err.errMsg) {
						detail = String(err.errMsg)
					} else if (err && err.message) {
						detail = String(err.message)
					}
					uni.showToast({
						title: detail || "请输入正确的用户名或密码",
						icon: "none",
						duration: 3000,
						fail() {

						}
					})
				})


				// that.$api.login({
				// 	"phoneNumber":e.username,
				// 	"password":e.password
				// }).then((res) =>{
				// 	uni.setStorageSync("userInfo",res.result.data)
				// 	uni.navigateTo({
				// 		url:"/pages/home/home"
				// 	})
				// }).catch(err=>{
				// 	alert("用户名密码不正确")
				// })
				// uniCloud.callFunction({
				// 	name:"login",
				// 	data:{
				// 		"phoneNumber":e.username,
				// 		"password":e.password
				// 	},
				// 	success(res) {
				// 		if(res.result.code == 200){

				// 			uni.setStorageSync("userInfo",res.result.data)
				// 			uni.navigateTo({
				// 				url:"/pages/home/home"
				// 			})

				// 		}else{
				// 			alert("用户名密码不正确")
				// 		}
				// 	},
				// 	fail() {
				// 		alert("用户名密码不正确")
				// 	}
				// })
				// console.log('登录'+ JSON.stringify(e))
			},
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/login-icon.css");
</style>