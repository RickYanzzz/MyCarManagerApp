<template>
	<view class="container">
		<view class="card" v-if="!loading">
			<view class="row">
				<text class="label">车牌号</text>
				<text class="value strong">{{ data.carNumber || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">车主姓名</text>
				<text class="value">{{ data.owner || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">联系方式</text>
				<text class="value">{{ data.ownerphone || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">车类型</text>
				<text class="value">{{ data.carType || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">车辆品牌</text>
				<text class="value">{{ data.brand || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">发动机号</text>
				<text class="value">{{ data.engineNumber || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">车架号</text>
				<text class="value">{{ data.frame || '-' }}</text>
			</view>
			<view class="row">
				<text class="label">保险到期</text>
				<text class="value">{{ formatInsurance(data.insure) }}</text>
			</view>
			<view class="row">
				<text class="label">其他说明</text>
				<text class="value">{{ data.other || '-' }}</text>
			</view>
		</view>

		<view class="btns">
			<button type="primary" @click="handleUpdate">修改</button>
			<button type="warn" class="btn-delete" @click="handleDelete">删除</button>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				carId: '',
				data: {},
				loading: true
			}
		},
		onLoad(options) {
			this.carId = options.id || ''
		},
		onShow() {
			if (this.carId) this.loadData()
		},
		methods: {
			loadData() {
				this.loading = true
				this.$api.get_car_info_byId({
					carInfoId: this.carId
				}).then(res => {
					this.data = res.data || {}
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					this.loading = false
				})
			},
			formatInsurance(value) {
				if (!value) return '-'
				const date = new Date(Number(value))
				if (isNaN(date.getTime())) return '-'
				const month = date.getMonth() + 1
				const day = date.getDate()
				return date.getFullYear() + '-' + (month < 10 ? '0' + month : month) + '-' + (day < 10 ? '0' + day : day)
			},
			handleUpdate() {
				uni.navigateTo({
					url: './edit?id=' + this.carId,
					events: {
						refreshData: () => {
							this.loadData()
						}
					}
				})
			},
			handleDelete() {
				uni.showModal({
					title: '删除车辆',
					content: '确定要删除这辆车吗？删除后不可恢复。',
					success: (res) => {
						if (!res.confirm) return
						this.$api.delete_car_info({
							_id: this.carId
						}).then(() => {
							uni.showToast({
								title: '删除成功',
								icon: 'none'
							})
							setTimeout(() => {
								uni.redirectTo({
									url: './list'
								})
							}, 500)
						}).catch(err => {
							uni.showToast({
								title: (err && (err.msg || err.errMsg)) || '删除失败',
								icon: 'none'
							})
						})
					}
				})
			}
		}
	}
</script>

<style>
	.container {
		padding: 12px;
		background-color: #F4F8FB;
		min-height: 100vh;
		box-sizing: border-box;
	}

	.card {
		background-color: #ffffff;
		border-radius: 8px;
		padding: 4px 14px;
	}

	.row {
		display: flex;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid #F0F0F0;
	}

	.row:last-child {
		border-bottom: none;
	}

	.label {
		font-size: 14px;
		color: #999999;
	}

	.value {
		font-size: 14px;
		color: #333333;
		max-width: 60%;
		text-align: right;
	}

	.value.strong {
		font-size: 16px;
		font-weight: 600;
	}

	.btns {
		margin-top: 16px;
		display: flex;
		flex-direction: row;
	}

	.btns button {
		flex: 1;
	}

	.btn-delete {
		margin-left: 10px;
	}
</style>
