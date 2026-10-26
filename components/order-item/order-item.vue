<template>
	<uni-list-item>
		<!-- 自定义 body -->
		<template v-slot:body>
			<view class="my-cell" @click="toDetail">
				<view>
					<view><text class="carnumber-text">{{item.carInfoList[0].carNumber}}</text></view>
					<view><text class="time-text">{{item.formatTime}}</text></view>
					<!-- 		<view><text>哈哈</text></view> -->
				</view>
				<view class="status-view" v-if="item.status==0">
					<text class="iconfont icon-a-shanchu1 delete_stu" v-show="item.payFee==0 &&item.owefee==0"
						@click.stop="deleteOrder"></text>
					<text v-show="item.payFee>0 &&item.owefee==0">可入帐</text>
					<text v-show="item.payFee>0 &&item.owefee>0">{{"待入帐 ¥"+item.owefee}}</text>
				</view>
				<view class="status-view" v-if="item.status==1">
					<!-- 					<text v-show="item.payFee==0 &&item.owefee==0">删除</text> -->
					<text v-show="item.payFee>0 &&item.owefee<=0">可入帐</text>
					<text v-show="item.payFee>0 &&item.owefee>0">{{"挂帐 ¥"+item.owefee}}</text>
				</view>
				<view class="status-view" v-if="item.status==2">
					<!-- 					<text v-show="item.payFee==0 &&item.owefee==0">删除</text> -->
					<text >{{"¥"+item.payFee}}</text>
				</view>
			</view>

		</template>
	</uni-list-item>
</template>

<script>
	export default {
		name: "order-item",
		data() {
			return {
				totalFee: 0,
				payFee: 0

			};
		},
		props: {
			item: {
				type: Object,
				required: true
			}
		},

		created() {
			console.log("item====" + JSON.stringify(this.item))


		},
		methods: {
			toDetail() {
				// alert(JSON.stringify(this.item))
				uni.navigateTo({
					url: "/pages/index/billing/billingDetail/billingDetail" + "?id=" + this.item._id,
					animationType: 'pop-in',
					success() {

					}
				})

			},
			deleteOrder() {
				this.$api.delete_order({
					_id: this.item._id,
					status: -1
				}).then(res => {
					this.$emit("getAllOrderByStatus", 0)
					uni.showToast({
						title: "删除成功",
						duration: 2000
					})
				})
			}
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/icons.css");

	.my-cell {
		width: 100%;
		display: flex;
		justify-content: space-between;
		box-sizing: content-box;
		border-bottom: 1px solid uni-bg-color-grey;

		.status-view {
			font-size: 13px;
			color: #CC71BF;
			// text-align: center;
			align-items: center;
			// justify-content: center;
		}

		.carnumber-text {
			font-size: 15px;
			color: $uni-text-color;
		}

		.time-text {
			font-size: 13px;
			color: $uni-text-color-grey;
		}

		.delete_stu {
			color: $uni-text-color-grey;
		}

	}
</style>