<template>
	<view class="page">

		<!-- 日期切换 -->
		<view class="date-card">
			<view class="date-row">
				<view class="arrow-btn" @click="shiftDate(-1)"><text class="arrow-text">‹</text></view>
				<picker mode="date" :value="date" @change="onPickDate" class="date-picker">
					<view class="date-center">
						<text class="date-big">{{ dateText }}</text>
						<text class="date-sub">{{ dateSub }}</text>
					</view>
				</picker>
				<view class="arrow-btn" @click="shiftDate(1)"><text class="arrow-text">›</text></view>
			</view>
			<view class="date-quick">
				<view class="quick-chip" :class="{ 'quick-chip--on': isToday }" @click="goToday">
					<text class="quick-text" :class="{ 'quick-text--on': isToday }">今天</text>
				</view>
				<view class="quick-chip" :class="{ 'quick-chip--on': isTomorrow }" @click="goTomorrow">
					<text class="quick-text" :class="{ 'quick-text--on': isTomorrow }">明天</text>
				</view>
				<view class="quick-spacer"></view>
				<text class="quick-hint">{{ config.openLabel }}-{{ config.closeLabel }} · {{ config.slotMinutes }}分/档</text>
			</view>
		</view>

		<!-- 加载 / 异常 -->
		<view v-if="loading" class="skeleton-wrap">
			<view class="skeleton skeleton--bar"></view>
			<view class="skeleton skeleton--grid"></view>
			<view class="skeleton skeleton--grid"></view>
		</view>

		<view v-else-if="error" class="state-box">
			<text class="state-title">排班表加载失败</text>
			<text class="state-desc">{{ error }}</text>
			<button class="state-btn" @click="loadData(true)">重新加载</button>
		</view>

		<block v-else>
			<!-- 当日概览 -->
			<view class="summary">
				<view class="summary-item">
					<text class="summary-value">{{ summary.total }}</text>
					<text class="summary-label">当日预约</text>
				</view>
				<view class="summary-divider"></view>
				<view class="summary-item">
					<text class="summary-value summary-value--blue">{{ summary.booked }}</text>
					<text class="summary-label">待到店</text>
				</view>
				<view class="summary-divider"></view>
				<view class="summary-item">
					<text class="summary-value summary-value--orange">{{ summary.working }}</text>
					<text class="summary-label">施工中</text>
				</view>
				<view class="summary-divider"></view>
				<view class="summary-item">
					<text class="summary-value summary-value--green">{{ summary.done }}</text>
					<text class="summary-label">已完成</text>
				</view>
				<view class="summary-divider"></view>
				<view class="summary-item">
					<text class="summary-value">{{ freeSlotCount }}</text>
					<text class="summary-label">空闲档</text>
				</view>
			</view>

			<!-- 工位容量 -->
			<view v-if="summary.bayCount > 0" class="bay-bar" :class="{ 'bay-bar--full': summary.bayFullCount > 0 }">
				<text class="bay-dot" :class="{ 'bay-dot--full': summary.bayFullCount > 0 }"></text>
				<text class="bay-text" :class="{ 'bay-text--full': summary.bayFullCount > 0 }">{{ bayText }}</text>
			</view>

			<!-- 冲突提醒 -->
			<view v-if="summary.conflictPairs > 0" class="warn-bar">
				<text class="warn-text">发现 {{ summary.conflictPairs }} 处时段重叠，已用红点标出，请调整师傅或时间</text>
			</view>

			<!-- 还没标记师傅 -->
			<view v-if="!hasTechnicianFlag" class="tip-bar">
				<text class="tip-text">还没有标记哪些员工是师傅，当前把全店 {{ staffCount }} 位员工都列进了排班表。</text>
				<view class="tip-btn" @click="markAllTechnicians">
					<text class="tip-btn-text">全店员工加入排班</text>
				</view>
			</view>

			<!-- 视图切换 -->
			<view class="tab-bar">
				<view class="tab" :class="{ 'tab--on': view === 'board' }" @click="view = 'board'">
					<text class="tab-text" :class="{ 'tab-text--on': view === 'board' }">时间表</text>
				</view>
				<view class="tab" :class="{ 'tab--on': view === 'list' }" @click="view = 'list'">
					<text class="tab-text" :class="{ 'tab-text--on': view === 'list' }">清单 {{ appointments.length }}</text>
				</view>
				<view class="tab-spacer"></view>
				<view class="add-btn" @click="createNew">
					<text class="add-text">+ 新预约</text>
				</view>
			</view>

			<!-- 师傅筛选 -->
			<scroll-view v-if="technicians.length > 1" scroll-x class="filter-scroll">
				<view class="filter-row">
					<view class="filter-chip" :class="{ 'filter-chip--on': !filterTechId }" @click="setFilter('')">
						<text class="filter-text" :class="{ 'filter-text--on': !filterTechId }">全部师傅</text>
					</view>
					<view v-for="t in technicians" :key="t._id" class="filter-chip"
						:class="{ 'filter-chip--on': filterTechId === t._id }" @click="setFilter(t._id)">
						<view class="filter-dot" :style="{ backgroundColor: t.color }"></view>
						<text class="filter-text" :class="{ 'filter-text--on': filterTechId === t._id }">{{ t.name }}</text>
					</view>
				</view>
			</scroll-view>

			<!-- 时间表 -->
			<view v-if="view === 'board'" class="board-card">
				<view v-if="!visibleTechnicians.length" class="state-box state-box--inline">
					<text class="state-title">暂无可排班的师傅</text>
					<text class="state-desc">请先在员工管理中启用账号，并标记为师傅</text>
				</view>
				<view v-else class="board">
					<view class="staff-col">
						<view class="staff-head">
							<text class="staff-head-text">师傅 / 时段</text>
						</view>
						<view v-for="t in visibleTechnicians" :key="t._id" class="staff-cell">
							<view class="staff-dot" :style="{ backgroundColor: t.color }"></view>
							<view class="staff-info">
								<text class="staff-name">{{ t.name }}</text>
								<text class="staff-meta">{{ staffMeta(t._id) }}</text>
							</view>
						</view>
					</view>

					<scroll-view scroll-x class="grid-scroll" :style="{ height: gridHeight + 'rpx' }" :scroll-left="scrollLeft">
						<view class="grid" :style="{ width: gridWidth + 'rpx' }">
							<view class="head-row">
								<view v-for="s in slots" :key="s.index" class="head-cell" :style="{ width: slotW + 'rpx' }">
									<text class="head-text">{{ s.label }}</text>
								</view>
							</view>
							<view v-for="t in visibleTechnicians" :key="t._id" class="row" :style="{ height: rowH + 'rpx' }">
								<view v-for="s in slots" :key="s.index" class="cell" :style="{ width: slotW + 'rpx' }"
									:class="{ 'cell--now': isCurrentSlot(s) }" @click="tapCell(t, s)"></view>
								<view v-for="a in rowAppointments(t._id)" :key="a._id" class="block" :style="blockStyle(a)"
									@click.stop="openDetail(a)">
									<view class="block-bar" :style="{ backgroundColor: statusColor(a.status) }"></view>
									<view class="block-body">
										<view class="block-title-row">
											<text v-if="a.startsBeforeDay" class="block-tag">续</text>
											<text class="block-title">{{ a.customerName || '未填客户' }}</text>
										</view>
										<text class="block-sub">{{ itemText(a) }}</text>
										<text class="block-time">{{ blockTimeText(a) }}</text>
									</view>
									<view v-if="a.hasConflict" class="block-flag"></view>
								</view>
							</view>
						</view>
					</scroll-view>
				</view>

				<view class="board-foot">
					<view class="legend">
						<view class="legend-item">
							<view class="legend-dot" style="background:#6EA0F7"></view><text class="legend-text">待到店</text>
						</view>
						<view class="legend-item">
							<view class="legend-dot" style="background:#F2B36B"></view><text class="legend-text">施工中</text>
						</view>
						<view class="legend-item">
							<view class="legend-dot" style="background:#7EC8B8"></view><text class="legend-text">已完成</text>
						</view>
						<view class="legend-item">
							<view class="legend-dot" style="background:#E58B8B"></view><text class="legend-text">未到店</text>
						</view>
					</view>
					<text class="board-hint">左右滑动看全天，点空白格直接排单；「续」表示前一天未完工、今天继续的单</text>
				</view>
			</view>

			<!-- 清单 -->
			<view v-else class="list-wrap">
				<view v-if="!listAppointments.length" class="state-box">
					<text class="state-title">这一天还没有预约</text>
					<text class="state-desc">点右上角「+ 新预约」为师傅排第一单</text>
				</view>
				<view v-for="a in listAppointments" :key="a._id" class="list-card" @click="openDetail(a)">
					<view class="list-left" :style="{ backgroundColor: statusColor(a.status) }">
						<text class="list-time">{{ a.startsBeforeDay ? '续' : a.startTimeText }}</text>
						<text class="list-duration">{{ a.duration }}分钟</text>
					</view>
					<view class="list-main">
						<view class="list-top">
							<text class="list-name">{{ a.customerName || '未填客户' }}</text>
							<text class="list-status" :style="{ color: statusColor(a.status) }">{{ a.statusText }}</text>
						</view>
						<view class="list-row">
							<text class="list-label">项目</text>
							<text class="list-value">{{ itemText(a) }}</text>
						</view>
						<view class="list-row">
							<text class="list-label">师傅</text>
							<text class="list-value">{{ a.technicianName }}</text>
							<text v-if="a.carNumber" class="list-car">{{ a.carNumber }}</text>
						</view>
						<view v-if="a.crossDay" class="list-row">
							<text class="list-label">时间</text>
							<text class="list-value list-value--dim">{{ a.boardTimeText }}</text>
						</view>
						<view v-if="summary.bayCount > 0" class="list-row">
							<text class="list-label">工位</text>
							<text class="list-value list-value--dim">{{ a.bayNo ? a.bayNo + ' 号位' : '未分配' }}</text>
						</view>
						<view v-if="a.remark" class="list-row">
							<text class="list-label">备注</text>
							<text class="list-value list-value--dim">{{ a.remark }}</text>
						</view>
					</view>
					<view v-if="a.hasConflict" class="list-conflict">冲突</view>
				</view>
			</view>

			<view class="bottom-space"></view>
		</block>

	</view>
