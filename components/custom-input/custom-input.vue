<template>
	<view class="custom-input">
		<view :class="['input-item',currentItem==item.id?'input-active':'']" @click="clickItem(item)">
			<view v-if="item.id!=7" :class="['real-text',currentItem==item.id?'text-active':'']">
				<text>{{item.text}}</text>
			</view>
			<view class="" v-if="item.id==7">
				<view v-if="currentItem!=item.id&&item.text==''" class="placeholder-view">
					<text class="iconfont icon-tianjia input-text"></text>
					<text class="title_text">新能源</text>
				</view>
				<view v-else :class="['real-text',currentItem==item.id?'text-active':'']">
					<text>{{item.text}}</text>
				</view>
			</view>

		</view>
	</view>
</template>

<script>
	export default {
		name: "custom-input",
		data() {
			return {
				isAcitve: false
			};
		},
		props: {
			item: {
				type: Object,
				required: true
			},
			currentItem: Number
		},
		methods: {
			clickItem(item) {
				this.$emit("clickMyItem", item)
			}
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/icons.css");

	.custom-input {
		.input-item {
			width: 36px;
			height: 36px;
			border: 1px $uni-color-primary solid;
		}

		.input-active {
			background-color: $uni-color-primary;
		}

		.real-text {
			color: $uni-color-primary;
			line-height: 36px;
			text-align: center;
			font-size: 20px;
			// font-weight: 600;
		}

		.text-active {
			color: #fff;
			line-height: 36px;
			text-align: center;
			font-size: 20px;
			// font-weight: 600;
		}

		.placeholder-view {
			margin-top: 3px;
			font-size: 8px;
			line-height: 18px;
			display: flex;
			align-items: center;
			text-align: center;
			flex-direction: column;
			color: $uni-text-color-grey;

		}
	}
</style>