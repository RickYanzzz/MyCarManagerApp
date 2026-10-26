<template>
	<view class="my-nav-header">
		<view class="status-bar"></view>
		<view class="home-nav" v-show="type=='home'">
			<view><text class="nav-text">{{enterprise.name}}</text></view>
			<view><text class="nav-text">{{userInfo.realName}}</text></view>
		</view>
		<view class="home-nav" v-show="type=='carNumber'">
			<view><text class="iconfont icon-fanhui car-text" @click="goBack"></text></view>
			<view><text class="nav-text">开单</text></view>
			<view @click="choseImage"><text class="iconfont icon-xiangji car-text"></text></view>
		</view>
		<view class="home-nav" v-show="type=='orderDetail'">
			<view><text class="iconfont icon-fanhui car-text" @click="goBack"></text></view>
			<view><text class="nav-text">{{title}}</text></view>
			<view>
				<!-- <text class="iconfont icon-sandian" style="color: #fff;font-size: 25px;"/> -->
			</view>
		</view>
		<view class="home-nav" v-show="type=='addConsumePro'">
			<view><text class="iconfont icon-fanhui car-text" @click="goBack"></text></view>
			<view><text class="nav-text">{{title}}</text></view>
			<view><text></text></view>
		</view>
	</view>

</template>

<script>
	import {
		pathToBase64
	} from "../../common/js/image_tools.js"
	export default {
		name: "nav-header",
		data() {
			return {
				userInfo: {},
				enterprise: {}
			};
		},
		computed: {

		},
		props: {
			type: {
				type: String,
				required: true
			},
			title: {
				type: String,
				required: true
			}
		},
		created() {
			this.userInfo = uni.getStorageSync("userInfo")
			this.enterprise = uni.getStorageSync("enterprise")
		},
		activated() {

		},
		methods: {
			goBack() {
				uni.navigateBack({
					delta: 1,
					animationType: "pop-out",
					animationDuration: 300
				});
			},
			choseImage() {
				
				const that = this
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['album','camera'],
					success: function(res) {
						that.ocrByPath(res.tempFilePaths[0])
					}
				});

			},
			// 压缩：阿里云 callFunction 入参上限 2MB，百度要求 base64 ≤4M 且最长边 ≤4096px
			// 先按最长边 1600px 等比缩放 + quality 60；平台不支持压缩/取尺寸时逐级退回
			compressForOcr(path) {
				return new Promise((resolve) => {
					const useOriginal = () => resolve(path)
					const withQualityOnly = () => {
						uni.compressImage({
							src: path,
							quality: 60,
							success: (r) => resolve(r.tempFilePath),
							fail: useOriginal
						})
					}
					uni.getImageInfo({
						src: path,
						success: (info) => {
							const maxSide = 1600
							const longSide = Math.max(info.width || 0, info.height || 0)
							if (!longSide || longSide <= maxSide) {
								return withQualityOnly()
							}
							const scale = maxSide / longSide
							uni.compressImage({
								src: path,
								quality: 60,
								width: Math.round((info.width || 0) * scale),
								height: Math.round((info.height || 0) * scale),
								success: (r) => resolve(r.tempFilePath),
								fail: withQualityOnly
							})
						},
						fail: withQualityOnly
					})
				})
			},
			ocrByPath(path) {
				const that = this
				uni.showLoading({
					title: "识别中...",
					mask: true
				})
				that.compressForOcr(path)
					.then((compressedPath) => pathToBase64(compressedPath))
					.then((base64) => {
						const pureBase64 = that.stripBase64Header(base64)
						if (!pureBase64) {
							return Promise.reject({
								msg: "图片读取失败"
							})
						}
						// 阿里云 callFunction 的 event 上限 2MB，base64 留足余量
						if (pureBase64.length > 1.8 * 1024 * 1024) {
							return Promise.reject({
								msg: "图片过大，请靠近拍摄"
							})
						}
						return that.$api.ocrLicensePlate(pureBase64)
					})
					.then((result) => {
						uni.hideLoading()
						const number = result && result.data && result.data.number
						if (number) {
							that.$emit("getCarNumber", number)
						} else {
							uni.showToast({
								title: "未识别到车牌，请重拍",
								icon: "none"
							})
						}
					})
					.catch((err) => {
						uni.hideLoading()
						console.error("车牌识别失败：", err)
						uni.showToast({
							title: (err && err.msg) ? err.msg : "识别失败，请重试",
							icon: "none",
							duration: 2000
						})
					})
			},
			// 百度要求去掉 "data:image/xxx;base64," 编码头，否则报 Invalid parameter
			stripBase64Header(base64) {
				if (!base64) return ""
				const idx = base64.indexOf(",")
				return idx >= 0 ? base64.substring(idx + 1) : base64
			}
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/icons.css");

	.my-nav-header {
		height: 80px;
		background-color: $uni-color-primary;
		.status-bar{
			height: 20px;
			background: white;
		}

		.home-nav {
			height: 100%;
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 0 15px;
		}

		.nav-text {
			font-size: 16px;
			color: #fff;
		}

		.car-text {
			font-size: 24px;
			color: #fff;

		}

	}
</style>