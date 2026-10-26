<template>
	<view class="chose-card">
		<nav-header type="carNumber" @getCarNumber="getCarNumber"></nav-header>
		<view class="my-grid">
			<uni-grid class="my-grid" :show-border="false" :column="8">
				<uni-grid-item class="my-grid-item" v-for="item in itemList">
					<custom-input :currentItem="currentItem" @clickMyItem="clickMyItem" :item="item"></custom-input>
				</uni-grid-item>
			</uni-grid>
		</view>
		<view class="spri-car" @click="inputDialogToggle">
			<text>特殊车牌</text>
		</view>
		<view v-show="selectType=='procard'">
			<pro-card @clickProCardItem="clickProCardItem"></pro-card>
		</view>
		<view v-show="selectType=='onlychar'">
			<only-char @clickOnlyCharItem="clickOnlyCharItem"></only-char>
		</view>
		<view v-show="selectType=='charnumber'">
			<char-number @clickOnlyCharNumber="clickOnlyCharNumber"></char-number>
		</view>

		<view class="submit">
			<button class="submit-btn" type="primary" @click="submitToDetail">{{btnText}}</button>
		</view>
		<!-- 输入框示例 -->
		<uni-popup ref="inputDialog" type="dialog">
			<uni-popup-dialog ref="inputClose" mode="input" title="其他车牌" :value="inputValue" placeholder="军牌、港澳车牌及其他车牌"
				@confirm="dialogInputConfirm"></uni-popup-dialog>
		</uni-popup>
		<!-- 提示信息弹窗 -->
		<uni-popup ref="message" type="message">
			<uni-popup-message :type="msgType" :message="messageText" :duration="2000"></uni-popup-message>
		</uni-popup>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				navType: 1, //1，临牌2，提交3，军牌
				type: 'center',
				msgType: 'success',
				messageText: '',
				inputValue: "",
				btnText: "临牌",
				currentItem: 2,
				selectType: "charnumber",
				itemList: [{
						id: 0,
						isActive: false,
						text: '京'
					},
					{
						id: 1,
						isActive: false,
						text: 'A'
					},
					{
						id: 2,
						isActive: false,
						text: ''
					},
					{
						id: 3,
						isActive: false,
						text: ''
					},
					{
						id: 4,
						isActive: false,
						text: ''
					},
					{
						id: 5,
						isActive: false,
						text: ''
					},
					{
						id: 6,
						isActive: false,
						text: ''
					},
					{
						id: 7,
						isActive: false,
						text: ''
					}
				]

			}
		},
		computed: {
			fullText() {
				let full = ""
				this.itemList.forEach(item => {
					full = full + item.text
				})
				return full
			}
		},
		watch: {
			fullText: {
				handler(newVal, oldVal) {
					if (newVal.length >= 6) {
						this.btnText = "提交"
						this.navType = 2
					} else {
						this.btnText = "临牌"
						this.navType = 1
					}
				},
				immediate: true
			}
		},
		methods: {
			submitToDetail() {
				this.navToDetail()
			},
			getCarNumber(number){
				const that  = this
				uni.showLoading({
					title:"加载中..."
				})
				this.$api.get_car_info_by_carNumber({
					"carNumber":number
				}).then(res_car=>{
					if(res_car.data._id){
						that.$api.addOrder({
							id: res_car.data._id
						}).then(res1=>{
							uni.hideLoading()
							uni.navigateTo({
								url: "./billingDetail" + "?id=" + res1.data.id,
								animationType: 'pop-in'
							})
						}).catch(err=>{
							uni.hideLoading()
						})
					}else{
						that.$api.addcar({
							"carNumber":number,
							"type":'4'
						}).then(res=>{
							that.$api.addOrder({
								id: res.data.id
							}).then(res1=>{
								uni.hideLoading()
								uni.navigateTo({
									url: "./billingDetail" + "?id=" + res1.data.id,
									animationType: 'pop-in'
								})
							}).catch(err=>{
								uni.hideLoading()
							})
							
						}).catch(err=>{
							uni.showToast({
								title:"请求失败！",
								fail() {
									
								}
							})
							uni.hideLoading()
						})
					}
				})
			},
			navToDetail() {
				if(this.navType == 1){
					uni.showLoading({
						title:"加载中..."
					})
					this.$api.addcar({
						"carNumber":"临牌",
						"type":1
					}).then(res=>{
						this.$api.addOrder({
							id: res.data.id
						}).then(res1=>{
							uni.hideLoading()
							uni.navigateTo({
								url: "./billingDetail" + "?id=" + res1.data.id,
								animationType: 'pop-in'
							})
						}).catch(err=>{
							uni.hideLoading()
						})
						
					}).catch(err=>{
						uni.showToast({
							title:"请求失败！",
							fail() {
								
							}
						})
						uni.hideLoading()
					})
				}else{
					let carNumberTxt = ""
					if(this.navType==3){
						carNumberTxt = this.inputValue
					}else{
						carNumberTxt = this.fullText
					}
					const that  = this
					uni.showLoading({
						title:"加载中..."
					})
					this.$api.get_car_info_by_carNumber({
						"carNumber":carNumberTxt
					}).then(res_car=>{
						if(res_car.data._id){
							that.$api.addOrder({
								id: res_car.data._id
							}).then(res1=>{
								uni.hideLoading()
								uni.navigateTo({
									url: "./billingDetail" + "?id=" + res1.data.id,
									animationType: 'pop-in'
								})
							}).catch(err=>{
								uni.hideLoading()
							})
						}else{
							that.$api.addcar({
								"carNumber":carNumberTxt,
								"type":that.navType
							}).then(res=>{
								that.$api.addOrder({
									id: res.data.id
								}).then(res1=>{
									uni.hideLoading()
									uni.navigateTo({
										url: "./billingDetail" + "?id=" + res1.data.id,
										animationType: 'pop-in'
									})
								}).catch(err=>{
									uni.hideLoading()
								})
								
							}).catch(err=>{
								uni.showToast({
									title:"请求失败！",
									fail() {
										
									}
								})
								uni.hideLoading()
							})
						}
					})
					
				}
			
			},
			clickMyItem(item) {
				this.currentItem = item.id
				// item.isActive=true
				// this.itemList.forEach(e=>{
				// 	if(e.id==item.id){
				// 		item.isActive=true
				// 	}else{
				// 		item.isActive=false
				// 	}
				// })
				// this.$forceUpdate()
				if (item.id == 0) {
					this.selectType = "procard"
				} else if (item.id == 1) {
					this.selectType = "onlychar"
				} else {
					this.selectType = "charnumber"
				}
			},
			clickProCardItem(item) {
				this.setText(item)
			},
			clickOnlyCharItem(item) {
				this.setText(item)
			},
			clickOnlyCharNumber(item) {
				this.setText(item)



			},
			setText(item) {
				this.dataItem = {
						id: this.currentItem,
						isActive: false,
						text: item
					},
					this.itemList.splice(this.currentItem, 1, this.dataItem)
				if (this.currentItem < 7) {
					this.currentItem++
				}
			},
			inputDialogToggle() {
				this.$refs.inputDialog.open()
			},
			dialogInputConfirm(val) {

				if (!val) {
					this.msgType = 'error'
					this.messageText = "请输入合法车牌"
					this.$refs.message.open()

				} else {
					this.$refs.inputDialog.close()
					this.inputValue = val
					this.navType = 3
					this.navToDetail()
				}


				// 				uni.showLoading({
				// 					title: '3秒后会关闭'
				// 				})

				// 				setTimeout(() => {
				// 					uni.hideLoading()
				// 					console.log(val)
				// 					this.value = val
				// 					// 关闭窗口后，恢复默认内容
				// 					this.$refs.inputDialog.close()
				// 				}, 3000)
			},

		}
	}
</script>

<style lang="scss">
	.my-grid {
		margin-top: 10px;
		margin-left: 5px;
		margin-right: 5px;
		display: flex;
		flex: 1;
		border: 0px;
	}

	.my-grid-item {
		display: flex;
		justify-content: center;
		align-items: center;
		border: 0px;
	}

	.spri-car {
		text-align: right;
		margin-right: 20px;
		margin-top: 8px;
		color: $uni-text-color-grey;
		font-size: 16px;
		font-weight: 600;
	}

	.chose-card {
		position: relative;

		.submit {
			position: absolute;
			left: 0;
			right: 0;
			bottom: 100;
			padding-left: 15px;
			padding-right: 15px;

			.submit-btn {
				background-color: $uni-color-primary;
			}
		}
	}
</style>