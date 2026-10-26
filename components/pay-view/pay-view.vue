<template>
	<view class="payTypeView">
		<view class="header">
			<text>添加结算</text>
		</view>
		<view class="formView">
			<uni-section title="订单未绑定会员">
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

				payList: [
				// 	{
				// 	value: 0,
				// 	text: '会员卡'
				// },
				{
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
					value: 0,
					fee: 0
				}
			};
		},
		props: {

		},
		methods: {
			loadData(item) {
				this.formData.value = item.value
				this.formData.fee = item.fee
			},
			change(e) {

			},
			addPayItem() {
				//alert(this.formData.value)
				console.log("this.payList===",JSON.stringify(this.payList));
				const data = this.payList.filter(e => {
					return e.value == this.formData.value
				})
				let item = {}
				if(data.length>0){
					item = data[0]
				}
		
				item.fee = this.formData.fee
						console.log("item===",JSON.stringify(item));
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
		height: 280px;
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

		.button {
			background: $uni-color-primary;
		}

	}
</style>