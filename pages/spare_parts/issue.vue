<template>
	<view class="sp-page">
		<nav-header type="spareParts" title="添加备件"></nav-header>

		<view class="sp-order-info">
			<text class="sp-order-title">{{ carNumber || '当前工单' }}</text>
			<text class="sp-order-sub">选择备件后会自动扣库存并计入本单费用</text>
		</view>

		<view class="sp-search">
			<uni-search-bar v-model="keyword" placeholder="搜索编号 / 名称 / 规格" :radius="100" cancel-button="none"></uni-search-bar>
		</view>

		<scroll-view class="sp-list" scroll-y="true">
			<view class="sp-item" v-for="item in filteredList" :key="item._id"
				:class="{ disabled: Number(item.stock) <= 0, selected: selected[item._id] }"
				@click="toggle(item)">
				<view class="sp-check">{{ selected[item._id] ? '✓' : '' }}</view>
				<view class="sp-info">
					<view class="sp-name">
						<text>{{ item.name }}</text>
						<text class="sp-spec" v-if="item.spec">{{ item.spec }}</text>
					</view>
					<view class="sp-meta">
						<text>{{ item.code }}</text>
						<text>库存 {{ item.stock }} {{ item.unit }}</text>
						<text>¥{{ item.salePrice }}/{{ item.unit }}</text>
					</view>
				</view>
				<view class="sp-qty" v-if="selected[item._id]" @click.stop>
					<uni-number-box :value="qty[item._id] || 1" :min="1" :max="Number(item.stock) || 1"
						@change="setQty(item, $event)" />
				</view>
				<text class="sp-soldout" v-if="Number(item.stock) <= 0">无库存</text>
			</view>
			<view class="sp-empty" v-if="!filteredList.length">没有匹配的备件</view>
			<view class="sp-bottom-space"></view>
		</scroll-view>

		<view class="sp-footer">
			<view class="sp-footer-info">
				<text class="sp-footer-count">已选 {{ selectedCount }} 项</text>
				<text class="sp-footer-total">合计 ¥{{ totalAmount }}</text>
			</view>
			<button class="sp-submit" type="primary" :disabled="!selectedCount" @click="submit">确认出库</button>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				orderId: '',
				carId: '',
				carNumber: '',
				keyword: '',
				parts: [],
				selected: {},
				qty: {}
			}
		},
		computed: {
			filteredList() {
				const keyword = String(this.keyword || '').trim().toLowerCase()
				if (!keyword) return this.parts
				return this.parts.filter(item => {
					const text = [item.code, item.name, item.spec, item.supplier].join(' ').toLowerCase()
					return text.indexOf(keyword) > -1
				})
			},
			selectedCount() {
				return Object.keys(this.selected).filter(id => this.selected[id]).length
			},
			totalAmount() {
				let total = 0
				Object.keys(this.selected).forEach(id => {
					if (!this.selected[id]) return
					const part = this.parts.find(item => item._id === id)
					if (part) total += Number(part.salePrice || 0) * Number(this.qty[id] || 1)
				})
				return total
			}
		},
		onLoad(options) {
			this.orderId = options.orderId || ''
			this.carId = options.carId || ''
			this.carNumber = options.carNumber ? decodeURIComponent(options.carNumber) : ''
			this.loadParts()
		},
		methods: {
			loadParts() {
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_spare_parts({}).then(res => {
					this.parts = res.data || []
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			toggle(item) {
				if (Number(item.stock) <= 0) {
					return uni.showToast({ title: '该备件无库存', icon: 'none' })
				}
				const id = item._id
				if (this.selected[id]) {
					this.$delete(this.selected, id)
					this.$delete(this.qty, id)
				} else {
					this.$set(this.selected, id, true)
					this.$set(this.qty, id, 1)
				}
			},
			setQty(item, value) {
				this.$set(this.qty, item._id, Number(value) || 1)
			},
			submit() {
				const items = Object.keys(this.selected)
					.filter(id => this.selected[id])
					.map(id => ({
						partId: id,
						qty: Number(this.qty[id] || 1)
					}))
				if (!items.length) {
					return uni.showToast({ title: '请选择备件', icon: 'none' })
				}
				uni.showLoading({
					title: '出库中...'
				})
				this.$api.issue_spare_parts({
					orderId: this.orderId,
					carId: this.carId,
					items: items
				}).then(() => {
					uni.hideLoading()
					uni.showToast({ title: '已出库并计入工单', icon: 'none' })
					if (this.getOpenerEventChannel) {
						this.getOpenerEventChannel().emit('sparePartsIssued')
					}
					setTimeout(() => uni.navigateBack(), 500)
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '出库失败',
						icon: 'none'
					})
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

	.sp-order-info {
		margin: 12px;
		padding: 12px 14px;
		background-color: #ffffff;
		border-radius: 8px;
	}

	.sp-order-title {
		display: block;
		font-size: 16px;
		color: #333333;
		font-weight: 500;
	}

	.sp-order-sub {
		display: block;
		margin-top: 6px;
		font-size: 12px;
		color: #999999;
	}

	.sp-search {
		padding: 0 12px 6px;
	}

	.sp-list {
		height: calc(100vh - 260px);
		padding: 0 12px;
		box-sizing: border-box;
	}

	.sp-item {
		display: flex;
		align-items: center;
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px 14px;
		margin-bottom: 8px;
		border: 1px solid transparent;
	}

	.sp-item.selected {
		border-color: #6EA0F7;
		background-color: #F7FAFF;
	}

	.sp-item.disabled {
		opacity: 0.5;
	}

	.sp-check {
		width: 22px;
		height: 22px;
		line-height: 22px;
		text-align: center;
		border-radius: 50%;
		border: 1px solid #D9D9D9;
		color: #ffffff;
		font-size: 13px;
		margin-right: 10px;
	}

	.sp-item.selected .sp-check {
		background-color: #6EA0F7;
		border-color: #6EA0F7;
	}

	.sp-info {
		flex: 1;
		min-width: 0;
	}

	.sp-name {
		font-size: 15px;
		color: #333333;
	}

	.sp-spec {
		margin-left: 8px;
		font-size: 12px;
		color: #999999;
	}

	.sp-meta {
		display: flex;
		flex-wrap: wrap;
		margin-top: 6px;
		font-size: 12px;
		color: #999999;
	}

	.sp-meta text {
		margin-right: 14px;
	}

	.sp-qty {
		margin-left: 8px;
	}

	.sp-soldout {
		font-size: 12px;
		color: #FF4D4F;
		margin-left: 8px;
	}

	.sp-empty {
		padding: 60px 0;
		text-align: center;
		color: #999999;
		font-size: 14px;
	}

	.sp-bottom-space {
		height: 90px;
	}

	.sp-footer {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ffffff;
		padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.05);
	}

	.sp-footer-info {
		flex: 1;
	}

	.sp-footer-count {
		display: block;
		font-size: 12px;
		color: #999999;
	}

	.sp-footer-total {
		display: block;
		margin-top: 2px;
		font-size: 18px;
		font-weight: 600;
		color: #FF4D4F;
	}

	.sp-submit {
		width: 120px;
		background-color: #6EA0F7;
		font-size: 14px;
		margin: 0;
	}
</style>
