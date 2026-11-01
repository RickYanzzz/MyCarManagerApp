<template>
	<view class="fu-page">
		<view class="fu-hero">
			<view class="fu-hero-item">
				<text class="fu-hero-num">{{ counts.pending }}</text>
				<text class="fu-hero-label">待回访</text>
			</view>
			<view class="fu-hero-line"></view>
			<view class="fu-hero-item">
				<text class="fu-hero-num">{{ counts.sent }}</text>
				<text class="fu-hero-label">已发送</text>
			</view>
			<view class="fu-hero-line"></view>
			<view class="fu-hero-item">
				<text class="fu-hero-num">{{ counts.converted }}</text>
				<text class="fu-hero-label">已到店</text>
			</view>
		</view>

		<view class="fu-tabs">
			<view class="fu-tab" v-for="tab in tabs" :key="tab.key"
				:class="{ active: status === tab.key }" @click="switchTab(tab.key)">
				<text>{{ tab.label }}</text>
				<text class="fu-tab-count" v-if="counts[tab.countKey]">{{ counts[tab.countKey] }}</text>
			</view>
		</view>

		<view class="fu-toolbar">
			<text class="fu-toolbar-tip">规则每日 08:00 自动扫描，也可手动刷新</text>
			<button class="fu-scan-btn" size="mini" :loading="scanning" @click="scan">刷新名单</button>
		</view>

		<scroll-view class="fu-list" scroll-y="true" refresher-enabled
			:refresher-triggered="refreshing" @refresherrefresh="onRefresh">
			<view class="fu-card" v-for="item in list" :key="item._id">
				<view class="fu-card-head">
					<view class="fu-who">
						<text class="fu-name">{{ item.contactName || '客户' }}</text>
						<text class="fu-rule">{{ item.ruleLabel }}</text>
						<text class="fu-plate" v-if="item.factSnapshot && item.factSnapshot.car && item.factSnapshot.car.车牌尾号">
							尾号 {{ item.factSnapshot.car.车牌尾号 }}
						</text>
					</view>
					<text class="fu-priority" :class="priorityClass(item.priority)">P{{ item.priority }}</text>
				</view>

				<view class="fu-reason">
					<text>{{ item.reason }}</text>
				</view>

				<view class="fu-phone" @click="callCustomer(item)" v-if="item.contactPhone">
					<text>{{ item.contactPhone }}</text>
					<text class="fu-phone-action">拨号</text>
				</view>

				<view class="fu-script" v-if="item.script">
					<text class="fu-script-text">{{ item.script.fullText }}</text>
					<view class="fu-script-meta">
						<text>{{ item.script.source === 'ai' ? 'AI 生成' : '模板生成' }}</text>
						<text v-if="item.script.riskFlags && item.script.riskFlags.length" class="fu-warn">
							已降级：{{ item.script.riskFlags[0] }}
						</text>
					</view>
				</view>

				<view class="fu-actions">
					<button class="fu-btn ghost" size="mini" v-if="!item.script" :loading="loadingId === item._id"
						@click="generate(item, false)">生成话术</button>
					<block v-else>
						<button class="fu-btn primary" size="mini" @click="copyAndWechat(item)">复制并去微信</button>
						<button class="fu-btn ghost" size="mini" :loading="loadingId === item._id"
							@click="generate(item, true)">换个说法</button>
					</block>
					<button class="fu-btn ghost" size="mini" v-if="item.status === 'pending' || item.status === 'generated'"
						@click="mark(item, 'sent')">已发送</button>
					<button class="fu-btn ghost" size="mini" v-if="item.status === 'pending' || item.status === 'generated'"
						@click="mark(item, 'ignored')">忽略</button>
				</view>
			</view>

			<view class="fu-empty" v-if="!loading && !list.length">
				<text class="fu-empty-title">{{ emptyText }}</text>
				<text class="fu-empty-desc">点上方「刷新名单」按当前经营数据重新扫描</text>
				<text class="fu-empty-debug" v-if="status === 'open'" @click="diagnose">为什么没有人？点这里诊断</text>
			</view>
			<view class="fu-loading" v-if="loading">
				<text>加载中...</text>
			</view>
			<view class="fu-bottom-space"></view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				status: 'open',
				all: [],
				list: [],
				page: 1,
				pageSize: 20,
				loading: false,
				scanning: false,
				diagnosing: false,
				refreshing: false,
				loadingId: '',
				tabs: [
					{ key: 'open', label: '待回访', countKey: 'pending' },
					{ key: 'sent', label: '已发送', countKey: 'sent' },
					{ key: 'converted', label: '已到店', countKey: 'converted' },
					{ key: 'ignored', label: '已忽略', countKey: 'ignored' }
				]
			}
		},
		computed: {
			counts() {
				const c = { pending: 0, sent: 0, converted: 0, ignored: 0 }
				this.all.forEach(item => {
					if (item.status === 'pending' || item.status === 'generated') c.pending++
					else if (c[item.status] !== undefined) c[item.status]++
				})
				return c
			},
			emptyText() {
				if (this.status === 'open') return '今天没有需要回访的客户'
				if (this.status === 'sent') return '还没有发出过话术'
				if (this.status === 'converted') return '还没有标记到店的客户'
				return '没有忽略过的任务'
			}
		},
		onLoad() {
			this.loadData()
		},
		onShow() {
			if (this.all.length) this.loadData()
		},
		methods: {
			loadData() {
				if (this.loading) return
				this.loading = true
				this.$api.followup_list({
					status: 'all',
					page: 1,
					pageSize: 200
				}).then(res => {
					this.all = (res.data && res.data.list) || []
					this.applyFilter()
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					this.loading = false
				})
			},
			applyFilter() {
				this.page = 1
				if (this.status === 'open') {
					this.list = this.all.filter(i => i.status === 'pending' || i.status === 'generated')
				} else {
					this.list = this.all.filter(i => i.status === this.status)
				}
			},
			switchTab(key) {
				this.status = key
				this.applyFilter()
			},
			onRefresh() {
				this.refreshing = true
				this.loadData()
				setTimeout(() => { this.refreshing = false }, 600)
			},
			scan() {
				if (this.scanning) return
				this.scanning = true
				this.$api.followup_scan({}).then(res => {
					const created = (res.data && res.data.created) || 0
					uni.showToast({
						title: created ? `新增 ${created} 条待回访` : '暂无新的回访机会',
						icon: 'none'
					})
					this.loadData()
					// 扫不出人时直接给诊断，避免"看起来坏了"
					if (!created) setTimeout(() => this.diagnose(), 800)
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg)) || '扫描失败',
						icon: 'none'
					})
				}).finally(() => {
					this.scanning = false
				})
			},
			diagnose() {
				if (this.diagnosing) return
				this.diagnosing = true
				uni.showLoading({ title: '诊断中...' })
				this.$api.followup_debug({
					action: 'diagnose'
				}).then(res => {
					const d = res.data || {}
					const c = d.counts || {}
					const lines = []
					lines.push(`会员 ${c.member} · 车辆 ${c.car} · 订单 ${c.order} · 次卡 ${c.memberCardItem}`)
					lines.push(`已有任务 ${c.followupTask} · 话术 ${c.followupScript}`)
					;(d.rules || []).forEach(r => {
						const keys = Object.keys(r.blocked || {})
						keys.sort((a, b) => r.blocked[b] - r.blocked[a])
						const top = keys.length ? `${keys[0]}×${r.blocked[keys[0]]}` : ''
						lines.push(`${r.code} ${r.label}：可触发 ${r.eligible}${top ? '｜卡点 ' + top : ''}`)
					})
					if (d.model && !d.model.hasKey) lines.push('未配模型 Key，话术走模板')
					;(d.hints || []).slice(0, 2).forEach(h => lines.push('· ' + h))
					uni.hideLoading()
					uni.showModal({
						title: '回访诊断',
						content: lines.join('\n'),
						showCancel: false,
						confirmText: '知道了'
					})
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						title: (err && (err.message || err.msg)) || '诊断失败：检查 followup_debug 是否已部署',
						icon: 'none'
					})
				}).finally(() => {
					this.diagnosing = false
				})
			},
			generate(item, regenerate) {
				if (this.loadingId) return
				this.loadingId = item._id
				this.$api.followup_generate({
					taskId: item._id,
					regenerate: !!regenerate,
					tone: 'warm'
				}).then(res => {
					const script = res.data && res.data.script
					if (script) {
						item.script = script
						if (item.status === 'pending') item.status = 'generated'
					}
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg)) || '生成失败',
						icon: 'none'
					})
				}).finally(() => {
					this.loadingId = ''
				})
			},
			copyAndWechat(item) {
				if (!item.script) return
				uni.setClipboardData({
					data: item.script.fullText,
					success: () => {
						this.mark(item, 'wechat', true)
						// #ifdef APP-PLUS
						plus.runtime.openURL('weixin://')
						// #endif
						// #ifndef APP-PLUS
						uni.showModal({
							title: '话术已复制',
							content: '打开微信，粘贴发送给客户即可',
							showCancel: false
						})
						// #endif
					}
				})
			},
			callCustomer(item) {
				if (!item.contactPhone) return
				uni.makePhoneCall({
					phoneNumber: item.contactPhone,
					fail: () => {}
				})
			},
			mark(item, action, silent) {
				this.$api.followup_mark({
					taskId: item._id,
					action: action
				}).then(res => {
					const next = (res.data && res.data.status) || item.status
					item.status = next
					if (!silent) {
						uni.showToast({ title: action === 'sent' ? '已标记发送' : '已忽略', icon: 'none' })
					}
					if (this.status === 'open') this.applyFilter()
				}).catch(err => {
					if (!silent) {
						uni.showToast({
							title: (err && (err.message || err.msg)) || '操作失败',
							icon: 'none'
						})
					}
				})
			},
			priorityClass(priority) {
				if (priority >= 85) return 'high'
				if (priority >= 60) return 'mid'
				return 'low'
			}
		}
	}
