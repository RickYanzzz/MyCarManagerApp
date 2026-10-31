<template>
	<view class="member-detail-page">
		<scroll-view class="member-scroll" scroll-y="true">
			<view class="member-card">
				<view class="member-card-head">
					<view>
						<text class="member-card-name">{{ member.name || '会员' }}</text>
						<text class="member-card-level">{{ member.level || '普通会员' }}</text>
					</view>
					<text class="member-card-status" :class="{ disabled: member.status != 1 }">
						{{ member.status == 1 ? '正常' : '已停用' }}
					</text>
				</view>
				<view class="member-card-no">卡号 {{ member.cardNo || '-' }}</view>
				<view class="member-balance-label">当前余额</view>
				<view class="member-balance-value">¥{{ member.balance || 0 }}</view>
				<view class="member-stats">
					<view>
						<text class="stat-value">{{ member.totalRecharge || 0 }}</text>
						<text class="stat-label">累计充值</text>
					</view>
					<view>
						<text class="stat-value">{{ member.totalConsume || 0 }}</text>
						<text class="stat-label">累计消费</text>
					</view>
				</view>
			</view>

			<view class="member-actions">
				<button class="action-btn primary" @click="goRecharge">充值</button>
				<button class="action-btn" @click="goTransactions">流水</button>
				<button class="action-btn" @click="goEdit">编辑</button>
				<button class="action-btn" @click="openBind">绑车</button>
			</view>

			<view class="member-info-card">
				<view class="info-row"><text class="info-label">手机号</text><text>{{ member.phone || '-' }}</text></view>
				<view class="info-row"><text class="info-label">备注</text><text>{{ member.remark || '-' }}</text></view>
				<view class="info-row"><text class="info-label">开卡时间</text><text>{{ formatTime(member.createTime) }}</text></view>
			</view>

			<view class="member-section-title">绑定车辆</view>
			<view class="member-car-card">
				<view class="member-car-item" v-for="car in member.cars || []" :key="car._id">
					<view>
						<text class="car-number">{{ car.carNumber }}</text>
						<text class="car-brand" v-if="car.brand">{{ car.brand }}</text>
					</view>
					<text class="car-unbind" @click="unbindCar(car)">解绑</text>
				</view>
				<view class="member-empty" v-if="!(member.cars || []).length">暂无绑定车辆</view>
			</view>

			<button class="status-btn" v-if="member.status == 1" @click="toggleStatus">停用会员</button>
			<button class="status-btn enable" v-else @click="toggleStatus">启用会员</button>
			<view class="member-bottom-space"></view>
		</scroll-view>

		<uni-popup ref="bindPopup" type="center">
			<view class="bind-popup">
				<view class="bind-popup-title">绑定车辆</view>
				<uni-easyinput v-model="bindCarNumber" placeholder="请输入车牌号"></uni-easyinput>
				<view class="bind-popup-btns">
					<button class="popup-btn" @click="closeBind">取消</button>
					<button class="popup-btn primary" @click="submitBind">确认绑定</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				memberId: '',
				member: {},
				bindCarNumber: ''
			}
		},
		onLoad(options) {
			this.memberId = options.id || ''
		},
		onShow() {
			if (this.memberId) this.loadData()
		},
		methods: {
			loadData() {
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
			formatTime(time) {
				if (!time) return '-'
				try {
					return this.$commons.formatDate(time)
				} catch (e) {
					return '-'
				}
			},
			goRecharge() {
				if (this.member.status != 1) {
					return uni.showToast({
						title: '会员已停用，不能充值',
						icon: 'none'
					})
				}
				uni.navigateTo({
					url: '/pages/member/recharge?id=' + this.memberId
				})
			},
			goTransactions() {
				uni.navigateTo({
					url: '/pages/member/transactions?id=' + this.memberId
				})
			},
			goEdit() {
				uni.navigateTo({
					url: '/pages/member/add?id=' + this.memberId
				})
			},
			openBind() {
				this.bindCarNumber = ''
				this.$refs.bindPopup.open()
			},
			closeBind() {
				this.$refs.bindPopup.close()
			},
			submitBind() {
				const carNumber = String(this.bindCarNumber || '').trim()
				if (!carNumber) {
					return uni.showToast({
						title: '请输入车牌号',
						icon: 'none'
					})
				}
				uni.showLoading({
					title: '绑定中...'
				})
				this.$api.bind_member_car({
					memberId: this.memberId,
					carNumber
				}).then(() => {
					uni.hideLoading()
					this.closeBind()
					this.loadData()
					uni.showToast({
						title: '绑定成功',
						icon: 'none'
					})
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '绑定失败',
						icon: 'none'
					})
				})
			},
			unbindCar(car) {
				uni.showModal({
					title: '解绑车辆',
					content: '确认将车辆 ' + car.carNumber + ' 从该会员解绑吗？',
					success: (res) => {
						if (!res.confirm) return
						uni.showLoading({
							title: '解绑中...'
						})
						this.$api.bind_member_car({
							memberId: '',
							carId: car._id
						}).then(() => {
							uni.hideLoading()
							this.loadData()
							uni.showToast({
								title: '已解绑',
								icon: 'none'
							})
						}).catch(err => {
							uni.hideLoading()
							uni.showToast({
								title: (err && (err.message || err.msg || err.errMsg)) || '解绑失败',
								icon: 'none'
							})
						})
					}
				})
			},
			toggleStatus() {
				const nextStatus = this.member.status == 1 ? 0 : 1
				const action = nextStatus === 1 ? '启用' : '停用'
				uni.showModal({
					title: action + '会员',
					content: '确认' + action + '会员「' + (this.member.name || '') + '」吗？',
					success: (res) => {
						if (!res.confirm) return
						uni.showLoading({
							title: '处理中...'
						})
						this.$api.set_member_status({
							memberId: this.memberId,
							status: nextStatus
						}).then(() => {
							uni.hideLoading()
							this.loadData()
							uni.showToast({
								title: action + '成功',
								icon: 'none'
							})
						}).catch(err => {
							uni.hideLoading()
							uni.showToast({
								title: (err && (err.message || err.msg || err.errMsg)) || '操作失败',
								icon: 'none'
							})
						})
					}
				})
			}
		}
	}
