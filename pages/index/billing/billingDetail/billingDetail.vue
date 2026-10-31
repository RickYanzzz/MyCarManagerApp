<template>
	<view style="position: relative;">
		<nav-header type="orderDetail" :title="headerTitle"></nav-header>
		<uni-section>
			<header-card @clickHeaderCard="clickHeaderCard" @bindMember="openMemberBind"
				@openMember="openMemberDetail" :carInfo="carInfo" :member="member"></header-card>
		</uni-section>
		<view style="padding-bottom: 80px;">
			<view class="select_tab" v-show="order.status!=2">
				<view class="select_sub_tab" v-for="(item,index) in tabList" :index="index" @click="selectTabBtn(item)">
					<view class="">
						<text>{{item.title}}</text>
					</view>
					<view v-if="item.id==selectIndex" class="tab_line" />
				</view>
			</view>
			<view class="" v-show="order.status!=2">
				<swiper @change="swipeIndex" :current="selectIndex" :duration="300" :circular="true">
					<swiper-item v-for="(val,idx) in tabList" :key="idx">
						<scroll-view scroll-y="true" :scroll-top="scrollTop">
							<view class="scoll-bg">
								<tag-page :hotGoods="hotGoods" v-if="idx==0"
									@clickTagPageItem="clickTagPageItem"></tag-page>
								<buyed-page :PurchasedGoods="PurchasedGoods" v-if="idx==1"></buyed-page>
							</view>
						</scroll-view>
					</swiper-item>
				</swiper>
			</view>
			<view class="spare-part-bar" v-if="order.status!=2 && order._id">
				<button class="spare-part-btn" type="primary" size="mini" @click="addSparePart">+ 添加备件</button>
			</view>
			<section-view v-for="(item,index) in sectionList" :status="order.status" :item="item" :index="index"
				@onDeleteItem="onDeleteItem" @clickSection="clickSection" @modifyMyItem="modifyItem">
			</section-view>
			<view v-if="order.status!=2">
				<view v-show="totalFee==0 && !owefee">
					<button class="m-button" type="primary" @click="updateOrderStatus(-1)">删除订单</button>
				</view>

				<view v-show="totalFee>0 && owefee>0">
					<view class="own-pay-view"><text> {{"还需支付： ¥"+owefee+ ",可挂帐"}}</text></view>
					<button class="m-button" type="primary" @click="updateOrderStatus(1)">挂帐</button>
				</view>
				<view v-show="totalFee>0 && owefee==0">
					<button class="m-button" type="primary" @click="updateOrderStatus(2)">结束订单</button>
				</view>
				<view v-show="totalFee>0 && owefee<0">
					<view class="own-pay-view"><text> {{"付款大于应付金额,请修改付款项目"}}</text></view>
					<button class="m-button" type="primary" @click="updateOrderStatus(2)">结束订单</button>
				</view>
			</view>
			<view v-show="order.status==2">
				<view class="own-pay-view"><text>订单已入账</text></view>
			</view>

		</view>
		<s-popup custom-class="demo-popup" position="center" v-model="isPopupShow">
			<!-- 内容 -->
			<pay-type-view v-show="isShowpPayType" @clickPayTypeView="clickPayTypeView"></pay-type-view>
			<pay-view ref="payviewRef" v-show="isShowpPayView" @addPayItem="addPayItem"></pay-view>
			<modify-view ref="modifyviewRef" v-show="isShowModifyItem" @updatePurchase="updatePurchase"></modify-view>
			<view v-show="isShowReturn" class="return-view">
				<view class="return-title">备件退料</view>
				<view class="return-line">{{ returnItem.name }}（已用 {{ returnItem.count }} {{ returnItem.unit }}）</view>
				<view class="return-line return-qty-line">
					<text>退料数量</text>
					<uni-number-box :value="returnQty" :min="1" :max="Number(returnItem.count) || 1" @change="returnQty = $event" />
				</view>
				<view class="return-btns">
					<button class="return-btn" size="mini" @click="closeReturn">取消</button>
					<button class="return-btn" size="mini" type="primary" @click="confirmReturn">确定退料</button>
				</view>
			</view>
		</s-popup>
	</view>
</template>

