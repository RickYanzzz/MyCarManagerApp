<template>
	<view class="page">

		<view v-if="loading" class="skeleton-wrap">
			<view class="skeleton skeleton--hero"></view>
			<view class="skeleton skeleton--card"></view>
		</view>

		<view v-else-if="error" class="state-box">
			<text class="state-title">预约加载失败</text>
			<text class="state-desc">{{ error }}</text>
			<button class="state-btn" @click="load(true)">重新加载</button>
		</view>

		<block v-else>
			<!-- 状态头部 -->
			<view class="hero" :style="{ backgroundColor: heroBg }">
				<view class="hero-top">
					<view class="hero-badge" :style="{ backgroundColor: statusColor }">
						<text class="hero-badge-text">{{ appointment.statusText }}</text>
					</view>
					<text class="hero-date">{{ dateText }}</text>
				</view>
				<text class="hero-time">{{ appointment.timeRangeText }}</text>
				<text class="hero-name">{{ appointment.customerName || '未填客户' }}</text>
				<text class="hero-meta">{{ heroMeta }}</text>
			</view>

			<!-- 冲突提示 -->
			<view v-if="appointment.hasConflict" class="warn-bar">
				<text class="warn-text">该预约与同师傅或同工位的另一单时段重叠，请改约其中一单</text>
			</view>

			<!-- 已开单提示 -->
			<view v-if="appointment.orderId" class="order-bar" @click="openOrder">
				<view class="order-left">
					<text class="order-title">已生成工单</text>
					<text class="order-sub">{{ orderStatusText }}</text>
				</view>
				<text class="order-link">查看工单 ›</text>
			</view>

			<!-- 客户与车辆 -->
			<view class="card">
				<view class="card-head">
					<text class="card-title">客户信息</text>
				</view>
				<view class="info-row">
					<text class="info-label">姓名</text>
					<text class="info-value">{{ appointment.customerName || '—' }}</text>
				</view>
				<view class="info-row" @click="callPhone">
					<text class="info-label">电话</text>
					<text class="info-value info-value--link">{{ appointment.customerPhone || '—' }}</text>
					<text v-if="appointment.customerPhone" class="info-action">拨号</text>
				</view>
				<view class="info-row">
					<text class="info-label">车牌</text>
					<text class="info-value">{{ appointment.carNumber || '未登记' }}</text>
				</view>
				<view class="info-row">
					<text class="info-label">会员</text>
					<text class="info-value">{{ appointment.memberId ? '已关联会员' : '散客' }}</text>
				</view>
				<view class="info-row">
					<text class="info-label">师傅</text>
					<text class="info-value">{{ appointment.technicianName }}</text>
				</view>
				<view class="info-row">
					<text class="info-label">工位</text>
					<text class="info-value">{{ bayText }}</text>
				</view>
				<view class="info-row">
					<text class="info-label">录入</text>
					<text class="info-value info-value--dim">{{ appointment.createUserName || '—' }} · {{ createTimeText }}</text>
				</view>
			</view>

			<!-- 项目 -->
			<view class="card">
				<view class="card-head">
					<text class="card-title">预约项目</text>
					<text class="card-sub">预计 {{ appointment.duration }} 分钟</text>
				</view>
				<view v-if="items.length" class="item-list">
					<view v-for="(it, idx) in items" :key="idx" class="item-row">
						<text class="item-name">{{ it.name }}</text>
						<text class="item-dur">{{ it.duration }}分</text>
						<text class="item-fee">¥{{ it.fee }}</text>
					</view>
					<view class="item-total">
						<text class="total-label">参考合计</text>
						<text class="total-value">¥{{ totalFee }}</text>
					</view>
				</view>
				<text v-else class="empty-text">未填写项目，到店后可在开单时补充</text>
			</view>

			<!-- 备注 -->
			<view v-if="appointment.remark" class="card">
				<view class="card-head">
					<text class="card-title">备注</text>
				</view>
				<text class="remark-text">{{ appointment.remark }}</text>
			</view>

			<!-- 同师傅当天 -->
			<view v-if="others.length" class="card">
				<view class="card-head">
					<text class="card-title">{{ appointment.technicianName }}当天其他安排</text>
					<text class="card-sub">共 {{ others.length }} 单</text>
				</view>
				<view class="other-list">
					<view v-for="o in others" :key="o._id" class="other-item" @click="openOther(o)">
						<view class="other-dot" :style="{ backgroundColor: colorOf(o.status) }"></view>
						<text class="other-time">{{ o.timeRangeText }}</text>
						<text class="other-name">{{ o.customerName || '客户' }}</text>
						<text class="other-status">{{ o.statusText }}</text>
					</view>
				</view>
			</view>

			<view class="bottom-space"></view>

			<!-- 操作 -->
			<view class="bottom-bar">
				<view class="ghost-btn" @click="onEdit">
					<text class="ghost-text">改约</text>
				</view>
				<view v-if="appointment.status === 0" class="ghost-btn" @click="changeStatus(4, '标记为未到店？')">
					<text class="ghost-text">未到店</text>
				</view>
				<view v-if="appointment.status === 0" class="ghost-btn" @click="changeStatus(3, '确认取消该预约？')">
					<text class="ghost-text ghost-text--danger">取消</text>
				</view>
				<view v-if="appointment.status === 0" class="primary-btn" @click="onArrive">
					<text class="primary-text">到店开单</text>
				</view>
				<view v-else-if="appointment.status === 1" class="primary-btn" @click="onOpenOrderOrDone">
					<text class="primary-text">完成施工</text>
				</view>
				<view v-else-if="appointment.status === 4 || appointment.status === 3" class="primary-btn" @click="onEdit">
					<text class="primary-text">重新预约</text>
				</view>
			</view>
		</block>

	</view>
