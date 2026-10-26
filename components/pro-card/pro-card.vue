<template>
	<view class="pro-view">
		<uni-grid :highlight="true" @change="clickText" class="my-grid" :show-border="false" :column="8">
			<uni-grid-item highlight style="width: 45px;height: 45px;" :show-border="false" class="my-grid-item"
				v-for="(item,index) in proArr" :index="index">
				<text>{{item}}</text>
			</uni-grid-item>
		</uni-grid>
	</view>
</template>

<script>
	export default {
		name: "pro-card",
		data() {
			return {
				proArr: ["京", "津", "沪", "渝", "冀", "晋", "蒙", "辽", "吉", "黑", "苏",
					"浙", "皖", "闽", "赣", "鲁", "豫", "鄂", "湘", "粤", "琼", "川", "贵", "云", "陕", "甘", "青", "台",
					"桂", "宁", "新", "藏"
				]
			};
		},
		methods: {
			clickText(e) {
				this.$emit("clickProCardItem", this.proArr[e.detail.index])
			}
		}
	}
</script>

<style lang="scss">
	.pro-view {
		padding: 20px;
	}

	 .my-grid {
		margin-left: 5px;
		margin-right: 5px;
		display: flex;
		flex: 1;
		border: 0;
	}

	.my-grid-item {

		margin-bottom: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
		border: 0;
		font-size: 20px;
		color: $uni-text-color-grey;

	}
</style>