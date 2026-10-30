<template>
	<view class="sp-page">
		<nav-header type="spareParts" :title="part.name || '备件详情'"></nav-header>

		<scroll-view class="sp-scroll" scroll-y="true">
			<view class="sp-card">
				<view class="sp-head">
					<text class="sp-code">{{ part.code }}</text>
					<text class="sp-status" :class="{ danger: isLowStock, disabled: part.status == 0 }">
						{{ part.status == 0 ? '已停用' : (isLowStock ? '库存不足' : '正常') }}
					</text>
				</view>
				<view class="sp-name">{{ part.name }}</view>
				<view class="sp-spec" v-if="part.spec">{{ part.spec }}</view>

				<view class="sp-stock-row">
					<view class="sp-stock-item">
						<text class="sp-stock-num" :class="{ danger: isLowStock }">{{ part.stock }}</text>
						<text class="sp-stock-label">当前库存（{{ part.unit }}）</text>
					</view>
					<view class="sp-stock-item">
						<text class="sp-stock-num">{{ part.safetyStock }}</text>
						<text class="sp-stock-label">安全库存</text>
					</view>
				</view>

				<view class="sp-info-row"><text class="sp-info-label">仓位</text><text>{{ part.location || '-' }}</text></view>
				<view class="sp-info-row"><text class="sp-info-label">供应商</text><text>{{ part.supplier || '-' }}</text></view>
				<view class="sp-info-row"><text class="sp-info-label">成本价</text><text>¥{{ part.costPrice || 0 }}</text></view>
				<view class="sp-info-row"><text class="sp-info-label">销售价</text><text>¥{{ part.salePrice || 0 }}</text></view>
			</view>

			<view class="sp-actions">
				<button class="sp-btn primary" @click="openIn">入库</button>
				<button class="sp-btn" @click="openAdjust">盘点</button>
				<button class="sp-btn" @click="goEdit">编辑</button>
				<button class="sp-btn danger" v-if="part.status != 0" @click="disablePart">停用</button>
				<button class="sp-btn" v-else @click="enablePart">启用</button>
			</view>

			<view class="sp-section-title">出入库流水</view>
			<view class="sp-log-list">
				<view class="sp-log-item" v-for="log in logs" :key="log._id">
					<view class="sp-log-head">
						<text class="sp-log-type" :class="log.type">{{ typeText(log.type) }}</text>
						<text class="sp-log-qty" :class="{ plus: log.type == 'in' || log.type == 'return' || (log.type == 'adjust' && log.qty > 0), minus: log.type == 'out' || (log.type == 'adjust' && log.qty < 0) }">
							{{ formatQty(log) }}
						</text>
					</view>
					<view class="sp-log-meta">
						<text>{{ formatTime(log.createdAt) }}</text>
						<text>{{ log.operatorName || '系统' }}</text>
					</view>
					<view class="sp-log-remark" v-if="log.remark">{{ log.remark }}</view>
				</view>
				<view class="sp-empty" v-if="!logs.length">暂无流水</view>
			</view>
			<view class="sp-bottom-space"></view>
		</scroll-view>

		<uni-popup ref="inPopup" type="center">
			<view class="sp-popup">
				<view class="sp-popup-title">入库</view>
				<view class="sp-popup-row"><text>数量</text><uni-number-box :value="inForm.qty" :min="1" @change="inForm.qty = $event" /></view>
				<view class="sp-popup-row"><text>进价（元）</text><uni-easyinput type="number" v-model="inForm.unitCost" placeholder="默认成本价" /></view>
				<view class="sp-popup-row"><text>供应商</text><uni-easyinput v-model="inForm.supplier" :placeholder="part.supplier || '供应商'" /></view>
				<view class="sp-popup-row"><text>备注</text><uni-easyinput v-model="inForm.remark" placeholder="选填" /></view>
				<view class="sp-popup-btns">
					<button class="sp-btn" @click="closeIn">取消</button>
					<button class="sp-btn primary" @click="submitIn">确认入库</button>
				</view>
			</view>
		</uni-popup>

		<uni-popup ref="adjustPopup" type="center">
			<view class="sp-popup">
				<view class="sp-popup-title">盘点调整</view>
				<view class="sp-popup-row"><text>实际库存</text><uni-number-box :value="adjustForm.actualStock" :min="0" @change="adjustForm.actualStock = $event" /></view>
				<view class="sp-popup-row"><text>备注</text><uni-easyinput v-model="adjustForm.remark" placeholder="盘点原因" /></view>
				<view class="sp-popup-btns">
					<button class="sp-btn" @click="closeAdjust">取消</button>
					<button class="sp-btn primary" @click="submitAdjust">确认调整</button>
				</view>
			</view>
		</uni-popup>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				partId: '',
				part: {},
				logs: [],
				inForm: {
					qty: 1,
					unitCost: '',
					supplier: '',
					remark: ''
				},
				adjustForm: {
					actualStock: 0,
					remark: ''
				}
			}
		},
		computed: {
			isLowStock() {
				return Number(this.part.stock || 0) <= Number(this.part.safetyStock || 0)
			}
		},
		onLoad(options) {
			this.partId = options.id || ''
		},
		onShow() {
			if (this.partId) this.loadData()
		},
		methods: {
			loadData() {
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_spare_part_by_id({
					id: this.partId
				}).then(res => {
					this.part = res.data || {}
					this.logs = res.logs || []
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			typeText(type) {
				const map = {
					in: '入库',
					out: '出库',
					return: '退料',
					adjust: '盘点'
				}
				return map[type] || type
			},
			formatQty(log) {
				const qty = Number(log.qty || 0)
				if (log.type === 'adjust') return (qty > 0 ? '+' : '') + qty
				return (log.type === 'out' ? '-' : '+') + qty
			},
			formatTime(time) {
				if (!time) return ''
				try {
					return this.$commons.formatDate(time)
				} catch (e) {
					return ''
				}
			},
			openIn() {
				this.inForm = {
					qty: 1,
					unitCost: this.part.costPrice || '',
					supplier: this.part.supplier || '',
					remark: ''
				}
				this.$refs.inPopup.open()
			},
			closeIn() {
				this.$refs.inPopup.close()
			},
			submitIn() {
				if (!this.inForm.qty || this.inForm.qty <= 0) {
					return uni.showToast({ title: '请输入入库数量', icon: 'none' })
				}
				this.$api.stock_in_spare_part({
					partId: this.partId,
					qty: this.inForm.qty,
					unitCost: this.inForm.unitCost,
					supplier: this.inForm.supplier,
					remark: this.inForm.remark
				}).then(() => {
					this.closeIn()
					this.loadData()
					uni.showToast({ title: '入库成功', icon: 'none' })
				}).catch(err => {
					uni.showToast({ title: (err && (err.msg || err.errMsg)) || '入库失败', icon: 'none' })
				})
			},
			openAdjust() {
				this.adjustForm = {
					actualStock: Number(this.part.stock || 0),
					remark: ''
				}
				this.$refs.adjustPopup.open()
			},
			closeAdjust() {
				this.$refs.adjustPopup.close()
			},
			submitAdjust() {
				this.$api.adjust_spare_part_stock({
					partId: this.partId,
					actualStock: this.adjustForm.actualStock,
					remark: this.adjustForm.remark
				}).then(() => {
					this.closeAdjust()
					this.loadData()
					uni.showToast({ title: '盘点成功', icon: 'none' })
				}).catch(err => {
					uni.showToast({ title: (err && (err.msg || err.errMsg)) || '盘点失败', icon: 'none' })
				})
			},
			goEdit() {
				uni.navigateTo({
					url: '/pages/spare_parts/edit?id=' + this.partId
				})
			},
			disablePart() {
				uni.showModal({
					title: '停用备件',
					content: '停用后不可再出库，历史流水会保留。确定吗？',
					success: (res) => {
						if (!res.confirm) return
						this.$api.delete_spare_part({
							id: this.partId
						}).then(result => {
							uni.showToast({
								title: result.data && result.data.disabled ? '已停用' : '已删除',
								icon: 'none'
							})
							if (!(result.data && result.data.disabled)) {
								setTimeout(() => uni.navigateBack(), 500)
							} else {
								this.loadData()
							}
						}).catch(err => {
							uni.showToast({ title: (err && (err.msg || err.errMsg)) || '操作失败', icon: 'none' })
						})
					}
				})
			},
			enablePart() {
				this.$api.update_spare_part({
					_id: this.partId,
					status: 1
				}).then(() => {
					this.loadData()
					uni.showToast({ title: '已启用', icon: 'none' })
				}).catch(err => {
					uni.showToast({ title: (err && (err.msg || err.errMsg)) || '操作失败', icon: 'none' })
				})
			}
		}
	}
</script>

<style>
	.sp-page {
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.sp-scroll {
		height: calc(100vh - 88px);
		box-sizing: border-box;
	}

	.sp-card {
		background-color: #ffffff;
		border-radius: 8px;
		margin: 12px;
		padding: 14px;
	}

	.sp-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sp-code {
		font-size: 12px;
		color: #999999;
	}

	.sp-status {
		font-size: 12px;
		color: #52C41A;
		background-color: #F0FFF0;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.sp-status.danger {
		color: #FF4D4F;
		background-color: #FFF1F0;
	}

	.sp-status.disabled {
		color: #999999;
		background-color: #F5F5F5;
	}

	.sp-name {
		margin-top: 8px;
		font-size: 20px;
		font-weight: 600;
		color: #333333;
	}

	.sp-spec {
		margin-top: 4px;
		font-size: 13px;
		color: #999999;
	}

	.sp-stock-row {
		display: flex;
		margin-top: 16px;
	}

	.sp-stock-item {
		flex: 1;
		background-color: #F8FAFF;
		border-radius: 6px;
		padding: 10px;
		margin-right: 10px;
	}

	.sp-stock-item:last-child {
		margin-right: 0;
	}

	.sp-stock-num {
		display: block;
		font-size: 24px;
		font-weight: 600;
		color: #6EA0F7;
	}

	.sp-stock-num.danger {
		color: #FF4D4F;
	}

	.sp-stock-label {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		color: #999999;
	}

	.sp-info-row {
		display: flex;
		justify-content: space-between;
		padding: 10px 0;
		border-bottom: 1px solid #F0F0F0;
		font-size: 14px;
		color: #333333;
	}

	.sp-info-label {
		color: #999999;
	}

	.sp-actions {
		display: flex;
		flex-wrap: wrap;
		margin: 0 12px 12px;
	}

	.sp-btn {
		margin: 0 8px 8px 0;
		min-width: 72px;
		font-size: 13px;
		background-color: #ffffff;
		color: #333333;
		border: 1px solid #E4E7EC;
	}

	.sp-btn.primary {
		background-color: #6EA0F7;
		color: #ffffff;
		border-color: #6EA0F7;
	}

	.sp-btn.danger {
		color: #FF4D4F;
		border-color: #FFD6D6;
	}

	.sp-section-title {
		margin: 6px 14px;
		font-size: 15px;
		font-weight: 600;
		color: #333333;
	}

	.sp-log-list {
		margin: 0 12px;
	}

	.sp-log-item {
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px 14px;
		margin-bottom: 8px;
	}

	.sp-log-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sp-log-type {
		font-size: 13px;
		color: #6EA0F7;
	}

	.sp-log-type.out {
		color: #CC71BF;
	}

	.sp-log-type.return {
		color: #52C41A;
	}

	.sp-log-qty {
		font-size: 16px;
		font-weight: 600;
	}

	.sp-log-qty.plus {
		color: #52C41A;
	}

	.sp-log-qty.minus {
		color: #FF4D4F;
	}

	.sp-log-meta {
		display: flex;
		justify-content: space-between;
		margin-top: 6px;
		font-size: 12px;
		color: #999999;
	}

	.sp-log-remark {
		margin-top: 4px;
		font-size: 12px;
		color: #666666;
	}

	.sp-empty {
		padding: 30px 0;
		text-align: center;
		color: #999999;
		font-size: 14px;
	}

	.sp-bottom-space {
		height: 40px;
	}

	.sp-popup {
		width: 300px;
		background-color: #ffffff;
		border-radius: 10px;
		padding: 18px;
	}

	.sp-popup-title {
		font-size: 17px;
		font-weight: 600;
		color: #333333;
		text-align: center;
		margin-bottom: 14px;
	}

	.sp-popup-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
		font-size: 14px;
		color: #333333;
	}

	.sp-popup-row > text {
		width: 80px;
		color: #666666;
	}

	.sp-popup-btns {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
	}

	.sp-popup-btns .sp-btn {
		width: 120px;
		margin: 0;
	}
</style>
