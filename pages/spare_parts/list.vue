<template>
	<view class="sp-page">
		<nav-header type="spareParts" title="备品备件"></nav-header>

		<view class="sp-toolbar">
			<uni-search-bar v-model="keyword" placeholder="搜索编号 / 名称 / 规格" :radius="100" cancel-button="none"
				@input="onSearch" @clear="onSearch"></uni-search-bar>
			<view class="sp-toolbar-row">
				<text class="sp-filter" :class="{active: lowStockOnly}" @click="toggleLowStock">
					{{ lowStockOnly ? '显示全部' : '只看低库存' }}
				</text>
				<text class="sp-reset" v-if="isDev" @click="resetDemo">重置演示数据</text>
			</view>
		</view>

		<view class="sp-summary" v-if="lowStockCount > 0" @click="showLowStock">
			<text class="sp-summary-text">{{ lowStockCount }} 项低于安全库存</text>
			<text class="sp-summary-arrow">查看 &gt;</text>
		</view>

		<scroll-view class="sp-list" scroll-y="true">
			<view class="sp-item" v-for="item in filteredList" :key="item._id" @click="openDetail(item)">
				<view class="sp-item-head">
					<text class="sp-code">{{ item.code }}</text>
					<text class="sp-status" :class="{ danger: isLowStock(item) }">
						{{ isLowStock(item) ? '库存不足' : '正常' }}
					</text>
				</view>
				<view class="sp-name">
					<text>{{ item.name }}</text>
					<text class="sp-spec" v-if="item.spec">{{ item.spec }}</text>
				</view>
				<view class="sp-meta">
					<text>库存 {{ item.stock }} {{ item.unit }}</text>
					<text>安全 {{ item.safetyStock }}</text>
					<text v-if="item.location">仓位 {{ item.location }}</text>
				</view>
			</view>
			<view class="sp-empty" v-if="!filteredList.length">
				<text>暂无备件，点右下角 + 新增</text>
			</view>
			<view class="sp-bottom-space"></view>
		</scroll-view>

		<uni-fab :pattern="fabPattern" horizontal="right" vertical="bottom" direction="horizontal"
			@fabClick="addPart"></uni-fab>
	</view>
</template>

<script>
	import { resetMockDb } from '@/common/mock/db.js'

	export default {
		data() {
			return {
				keyword: '',
				lowStockOnly: false,
				allList: [],
				fabPattern: {
					backgroundColor: '#6EA0F7',
					buttonColor: '#6EA0F7',
					iconColor: '#ffffff'
				}
			}
		},
		computed: {
			isDev() {
				return typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production'
			},
			lowStockCount() {
				return this.allList.filter(item => this.isLowStock(item)).length
			},
			filteredList() {
				const keyword = String(this.keyword || '').trim().toLowerCase()
				return this.allList.filter(item => {
					if (this.lowStockOnly && !this.isLowStock(item)) return false
					if (!keyword) return true
					const text = [item.code, item.name, item.spec, item.supplier].join(' ').toLowerCase()
					return text.indexOf(keyword) > -1
				})
			}
		},
		onShow() {
			this.loadList()
		},
		methods: {
			isLowStock(item) {
				return Number(item.stock || 0) <= Number(item.safetyStock || 0)
			},
			loadList() {
				this.$api.get_spare_parts({}).then(res => {
					this.allList = res.data || []
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				})
			},
			onSearch() {
				// 搜索由 computed 完成，这里保留事件入口方便以后接服务端搜索
			},
			toggleLowStock() {
				this.lowStockOnly = !this.lowStockOnly
			},
			showLowStock() {
				this.lowStockOnly = true
			},
			openDetail(item) {
				uni.navigateTo({
					url: '/pages/spare_parts/detail?id=' + item._id
				})
			},
			addPart() {
				uni.navigateTo({
					url: '/pages/spare_parts/edit'
				})
			},
			resetDemo() {
				uni.showModal({
					title: '重置演示数据',
					content: '会清空本地 mock 数据并恢复样例，确定吗？',
					success: (res) => {
						if (!res.confirm) return
						resetMockDb()
						this.loadList()
						uni.showToast({
							title: '已重置',
							icon: 'none'
						})
					}
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

	.sp-toolbar {
		padding: 10px 12px 4px;
	}

	.sp-toolbar-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 8px 4px 0;
	}

	.sp-filter,
	.sp-reset {
		font-size: 13px;
		color: #6EA0F7;
	}

	.sp-filter.active {
		color: #E6AA46;
	}

	.sp-summary {
		margin: 8px 12px 0;
		padding: 10px 12px;
		background-color: #FFF4E5;
		border-radius: 6px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sp-summary-text {
		color: #E6AA46;
		font-size: 14px;
	}

	.sp-summary-arrow {
		color: #E6AA46;
		font-size: 12px;
	}

	.sp-list {
		height: calc(100vh - 170px);
		padding: 10px 12px 0;
		box-sizing: border-box;
	}

	.sp-item {
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px 14px;
		margin-bottom: 10px;
	}

	.sp-item-head {
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

	.sp-name {
		margin-top: 8px;
		font-size: 16px;
		color: #333333;
		font-weight: 500;
	}

	.sp-spec {
		margin-left: 8px;
		font-size: 13px;
		color: #999999;
		font-weight: normal;
	}

	.sp-meta {
		margin-top: 8px;
		display: flex;
		flex-wrap: wrap;
		font-size: 12px;
		color: #666666;
	}

	.sp-meta text {
		margin-right: 16px;
	}

	.sp-empty {
		padding: 80px 0;
		text-align: center;
		color: #999999;
		font-size: 14px;
	}

	.sp-bottom-space {
		height: 80px;
	}
</style>
