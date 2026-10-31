<template>
	<view class="member-form-page">
		<view class="member-form-card">
			<view class="form-row">
				<text class="form-label">姓名</text>
				<uni-easyinput v-model="form.name" placeholder="请输入会员姓名"></uni-easyinput>
			</view>
			<view class="form-row">
				<text class="form-label">手机号</text>
				<uni-easyinput v-model="form.phone" type="number" placeholder="请输入手机号"></uni-easyinput>
			</view>
			<view class="form-row">
				<text class="form-label">会员卡号</text>
				<uni-easyinput v-model="form.cardNo" :disabled="!!memberId" placeholder="留空自动生成"></uni-easyinput>
			</view>
			<view class="form-row">
				<text class="form-label">会员等级</text>
				<uni-data-select v-model="form.level" :localdata="levels" :clear="false"></uni-data-select>
			</view>
			<view class="form-row form-row-textarea">
				<text class="form-label">备注</text>
				<uni-easyinput v-model="form.remark" type="textarea" placeholder="选填"></uni-easyinput>
			</view>
		</view>

		<view class="bind-hint" v-if="mode === 'bind'">
			<text>保存后将自动绑定车辆 {{ carNumber || '当前车辆' }}</text>
		</view>

		<button class="submit-btn" type="primary" :loading="submitting" :disabled="submitting" @click="submit">
			{{ memberId ? '保存修改' : '确认开卡' }}
		</button>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				memberId: '',
				mode: '',
				carId: '',
				carNumber: '',
				orderId: '',
				submitting: false,
				levels: [{
					value: '普通会员',
					text: '普通会员'
				}, {
					value: '银卡会员',
					text: '银卡会员'
				}, {
					value: '金卡会员',
					text: '金卡会员'
				}],
				form: {
					name: '',
					phone: '',
					cardNo: '',
					level: '普通会员',
					remark: ''
				}
			}
		},
		onLoad(options) {
			this.memberId = options.id || ''
			this.mode = options.mode || ''
			this.carId = options.carId || ''
			this.carNumber = options.carNumber ? decodeURIComponent(options.carNumber) : ''
			this.orderId = options.orderId || ''
			if (this.memberId) {
				uni.setNavigationBarTitle({
					title: '编辑会员'
				})
				this.loadMember()
			} else if (this.mode === 'bind') {
				uni.setNavigationBarTitle({
					title: '开卡并绑定'
				})
			}
		},
		methods: {
			loadMember() {
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_member({
					memberId: this.memberId
				}).then(res => {
					const member = res.data || {}
					this.form = {
						name: member.name || '',
						phone: member.phone || '',
						cardNo: member.cardNo || '',
						level: member.level || '普通会员',
						remark: member.remark || ''
					}
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			submit() {
				const name = String(this.form.name || '').trim()
				const phone = String(this.form.phone || '').trim()
				if (!name) {
					return uni.showToast({
						title: '请输入会员姓名',
						icon: 'none'
					})
				}
				if (!phone) {
					return uni.showToast({
						title: '请输入手机号',
						icon: 'none'
					})
				}
				if (this.submitting) return
				this.submitting = true
				uni.showLoading({
					title: '保存中...'
				})
				const payload = {
					name,
					phone,
					level: this.form.level || '普通会员',
					remark: String(this.form.remark || '').trim()
				}
				const request = this.memberId
					? this.$api.update_member(Object.assign({ memberId: this.memberId }, payload))
					: this.$api.add_member(Object.assign({ cardNo: String(this.form.cardNo || '').trim() }, payload))
				request.then(res => {
					if (this.memberId) {
						uni.hideLoading()
						uni.showToast({
							title: '修改成功',
							icon: 'none'
						})
						setTimeout(() => uni.navigateBack(), 500)
						return
					}
					const member = res.data || {}
					if (this.mode === 'bind' && this.carId) {
						return this.$api.bind_member_car({
							memberId: member._id,
							carId: this.carId,
							carNumber: this.carNumber,
							orderId: this.orderId
						}).then(bindRes => {
							uni.hideLoading()
							try {
								const channel = this.getOpenerEventChannel()
								if (channel && channel.emit) channel.emit('memberBound', bindRes.data.member || member)
							} catch (e) {}
							uni.navigateBack()
						})
					}
					uni.hideLoading()
					uni.showToast({
						title: '开卡成功',
						icon: 'none'
					})
					setTimeout(() => {
						uni.redirectTo({
							url: '/pages/member/detail?id=' + member._id
						})
					}, 500)
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '保存失败',
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
	.member-form-page {
		padding: 15px;
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.member-form-card {
		background-color: #ffffff;
		border-radius: 8px;
		padding: 8px 14px;
	}

	.form-row {
		padding: 10px 0;
		border-bottom: 1px solid #F0F0F0;
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

	.bind-hint {
		margin-top: 12px;
		padding: 10px 12px;
		background-color: #EAF2FF;
		border-radius: 6px;
		color: #6EA0F7;
		font-size: 13px;
	}

	.submit-btn {
		margin-top: 24px;
		background-color: #6EA0F7;
	}
</style>
