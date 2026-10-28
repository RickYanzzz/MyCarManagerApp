<template>
	<view class="analytics-page">

		<!-- 时间段切换 -->
		<view class="range-bar">
			<view v-for="item in rangeOptions" :key="item" class="range-item" :class="{ 'range-item--active': item === range }"
				@click="onSwitchRange(item)">
				<text class="range-text" :class="{ 'range-text--active': item === range }">{{ item }}天</text>
			</view>
		</view>

		<!-- 加载态 -->
		<view v-if="status === 'loading'" class="skeleton-wrap">
			<view class="skeleton skeleton--hero"></view>
			<view class="skeleton-row">
				<view class="skeleton skeleton--half"></view>
				<view class="skeleton skeleton--half"></view>
			</view>
			<view class="skeleton skeleton--chart"></view>
			<view class="skeleton skeleton--chart"></view>
		</view>

		<!-- 异常态 -->
		<view v-else-if="status === 'error'" class="state-box">
			<text class="state-title">数据加载失败</text>
			<text class="state-desc">{{ errorMessage || '请检查网络后重试' }}</text>
			<button class="state-btn" @click="loadData">重新加载</button>
		</view>

		<!-- 正常态 -->
		<block v-else>
			<!-- 核心指标 -->
			<view class="hero-card">
				<view class="hero-head">
					<text class="hero-label">已入账订单金额</text>
					<text class="hero-date">{{ dateRangeText }}</text>
				</view>
				<view class="hero-value-row">
					<text class="hero-currency">¥</text>
					<text class="hero-value">{{ totalAmountText }}</text>
				</view>
				<view class="hero-foot">
					<text class="hero-foot-text">其中赠送 ¥{{ giftText }}，未计入上述金额</text>
				</view>
			</view>

			<view class="sub-row">
				<view class="sub-card">
					<text class="sub-label">已入账工单</text>
					<view class="sub-value-row">
						<text class="sub-value">{{ summary.totalOrders }}</text>
						<text class="sub-unit">单</text>
					</view>
				</view>
				<view class="sub-card sub-card--right">
					<text class="sub-label">平均每单</text>
					<view class="sub-value-row">
						<text class="sub-currency">¥</text>
						<text class="sub-value">{{ avgText }}</text>
					</view>
				</view>
			</view>

			<!-- 口径说明 -->
			<view class="notice">
				<text class="notice-title">统计口径</text>
				<text class="notice-item">· 仅统计「已入账」订单，按订单最后一次状态变更时间归集到北京时间自然日</text>
				<text class="notice-item">· 该时间为结算时间的近似值，订单后续被修改状态时会随之变动</text>
				<text class="notice-item">· 本页展示的是「已入账订单金额」，不等于实际到账金额</text>
				<text class="notice-item">· 赠送金额不计入，系统无退款与成本数据，故不展示毛利/净利</text>
			</view>

			<!-- 空数据 -->
			<view v-if="isEmpty" class="state-box state-box--inline">
				<text class="state-title">该时间段暂无已入账订单</text>
				<text class="state-desc">换个时间段看看，或先在「消费开单」中完成结算</text>
			</view>

			<block v-else>
				<!-- 每日收入趋势 -->
				<view class="chart-card">
					<view class="chart-head">
						<text class="chart-title">每日收入趋势</text>
						<text class="chart-sub">单位：元</text>
					</view>
					<view class="chart-body">
						<qiun-data-charts :key="'line-' + range" type="line" :chartData="lineData" :opts="optsLine"
							canvasId="analyticsLine" :canvas2d="true" :ontouch="true" :animation="true" />
					</view>
				</view>

				<!-- 每日工单数量 -->
				<view class="chart-card">
					<view class="chart-head">
						<text class="chart-title">每日工单数量</text>
						<text class="chart-sub">单位：单</text>
					</view>
					<view class="chart-body">
						<qiun-data-charts :key="'column-' + range" type="column" :chartData="columnData" :opts="optsColumn"
							canvasId="analyticsColumn" :canvas2d="true" :ontouch="true" :animation="true" />
					</view>
				</view>

				<!-- 收款方式占比 -->
				<view class="chart-card">
					<view class="chart-head">
						<text class="chart-title">收款方式占比</text>
						<text class="chart-sub">按金额</text>
					</view>
					<view class="chart-body chart-body--ring">
						<qiun-data-charts v-if="hasRingData" :key="'ring-' + range" type="ring" :chartData="ringData"
							:opts="optsRing" canvasId="analyticsRing" :canvas2d="true" :ontouch="true" :animation="true" />
						<view v-else class="chart-empty">
							<text class="chart-empty-text">暂无收款记录</text>
						</view>
					</view>
					<view v-if="hasRingData" class="type-list">
						<view v-for="item in payTypeList" :key="item.type" class="type-item">
							<view class="type-dot" :style="{ backgroundColor: item.color }"></view>
							<text class="type-name">{{ item.label }}</text>
							<text class="type-amount">¥{{ item.amountText }}</text>
							<text class="type-ratio">{{ item.ratioText }}</text>
						</view>
					</view>
				</view>
			</block>

			<!-- 数据来源提示（模拟数据时可见） -->
			<view v-if="isMock" class="mock-tip">
				<text class="mock-tip-text">当前为本地模拟数据（云函数未部署），非门店真实经营数据</text>
			</view>

			<view class="bottom-space"></view>
		</block>

	</view>
