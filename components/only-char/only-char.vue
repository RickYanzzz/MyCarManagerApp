<template>
	<view class="only-char">
		<uni-grid class="my-grid" :show-border="false" :column="8" @change="clickText">
			<uni-grid-item style="width: 40px;height: 40px;" :show-border="false" class="my-grid-item"
				v-for="(item,index) in chars" :index="index">
				<text>{{item}}</text>
			</uni-grid-item>
		</uni-grid>
	</view>
</template>

<script>
	export default {
		name: "only-char",
		data() {
			return {
				chars: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
					"K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
					"W", "X", "Y", "Z"
				]
			};
		},
		methods: {
			clickText(e) {
				this.$emit("clickOnlyCharItem", this.chars[e.detail.index])
			}
		}
	}
</script>

<style lang="scss">
	.only-char {
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