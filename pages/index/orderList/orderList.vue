<template>
	<view>
		<nav-header type="addConsumePro" :title="title"></nav-header>
		<uni-section padding="0">
			<view class="search-result">
				<uni-list>
					<order-item @getAllOrderByStatus="getAllOrderByStatus" v-for="item in dataList" :item="item"
						@click="clickToDetail(item)"></order-item>
				</uni-list>
			</view>
		</uni-section>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				searchValue: "",
				dataList: [

				],
				title: ""
			};
		},
		onLoad(opt) {
			this.getAllOrderByStatus(opt.status)
			if (opt.status == 0) {
				this.title = "临时订单"
			} else if (opt.status == 1) {
				this.title = "挂帐订单"
			} else {
				this.title = "入账订单"
			}
		},
		created() {


		},
		mounted() {

		},
		methods: {

			getAllOrderByStatus(status) {
				const that = this
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_order_byStatus({
					"status": status
				}).then(res => {
					uni.hideLoading()
					res.data.forEach(item => {
						if (item.time) {
							item.formatTime = that.$commons.formatDate(item.time)
						} else {
							item.formatTime = ""
						}
						var totalFee = 0
						item.purchasedList.forEach(data => {
							totalFee += data.fee
						})
						item.totalFee = totalFee
						var payFee = 0
						item.pay_infoList.forEach(data => {
							payFee += parseInt(data.fee)
						})
						item.payFee = payFee
						item.owefee = totalFee - payFee
					})
					that.dataList = res.data
					console.log("res=====", JSON.stringify(res));
				}).catch(err => {

				})
			},
			clickToDetail(item) {

			}

		}
	}
</script>

<style lang="scss">

</style>