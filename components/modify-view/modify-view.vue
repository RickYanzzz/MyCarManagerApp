<template>
	<view class="payTypeView">
		<view class="header">
			<text>修改消费项目</text>
		</view>
		<view class="formView">
			<uni-section title="修改消费项目">
				<uni-forms :modelValue="formData">
					<uni-forms-item label-width="40" label="名称" name="value">
						<uni-easyinput type="input" disabled="true" v-model="formData.name" placeholder="名称" />
					</uni-forms-item>
					<uni-forms-item label="数量" required name="age">
						<uni-number-box :value="formData.count" background="#6EA0F7" color="#fff"
							@change="changeNumber" />
					</uni-forms-item>
					<uni-forms-item label-width="40" label="付款金额" name="fee">
						<uni-easyinput type="number" v-model="formData.fee" placeholder="付款金额" disabled="true" />
					</uni-forms-item>
					<div>
						<button class="button" type="primary" @click="updateItem">确定</button>
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
				formData: {
					name: "",
					count: 0,
					fee: 0
				},
				item: {}
			};
		},
		props: {

		},
		methods: {

			loadData(item) {
				this.formData.name = item.name
				this.formData.count = item.count
				this.formData.fee = item.fee
				this.item = item

			},
			changeNumber(value) {
				this.formData.count = value
				this.formData.fee = value * this.item.fee
			},
			change(e) {

			},
			updateItem() {
				const that = this
				that.$api.update_purchased_goods({
					_id: this.item._id,
					count: this.formData.count,
					fee: this.formData.fee
				}).then(res => {
					that.$emit("updatePurchase", 0)
				}).catch(err => {

				})
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

		.button {
			background: $uni-color-primary;
		}

	}
</style>