</script>

<style>
	.member-detail-page {
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.member-scroll {
		height: 100vh;
		padding: 12px;
		box-sizing: border-box;
	}

	.member-card {
		background-color: #6EA0F7;
		border-radius: 10px;
		padding: 16px;
		color: #ffffff;
	}

	.member-card-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}

	.member-card-name {
		font-size: 20px;
		font-weight: 600;
	}

	.member-card-level {
		margin-left: 8px;
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 10px;
		background-color: rgba(255, 255, 255, 0.2);
	}

	.member-card-status {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 10px;
		background-color: rgba(255, 255, 255, 0.2);
	}

	.member-card-status.disabled {
		color: #FFE0E0;
	}

	.member-card-no {
		margin-top: 10px;
		font-size: 12px;
		opacity: 0.85;
	}

	.member-balance-label {
		margin-top: 18px;
		font-size: 12px;
		opacity: 0.85;
	}

	.member-balance-value {
		margin-top: 4px;
		font-size: 32px;
		font-weight: 600;
	}

	.member-stats {
		margin-top: 16px;
		display: flex;
		justify-content: space-around;
		border-top: 1px solid rgba(255, 255, 255, 0.25);
		padding-top: 12px;
	}

	.member-stats view {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 16px;
		font-weight: 600;
	}

	.stat-label {
		margin-top: 4px;
		font-size: 12px;
		opacity: 0.85;
	}

	.member-actions {
		margin-top: 12px;
		display: flex;
		justify-content: space-between;
	}

	.action-btn {
		flex: 1;
		margin: 0 4px;
		font-size: 13px;
		background-color: #ffffff;
		color: #333333;
		border-radius: 6px;
	}

	.action-btn.primary {
		background-color: #6EA0F7;
		color: #ffffff;
	}

	.member-info-card,
	.member-car-card {
		margin-top: 12px;
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px 14px;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		font-size: 14px;
		color: #333333;
		border-bottom: 1px solid #F5F5F5;
	}

	.info-row:last-child {
		border-bottom: none;
	}

	.info-label {
		color: #999999;
	}

	.member-section-title {
		margin: 16px 4px 8px;
		font-size: 14px;
		color: #666666;
	}

	.member-car-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 0;
		border-bottom: 1px solid #F5F5F5;
	}

	.member-car-item:last-child {
		border-bottom: none;
	}

	.car-number {
		font-size: 15px;
		color: #333333;
	}

	.car-brand {
		margin-left: 8px;
		font-size: 12px;
		color: #999999;
	}

	.car-unbind {
		font-size: 13px;
		color: #FF4D4F;
	}

	.member-empty {
		padding: 20px 0;
		text-align: center;
		font-size: 13px;
		color: #999999;
	}

	.status-btn {
		margin-top: 20px;
		background-color: #FFF1F0;
		color: #FF4D4F;
		font-size: 14px;
	}

	.status-btn.enable {
		background-color: #F0FFF0;
		color: #52C41A;
	}

	.member-bottom-space {
		height: 40px;
	}

	.bind-popup {
		width: 280px;
		background-color: #ffffff;
		border-radius: 10px;
		padding: 18px;
	}

	.bind-popup-title {
		font-size: 17px;
		font-weight: 600;
		color: #333333;
		text-align: center;
		margin-bottom: 16px;
	}

	.bind-popup-btns {
		display: flex;
		justify-content: space-between;
		margin-top: 18px;
	}

	.popup-btn {
		width: 110px;
		margin: 0;
		font-size: 13px;
	}

	.popup-btn.primary {
		background-color: #6EA0F7;
		color: #ffffff;
	}
</style>
