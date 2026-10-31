<template>
	<view class="recharge-page">
		<view class="recharge-card">
			<view class="recharge-member">
				<text class="recharge-name">{{ member.name || '会员' }}</text>
				<text class="recharge-card-no">{{ member.cardNo || '' }}</text>
			</view>
			<view class="recharge-balance-label">当前余额</view>
			<view class="recharge-balance">¥{{ member.balance || 0 }}</view>
		</view>

		<view class="recharge-form-card">
			<view class="form-row">
				<text class="form-label">充值金额（元）</text>
				<uni-easyinput v-model="amount" type="number" placeholder="请输入充值金额"></uni-easyinput>
			</view>
			<view class="quick-amounts">
				<text class="quick-amount" v-for="item in quickAmounts" :key="item" @click="selectAmount(item)">
					{{ item }}
				</text>
			</view>
			<view class="form-row">
				<text class="form-label">收款方式</text>
				<uni-data-select v-model="payType" :localdata="payTypes" :clear="false"></uni-data-select>
			</view>
			<view class="form-row">
				<text class="form-label">备注</text>
				<uni-easyinput v-model="remark" placeholder="选填"></uni-easyinput>
			</view>
		</view>

		<view class="recharge-disabled" v-if="member.status != 1">
			<text>该会员已停用，不能充值</text>
		</view>

		<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting || member.status != 1"
			@click="submit">确认充值</button>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				memberId: '',
				member: {},
				amount: '',
				payType: 1,
				remark: '',
				idempotencyKey: '',
				submitting: false,
				quickAmounts: [100, 200, 500, 1000, 2000],
				payTypes: [{
					value: 1,
					text: '微信'
				}, {
					value: 2,
					text: '现金'
				}, {
					value: 3,
					text: '支付宝'
				}, {
					value: 5,
					text: '其他'
				}, {
					value: 6,
					text: '银行卡'
				}]
			}
		},
		onLoad(options) {
			this.memberId = options.id || ''
			this.idempotencyKey = this.$commons.uuid()
			if (this.memberId) this.loadMember()
		},
		methods: {
			loadMember() {
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_member({
					memberId: this.memberId
				}).then(res => {
					this.member = res.data || {}
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			selectAmount(value) {
				this.amount = String(value)
			},
			submit() {
				const amount = Number(this.amount)
				if (!Number.isInteger(amount) || amount <= 0) {
					return uni.showToast({
						title: '请输入正整数充值金额',
						icon: 'none'
					})
				}
				if (this.submitting) return
				this.submitting = true
				uni.showLoading({
					title: '充值中...'
				})
				this.$api.recharge_member({
					memberId: this.memberId,
					amount,
					payType: this.payType,
					remark: String(this.remark || '').trim(),
					idempotencyKey: this.idempotencyKey
				}).then(res => {
					uni.hideLoading()
					const balance = res.data && res.data.balance !== undefined ? res.data.balance : this.member.balance
					this.member.balance = balance
					uni.showToast({
						title: '充值成功，余额 ¥' + balance,
						icon: 'none'
					})
					setTimeout(() => uni.navigateBack(), 800)
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '充值失败',
						icon: 'none'
					})
				}).finally(() => {
					this.submitting = false
				})
			}
		}
	}
</script>

<style>
	.recharge-page {
		padding: 15px;
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.recharge-card {
		background-color: #6EA0F7;
		border-radius: 10px;
		padding: 16px;
		color: #ffffff;
	}

	.recharge-member {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.recharge-name {
		font-size: 18px;
		font-weight: 600;
	}

	.recharge-card-no {
		font-size: 12px;
		opacity: 0.85;
	}

	.recharge-balance-label {
		margin-top: 18px;
		font-size: 12px;
		opacity: 0.85;
	}

	.recharge-balance {
		margin-top: 4px;
		font-size: 30px;
		font-weight: 600;
	}

	.recharge-form-card {
		margin-top: 12px;
		background-color: #ffffff;
		border-radius: 8px;
		padding: 8px 14px;
	}

	.form-row {
		padding: 10px 0;
		border-bottom: 1px solid #F5F5F5;
	}

	.form-row:last-child {
		border-bottom: none;
	}

	.form-label {
		display: block;
		font-size: 13px;
		color: #666666;
		margin-bottom: 8px;
	}

	.quick-amounts {
		display: flex;
		flex-wrap: wrap;
		padding: 4px 0 10px;
	}

	.quick-amount {
		margin: 4px 8px 4px 0;
		padding: 5px 14px;
		border-radius: 14px;
		background-color: #F0F5FF;
		color: #6EA0F7;
		font-size: 13px;
	}

	.recharge-disabled {
		margin-top: 12px;
		padding: 10px 12px;
		background-color: #FFF1F0;
		border-radius: 6px;
		color: #FF4D4F;
		font-size: 13px;
	}

	.submit-btn {
		margin-top: 24px;
		background-color: #6EA0F7;
	}
</style>