</template>

<script>
	const RING_COLORS = ['#6EA0F7', '#7EC8B8', '#F2B36B', '#B9A7F0', '#8A94A6', '#E58B8B']

	export default {
		data() {
			return {
				range: 7,
				rangeOptions: [7, 30, 90],
				status: 'loading',
				errorMessage: '',
				isMock: false,
				dateRangeText: '',
				summary: {
					totalAmount: 0,
					totalOrders: 0,
					avgPerOrder: 0,
					giftAmount: 0
				},
				daily: [],
				payTypes: [],
				lineData: { categories: [], series: [] },
				columnData: { categories: [], series: [] },
				ringData: { series: [{ data: [] }] },
				optsLine: {
					color: ['#6EA0F7'],
					padding: [15, 16, 0, 6],
					dataLabel: false,
					dataPointShape: false,
					enableScroll: false,
					legend: { show: false },
					xAxis: {
						disableGrid: true,
						fontColor: '#8A94A6',
						fontSize: 10,
						itemCount: 6,
						axisLineColor: '#E6EAF2'
					},
					yAxis: {
						gridType: 'dash',
						dashLength: 3,
						gridColor: '#EEF1F6',
						data: [{ min: 0, fontColor: '#8A94A6', fontSize: 10, axisLineColor: 'rgba(0,0,0,0)' }]
					},
					extra: {
						line: { type: 'curve', width: 2, activeType: 'hollow' }
					}
				},
				optsColumn: {
					color: ['#7EC8B8'],
					padding: [15, 16, 0, 6],
					dataLabel: false,
					legend: { show: false },
					xAxis: {
						disableGrid: true,
						fontColor: '#8A94A6',
						fontSize: 10,
						itemCount: 6,
						axisLineColor: '#E6EAF2'
					},
					yAxis: {
						gridType: 'dash',
						dashLength: 3,
						gridColor: '#EEF1F6',
						data: [{ min: 0, fontColor: '#8A94A6', fontSize: 10, axisLineColor: 'rgba(0,0,0,0)' }]
					},
					extra: {
						column: { type: 'group', activeBgColor: '#6EA0F7', activeBgOpacity: 0.1, linearType: 'none' }
					}
				},
				optsRing: {
					color: RING_COLORS,
					padding: [8, 8, 8, 8],
					dataLabel: false,
					legend: {
						show: false
					},
					extra: {
						ring: {
							ringWidth: 26,
							activeOpacity: 0.5,
							activeRadius: 8,
							offsetAngle: -90,
							border: true,
							borderWidth: 3,
							borderColor: '#FFFFFF'
						}
					}
				}
			}
		},
		computed: {
			totalAmountText() {
				return this.formatMoney(this.summary.totalAmount)
			},
			avgText() {
				return this.formatMoney(this.summary.avgPerOrder)
			},
			giftText() {
				return this.formatMoney(this.summary.giftAmount)
			},
			isEmpty() {
				return this.summary.totalOrders === 0 && this.summary.totalAmount === 0
			},
			hasRingData() {
				return (this.payTypes || []).some((item) => {
					return !item.isGift && Number(item.amount) > 0
				})
			},
			payTypeList() {
				const list = (this.payTypes || []).filter((item) => !item.isGift && Number(item.amount) > 0)
				const total = list.reduce((acc, item) => acc + Number(item.amount), 0)
				return list.map((item, index) => {
					const ratio = total > 0 ? (Number(item.amount) / total) * 100 : 0
					return {
						type: item.type,
						label: item.label,
						amountText: this.formatMoney(item.amount),
						ratioText: ratio.toFixed(1) + '%',
						color: RING_COLORS[index % RING_COLORS.length]
					}
				})
			}
		},
		onLoad() {
			this.loadData()
		},
		onPullDownRefresh() {
			this.loadData(true)
		},
		methods: {
			onSwitchRange(value) {
				if (this.range === value) return
				this.range = value
				this.loadData()
			},

			loadData(isPullRefresh) {
				const that = this
				// 切换时间段时展示骨架屏；下拉刷新保留旧数据，避免页面跳动
				if (!isPullRefresh) {
					this.status = 'loading'
				}
				this.errorMessage = ''

				this.$api.get_analytics_summary({ range: this.range })
					.then((res) => {
						that.applyResult(res && res.data ? res.data : {})
						that.status = 'ready'
						if (isPullRefresh) {
							uni.stopPullDownRefresh()
						}
					})
					.catch((err) => {
						console.error('[analytics] 加载失败', err)
						that.status = 'error'
						that.errorMessage = (err && (err.message || err.errMsg)) || '云函数调用失败'
						if (isPullRefresh) {
							uni.stopPullDownRefresh()
						}
					})
			},

			applyResult(data) {
				this.summary = data.summary || {
					totalAmount: 0,
					totalOrders: 0,
					avgPerOrder: 0,
					giftAmount: 0
				}
				this.daily = data.daily || []
				this.payTypes = data.payTypes || []
				this.isMock = !!data.mock
				this.dateRangeText = data.startDate && data.endDate ? data.startDate + ' 至 ' + data.endDate : ''
				this.buildCharts()
			},

			buildCharts() {
				const daily = this.daily || []
				const categories = daily.map((item) => this.formatShortDate(item.date))
				const amounts = daily.map((item) => Number(item.amount) || 0)
				const orders = daily.map((item) => Number(item.orders) || 0)

				this.lineData = {
					categories: categories,
					series: [{ name: '收入', data: amounts }]
				}
				this.columnData = {
					categories: categories,
					series: [{ name: '工单', data: orders }]
				}
				this.ringData = {
					series: [{
						data: (this.payTypes || [])
							.filter((item) => !item.isGift && Number(item.amount) > 0)
							.map((item) => {
								return { name: item.label, value: Number(item.amount) }
							})
					}]
				}
			},

			formatShortDate(dateStr) {
				if (!dateStr) return ''
				return dateStr.length >= 10 ? dateStr.slice(5) : dateStr
			},

			formatMoney(value) {
				const num = Number(value)
				if (!isFinite(num)) return '0.00'
				const fixed = num.toFixed(2)
				const parts = fixed.split('.')
				parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
				return parts.join('.')
			}
		}
	}