<script>
	import sPopup from '@/components/s-popup';
	export default {
		data() {
			return {
				isShowpPayType: false,
				isShowpPayView: false,
				isPopupShow: false,
				isShowModifyItem: false,
				isShowReturn: false,
				returnItem: {},
				returnQty: 1,
				selectIndex: 0,
				carNumber: "临牌",
				headerTitle: "单号20231118004-施工中",
				tabList: [{
						id: 0,
						title: "热门项目"
					},
					{
						id: 1,
						title: "已购项目"
					}
				],
				scrollTop: 0,
				dataList: [{
						id: 0,
						title: "热门项目"
					},
					{
						id: 1,
						title: "已购项目"
					}
				],
				sectionList: [{
						id: 0,
						classStr: "icon-xiaofeimingxidan",
						title: "消费项目",
						status: 0,
						list: []

					},
					{
						id: 1,
						classStr: "icon-icon-",
						title: "结算信息",
						status: 0,
						list: []
					}
				],
				carInfo: {},
				order: {},
				member: {},
				hotGoods: [],
				PurchasedGoods: [],
				PurchaseingGoods: [],
				formData: {

				},
				payInfoList: [],
				totalFee: 0,
				payFee: 0
			}
		},
		components: {
			sPopup
		},
		computed: {
			owefee() {
				return parseInt(this.totalFee) - parseInt(this.payFee)
			}
		},
		onLoad(opt) {
			this.loadData(opt.id)
			this.getHotGoods()
		},
		created() {

		},
		methods: {
			// tocarInfoDetail(){
			// 	alert(1)
			// 	uni.navigateTo({
			// 	  url: '/pages/car_info/detail?id=' + this.carInfo._id
			// 	})
			// },
			modifyItem(item) {
				if (this.order.status == 2) {
					return;
				}
				if (item.source === 'spare_part') {
					this.returnItem = item
					this.returnQty = Number(item.count) || 1
					this.isPopupShow = true
					this.isShowpPayType = false
					this.isShowpPayView = false
					this.isShowModifyItem = false
					this.isShowReturn = true
					return
				}
				this.isPopupShow = true
				this.isShowpPayType = false
				this.isShowpPayView = false
				this.isShowModifyItem = true
				this.isShowReturn = false
				this.$refs.modifyviewRef.loadData(item)
			},
			addSparePart() {
				const that = this
				if (!this.order._id || this.order.status == 2) return
				uni.navigateTo({
					url: '/pages/spare_parts/issue?orderId=' + this.order._id +
						'&carId=' + this.carInfo._id +
						'&carNumber=' + encodeURIComponent(this.carInfo.carNumber || ''),
					events: {
						sparePartsIssued: () => {
							that.loadData(that.order._id)
						}
					}
				})
			},
			closeReturn() {
				this.isShowReturn = false
				this.isPopupShow = false
			},
			confirmReturn() {
				const qty = parseInt(this.returnQty)
				if (!qty || qty <= 0) {
					return uni.showToast({ title: '请输入退料数量', icon: 'none' })
				}
				if (qty > Number(this.returnItem.count || 0)) {
					return uni.showToast({ title: '退料数量不能大于已用数量', icon: 'none' })
				}
				const that = this
				this.$api.return_spare_part({
					id: this.returnItem._id,
					qty: qty
				}).then(() => {
					that.closeReturn()
					that.loadData(that.order._id)
					uni.showToast({ title: '退料成功', icon: 'none' })
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '退料失败',
						icon: 'none'
					})
				})
			},
			updatePurchase() {
				this.isPopupShow = false
				this.getPurchasedGoods(0)
			},
			loadData(id) {
				const that = this
				uni.showLoading({
					title: "加载中..."
				})
				this.$api.get_order_byId({
					id
				}).then(res => {

					that.order = res.data
					if (that.order.status == 0) {
						if (that.order.time) {
							that.headerTitle = "单号" + that.order.time + "-施工中"
						} else {
							that.headerTitle = "单号" + "-施工中"
						}
					} else if (that.order.status == 1) {
						if (that.order.time) {
							that.headerTitle = "单号" + that.order.time + "-挂帐"
						} else {
							that.headerTitle = "单号" + "-施工中"
						}
					} else {
						if (that.order.time) {
							that.headerTitle = "单号" + that.order.time + "-已入账"
						} else {
							that.headerTitle = "单号" + "-施工中"
						}
					}

					this.sectionList.forEach(item => {
						item.status = that.order.status
					})

					this.$api.get_car_info_byId({
						carInfoId: res.data.carInfoId
					}).then(res1 => {
						uni.hideLoading()
						console.log("res1===", JSON.stringify(res1));
						that.carInfo = res1.data
						that.loadMember()
						that.getPurchasedGoods(0)
						that.getPurchasedGoods(1)
						that.getPayInfo()
					})
				}).catch(err => {
					uni.hideLoading()
				})
			},
			getHotGoods() {
				const that = this
				this.$api.get_hot_goods({}).then(res => {
					this.hotGoods = res.data


				}).catch(err => {

				})
			},
			getPurchasedGoods(status) {
				const that = this
				this.$api.get_purchased_goods({
					carId: that.carInfo._id,
					orderId: that.order._id,
					status
				}).then(res => {
					console.log("get_purchased_goods===", JSON.stringify(res));
					if (status == 0) {
						that.totalFee = 0
						res.data.forEach(item => {
							that.totalFee += parseInt(item.fee)
						})


						that.sectionList[0].list = res.data
						// that.sectionList[1].list = res.data
						// 未付款项目，购买中
						that.PurchaseingGoods = res.data
						// that.PurchasedGoods = res.data

					} else {
						//已购买项目
						that.PurchasedGoods = res.data
					}
				}).catch(err => {

				})
			},
			clickSection(item) {
				if (item.id == 0) {
					this.addXproject();
				} else {
					this.isPopupShow = true
					this.isShowpPayType = true
					this.isShowpPayView = false
					// this.open()
				}
			},
			addXproject() {
				const that = this
				uni.navigateTo({
					url: "/pages/index/billing/addConsumePro/addConsumePro?" +
						"carId=" + that.carInfo._id + "&orderId=" + that.order._id,
					animationType: 'pop-in',
					success() {
						uni.$once("addConsumePro", (data) => {
							that.loadData(data.orderId)
							console.log(": " + JSON.stringify(data));
						})
					}
				})
			},
			addTotal() {

			},
			open() {
				uni.navigateTo({
					url: "/pages/index/billing/PayController/PayController"
				})
			},
			selectTabBtn(item) {
				this.selectIndex = item.id
			},
			swipeIndex(e) {
				this.selectIndex = e.detail.current
				this.scrollTop = 0
				// this.getData()
			},
			clickTagPageItem(item) {
				const that = this
				this.$api.add_purchased_goods({
					"name": item.name,
					"fee": item.fee,
					"count": 1,
					"orderId": that.order._id,
					"carId": that.carInfo._id,
					"status": 0
				}).then(res => {
					this.getPurchasedGoods(0)
				}).catch(err => {

				})

			},
			onDeleteItem(e) {
				if (e == 0) {
					this.getPurchasedGoods(0)
				} else {
					this.getPayInfo()
				}

			},
			clickPayTypeView(item) {
				if (item.value === 0 && !this.member._id) {
					this.isPopupShow = false
					this.isShowpPayType = false
					this.openMemberBind()
					return
				}
				this.formData.value = item.value
				if (item.value === 0) {
					this.formData.fee = this.owefee > 0 ? this.owefee : 0
				} else {
					var totalFee = 0
					this.PurchaseingGoods.forEach(res => {
						totalFee += res.fee
					})
					this.formData.fee = totalFee
				}
				this.$refs.payviewRef.loadData(this.formData, this.member, this.owefee)
				this.isPopupShow = true
				this.isShowpPayType = false
				this.isShowpPayView = true
			},
			addPayItem(item) {
				const that = this
				uni.showLoading({
					title: "添加中..."
				})
				const request = item.value === 0
					? that.$api.consume_member_balance({
						"memberId": this.member._id,
						"orderId": this.order._id,
						"carId": this.carInfo._id,
						"amount": item.fee,
						"idempotencyKey": this.$commons.uuid()
					})
					: that.$api.add_pay_info({
						"name": item.text,
						"type": item.value,
						"fee": item.fee,
						"userId": this.$store.state.userId,
						"enterpriseId": this.$store.state.enterpriseId,
						"orderId": this.order._id,
						"carId": this.carInfo._id
					})
				request.then(res => {
					uni.hideLoading()
					this.isPopupShow = false
					that.loadData(that.order._id)
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						icon: "none",
						title: (err && (err.message || err.msg || err.errMsg)) || "网络异常，请稍后重试～"
					})
				})
			},
			loadMember() {
				const memberId = this.order.memberId || this.carInfo.memberId
				if (!memberId) {
					this.member = {}
					return
				}
				this.$api.get_member({
					memberId
				}).then(res => {
					this.member = res.data || {}
				}).catch(err => {
					this.member = {}
				})
			},
			openMemberBind() {
				if (!this.carInfo._id) return
				const that = this
				uni.navigateTo({
					url: '/pages/member/list?mode=bind&carId=' + this.carInfo._id +
						'&orderId=' + this.order._id +
						'&carNumber=' + encodeURIComponent(this.carInfo.carNumber || ''),
					events: {
						memberBound: () => {
							that.loadData(that.order._id)
						}
					}
				})
			},
			openMemberDetail() {
				const memberId = (this.member && this.member._id) || this.carInfo.memberId
				if (!memberId) {
					this.openMemberBind()
					return
				}
				uni.navigateTo({
					url: '/pages/member/detail?id=' + memberId
				})
			},
			getPayInfo() {
				const that = this
				that.$api.get_pay_info({
					carId: this.carInfo._id,
					orderId: this.order._id
				}).then(res => {
					console.log("get_pay_info===", JSON.stringify(res));
					that.sectionList[1].list = res.data
					that.payFee = 0
					res.data.forEach(item => {
						that.payFee += parseInt(item.fee)
					})
				}).catch(err => {

				})
			},
			updateOrderStatus(status) {
				this.$api.delete_order({
					_id: this.order._id,
					status: status
				}).then(res => {
					uni.navigateBack({
						delta: 2,
						success() {
							uni.$emit("updateOrderStatus", res)
						}
					})
				})
			},
			clickHeaderCard() {
				uni.navigateTo({
					url: '/pages/car_info/edit?id=' + this.carInfo._id+'&orderId='+this.order._id,
					events: {
						// 监听修改页面成功修改数据后, 刷新当前页面数据
						refreshData: (orderId) => {
							this.loadData(orderId)
						}
					}
				})
			}

		}
	}