</script>

<style lang="scss">
	.fu-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: #F4F8FB;
	}

	.fu-hero {
		display: flex;
		align-items: center;
		justify-content: space-around;
		margin: 20rpx 24rpx 12rpx;
		padding: 28rpx 0;
		background-color: #6EA0F7;
		border-radius: 16rpx;
	}

	.fu-hero-item {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.fu-hero-num {
		color: #ffffff;
		font-size: 44rpx;
		font-weight: 600;
	}

	.fu-hero-label {
		color: #E8F0FE;
		font-size: 24rpx;
		margin-top: 6rpx;
	}

	.fu-hero-line {
		width: 1px;
		height: 56rpx;
		background-color: rgba(255, 255, 255, 0.35);
	}

	.fu-tabs {
		display: flex;
		margin: 8rpx 24rpx 0;
		background-color: #ffffff;
		border-radius: 12rpx;
		padding: 8rpx;
	}

	.fu-tab {
		flex: 1;
		text-align: center;
		padding: 14rpx 0;
		font-size: 26rpx;
		color: #6B7280;
		border-radius: 8rpx;
	}

	.fu-tab.active {
		background-color: #EAF1FE;
		color: #3F72C8;
		font-weight: 600;
	}

	.fu-tab-count {
		margin-left: 6rpx;
		font-size: 22rpx;
	}

	.fu-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 30rpx 8rpx;
	}

	.fu-toolbar-tip {
		font-size: 22rpx;
		color: #9AA4B2;
	}

	.fu-scan-btn {
		background-color: #ffffff;
		color: #3F72C8;
		font-size: 24rpx;
		border: 1px solid #D6E2F8;
	}

	.fu-list {
		flex: 1;
		padding: 0 24rpx;
		box-sizing: border-box;
	}

	.fu-card {
		background-color: #ffffff;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-bottom: 20rpx;
	}

	.fu-card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.fu-who {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
	}

	.fu-name {
		font-size: 30rpx;
		font-weight: 600;
		color: #1F2937;
		margin-right: 12rpx;
	}

	.fu-rule {
		font-size: 22rpx;
		color: #3F72C8;
		background-color: #EAF1FE;
		padding: 4rpx 12rpx;
		border-radius: 6rpx;
		margin-right: 8rpx;
	}

	.fu-plate {
		font-size: 22rpx;
		color: #6B7280;
		background-color: #F3F4F6;
		padding: 4rpx 12rpx;
		border-radius: 6rpx;
	}

	.fu-priority {
		font-size: 22rpx;
		padding: 4rpx 10rpx;
		border-radius: 6rpx;
	}

	.fu-priority.high {
		color: #B42318;
		background-color: #FEE4E2;
	}

	.fu-priority.mid {
		color: #B54708;
		background-color: #FEF0C7;
	}

	.fu-priority.low {
		color: #475467;
		background-color: #F2F4F7;
	}

	.fu-reason {
		margin-top: 14rpx;
		font-size: 26rpx;
		color: #475467;
		line-height: 1.6;
	}

	.fu-phone {
		margin-top: 12rpx;
		display: flex;
		align-items: center;
		font-size: 24rpx;
		color: #6B7280;
	}

	.fu-phone-action {
		margin-left: 12rpx;
		color: #3F72C8;
	}

	.fu-script {
		margin-top: 18rpx;
		padding: 20rpx;
		background-color: #F7FAFF;
		border: 1px solid #E3ECFB;
		border-radius: 12rpx;
	}

	.fu-script-text {
		font-size: 27rpx;
		color: #1F2937;
		line-height: 1.7;
	}

	.fu-script-meta {
		margin-top: 10rpx;
		display: flex;
		flex-wrap: wrap;
		font-size: 21rpx;
		color: #9AA4B2;
	}

	.fu-warn {
		margin-left: 12rpx;
		color: #B54708;
	}

	.fu-actions {
		margin-top: 20rpx;
		display: flex;
		flex-wrap: wrap;
	}

	.fu-btn {
		margin: 0 16rpx 12rpx 0;
		font-size: 24rpx;
		border-radius: 10rpx;
	}

	.fu-btn.primary {
		background-color: #6EA0F7;
		color: #ffffff;
	}

	.fu-btn.ghost {
		background-color: #F3F6FC;
		color: #3F72C8;
	}

	.fu-empty {
		padding: 120rpx 40rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.fu-empty-title {
		font-size: 28rpx;
		color: #6B7280;
	}

	.fu-empty-desc {
		margin-top: 12rpx;
		font-size: 23rpx;
		color: #9AA4B2;
	}

	.fu-empty-debug {
		margin-top: 20rpx;
		font-size: 24rpx;
		color: #6EA0F7;
		text-decoration: underline;
	}

	.fu-loading {
		padding: 30rpx;
		text-align: center;
		font-size: 24rpx;
		color: #9AA4B2;
	}

	.fu-bottom-space {
		height: 40rpx;
	}
</style>