</script>

<style lang="scss" scoped>
	.analytics-page {
		min-height: 100vh;
		background-color: #F4F8FB;
		padding: 24rpx 24rpx 0 24rpx;
		box-sizing: border-box;
	}

	/* 时间段切换 */
	.range-bar {
		display: flex;
		flex-direction: row;
		background-color: #FFFFFF;
		border-radius: 16rpx;
		padding: 8rpx;
		border: 1rpx solid #EDF1F7;
	}

	.range-item {
		flex: 1;
		height: 68rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 12rpx;
	}

	.range-item--active {
		background-color: #6EA0F7;
	}

	.range-text {
		font-size: 26rpx;
		color: #7A8496;
	}

	.range-text--active {
		color: #FFFFFF;
		font-weight: 500;
	}

	/* 主指标卡 */
	.hero-card {
		margin-top: 24rpx;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 28rpx 28rpx 24rpx 28rpx;
		border: 1rpx solid #EDF1F7;
	}

	.hero-head {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
	}

	.hero-label {
		font-size: 26rpx;
		color: #7A8496;
	}

	.hero-date {
		font-size: 22rpx;
		color: #A8B0BE;
	}

	.hero-value-row {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		margin-top: 12rpx;
	}

	.hero-currency {
		font-size: 30rpx;
		color: #2B3445;
		margin-right: 6rpx;
	}

	.hero-value {
		font-size: 60rpx;
		font-weight: 500;
		color: #2B3445;
		line-height: 1.2;
	}

	.hero-foot {
		margin-top: 12rpx;
	}

	.hero-foot-text {
		font-size: 22rpx;
		color: #A8B0BE;
	}

	/* 次级指标 */
	.sub-row {
		display: flex;
		flex-direction: row;
		margin-top: 20rpx;
	}

	.sub-card {
		flex: 1;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 24rpx;
		border: 1rpx solid #EDF1F7;
	}

	.sub-card--right {
		margin-left: 20rpx;
	}

	.sub-label {
		font-size: 24rpx;
		color: #7A8496;
	}

	.sub-value-row {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		margin-top: 10rpx;
	}

	.sub-value {
		font-size: 42rpx;
		font-weight: 500;
		color: #2B3445;
	}

	.sub-unit {
		font-size: 22rpx;
		color: #A8B0BE;
		margin-left: 6rpx;
	}

	.sub-currency {
		font-size: 24rpx;
		color: #2B3445;
		margin-right: 4rpx;
	}

	/* 口径说明 */
	.notice {
		margin-top: 20rpx;
		background-color: #EEF4FE;
		border-radius: 16rpx;
		padding: 22rpx 24rpx;
	}

	.notice-title {
		font-size: 24rpx;
		color: #4A7FD4;
		font-weight: 500;
	}

	.notice-item {
		display: block;
		font-size: 22rpx;
		color: #6E7B8F;
		line-height: 1.7;
		margin-top: 4rpx;
	}

	/* 图表卡 */
	.chart-card {
		margin-top: 20rpx;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 24rpx 16rpx 20rpx 16rpx;
		border: 1rpx solid #EDF1F7;
	}

	.chart-head {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		justify-content: space-between;
		padding: 0 8rpx 12rpx 8rpx;
	}

	.chart-title {
		font-size: 28rpx;
		font-weight: 500;
		color: #2B3445;
	}

	.chart-sub {
		font-size: 22rpx;
		color: #A8B0BE;
	}

	.chart-body {
		width: 100%;
		height: 420rpx;
	}

	.chart-body--ring {
		height: 380rpx;
	}

	.chart-empty {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.chart-empty-text {
		font-size: 24rpx;
		color: #A8B0BE;
	}

	/* 收款方式明细 */
	.type-list {
		padding: 12rpx 8rpx 0 8rpx;
	}

	.type-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		height: 56rpx;
	}

	.type-dot {
		width: 14rpx;
		height: 14rpx;
		border-radius: 4rpx;
		margin-right: 12rpx;
	}

	.type-name {
		flex: 1;
		font-size: 24rpx;
		color: #5B6472;
	}

	.type-amount {
		font-size: 24rpx;
		color: #2B3445;
		margin-right: 16rpx;
	}

	.type-ratio {
		font-size: 22rpx;
		color: #8A94A6;
		width: 90rpx;
		text-align: right;
	}

	/* 状态 */
	.state-box {
		margin-top: 24rpx;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		padding: 60rpx 32rpx;
		border: 1rpx solid #EDF1F7;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.state-box--inline {
		margin-top: 20rpx;
		padding: 50rpx 32rpx;
	}

	.state-title {
		font-size: 28rpx;
		color: #2B3445;
		font-weight: 500;
	}

	.state-desc {
		font-size: 24rpx;
		color: #8A94A6;
		margin-top: 12rpx;
		text-align: center;
		line-height: 1.6;
	}

	.state-btn {
		margin-top: 28rpx;
		background-color: #6EA0F7;
		color: #FFFFFF;
		font-size: 26rpx;
		border-radius: 12rpx;
		padding: 0 44rpx;
		height: 68rpx;
		line-height: 68rpx;
	}

	/* 骨架屏 */
	.skeleton-wrap {
		margin-top: 24rpx;
	}

	.skeleton {
		background-color: #E9EEF7;
		border-radius: 20rpx;
	}

	.skeleton--hero {
		height: 240rpx;
	}

	.skeleton-row {
		display: flex;
		flex-direction: row;
		margin-top: 20rpx;
	}

	.skeleton--half {
		flex: 1;
		height: 150rpx;
	}

	.skeleton--half + .skeleton--half {
		margin-left: 20rpx;
	}

	.skeleton--chart {
		height: 420rpx;
		margin-top: 20rpx;
	}

	/* 模拟数据提示 */
	.mock-tip {
		margin-top: 20rpx;
		padding: 18rpx 24rpx;
		background-color: #FFF7E8;
		border-radius: 16rpx;
	}

	.mock-tip-text {
		font-size: 22rpx;
		color: #B07D2B;
	}

	.bottom-space {
		height: 60rpx;
	}
</style>
