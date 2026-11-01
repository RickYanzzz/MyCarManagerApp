<template>
	<view class="page">

		<!-- 师傅 -->
		<view class="section">
			<view class="section-head">
				<text class="section-title">师傅</text>
				<text class="section-sub">选中后下方会提示该时段是否空闲</text>
			</view>
			<scroll-view scroll-x class="tech-scroll">
				<view class="tech-row">
					<view v-for="t in technicians" :key="t._id" class="tech-chip"
						:class="{ 'tech-chip--on': form.technicianId === t._id }" @click="pickTech(t)">
						<view class="tech-dot" :style="{ backgroundColor: t.color }"></view>
						<text class="tech-name" :class="{ 'tech-name--on': form.technicianId === t._id }">{{ t.name }}</text>
						<text class="tech-free" :class="{ 'tech-free--on': form.technicianId === t._id }">{{ freeText(t._id) }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 时间 -->
		<view class="section">
			<view class="row">
				<text class="label">日期</text>
				<picker mode="date" :value="form.date" @change="onDateChange" class="row-picker">
					<view class="value-wrap">
						<text class="value">{{ form.date }}</text>
						<text class="value-sub">{{ dateText }}</text>
					</view>
				</picker>
			</view>
			<view class="divider"></view>
			<view class="row">
				<text class="label">开始</text>
				<picker mode="selector" :range="startLabels" :value="startIndex" @change="onStartChange" class="row-picker">
					<view class="value-wrap">
						<text class="value">{{ startLabel }}</text>
						<text class="value-sub">每 {{ config.startAlignMinutes }} 分钟一档</text>
					</view>
				</picker>
			</view>
			<view class="divider"></view>
			<view class="row row--wrap">
				<text class="label">时长</text>
				<view class="dur-row">
					<view v-for="d in durationOptions" :key="d" class="dur-chip"
						:class="{ 'dur-chip--on': form.duration === d }" @click="setDuration(d)">
						<text class="dur-text" :class="{ 'dur-text--on': form.duration === d }">{{ d }}分</text>
					</view>
				</view>
			</view>
			<view class="end-row">
				<text class="end-text">占用时段 {{ startLabel }} - {{ endTimeText }}</text>
			</view>
			<view class="divider divider--gap"></view>
			<view class="row row--wrap">
				<text class="label">工位</text>
				<view v-if="bayInfo.limited" class="bay-row">
					<view v-for="n in bayInfo.bayCount" :key="n" class="bay-chip"
						:class="{ 'bay-chip--on': effectiveBay === n, 'bay-chip--busy': isBayBusy(n) }"
						@click="pickBay(n)">
						<text class="bay-chip-text" :class="{ 'bay-chip-text--on': effectiveBay === n, 'bay-chip-text--busy': isBayBusy(n) }">{{ n }}</text>
					</view>
					<text class="bay-hint">{{ bayHint }}</text>
				</view>
				<text v-else class="bay-hint">未启用工位限制</text>
			</view>
		</view>

		<!-- 工位排满 -->
		<view v-if="bayInfo.full" class="conflict-bar">
			<text class="conflict-title">工位已排满</text>
			<text class="conflict-text">该时段 {{ bayInfo.bayCount }} 个工位都被占用了，请换时间，或在 app_config 里调整工位数</text>
		</view>

		<!-- 冲突提示 -->
		<view v-if="conflictList.length" class="conflict-bar">
			<text class="conflict-title">时间冲突</text>
			<text class="conflict-text">{{ conflictText }}</text>
		</view>

		<!-- 客户 -->
		<view class="section">
			<view class="section-head">
				<text class="section-title">客户</text>
				<text class="section-link" @click="toggleSearch">{{ useSearch ? '手动填写' : '搜索会员' }}</text>
			</view>

			<block v-if="useSearch">
				<view class="search-row">
					<input class="search-input" v-model="keyword" placeholder="输入姓名 / 手机号 / 卡号" confirm-type="search"
						@input="onKeywordInput" />
				</view>
				<view v-if="memberList.length" class="result-list">
					<view v-for="m in memberList" :key="m._id" class="result-item" @click="pickMember(m)">
						<view class="result-main">
							<text class="result-name">{{ m.name }}</text>
							<text class="result-phone">{{ m.phone }}</text>
						</view>
						<text class="result-card">{{ m.cardNo }}</text>
					</view>
				</view>
				<text v-else-if="keyword" class="empty-tip">没有匹配的会员，可切到「手动填写」</text>
				<text v-else class="empty-tip">输入关键字搜索会员；散客可直接手动填写</text>
			</block>

			<block v-else>
				<view class="row">
					<text class="label">姓名</text>
					<input class="input" v-model="form.customerName" placeholder="客户姓名" />
				</view>
				<view class="row">
					<text class="label">电话</text>
					<input class="input" v-model="form.customerPhone" type="number" placeholder="联系电话" />
				</view>
			</block>

			<view v-if="selectedMember" class="picked-member">
				<text class="picked-name">{{ selectedMember.name }}</text>
				<text class="picked-phone">{{ selectedMember.phone }}</text>
				<text class="picked-clear" @click="clearMember">清除</text>
			</view>

			<view class="divider"></view>

			<view v-if="carOptions.length" class="row">
				<text class="label">车辆</text>
				<picker mode="selector" :range="carLabels" :value="carIndex" @change="onCarChange" class="row-picker">
					<view class="value-wrap">
						<text class="value">{{ carLabel }}</text>
						<text class="value-sub">开单时会用到</text>
					</view>
				</picker>
			</view>
			<view v-else class="row">
				<text class="label">车牌</text>
				<input class="input" v-model="form.carNumber" placeholder="可留空，到店再登记" />
			</view>
		</view>

		<!-- 项目 -->
		<view class="section">
			<view class="section-head">
				<text class="section-title">预约项目</text>
				<text class="section-sub">选中后自动累加预计时长</text>
			</view>
			<view v-if="goods.length" class="goods-grid">
				<view v-for="g in goods" :key="g._id" class="goods-chip"
					:class="{ 'goods-chip--on': isGoodsOn(g._id) }" @click="toggleGoods(g)">
					<text class="goods-name" :class="{ 'goods-name--on': isGoodsOn(g._id) }">{{ g.name }}</text>
					<text class="goods-meta" :class="{ 'goods-meta--on': isGoodsOn(g._id) }">¥{{ g.fee }} · {{ g.duration }}分</text>
				</view>
			</view>
			<text v-else class="empty-tip">还没有服务项目，可先在「消费开单」里维护项目价格</text>
		</view>

		<!-- 备注 -->
		<view class="section">
			<view class="section-head">
				<text class="section-title">备注</text>
			</view>
			<textarea class="remark" v-model="form.remark" placeholder="客户诉求、是否需要接送车等" maxlength="200" />
		</view>

		<view class="bottom-space"></view>

		<!-- 底部操作 -->
		<view class="bottom-bar">
			<view class="bottom-info">
				<text class="bottom-time">{{ form.date }} {{ startLabel }}-{{ endTimeText }}</text>
				<text class="bottom-tech">{{ techName || '未选师傅' }}</text>
			</view>
			<view class="save-btn" :class="{ 'save-btn--disabled': !canSubmit }" @click="submit">
				<text class="save-text">{{ form.id ? '保存修改' : '确认预约' }}</text>
			</view>
		</view>

	</view>
</template>

<script>
	import {
		todayKey,
		shortDateLabel,
		dayStartFromKey,
		beijingParts,
		hhmm,
		endLabelOf,
		buildStartOptions,
		normalizeConfig,
		findConflicts,
		bayPlan,
		DEFAULT_CONFIG
	} from '@/common/utils/schedule.js'

	export default {
		data() {
			return {
				form: {
					id: '',
					date: todayKey(),
					technicianId: '',
					startMinutes: DEFAULT_CONFIG.openMinutes,
					duration: 60,
					memberId: '',
					carInfoId: '',
					customerName: '',
					customerPhone: '',
					carNumber: '',
					bayNo: 0,
					items: [],
					remark: ''
				},
				config: normalizeConfig(DEFAULT_CONFIG),
				technicians: [],
				goods: [],
				appointments: [],
				durationOptions: [30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720],
				useSearch: true,
				keyword: '',
				memberList: [],
				selectedMember: null,
				vehicles: [],
				carIndex: 0,
				durationTouched: false,
				submitting: false,
				searchTimer: null
			}
		},
		computed: {
			dateText() {
				return shortDateLabel(this.form.date)
			},
			startOptions() {
				return buildStartOptions(this.config)
			},
			startLabels() {
				return this.startOptions.map(o => o.label)
			},
			startIndex() {
				let best = 0
				let min = Infinity
				this.startOptions.forEach((o, i) => {
					const diff = Math.abs(o.minutes - this.form.startMinutes)
					if (diff < min) {
						min = diff
						best = i
					}
				})
				return best
			},
			startLabel() {
				const opt = this.startOptions[this.startIndex]
				return opt ? opt.label : hhmm(this.form.startMinutes)
			},
			endTimeText() {
				return endLabelOf(this.form.startMinutes, this.form.duration)
			},
			startTimeTs() {
				const dayStart = dayStartFromKey(this.form.date)
				if (isNaN(dayStart)) return NaN
				return dayStart + this.form.startMinutes * 60 * 1000
			},
			techName() {
				const t = this.technicians.find(item => item._id === this.form.technicianId)
				return t ? t.name : ''
			},
			conflictList() {
				if (!this.form.technicianId || isNaN(this.startTimeTs)) return []
				return findConflicts(this.appointments, {
					technicianId: this.form.technicianId,
					startTime: this.startTimeTs,
					duration: this.form.duration,
					excludeId: this.form.id
				})
			},
			conflictText() {
				return this.conflictList
					.map(a => (a.timeRangeText || '') + ' ' + (a.customerName || '客户'))
					.join('、') + '，请更换时间或师傅'
			},
			/** 工位占用：与师傅无关，按全店同一时段统计 */
			bayInfo() {
				return bayPlan(this.appointments, {
					startTime: this.startTimeTs,
					duration: this.form.duration,
					excludeId: this.form.id
				}, this.config)
			},
			effectiveBay() {
				const info = this.bayInfo
				if (!info.limited) return 0
				// 0 表示交给系统自动补空位，展示时用推荐值
				return this.form.bayNo || info.suggestedBay
			},
			bayHint() {
				const info = this.bayInfo
				if (!info.limited) return ''
				if (info.full) return '已排满'
				if (this.form.bayNo) return this.form.bayNo + ' 号位（手动指定）'
				return info.suggestedBay + ' 号位（自动）'
			},
			carOptions() {
				if (this.form.memberId) {
					return this.vehicles.filter(v => v.memberId === this.form.memberId)
				}
				if (this.form.carInfoId) {
					return this.vehicles.filter(v => v._id === this.form.carInfoId)
				}
				return []
			},
			carLabels() {
				return this.carOptions.map(v => this.carLabelOf(v))
			},
			carLabel() {
				const v = this.carOptions[this.carIndex]
				return v ? this.carLabelOf(v) : '未选择'
			},
			canSubmit() {
				if (this.submitting) return false
				if (!this.form.technicianId) return false
				if (this.conflictList.length) return false
				if (this.bayInfo.full) return false
				if (this.form.memberId || this.form.carInfoId) return true
				return !!String(this.form.customerName || '').trim()
			}
		},
		onLoad(options) {
			const opt = options || {}
			if (opt.date) this.form.date = opt.date
			if (opt.technicianId) this.form.technicianId = opt.technicianId
			if (opt.startMinutes) this.form.startMinutes = parseInt(opt.startMinutes, 10)
			if (opt.id) this.form.id = opt.id
			this.loadVehicles()
			if (opt.id) {
				this.loadDetail(opt.id)
			} else {
				this.loadBoard()
			}
		},
		methods: {
			loadBoard() {
				const that = this
				this.$api.get_appointment_board({ date: this.form.date }).then(res => {
					const d = (res && res.data) || {}
					that.config = normalizeConfig(d.config || DEFAULT_CONFIG)
					that.technicians = d.technicians || []
					that.goods = d.goods || []
					that.appointments = d.appointments || []
					if (!that.form.technicianId && that.technicians.length) {
						that.form.technicianId = that.technicians[0]._id
					}
				}).catch(err => {
					uni.showToast({ title: (err && err.message) || '排班加载失败', icon: 'none' })
				})
			},
			loadDetail(id) {
				const that = this
				uni.showLoading({ title: '加载中...' })
				this.$api.get_appointment_detail({ id: id }).then(res => {
					const d = (res && res.data) || {}
					const a = d.appointment || {}
					that.config = normalizeConfig(d.config || DEFAULT_CONFIG)
					that.form.id = a._id
					that.form.technicianId = a.technicianId || ''
					that.form.duration = a.duration || 60
					that.form.memberId = a.memberId || ''
					that.form.carInfoId = a.carInfoId || ''
					that.form.customerName = a.customerName || ''
					that.form.customerPhone = a.customerPhone || ''
					that.form.carNumber = a.carNumber || ''
					that.form.bayNo = parseInt(a.bayNo, 10) || 0
					that.form.items = (a.items || []).map(it => ({
						goodsId: it.goodsId || '',
						name: it.name,
						fee: it.fee,
						duration: it.duration
					}))
					that.form.remark = a.remark || ''
					that.durationTouched = true

					const p = beijingParts(a.startTime)
					if (p) {
						that.form.startMinutes = p.minutesOfDay
						that.form.date = a.startTime ? that.dateKeyOfTs(a.startTime) : that.form.date
					}
					if (a.memberId) {
						that.selectedMember = {
							_id: a.memberId,
							name: a.customerName || '',
							phone: a.customerPhone || '',
							cardNo: ''
						}
						that.useSearch = false
					}
					that.loadBoardForDate(that.form.date)
					uni.hideLoading()
					that.$nextTick(() => {
						that.syncCarIndex()
					})
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({ title: (err && err.message) || '预约加载失败', icon: 'none' })
				})
			},
			loadBoardForDate(date) {
				const that = this
				this.$api.get_appointment_board({ date: date }).then(res => {
					const d = (res && res.data) || {}
					that.config = normalizeConfig(d.config || that.config)
					that.appointments = d.appointments || []
					if (!that.technicians.length) that.technicians = d.technicians || []
					if (!that.goods.length) that.goods = d.goods || []
				}).catch(() => {})
			},
			loadVehicles() {
				const that = this
				this.$api.get_car_info_list({}).then(res => {
					that.vehicles = (res && res.data) || []
					that.syncCarIndex()
				}).catch(() => {})
			},
			dateKeyOfTs(ts) {
				const p = beijingParts(ts)
				if (!p) return ''
				const pad = n => (n < 10 ? '0' + n : '' + n)
				return p.year + '-' + pad(p.month) + '-' + pad(p.day)
			},
			pickTech(t) {
				this.form.technicianId = t._id
			},
			freeText(technicianId) {
				const busy = this.appointments.filter(a =>
					a.technicianId === technicianId && (Number(a.status) === 0 || Number(a.status) === 1)
				)
				if (!busy.length) return '今日空闲'
				return busy.length + ' 单已排'
			},
			onDateChange(e) {
				const value = e && e.detail && e.detail.value
				if (!value || value === this.form.date) return
				this.form.date = value
				this.loadBoardForDate(value)
			},
			onStartChange(e) {
				const index = parseInt(e && e.detail && e.detail.value, 10) || 0
				const opt = this.startOptions[index]
				if (opt) this.form.startMinutes = opt.minutes
			},
			setDuration(d) {
				this.form.duration = d
				this.durationTouched = true
			},
			isBayBusy(bay) {
				return this.bayInfo.usedBays.indexOf(bay) > -1
			},
			pickBay(bay) {
				if (this.isBayBusy(bay)) {
					uni.showToast({ title: bay + ' 号工位已被占用', icon: 'none' })
					return
				}
				// 再点一次同一个工位 = 退回自动分配
				this.form.bayNo = this.form.bayNo === bay ? 0 : bay
			},
			toggleSearch() {
				this.useSearch = !this.useSearch
			},
			onKeywordInput() {
				const that = this
				if (this.searchTimer) clearTimeout(this.searchTimer)
				this.searchTimer = setTimeout(() => {
					that.searchMembers()
				}, 300)
			},
			searchMembers() {
				const keyword = String(this.keyword || '').trim()
				if (!keyword) {
					this.memberList = []
					return
				}
				const that = this
				this.$api.list_members({ keyword: keyword, pageSize: 10 }).then(res => {
					const d = (res && res.data) || {}
					that.memberList = d.list || []
				}).catch(() => {
					that.memberList = []
				})
			},
			pickMember(m) {
				this.form.memberId = m._id
				this.form.customerName = m.name || ''
				this.form.customerPhone = m.phone || ''
				this.selectedMember = m
				this.useSearch = false
				this.keyword = ''
				this.memberList = []
				this.carIndex = 0
				this.$nextTick(() => {
					this.syncCarIndex()
					if (this.carOptions.length) {
						this.form.carInfoId = this.carOptions[0]._id
						this.form.carNumber = this.carOptions[0].carNumber || ''
					}
				})
			},
			clearMember() {
				this.selectedMember = null
				this.form.memberId = ''
				this.form.carInfoId = ''
			},
			syncCarIndex() {
				const idx = this.carOptions.findIndex(v => v._id === this.form.carInfoId)
				this.carIndex = idx >= 0 ? idx : 0
			},
			onCarChange(e) {
				const index = parseInt(e && e.detail && e.detail.value, 10) || 0
				this.carIndex = index
				const v = this.carOptions[index]
				if (v) {
					this.form.carInfoId = v._id
					this.form.carNumber = v.carNumber || ''
					if (!this.form.customerName && v.owner) this.form.customerName = v.owner
					if (!this.form.customerPhone && v.ownerphone) this.form.customerPhone = v.ownerphone
				}
			},
			carLabelOf(v) {
				if (!v) return ''
				return v.carNumber || '未填车牌'
			},
			isGoodsOn(goodsId) {
				return this.form.items.some(it => it.goodsId === goodsId)
			},
			toggleGoods(g) {
				const idx = this.form.items.findIndex(it => it.goodsId === g._id)
				if (idx >= 0) {
					this.form.items.splice(idx, 1)
				} else {
					this.form.items.push({
						goodsId: g._id,
						name: g.name,
						fee: g.fee,
						duration: g.duration
					})
				}
				// 项目总时长自动累加，只要用户没手动改过时长
				if (!this.durationTouched) {
					const total = this.form.items.reduce((sum, it) => sum + (parseInt(it.duration, 10) || 0), 0)
					if (total > 0) this.form.duration = Math.max(30, Math.ceil(total / 30) * 30)
				}
			},
			submit() {
				if (!this.canSubmit) {
					if (this.bayInfo.full) {
						uni.showToast({ title: '该时段工位已排满', icon: 'none' })
					} else if (this.conflictList.length) {
						uni.showToast({ title: '时段冲突，请调整时间', icon: 'none' })
					} else if (!this.form.technicianId) {
						uni.showToast({ title: '请选择师傅', icon: 'none' })
					} else {
						uni.showToast({ title: '请填写客户姓名', icon: 'none' })
					}
					return
				}
				const that = this
				this.submitting = true
				uni.showLoading({ title: '保存中...', mask: true })
				const payload = {
					id: this.form.id || undefined,
					technicianId: this.form.technicianId,
					startTime: this.startTimeTs,
					duration: this.form.duration,
					memberId: this.form.memberId,
					carInfoId: this.form.carInfoId,
					customerName: this.form.customerName,
					customerPhone: this.form.customerPhone,
					carNumber: this.form.carNumber,
					bayNo: this.form.bayNo,
					items: this.form.items,
					remark: this.form.remark
				}
				this.$api.save_appointment(payload).then(res => {
					uni.hideLoading()
					that.submitting = false
					const warnings = (res && res.data && res.data.warnings) || []
					uni.showToast({ title: that.form.id ? '已保存' : '预约成功', icon: 'success' })
					// 跨天、超出营业时间这类提示不拦保存，但要让人看见
					if (warnings.length) {
						setTimeout(() => {
							uni.showModal({ title: '提醒', content: warnings.join('；'), showCancel: false })
						}, 600)
					}
					setTimeout(() => {
						uni.navigateBack({ delta: 1 })
					}, warnings.length ? 2000 : 600)
				}).catch(err => {
					uni.hideLoading()
					that.submitting = false
					const message = (err && err.message) || (err && err.errMsg) || '保存失败'
					let title = '保存失败'
					if (err && err.bayFull) title = '工位已排满'
					else if (err && err.code === 409) title = '时段已被占用'
					uni.showModal({
						title: title,
						content: message,
						showCancel: false
					})
				})
			}
		}
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background: #F4F8FB;
		padding: 20rpx 20rpx 180rpx;
		box-sizing: border-box;
	}

	.section {
		background: #fff;
		border-radius: 16rpx;
		padding: 24rpx;
		margin-bottom: 16rpx;
		box-shadow: 0 4rpx 16rpx rgba(110, 160, 247, 0.06);
	}

	.section-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.section-title {
		font-size: 28rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.section-sub {
		font-size: 20rpx;
		color: #A4ADBD;
		margin-left: 16rpx;
		flex: 1;
	}

	.section-link {
		font-size: 22rpx;
		color: #4A7FDB;
	}

	/* 师傅 */
	.tech-scroll {
		white-space: nowrap;
	}

	.tech-row {
		display: flex;
		align-items: stretch;
	}

	.tech-chip {
		display: flex;
		flex-direction: column;
		background: #F7F9FC;
		border: 1px solid #E8EEF7;
		border-radius: 12rpx;
		padding: 14rpx 20rpx;
		margin-right: 12rpx;
		flex-shrink: 0;
	}

	.tech-chip--on {
		background: #E8F0FE;
		border-color: #6EA0F7;
	}

	.tech-dot {
		width: 40rpx;
		height: 6rpx;
		border-radius: 3rpx;
		margin-bottom: 10rpx;
	}

	.tech-name {
		font-size: 26rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.tech-name--on {
		color: #3568C4;
	}

	.tech-free {
		font-size: 18rpx;
		color: #A4ADBD;
		margin-top: 6rpx;
	}

	.tech-free--on {
		color: #5B87D6;
	}

	/* 行 */
	.row {
		display: flex;
		align-items: center;
		min-height: 72rpx;
	}

	.row--wrap {
		flex-wrap: wrap;
	}

	.label {
		width: 90rpx;
		font-size: 24rpx;
		color: #8A94A6;
		flex-shrink: 0;
	}

	.row-picker {
		flex: 1;
	}

	.value-wrap {
		display: flex;
		align-items: baseline;
		justify-content: flex-end;
	}

	.value {
		font-size: 26rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.value-sub {
		font-size: 20rpx;
		color: #A4ADBD;
		margin-left: 12rpx;
	}

	.input {
		flex: 1;
		font-size: 26rpx;
		color: #2C405A;
		text-align: right;
	}

	.divider {
		height: 1px;
		background: #F4F6FA;
	}

	.dur-row {
		display: flex;
		flex-wrap: wrap;
		flex: 1;
		justify-content: flex-end;
	}

	.dur-chip {
		padding: 8rpx 18rpx;
		border-radius: 8rpx;
		background: #F7F9FC;
		margin: 4rpx 0 4rpx 10rpx;
	}

	.dur-chip--on {
		background: #6EA0F7;
	}

	.dur-text {
		font-size: 22rpx;
		color: #6B7688;
	}

	.dur-text--on {
		color: #fff;
		font-weight: 600;
	}

	.end-row {
		margin-top: 12rpx;
		background: #F7FAFF;
		border-radius: 10rpx;
		padding: 12rpx 16rpx;
	}

	.end-text {
		font-size: 22rpx;
		color: #4A7FDB;
	}

	.divider--gap {
		margin: 12rpx 0;
	}

	/* 工位 */
	.bay-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		flex: 1;
		justify-content: flex-end;
	}

	.bay-chip {
		width: 64rpx;
		height: 56rpx;
		border-radius: 10rpx;
		background: #F7F9FC;
		border: 1px solid #E8EEF7;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 4rpx 0 4rpx 10rpx;
	}

	.bay-chip--on {
		background: #6EA0F7;
		border-color: #6EA0F7;
	}

	.bay-chip--busy {
		background: #FDF0EF;
		border-color: #F5D6D5;
	}

	.bay-chip-text {
		font-size: 24rpx;
		color: #6B7688;
	}

	.bay-chip-text--on {
		color: #fff;
		font-weight: 600;
	}

	.bay-chip-text--busy {
		color: #C99C9A;
	}

	.bay-hint {
		font-size: 20rpx;
		color: #A4ADBD;
		margin-left: 12rpx;
	}

	/* 冲突 */
	.conflict-bar {
		background: #FDF0EF;
		border-radius: 12rpx;
		padding: 16rpx 20rpx;
		margin-bottom: 16rpx;
	}

	.conflict-title {
		font-size: 24rpx;
		color: #C25B58;
		font-weight: 600;
	}

	.conflict-text {
		display: block;
		font-size: 22rpx;
		color: #C25B58;
		line-height: 32rpx;
		margin-top: 6rpx;
	}

	/* 会员搜索 */
	.search-row {
		background: #F7F9FC;
		border-radius: 10rpx;
		padding: 0 16rpx;
	}

	.search-input {
		height: 72rpx;
		font-size: 24rpx;
		color: #2C405A;
	}

	.result-list {
		margin-top: 8rpx;
	}

	.result-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 4rpx;
		border-bottom: 1px solid #F4F6FA;
	}

	.result-main {
		display: flex;
		align-items: baseline;
	}

	.result-name {
		font-size: 26rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.result-phone {
		font-size: 22rpx;
		color: #8A94A6;
		margin-left: 16rpx;
	}

	.result-card {
		font-size: 18rpx;
		color: #A4ADBD;
	}

	.empty-tip {
		display: block;
		font-size: 22rpx;
		color: #A4ADBD;
		margin-top: 12rpx;
		line-height: 32rpx;
	}

	.picked-member {
		display: flex;
		align-items: center;
		margin-top: 16rpx;
		background: #EEF5FF;
		border-radius: 10rpx;
		padding: 12rpx 16rpx;
	}

	.picked-name {
		font-size: 24rpx;
		color: #3568C4;
		font-weight: 600;
	}

	.picked-phone {
		font-size: 22rpx;
		color: #5B87D6;
		margin-left: 12rpx;
		flex: 1;
	}

	.picked-clear {
		font-size: 22rpx;
		color: #8A94A6;
	}

	/* 项目 */
	.goods-grid {
		display: flex;
		flex-wrap: wrap;
	}

	.goods-chip {
		width: 48%;
		box-sizing: border-box;
		background: #F7F9FC;
		border: 1px solid #E8EEF7;
		border-radius: 12rpx;
		padding: 14rpx 16rpx;
		margin-bottom: 12rpx;
	}

	.goods-chip:nth-child(odd) {
		margin-right: 4%;
	}

	.goods-chip--on {
		background: #E8F0FE;
		border-color: #6EA0F7;
	}

	.goods-name {
		font-size: 24rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.goods-name--on {
		color: #3568C4;
	}

	.goods-meta {
		display: block;
		font-size: 18rpx;
		color: #A4ADBD;
		margin-top: 6rpx;
	}

	.goods-meta--on {
		color: #5B87D6;
	}

	.remark {
		width: 100%;
		height: 140rpx;
		font-size: 24rpx;
		color: #2C405A;
		line-height: 36rpx;
	}

	.bottom-space {
		height: 40rpx;
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

	.bottom-info {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.bottom-time {
		font-size: 24rpx;
		color: #2C405A;
		font-weight: 600;
	}

	.bottom-tech {
		font-size: 20rpx;
		color: #8A94A6;
		margin-top: 4rpx;
	}

	.save-btn {
		background: #6EA0F7;
		border-radius: 40rpx;
		padding: 0 48rpx;
		height: 80rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.save-btn--disabled {
		background: #C7D6EE;
	}

	.save-text {
		font-size: 28rpx;
		color: #fff;
		font-weight: 600;
	}
</style>
