<template>
	<view class="payTypeView">
		<view class="header">
			<text>添加结算</text>
		</view>
		<view>
			<uni-list>
				<uni-list-item :clickable="true" v-for="data in payList"  thumbSize="14" @click="clickItem(data)">
							<template v-slot:body>
								<text class="slot-box slot-text text-color">{{data.text}}</text>
							</template>
				</uni-list-item>
			</uni-list>
		</view>
	</view>
</template>

<script>
	export default {
		name:"pay-type-view",
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
				}]
			};
		},
		methods:{
			clickItem(item){
				this.$emit("clickPayTypeView",item)
			}
		}
	}
</script>

<style lang="scss">
	.payTypeView{
		width: 260px;
		height: 350px;
		border-radius: 10px;
		.header{
			height: 40px;
			background: $uni-color-primary;
			color: #fff;
			text-align: center;
			line-height: 40px;
		}
		.text-color{
			font-size: 14px;
			color: $uni-text-color-grey;
		}
	}
</style>