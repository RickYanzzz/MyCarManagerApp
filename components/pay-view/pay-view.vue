<template>
	<view class="payTypeView">
		<view class="header">
			<text>添加结算</text>
		</view>
		<view class="formView">
			<uni-section :title="sectionTitle">
				<view class="member-balance-row" v-if="formData.value == 0">
					<text v-if="memberInfo._id">会员余额 ¥{{ memberInfo.balance || 0 }}</text>
					<text v-else>请先绑定会员</text>
				</view>
				<uni-forms :modelValue="formData">
					<uni-forms-item label-width="40" label="付款方式" name="value">
						<uni-data-select :clear="false" v-model="formData.value" :localdata="payList" @change="change">
						</uni-data-select>
					</uni-forms-item>
					<uni-forms-item label-width="40" label="付款金额" name="fee">
						<uni-easyinput type="number" v-model="formData.fee" placeholder="付款金额" />
					</uni-forms-item>
					<div>
						<button class="button" type="primary" @click="addPayItem">确定</button>
					</div>
				</uni-forms>
			</uni-section>

		</view>
	</view>
</template>

<script>
	export default {
		name: "pay-view",
		data() {
			return {

				payList: [{
					value: 0,
					text: '会员卡'
				}, {
					value: 1,
					text: '微信'
				}, {
					value: 2,
					text: '现金'
				}, {
					value: 3,
					text: '支付宝'
				}, {
					value: 4,
					text: '赠送'
				}, {
					value: 5,
					text: '其他'
				}, {
					value: 6,
					text: '银行卡'
				}],
				formData: {
					value: 1,
					fee: 0
				},
				memberInfo: {},
				oweFeeValue: 0
			};
		},
		computed: {
			sectionTitle() {
				if (this.memberInfo && this.memberInfo._id) {
					return '会员：' + this.memberInfo.name + '  余额 ¥' + (this.memberInfo.balance || 0)
				}
				return '订单未绑定会员'
			}
		},
		props: {

		},
		methods: {
			loadData(item, member, oweFee) {
				this.formData.value = item.value
				this.formData.fee = item.fee
				this.memberInfo = member || {}
				this.oweFeeValue = Number(oweFee || 0)
			},
			change(e) {

			},
			addPayItem() {
				const fee = Number(this.formData.fee)
				if (!Number.isInteger(fee) || fee <= 0) {
					return uni.showToast({
						title: '请输入正整数付款金额',
						icon: 'none'
					})
				}
				if (this.formData.value == 0) {
					if (!this.memberInfo._id) {
						return uni.showToast({
							title: '请先绑定会员',
							icon: 'none'
						})
					}
					if (fee > Number(this.memberInfo.balance || 0)) {
						return uni.showToast({
							title: '会员余额不足',
							icon: 'none'
						})
					}
					if (this.oweFeeValue > 0 && fee > this.oweFeeValue) {
						return uni.showToast({
							title: '支付金额不能超过未付金额',
							icon: 'none'
						})
					}
				}
				const data = this.payList.filter(e => {
					return e.value == this.formData.value
				})
				let item = {}
				if(data.length>0){
					item = data[0]
				}
		
				item.fee = fee
				this.$emit("addPayItem", item)
				// this.$api.add_pay_info({
				// 	"name": data.text,
				// 	"type": data.value,
				// 	"fee": this.formData.fee,
				// 	"userId": this.$store.state.userId,
				// 	"enterpriseId": this.$store.state.enterpriseId,
				// 	"orderId": this.orderId,
				// 	"carId": this.carId
				// }).then(res=>{

				// }).catch(err=>{

				// })
			}


		}
	}
</script>

<style lang="scss">
	.payTypeView {
		width: 260px;
		height: 340px;
		border-radius: 10px;

		.header {
			height: 40px;
			background: $uni-color-primary;
			color: #fff;
			text-align: center;
			line-height: 40px;
		}

		.formView {
			padding: 10px;
		}

		.member-balance-row {
			padding: 8px 10px;
			margin-bottom: 6px;
			background-color: #F0F5FF;
			border-radius: 6px;
			font-size: 12px;
			color: #6EA0F7;
		}

		.button {
			background: $uni-color-primary;
		}

	}
</style>