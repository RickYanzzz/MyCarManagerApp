<template>
	<view class="addConsumePro">
		<nav-header type="addConsumePro" title="添加消费项目"></nav-header>
		<view class="form-view">
			<uni-forms ref="customForm" :rules="customRules" :modelValue="customFormData">
				<uni-forms-item label="名称" name="name">
					<uni-easyinput v-model="customFormData.name" placeholder="请输入名称" @focus="beginInput"
						@blur="endInput()" />
					<uni-list v-show="tableShow" style="position: fixed;z-index:1000;width: 70%;">
						<uni-list-item v-for="(item,index) in allGoods" :key="index" :title="item.name" clickable
							@click="clickItem(item)"></uni-list-item>
					</uni-list>
				</uni-forms-item>
				<uni-forms-item label="数量" name="count">
					<uni-number-box v-model="customFormData.count" background="#6EA0F7" color="#fff" @change="changeCount" />
				</uni-forms-item>
				<uni-forms-item label="总价" name="fee">
					<uni-number-box v-model="customFormData.fee" background="#6EA0F7" color="#fff" />
				</uni-forms-item>
				<button type="primary" style="background:#6EA0F7" @click="submit('customForm')">提交</button>
				
			</uni-forms>
		</view>

	</view>
</template>

<script>
	export default {
		data() {
			return {
				query:{},
				onePrice:10,
				allGoods: [],
				tableShow: false,
				value: 0,
				range: [{
						value: 0,
						text: "篮球"
					},
					{
						value: 1,
						text: "足球"
					},
					{
						value: 2,
						text: "游泳"
					},
				],
				// 自定义表单数据
				customFormData: {
					name: "",
					count: 1,
					fee: 10
				},
				// 自定义表单校验规则
				customRules: {
					name: {
						rules: [{
							required: true,
							errorMessage: '名称不能为空'
						}]
					},
					count: {
						rules: [{
							required: true,
							errorMessage: '数量不能为空'
						}]
					},
					fee: {
						rules: [{
							required: true,
							errorMessage: '价格不能为空'
						}]
					}


				}
			};
		},
		onLoad(opt) {
			this.query=opt
		},
		created() {
			this.getAllGoods()
		},
		methods: {
			changeCount(value){
				this.customFormData.count = value
				this.customFormData.fee = value*this.onePrice	
			},
			submit(form) {
				const that = this
			    uni.showLoading({
			    	title:"添加中..."
			    })
				const data= {
					"name": that.customFormData.name,
					"fee": that.customFormData.fee,
					"count": that.customFormData.count?that.customFormData.count:1,
					"orderId": that.query.orderId,
					"carId": that.query.carId,
					"status": 0
				}
				console.log("data=====",JSON.stringify(data));
				that.$api.add_purchased_goods(data).then(res => {
					uni.hideLoading()
					uni.$emit("addConsumePro",data)
					uni.navigateBack()
				}).catch(err => {
				   uni.hideLoading()
				   title:"网络异常，请稍后重试～"
				})

			},
			getAllGoods() {
				const that = this
				this.$api.get_All_goods({}).then(res => {
					console.log("res===" + JSON.stringify(res))
					that.allGoods = res.data
				}).catch(err => {

				})
			},
			beginInput() {
				if (!this.customFormData.name) {
					this.tableShow = true
				}

			},
			endInput() {
				if (this.customFormData.name) {
					this.tableShow = false
				}

			},
			clickItem(item) {
				this.onePrice = item.fee
				this.customFormData.name = item.name
				this.customFormData.count = item.count
				this.customFormData.fee = item.fee
				this.tableShow = false
			}
		}
	}
</script>

<style lang="scss">
	.addConsumePro {
		height: 100%;
		position: relative;

		.form-view {
			padding: 20px;
		}
	}
</style>