</script>

<style lang="scss">
	.demo-popup {
		.s-popup-wrap {
			// width: 100px;
			// height: 100px;
		}
	}

	.select_tab {
		margin-top: 20px;
		display: flex;
		background: #fff;
		padding-top: 15px;
		margin-left: 15px;
		margin-right: 15px;
		box-sizing: border-box;
		border-bottom: 2px $uni-bg-color-grey solid;

		.select_sub_tab {
			display: flex;
			flex-direction: column;
			justify-content: space-between;
			text-align: center;
			flex: 1;

			.tab_line {
				margin-top: 10px;
				background-color: $uni-color-primary;
				height: 2px;
				text-align: center;
			}

		}
	}



	.add {
		font-size: 30px;
	}

	.m-button {

		background-color: $uni-color-primary;
		margin-left: 15px;
		margin-right: 15px;
		margin-top: 30px;
		margin-bottom: 30px;


	}

	.popup {
		display: flex;
		justify-content: center;
		align-items: center;

	}

	.my_popup {
		width: 260px;
		height: 350px;
		background: white;
		margin: 0 auto;
		// margin-top: 100px;

	}

	.scoll-bg {
		background: #fff;
		margin-left: 15px;
		margin-right: 15px;
		height: 100px;
	}

	uni-swiper {
		height: 100px;
	}

	.own-pay-view {
		text-align: right;
		padding: 0 20px;
		padding-top: 30px;
		color: $uni-text-color-grey;
	}

	.spare-part-bar {
		margin: 10px 15px 0;
		text-align: right;
	}

	.spare-part-btn {
		background-color: $uni-color-primary;
		font-size: 12px;
		padding: 0 14px;
	}

	.return-view {
		width: 280px;
		background: #ffffff;
		border-radius: 10px;
		padding: 18px;
	}

	.return-title {
		font-size: 17px;
		font-weight: 600;
		color: #333333;
		text-align: center;
		margin-bottom: 14px;
	}

	.return-line {
		font-size: 14px;
		color: #333333;
		margin-bottom: 12px;
	}

	.return-qty-line {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.return-btns {
		display: flex;
		justify-content: space-between;
		margin-top: 10px;
	}

	.return-btn {
		width: 110px;
		margin: 0;
	}
</style>