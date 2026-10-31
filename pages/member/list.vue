<template>
	<view class="member-page">
		<view class="member-toolbar">
			<uni-search-bar v-model="keyword" placeholder="搜索姓名 / 手机号 / 卡号" :radius="100" cancel-button="none"
				@input="onSearch" @confirm="onSearch" @clear="onSearch"></uni-search-bar>
		</view>

		<view class="bind-tip" v-if="mode === 'bind'">
			<text>正在为 {{ carNumber || '当前车辆' }} 绑定会员</text>
		</view>
		<view class="bind-tip recharge-tip" v-if="action === 'recharge'">
			<text>请选择需要充值的会员</text>
		</view>

		<scroll-view class="member-list" scroll-y="true" @scrolltolower="loadMore">
			<view class="member-item" v-for="item in list" :key="item._id" @click="handleMember(item)">
				<view class="member-item-head">
					<text class="member-name">{{ item.name }}</text>
					<text class="member-status" :class="{ disabled: item.status != 1 }">
						{{ item.status == 1 ? '正常' : '已停用' }}
					</text>
				</view>
				<view class="member-meta">
					<text>{{ item.phone }}</text>
					<text>{{ item.cardNo }}</text>
				</view>
				<view class="member-foot">
					<text class="member-level">{{ item.level || '普通会员' }}</text>
					<text class="member-balance">余额 ¥{{ item.balance || 0 }}</text>
				</view>
			</view>
			<view class="member-empty" v-if="!loading && !list.length">
				<text>{{ keyword ? '没有找到匹配的会员' : '暂无会员，点右下角 + 开卡' }}</text>
			</view>
			<view class="member-loading" v-if="loading">
				<text>加载中...</text>
			</view>
			<view class="member-bottom-space"></view>
		</scroll-view>

		<uni-fab :pattern="fabPattern" horizontal="right" vertical="bottom" direction="horizontal"
			@fabClick="addMember"></uni-fab>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				keyword: '',
				list: [],
				page: 1,
				pageSize: 20,
				total: 0,
				loading: false,
				mode: '',
				action: '',
				carId: '',
				carNumber: '',
				orderId: '',
				searchTimer: null,
				fabPattern: {
					backgroundColor: '#6EA0F7',
					buttonColor: '#6EA0F7',
					iconColor: '#ffffff'
				}
			}
		},
		onLoad(options) {
			this.mode = options.mode || ''
			this.action = options.action || ''
			this.carId = options.carId || ''
			this.carNumber = options.carNumber ? decodeURIComponent(options.carNumber) : ''
			this.orderId = options.orderId || ''
		},
		onShow() {
			this.loadData(true)
		},
		onReachBottom() {
			if (this.list.length < this.total && !this.loading) {
				this.page++
				this.loadData(false)
			}
		},
		methods: {
			loadData(reset) {
				if (this.loading) return
				if (reset) this.page = 1
				this.loading = true
				this.$api.list_members({
					keyword: this.keyword,
					page: this.page,
					pageSize: this.pageSize
				}).then(res => {
					const data = res.data || {}
					const list = data.list || []
					this.list = reset ? list : this.list.concat(list)
					this.total = Number(data.total || 0)
				}).catch(err => {
					uni.showToast({
						title: (err && (err.message || err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					this.loading = false
				})
			},
			onSearch() {
				if (this.searchTimer) clearTimeout(this.searchTimer)
				this.searchTimer = setTimeout(() => {
					this.loadData(true)
				}, 300)
			},
			loadMore() {
				if (this.list.length < this.total && !this.loading) {
					this.page++
					this.loadData(false)
				}
			},
			handleMember(member) {
				if (this.mode === 'bind') {
					this.bindMember(member)
					return
				}
				if (this.action === 'recharge') {
					uni.navigateTo({
						url: '/pages/member/recharge?id=' + member._id
					})
					return
				}
				uni.navigateTo({
					url: '/pages/member/detail?id=' + member._id
				})
			},
			bindMember(member) {
				uni.showModal({
					title: '绑定会员',
					content: '确认将会员「' + member.name + '」绑定到车辆 ' + (this.carNumber || '') + ' 吗？',
					success: (res) => {
						if (!res.confirm) return
						uni.showLoading({
							title: '绑定中...'
						})
						this.$api.bind_member_car({
							memberId: member._id,
							carId: this.carId,
							carNumber: this.carNumber,
							orderId: this.orderId
						}).then(result => {
							uni.hideLoading()
							try {
								const channel = this.getOpenerEventChannel()
								if (channel && channel.emit) channel.emit('memberBound', result.data.member)
							} catch (e) {}
							uni.navigateBack()
						}).catch(err => {
							uni.hideLoading()
							uni.showToast({
								title: (err && (err.message || err.msg || err.errMsg)) || '绑定失败',
								icon: 'none'
							})
						})
					}
				})
			},
			addMember() {
				let url = '/pages/member/add'
				const params = []
				if (this.mode) params.push('mode=' + this.mode)
				if (this.carId) params.push('carId=' + this.carId)
				if (this.carNumber) params.push('carNumber=' + encodeURIComponent(this.carNumber))
				if (this.orderId) params.push('orderId=' + this.orderId)
				if (params.length) url += '?' + params.join('&')
				uni.navigateTo({
					url: url
				})
			}
		}
	}
</script>

<style>
	.member-page {
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.member-toolbar {
		padding: 10px 12px 0;
	}

	.bind-tip {
		margin: 8px 12px 0;
		padding: 10px 12px;
		background-color: #EAF2FF;
		border-radius: 6px;
		color: #6EA0F7;
		font-size: 14px;
	}

	.recharge-tip {
		background-color: #FFF4E5;
		color: #E6AA46;
	}

	.member-list {
		height: calc(100vh - 150px);
		padding: 10px 12px 0;
		box-sizing: border-box;
	}

	.member-item {
		background-color: #ffffff;
		border-radius: 8px;
		padding: 12px 14px;
		margin-bottom: 10px;
	}

	.member-item-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.member-name {
		font-size: 16px;
		font-weight: 500;
		color: #333333;
	}

	.member-status {
		font-size: 12px;
		color: #52C41A;
		background-color: #F0FFF0;
		padding: 2px 8px;
		border-radius: 10px;
	}

	.member-status.disabled {
		color: #999999;
		background-color: #F5F5F5;
	}

	.member-meta {
		margin-top: 8px;
		display: flex;
		justify-content: space-between;
		font-size: 13px;
		color: #666666;
	}

	.member-foot {
		margin-top: 10px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.member-level {
		font-size: 12px;
		color: #999999;
	}

	.member-balance {
		font-size: 15px;
		color: #E6AA46;
		font-weight: 600;
	}

	.member-empty,
	.member-loading {
		padding: 60px 0;
		text-align: center;
		color: #999999;
		font-size: 14px;
	}

	.member-bottom-space {
		height: 80px;
	}
</style>
