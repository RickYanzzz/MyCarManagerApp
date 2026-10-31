<template>
	<view class="tx-page">
		<scroll-view class="tx-scroll" scroll-y="true" @scrolltolower="loadMore">
			<view class="tx-item" v-for="item in list" :key="item._id">
				<view class="tx-head">
					<text class="tx-type" :class="item.type">{{ typeText(item.type) }}</text>
					<text class="tx-amount" :class="{ plus: item.type === 'recharge', minus: item.type === 'consume' }">
						{{ amountText(item) }}
					</text>
				</view>
				<view class="tx-meta">
					<text>{{ formatTime(item.time) }}</text>
					<text>余额 ¥{{ item.balanceAfter || 0 }}</text>
				</view>
				<view class="tx-extra">
					<text v-if="item.payType !== undefined && item.payType !== null">方式：{{ payTypeText(item.payType) }}</text>
					<text v-if="item.orderId">订单：{{ shortId(item.orderId) }}</text>
				</view>
				<view class="tx-remark" v-if="item.remark">{{ item.remark }}</view>
			</view>
			<view class="tx-empty" v-if="!loading && !list.length">暂无流水</view>
			<view class="tx-loading" v-if="loading">加载中...</view>
			<view class="tx-bottom-space"></view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				memberId: '',
				list: [],
				page: 1,
				pageSize: 20,
				total: 0,
				loading: false
			}
		},
		onLoad(options) {
			this.memberId = options.id || ''
		},
		onShow() {
			this.loadData(true)
		},
		methods: {
			loadData(reset) {
				if (this.loading) return
				if (reset) this.page = 1
				this.loading = true
				this.$api.get_member_transactions({
					memberId: this.memberId,
					page: this.page,
					pageSize: this.pageSize
				}).then(res => {
					const data = res.data || {}
					const list = data.list || []
					this.list = reset ? list : this.list.concat(list)
					this.total = Number(data.total || 0)
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					this.loading = false
				})
			},
			loadMore() {
				if (this.list.length < this.total && !this.loading) {
					this.page++
					this.loadData(false)
				}
			},
			typeText(type) {
				const map = {
					recharge: '充值',
					consume: '消费',
					refund: '退款',
					adjust: '调整'
				}
				return map[type] || type
			},
			payTypeText(type) {
				const map = {
					0: '会员卡',
					1: '微信',
					2: '现金',
					3: '支付宝',
					4: '赠送',
					5: '其他',
					6: '银行卡'
				}
				return map[type] || '其他'
			},
			amountText(item) {
				const amount = Number(item.amount || 0)
				if (item.type === 'consume') return '-¥' + amount
				return '+¥' + amount
			},
			shortId(id) {
				return String(id || '').slice(-8)
			},
			formatTime(time) {
				if (!time) return '-'
				try {
					return this.$commons.formatDate(time)
				} catch (e) {
					return '-'
				}
			}
		}
	}
</script>

<style>
	.tx-page {
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.tx-scroll {
		height: 100vh;
		padding: 12px;
		box-sizing: border-box;
	}

	.tx-item {
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px 14px;
		margin-bottom: 10px;
	}

	.tx-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.tx-type {
		font-size: 13px;
		color: #6EA0F7;
		background-color: #F0F5FF;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.tx-type.consume {
		color: #E6AA46;
		background-color: #FFF4E5;
	}

	.tx-amount {
		font-size: 16px;
		font-weight: 600;
		color: #333333;
	}

	.tx-amount.plus {
		color: #52C41A;
	}

	.tx-amount.minus {
		color: #E6AA46;
	}

	.tx-meta {
		margin-top: 8px;
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #999999;
	}

	.tx-extra {
		margin-top: 6px;
		display: flex;
		justify-content: space-between;
		font-size: 12px;
		color: #999999;
	}

	.tx-remark {
		margin-top: 6px;
		font-size: 12px;
		color: #666666;
	}

	.tx-empty,
	.tx-loading {
		padding: 60px 0;
		text-align: center;
		color: #999999;
		font-size: 14px;
	}

	.tx-bottom-space {
		height: 40px;
	}
</style>