</template>

<script>
	import {
		todayKey,
		shiftDayKey,
		shortDateLabel,
		relativeDateLabel,
		beijingParts,
		STATUS_COLOR
	} from '@/common/utils/schedule.js'

	export default {
		data() {
			return {
				date: todayKey(),
				view: 'board',
				loading: true,
				error: '',
				loaded: false,
				config: {
					openLabel: '08:00',
					closeLabel: '19:00',
					slotMinutes: 60,
					openMinutes: 480
				},
				slots: [],
				technicians: [],
				appointments: [],
				goods: [],
				summary: {
					total: 0,
					booked: 0,
					working: 0,
					done: 0,
					cancelled: 0,
					noShow: 0,
					crossDayCount: 0,
					conflictPairs: 0,
					bayCount: 0,
					bayPeak: 0,
					bayPeakLabel: '',
					bayFullCount: 0,
					bayFullLabels: []
				},
				hasTechnicianFlag: true,
				staffCount: 0,
				filterTechId: '',
				scrollLeft: 0,
				slotW: 118,
				rowH: 112,
				headH: 56
			}
		},
		computed: {
			dateText() {
				return shortDateLabel(this.date)
			},
			dateSub() {
				const rel = relativeDateLabel(this.date)
				return rel === this.dateText ? '' : rel
			},
			isToday() {
				return this.date === todayKey()
			},
			isTomorrow() {
				return this.date === shiftDayKey(todayKey(), 1)
			},
			visibleTechnicians() {
				if (!this.filterTechId) return this.technicians
				return this.technicians.filter(t => t._id === this.filterTechId)
			},
			gridWidth() {
				return this.slots.length * this.slotW
			},
			gridHeight() {
				return this.headH + this.visibleTechnicians.length * this.rowH
			},
			freeSlotCount() {
				const total = this.visibleTechnicians.length * this.slots.length
				const used = this.appointments.filter(a => a.visible && (a.status === 0 || a.status === 1))
					.reduce((sum, a) => sum + Math.max(1, a.clippedSpan || a.spanSlots), 0)
				return Math.max(0, total - used)
			},
			bayText() {
				const s = this.summary
				const total = s.bayCount || 0
				if (!total) return ''
				if (s.bayFullCount > 0) {
					const labels = (s.bayFullLabels || []).slice(0, 2).join('、')
					const more = s.bayFullCount > 2 ? ' 等 ' + s.bayFullCount + ' 个时段' : ''
					return '工位 ' + total + ' 个，' + labels + more + ' 已排满'
				}
				const peak = s.bayPeak || 0
				if (!peak) return '工位 ' + total + ' 个 · 今日未占用'
				return '工位 ' + total + ' 个 · 今日峰值 ' + peak + (s.bayPeakLabel ? ' · ' + s.bayPeakLabel : '')
			},
			listAppointments() {
				const list = this.appointments.slice()
				list.sort((a, b) => Number(a.startTime) - Number(b.startTime))
				return list.map(a => {
					const p = beijingParts(a.startTime)
					const hh = p ? (p.minutesOfDay / 60) : 0
					const h = Math.floor(hh)
					const m = p ? p.minutesOfDay % 60 : 0
					return Object.assign({}, a, {
						startTimeText: (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m)
					})
				})
			}
		},
		onLoad() {
			this.loadData(true)
		},
		onShow() {
			// 从新建/详情返回后刷新，保证状态与占用时段是最新的
			if (this.loaded) this.loadData(false)
		},
		methods: {
			loadData(showLoading) {
				const that = this
				if (showLoading) {
					this.loading = true
					this.error = ''
				}
				this.$api.get_appointment_board({ date: this.date }).then(res => {
					const d = (res && res.data) || {}
					that.config = d.config || that.config
					that.slots = d.slots || []
					that.technicians = d.technicians || []
					that.appointments = d.appointments || []
					that.goods = d.goods || []
					that.summary = d.summary || that.summary
					that.hasTechnicianFlag = d.hasTechnicianFlag !== false
					that.staffCount = d.staffCount || 0
					that.loading = false
					that.loaded = true
					that.error = ''
					that.$nextTick(() => {
						that.scrollToWorkTime()
					})
				}).catch(err => {
					that.loading = false
					that.loaded = true
					that.error = (err && (err.message || err.errMsg)) || '请检查网络后重试'
				})
			},
			scrollToWorkTime() {
				if (this.slots.length === 0) return
				let slotIndex = 0
				if (this.isToday()) {
					const p = beijingParts(Date.now())
					if (p) {
						const idx = Math.floor((p.minutesOfDay - this.config.openMinutes) / this.config.slotMinutes)
						if (idx > 0) slotIndex = Math.max(0, idx - 1)
					}
				}
				// scroll-left 用 px，rpx 需要换算；再留出一点左内边距
				const px = uni.upx2px(this.slotW) * slotIndex
				this.scrollLeft = this.scrollLeft === px ? px + 1 : px
			},
			shiftDate(offset) {
				const next = shiftDayKey(this.date, offset)
				if (!next) return
				this.date = next
				this.scrollLeft = 0
				this.loadData(true)
			},
			onPickDate(e) {
				const value = e && e.detail && e.detail.value
				if (!value || value === this.date) return
				this.date = value
				this.scrollLeft = 0
				this.loadData(true)
			},
			goToday() {
				if (this.isToday) return
				this.date = todayKey()
				this.scrollLeft = 0
				this.loadData(true)
			},
			goTomorrow() {
				if (this.isTomorrow) return
				this.date = shiftDayKey(todayKey(), 1)
				this.scrollLeft = 0
				this.loadData(true)
			},
			setFilter(id) {
				this.filterTechId = this.filterTechId === id ? '' : id
				this.$nextTick(() => {
					this.scrollLeft = 0
				})
			},
			tapCell(technician, slot) {
				uni.navigateTo({
					url: '/pages/appointment/edit?date=' + this.date +
						'&technicianId=' + technician._id +
						'&startMinutes=' + slot.startMinutes
				})
			},
			createNew() {
				uni.navigateTo({
					url: '/pages/appointment/edit?date=' + this.date
				})
			},
			openDetail(a) {
				uni.navigateTo({
					url: '/pages/appointment/detail?id=' + a._id
				})
			},
			rowAppointments(technicianId) {
				return this.appointments.filter(a =>
					a.technicianId === technicianId && a.visible && Number(a.status) !== 3
				)
			},
			blockStyle(a) {
				const span = Math.max(1, a.clippedSpan || a.spanSlots || 1)
				return {
					left: (a.startSlot * this.slotW + 4) + 'rpx',
					width: (span * this.slotW - 10) + 'rpx',
					top: '6rpx',
					height: (this.rowH - 12) + 'rpx'
				}
			},
			blockTimeText(a) {
				let text = a.boardTimeText || a.timeRangeText || ''
				const span = Math.max(1, a.clippedSpan || a.spanSlots || 1)
				// 单格太窄，工位号放不下，留给清单视图看
				if (a.bayNo && span >= 2) text += ' · ' + a.bayNo + '号位'
				return text
			},
			statusColor(status) {
				return STATUS_COLOR[Number(status)] || '#8A94A6'
			},
			itemText(a) {
				const items = a.items || []
				if (!items.length) return '未填项目'
				const text = items.map(it => it.name).join('、')
				return text
			},
			staffMeta(technicianId) {
				const list = this.appointments.filter(a => a.technicianId === technicianId && Number(a.status) !== 3)
				if (!list.length) return '今日空闲'
				const minutes = list.filter(a => a.status === 0 || a.status === 1)
					.reduce((sum, a) => {
						// 跨天单只算落在当天的部分，否则一个通宵单会把工时算成 16 小时
						if (a.crossDay) return sum + Math.max(1, a.clippedSpan || 0) * this.config.slotMinutes
						return sum + (a.duration || 0)
					}, 0)
				const hours = Math.round(minutes / 30) / 2
				return list.length + '单 · ' + hours + 'h'
			},
			isCurrentSlot(slot) {
				if (!this.isToday()) return false
				const p = beijingParts(Date.now())
				if (!p) return false
				return p.minutesOfDay >= slot.startMinutes && p.minutesOfDay < slot.endMinutes
			},
			markAllTechnicians() {
				const that = this
				uni.showModal({
					title: '加入排班',
					content: '把全店 ' + this.staffCount + ' 位员工都标记为师傅？之后可以在员工资料里单独调整。',
					success(res) {
						if (!res.confirm) return
						that.$api.set_technician({ value: true }).then(() => {
							uni.showToast({ title: '已加入排班', icon: 'none' })
							that.loadData(true)
						}).catch(err => {
							uni.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
						})
					}
				})
			}
		}
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background-color: #F4F8FB;
		padding: 20rpx 20rpx 0;
		box-sizing: border-box;
	}

	/* 日期 */
	.date-card {
		background: #fff;
		border-radius: 16rpx;
		padding: 20rpx 24rpx 16rpx;
		box-shadow: 0 4rpx 16rpx rgba(110, 160, 247, 0.08);
	}

	.date-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.arrow-btn {
		width: 64rpx;
		height: 64rpx;
		border-radius: 32rpx;
		background: #F4F8FB;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.arrow-text {
		font-size: 36rpx;
		color: #6EA0F7;
		line-height: 36rpx;
	}

	.date-picker {
		flex: 1;
	}

	.date-center {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.date-big {
		font-size: 34rpx;
		font-weight: 600;
		color: #2C405A;
	}

	.date-sub {
		font-size: 22rpx;
		color: #8A94A6;
		margin-top: 4rpx;
	}

	.date-quick {
		display: flex;
		align-items: center;
		margin-top: 16rpx;
	}

	.quick-chip {
		padding: 6rpx 20rpx;
		border-radius: 20rpx;
		background: #F4F8FB;
		margin-right: 12rpx;
	}

	.quick-chip--on {
		background: #E8F0FE;
	}

	.quick-text {
		font-size: 22rpx;
		color: #6B7688;
	}

	.quick-text--on {
		color: #4A7FDB;
		font-weight: 600;
	}

	.quick-spacer {
		flex: 1;
	}

	.quick-hint {
		font-size: 20rpx;
		color: #A4ADBD;
	}

	/* 概览 */
	.summary {
		display: flex;
		align-items: center;
		background: #fff;
		border-radius: 16rpx;
		margin-top: 16rpx;
		padding: 20rpx 0;
		box-shadow: 0 4rpx 16rpx rgba(110, 160, 247, 0.06);
	}

	.summary-item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.summary-value {
		font-size: 34rpx;
		font-weight: 600;
		color: #2C405A;
	}

	.summary-value--blue {
		color: #6EA0F7;
	}

	.summary-value--orange {
		color: #F2B36B;
	}

	.summary-value--green {
		color: #4FAF98;
	}

	.summary-label {
		font-size: 20rpx;
		color: #8A94A6;
		margin-top: 4rpx;
	}

	.summary-divider {
		width: 1px;
		height: 44rpx;
		background: #EEF1F6;
	}

	/* 工位容量 */
	.bay-bar {
		display: flex;
		align-items: center;
		background: #EEF5FF;
		border-radius: 12rpx;
		padding: 12rpx 20rpx;
		margin-top: 16rpx;
	}

	.bay-bar--full {
		background: #FFF8EC;
	}

	.bay-dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 6rpx;
		background: #6EA0F7;
		margin-right: 10rpx;
		flex-shrink: 0;
	}

	.bay-dot--full {
		background: #F2B36B;
	}

	.bay-text {
		font-size: 21rpx;
		color: #4A7FDB;
		line-height: 30rpx;
	}

	.bay-text--full {
		color: #A5793A;
	}

	/* 提示条 */
	.warn-bar {
		background: #FDF0EF;
		border-radius: 12rpx;
		padding: 14rpx 20rpx;
		margin-top: 16rpx;
	}

	.warn-text {
		font-size: 22rpx;
		color: #C25B58;
		line-height: 32rpx;
	}

	.tip-bar {
		background: #FFF8EC;
		border-radius: 12rpx;
		padding: 16rpx 20rpx;
		margin-top: 16rpx;
	}

	.tip-text {
		font-size: 22rpx;
		color: #A5793A;
		line-height: 32rpx;
	}

	.tip-btn {
		margin-top: 12rpx;
		align-self: flex-start;
		background: #F2B36B;
		border-radius: 8rpx;
		padding: 8rpx 20rpx;
		display: inline-flex;
	}

	.tip-btn-text {
		font-size: 22rpx;
		color: #fff;
	}

	/* 视图切换 */
	.tab-bar {
		display: flex;
		align-items: center;
		margin-top: 20rpx;
	}

	.tab {
		padding: 10rpx 24rpx;
		border-radius: 24rpx;
		background: #fff;
		margin-right: 12rpx;
	}

	.tab--on {
		background: #6EA0F7;
	}

	.tab-text {
		font-size: 24rpx;
		color: #6B7688;
	}

	.tab-text--on {
		color: #fff;
		font-weight: 600;
	}

	.tab-spacer {
		flex: 1;
	}

	.add-btn {
		background: #6EA0F7;
		border-radius: 24rpx;
		padding: 10rpx 24rpx;
	}

	.add-text {
		font-size: 24rpx;
		color: #fff;
		font-weight: 600;
	}

	/* 筛选 */
	.filter-scroll {
		margin-top: 16rpx;
		white-space: nowrap;
	}

	.filter-row {
		display: flex;
		align-items: center;
	}

	.filter-chip {
		display: flex;
		align-items: center;
		background: #fff;
		border-radius: 22rpx;
		padding: 8rpx 20rpx;
		margin-right: 12rpx;
		flex-shrink: 0;
	}

	.filter-chip--on {
		background: #E8F0FE;
	}

	.filter-dot {
		width: 12rpx;
		height: 12rpx;
		border-radius: 6rpx;
		margin-right: 8rpx;
	}

	.filter-text {
		font-size: 22rpx;
		color: #6B7688;
	}

	.filter-text--on {
		color: #4A7FDB;
		font-weight: 600;
	}

	/* 时间表 */
	.board-card {
		background: #fff;
		border-radius: 16rpx;
		margin-top: 16rpx;
		padding: 16rpx 0 12rpx;
		box-shadow: 0 4rpx 16rpx rgba(110, 160, 247, 0.06);
		overflow: hidden;
	}

	.board {
		display: flex;
		align-items: flex-start;
	}

	.staff-col {
		width: 150rpx;
		flex-shrink: 0;
		border-right: 1px solid #EEF1F6;
		background: #fff;
		z-index: 2;
	}

	.staff-head {
		height: 56rpx;
		display: flex;
		align-items: center;
		padding-left: 16rpx;
		box-sizing: border-box;
		border-bottom: 1px solid #EEF1F6;
	}

	.staff-head-text {
		font-size: 20rpx;
		color: #A4ADBD;
	}

	.staff-cell {
		height: 112rpx;
		display: flex;
		align-items: center;
		padding-left: 12rpx;
		box-sizing: border-box;
		border-bottom: 1px solid #F4F6FA;
	}

	.staff-dot {
		width: 10rpx;
		height: 44rpx;
		border-radius: 6rpx;
		margin-right: 10rpx;
		flex-shrink: 0;
	}

	.staff-info {
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.staff-name {
		font-size: 24rpx;
		color: #2C405A;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.staff-meta {
		font-size: 18rpx;
		color: #A4ADBD;
		margin-top: 4rpx;
		white-space: nowrap;
	}

	.grid-scroll {
		flex: 1;
		white-space: nowrap;
	}

	.grid {
		display: flex;
		flex-direction: column;
	}

	.head-row {
		display: flex;
		height: 56rpx;
		box-sizing: border-box;
		border-bottom: 1px solid #EEF1F6;
	}

	.head-cell {
		display: flex;
		align-items: center;
		justify-content: center;
		border-right: 1px solid #F4F6FA;
		box-sizing: border-box;
	}

	.head-text {
		font-size: 20rpx;
		color: #8A94A6;
	}

	.row {
		position: relative;
		display: flex;
		box-sizing: border-box;
		border-bottom: 1px solid #F4F6FA;
	}

	.cell {
		height: 100%;
		border-right: 1px solid #F4F6FA;
		box-sizing: border-box;
	}

	.cell--now {
		background: #F7FAFF;
	}

	.block {
		position: absolute;
		border-radius: 10rpx;
		background: #F7F9FC;
		border: 1px solid #E8EEF7;
		display: flex;
		overflow: hidden;
		z-index: 3;
	}

	.block-bar {
		width: 6rpx;
		flex-shrink: 0;
	}

	.block-body {
		flex: 1;
		padding: 8rpx 8rpx 6rpx;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.block-title {
		font-size: 22rpx;
		color: #2C405A;
		font-weight: 600;
		line-height: 28rpx;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.block-title-row {
		display: flex;
		align-items: center;
		overflow: hidden;
	}

	.block-tag {
		flex-shrink: 0;
		font-size: 16rpx;
		line-height: 22rpx;
		color: #fff;
		background: #B9A7F0;
		border-radius: 6rpx;
		padding: 0 6rpx;
		margin-right: 6rpx;
	}

	.block-sub {
		font-size: 18rpx;
		color: #7B8598;
		line-height: 24rpx;
		margin-top: 2rpx;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.block-time {
		font-size: 18rpx;
		color: #A4ADBD;
		line-height: 24rpx;
		margin-top: auto;
	}

	.block-flag {
		position: absolute;
		top: 6rpx;
		right: 6rpx;
		width: 12rpx;
		height: 12rpx;
		border-radius: 6rpx;
		background: #E58B8B;
	}

	.board-foot {
		margin-top: 12rpx;
		padding: 0 16rpx;
	}

	.legend {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		margin-right: 20rpx;
		margin-bottom: 6rpx;
	}

	.legend-dot {
		width: 10rpx;
		height: 10rpx;
		border-radius: 5rpx;
		margin-right: 6rpx;
	}

	.legend-text {
		font-size: 18rpx;
		color: #8A94A6;
	}

	.board-hint {
		font-size: 18rpx;
		color: #A4ADBD;
	}

	/* 清单 */
	.list-wrap {
		margin-top: 16rpx;
	}

	.list-card {
		display: flex;
		background: #fff;
		border-radius: 16rpx;
		margin-bottom: 16rpx;
		overflow: hidden;
		position: relative;
		box-shadow: 0 4rpx 16rpx rgba(110, 160, 247, 0.06);
	}

	.list-left {
		width: 130rpx;
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24rpx 0;
	}

	.list-time {
		font-size: 30rpx;
		color: #fff;
		font-weight: 600;
	}

	.list-duration {
		font-size: 18rpx;
		color: rgba(255, 255, 255, 0.9);
		margin-top: 6rpx;
	}

	.list-main {
		flex: 1;
		padding: 20rpx 24rpx;
		overflow: hidden;
	}

	.list-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.list-name {
		font-size: 28rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.list-status {
		font-size: 22rpx;
		font-weight: 600;
	}

	.list-row {
		display: flex;
		align-items: center;
		margin-top: 8rpx;
	}

	.list-label {
		font-size: 20rpx;
		color: #A4ADBD;
		width: 60rpx;
		flex-shrink: 0;
	}

	.list-value {
		font-size: 22rpx;
		color: #55607A;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.list-value--dim {
		color: #8A94A6;
	}

	.list-car {
		font-size: 18rpx;
		color: #4A7FDB;
		background: #E8F0FE;
		border-radius: 6rpx;
		padding: 2rpx 8rpx;
		margin-left: 12rpx;
	}

	.list-conflict {
		position: absolute;
		top: 0;
		right: 0;
		background: #E58B8B;
		color: #fff;
		font-size: 18rpx;
		padding: 4rpx 12rpx;
		border-bottom-left-radius: 10rpx;
	}

	/* 状态 */
	.state-box {
		background: #fff;
		border-radius: 16rpx;
		padding: 60rpx 40rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 16rpx;
	}

	.state-box--inline {
		padding: 40rpx 20rpx;
		margin-top: 0;
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

	/* 骨架屏 */
	.skeleton-wrap {
		margin-top: 16rpx;
	}

	.skeleton {
		background: linear-gradient(90deg, #EEF2F8 25%, #F7F9FC 37%, #EEF2F8 63%);
		border-radius: 16rpx;
		margin-bottom: 16rpx;
	}

	.skeleton--bar {
		height: 120rpx;
	}

	.skeleton--grid {
		height: 320rpx;
	}

	.bottom-space {
		height: 60rpx;
	}
</style>