</template>

<script>
	import {
		STATUS_COLOR,
		beijingParts,
		shortDateLabel,
		dateKeyOf
	} from '@/common/utils/schedule.js'

	const HERO_BG = {
		0: '#EEF5FF',
		1: '#FFF6EA',
		2: '#EDF8F4',
		3: '#F4F6FA',
		4: '#FDF0EF'
	}

	const ORDER_STATUS = {
		0: '施工中',
		1: '挂账',
		2: '已入账',
		'-1': '已删除'
	}

	export default {
		data() {
			return {
				id: '',
				loading: true,
				loaded: false,
				error: '',
				appointment: {},
				others: [],
				order: null,
				bay: { bayNo: 0, bayCount: 0, crossDay: false, boardTimeText: '' }
			}
		},
		computed: {
			statusColor() {
				return STATUS_COLOR[Number(this.appointment.status)] || '#8A94A6'
			},
			heroBg() {
				return HERO_BG[Number(this.appointment.status)] || '#F4F6FA'
			},
			dateText() {
				const p = beijingParts(this.appointment.startTime)
				if (!p) return ''
				return p.year + '年' + shortDateLabel(dateKeyOf(this.appointment.startTime))
			},
			createTimeText() {
				const p = beijingParts(this.appointment.createTime)
				if (!p) return ''
				const hh = Math.floor(p.minutesOfDay / 60)
				const mm = p.minutesOfDay % 60
				return p.month + '/' + p.day + ' ' + (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm)
			},
			items() {
				return this.appointment.items || []
			},
			totalFee() {
				return this.items.reduce((sum, it) => sum + (parseInt(it.fee, 10) || 0), 0)
			},
			orderStatusText() {
				if (!this.order) return '工单状态未知'
				return ORDER_STATUS[String(this.order.status)] || '工单进行中'
			},
			bayText() {
				const info = this.bay || {}
				if (!info.bayCount) return '未启用'
				if (!info.bayNo) return '未分配 / 共 ' + info.bayCount + ' 个'
				return info.bayNo + ' 号位 / 共 ' + info.bayCount + ' 个'
			},
			heroMeta() {
				let text = (this.appointment.technicianName || '') + ' · ' + (this.appointment.duration || 0) + '分钟'
				if (this.appointment.crossDay) text += ' · 跨天'
				return text
			}
		},
		onLoad(options) {
			this.id = (options && options.id) || ''
			this.load(true)
		},
		onShow() {
			if (this.loaded && this.id) this.load(false)
		},
		methods: {
			load(showLoading) {
				if (!this.id) {
					this.loading = false
					this.error = '缺少预约ID'
					return
				}
				const that = this
				if (showLoading) this.loading = true
				this.$api.get_appointment_detail({ id: this.id }).then(res => {
					const d = (res && res.data) || {}
					that.appointment = d.appointment || {}
					that.others = d.others || []
					that.order = d.order || null
					that.bay = d.bay || { bayNo: 0, bayCount: 0, crossDay: false, boardTimeText: '' }
					that.loading = false
					that.loaded = true
					that.error = ''
				}).catch(err => {
					that.loading = false
					that.loaded = true
					that.error = (err && err.message) || '请检查网络后重试'
				})
			},
			colorOf(status) {
				return STATUS_COLOR[Number(status)] || '#8A94A6'
			},
			callPhone() {
				const phone = this.appointment.customerPhone
				if (!phone) {
					uni.showToast({ title: '没有登记电话', icon: 'none' })
					return
				}
				uni.makePhoneCall({ phoneNumber: String(phone) })
			},
			openOrder() {
				if (!this.appointment.orderId) return
				uni.navigateTo({
					url: '/pages/index/billing/billingDetail/billingDetail?id=' + this.appointment.orderId
				})
			},
			openOther(o) {
				uni.navigateTo({ url: '/pages/appointment/detail?id=' + o._id })
			},
			onEdit() {
				uni.navigateTo({ url: '/pages/appointment/edit?id=' + this.id })
			},
			onArrive() {
				const that = this
				uni.showModal({
					title: '到店开单',
					content: '将为该预约生成工单，并把预约项目带入消费清单，是否继续？',
					success(res) {
						if (!res.confirm) return
						uni.showLoading({ title: '开单中...', mask: true })
						that.$api.appointment_to_order({ id: that.id }).then(res2 => {
							uni.hideLoading()
							const orderId = res2 && res2.data && res2.data.orderId
							uni.showToast({ title: '工单已生成', icon: 'success' })
							setTimeout(() => {
								uni.navigateTo({
									url: '/pages/index/billing/billingDetail/billingDetail?id=' + orderId
								})
							}, 500)
						}).catch(err => {
							uni.hideLoading()
							uni.showModal({
								title: '无法开单',
								content: (err && err.message) || '请稍后重试',
								showCancel: false
							})
						})
					}
				})
			},
			onOpenOrderOrDone() {
				const that = this
				uni.showModal({
					title: '完成施工',
					content: '标记为已完成？如需收款结算，请到工单里操作。',
					success(res) {
						if (!res.confirm) return
						that.changeStatus(2)
					}
				})
			},
			changeStatus(status, confirmText) {
				const that = this
				const doChange = () => {
					uni.showLoading({ title: '处理中...' })
					that.$api.set_appointment_status({ id: that.id, status: status }).then(() => {
						uni.hideLoading()
						uni.showToast({ title: '已更新', icon: 'success' })
						that.load(false)
					}).catch(err => {
						uni.hideLoading()
						uni.showModal({
							title: '操作失败',
							content: (err && err.message) || '请稍后重试',
							showCancel: false
						})
					})
				}
				if (!confirmText) {
					doChange()
					return
				}
				uni.showModal({
					title: '确认操作',
					content: confirmText,
					success(res) {
						if (res.confirm) doChange()
					}
				})
			}
		}
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background: #F4F8FB;
		padding: 20rpx 20rpx 200rpx;
		box-sizing: border-box;
	}

	/* 头部 */
	.hero {
		border-radius: 20rpx;
		padding: 28rpx 28rpx 32rpx;
		display: flex;
		flex-direction: column;
	}

	.hero-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.hero-badge {
		border-radius: 20rpx;
		padding: 4rpx 18rpx;
	}

	.hero-badge-text {
		font-size: 20rpx;
		color: #fff;
		font-weight: 600;
	}

	.hero-date {
		font-size: 22rpx;
		color: #6B7688;
	}

	.hero-time {
		font-size: 52rpx;
		color: #2C405A;
		font-weight: 700;
		margin-top: 20rpx;
		letter-spacing: 1rpx;
	}

	.hero-name {
		font-size: 32rpx;
		color: #2C405A;
		font-weight: 600;
		margin-top: 8rpx;
	}

	.hero-meta {
		font-size: 22rpx;
		color: #7B8598;
		margin-top: 8rpx;
	}

	/* 提示 */
	.warn-bar {
		background: #FDF0EF;
		border-radius: 12rpx;
		padding: 16rpx 20rpx;
		margin-top: 16rpx;
	}

	.warn-text {
		font-size: 22rpx;
		color: #C25B58;
		line-height: 32rpx;
	}

	.order-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #EDF8F4;
		border-radius: 12rpx;
		padding: 20rpx 24rpx;
		margin-top: 16rpx;
	}

	.order-left {
		display: flex;
		flex-direction: column;
	}

	.order-title {
		font-size: 24rpx;
		color: #2F8570;
		font-weight: 600;
	}

	.order-sub {
		font-size: 20rpx;
		color: #4FAF98;
		margin-top: 4rpx;
	}

	.order-link {
		font-size: 22rpx;
		color: #2F8570;
	}

	/* 卡片 */
	.card {
		background: #fff;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-top: 16rpx;
		box-shadow: 0 4rpx 16rpx rgba(110, 160, 247, 0.06);
	}

	.card-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 12rpx;
	}

	.card-title {
		font-size: 26rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.card-sub {
		font-size: 20rpx;
		color: #A4ADBD;
	}

	.info-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12rpx 0;
		border-bottom: 1px solid #F7F9FC;
	}

	.info-label {
		font-size: 22rpx;
		color: #8A94A6;
		width: 90rpx;
	}

	.info-value {
		font-size: 24rpx;
		color: #2C405A;
		flex: 1;
		text-align: right;
	}

	.info-value--link {
		color: #4A7FDB;
	}

	.info-value--dim {
		color: #8A94A6;
		font-size: 22rpx;
	}

	.info-action {
		font-size: 20rpx;
		color: #4A7FDB;
		background: #E8F0FE;
		border-radius: 6rpx;
		padding: 2rpx 10rpx;
		margin-left: 12rpx;
	}

	/* 项目 */
	.item-list {
		margin-top: 8rpx;
	}

	.item-row {
		display: flex;
		align-items: center;
		padding: 14rpx 0;
		border-bottom: 1px solid #F7F9FC;
	}

	.item-name {
		font-size: 24rpx;
		color: #2C405A;
		flex: 1;
	}

	.item-dur {
		font-size: 20rpx;
		color: #A4ADBD;
		margin-right: 20rpx;
	}

	.item-fee {
		font-size: 24rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.item-total {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 16rpx;
	}

	.total-label {
		font-size: 22rpx;
		color: #8A94A6;
	}

	.total-value {
		font-size: 30rpx;
		color: #C25B58;
		font-weight: 700;
	}

	.empty-text {
		display: block;
		font-size: 22rpx;
		color: #A4ADBD;
		margin-top: 8rpx;
		line-height: 32rpx;
	}

	.remark-text {
		display: block;
		font-size: 24rpx;
		color: #55607A;
		line-height: 38rpx;
		margin-top: 8rpx;
	}

	/* 其他安排 */
	.other-list {
		margin-top: 8rpx;
	}

	.other-item {
		display: flex;
		align-items: center;
		padding: 14rpx 0;
		border-bottom: 1px solid #F7F9FC;
	}

	.other-dot {
		width: 10rpx;
		height: 10rpx;
		border-radius: 5rpx;
		margin-right: 12rpx;
	}

	.other-time {
		font-size: 22rpx;
		color: #55607A;
		width: 150rpx;
	}

	.other-name {
		font-size: 22rpx;
		color: #2C405A;
		flex: 1;
	}

	.other-status {
		font-size: 20rpx;
		color: #A4ADBD;
	}

	/* 底部 */
	.bottom-bar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		background: #fff;
		padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		box-shadow: 0 -4rpx 20rpx rgba(110, 160, 247, 0.1);
	}

	.ghost-btn {
		padding: 0 22rpx;
		height: 76rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #F4F8FB;
		border-radius: 38rpx;
		margin-right: 12rpx;
	}

	.ghost-text {
		font-size: 24rpx;
		color: #6B7688;
	}

	.ghost-text--danger {
		color: #C25B58;
	}

	.primary-btn {
		flex: 1;
		height: 76rpx;
		background: #6EA0F7;
		border-radius: 38rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.primary-text {
		font-size: 28rpx;
		color: #fff;
		font-weight: 600;
	}

	/* 状态 */
	.state-box {
		background: #fff;
		border-radius: 16rpx;
		padding: 60rpx 40rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 40rpx;
	}

	.state-title {
		font-size: 28rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.state-desc {
		font-size: 22rpx;
		color: #8A94A6;
		margin-top: 12rpx;
		text-align: center;
		line-height: 34rpx;
	}

	.state-btn {
		margin-top: 24rpx;
		background: #6EA0F7;
		color: #fff;
		font-size: 24rpx;
		border-radius: 30rpx;
		padding: 0 40rpx;
		line-height: 60rpx;
	}

	.skeleton-wrap {
		margin-top: 8rpx;
	}

	.skeleton {
		background: linear-gradient(90deg, #EEF2F8 25%, #F7F9FC 37%, #EEF2F8 63%);
		border-radius: 16rpx;
		margin-bottom: 16rpx;
	}

	.skeleton--hero {
		height: 260rpx;
	}

	.skeleton--card {
		height: 300rpx;
	}

	.bottom-space {
		height: 40rpx;
	}
</style>
