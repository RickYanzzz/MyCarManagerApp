<template>
	<view class="container">
		<view class="search-wrap">
			<uni-search-bar v-model="keyword" placeholder="搜索车牌 / 车主 / 电话" :radius="100"
				cancel-button="none"></uni-search-bar>
		</view>

		<uni-list>
			<uni-list-item v-for="item in filteredList" :key="item._id" showArrow :clickable="true"
				@click="handleItemClick(item._id)">
				<template v-slot:body>
					<view class="car-row">
						<view class="car-main">
							<text class="car-number">{{ item.carNumber || '临牌' }}</text>
							<text class="car-owner">{{ item.owner || '未填写车主' }}</text>
						</view>
						<text class="car-sub">{{ item.brand || '' }}<text v-if="item.ownerphone"> · {{ item.ownerphone }}</text></text>
					</view>
				</template>
			</uni-list-item>
		</uni-list>

		<view class="empty" v-if="!filteredList.length">暂无车辆</view>
		<view class="bottom-space"></view>

		<uni-fab ref="fab" horizontal="right" vertical="bottom" :pop-menu="false" @fabClick="fabClick" />
	</view>
</template>

<script>
	export default {
		data() {
			return {
				keyword: '',
				dataList: []
			}
		},
		computed: {
			filteredList() {
				const keyword = String(this.keyword || '').trim().toLowerCase()
				if (!keyword) return this.dataList
				return this.dataList.filter(item => {
					const text = [item.carNumber, item.owner, item.ownerphone, item.brand].join(' ').toLowerCase()
					return text.indexOf(keyword) > -1
				})
			}
		},
		onShow() {
			this.loadList()
		},
		methods: {
			loadList() {
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_car_info_list({}).then(res => {
					this.dataList = res.data || []
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			handleItemClick(id) {
				uni.navigateTo({
					url: './detail?id=' + id
				})
			},
			fabClick() {
				uni.navigateTo({
					url: './add',
					events: {
						refreshData: () => {
							this.loadList()
						}
					}
				})
			}
		}
	}
</script>

<style>
	.container {
		padding: 10px;
		background-color: #F4F8FB;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.search-wrap {
		margin-bottom: 6px;
	}

	.car-row {
		display: flex;
		flex-direction: column;
	}

	.car-main {
		display: flex;
		align-items: center;
	}

	.car-number {
		font-size: 16px;
		font-weight: 600;
		color: #333333;
	}

	.car-owner {
		margin-left: 10px;
		font-size: 14px;
		color: #666666;
	}

	.car-sub {
		margin-top: 4px;
		font-size: 12px;
		color: #999999;
	}

	.empty {
		padding: 80px 0;
		text-align: center;
		color: #999999;
		font-size: 14px;
	}

	.bottom-space {
		height: 80px;
	}
</style>
