<template>
	<view class="char-number">
		<uni-grid class="my-grid" :show-border="false" :column="8" @change="clickText">
			<uni-grid-item style="width: 40px;height: 40px;" :show-border="false" class="my-grid-item"
				v-for="(item,index) in chars" :index="index">
				<text>{{item}}</text>
			</uni-grid-item>
		</uni-grid>
		<uni-grid class="my-grid" :show-border="false" :column="8" @change="clickNumber">
			<uni-grid-item style="width: 40px;height: 40px;" :show-border="false" class="my-grid-item"
				v-for="(item,index) in numbers" :index="index">
				<text>{{item}}</text>
			</uni-grid-item>
		</uni-grid>
		<view class="del" @click="deleteItem">
			<text>删除</text>
		</view>
	</view>
</template>

<script>
	export default {
		name: "char-number",
		data() {
			return {
				chars: ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
					"K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
					"W", "X", "Y", "Z"
				],
				numbers: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
			};
		},
		methods: {
			clickText(e) {
				this.$emit("clickOnlyCharNumber", this.chars[e.detail.index])
			},
			clickNumber(e) {
				this.$emit("clickOnlyCharNumber", this.numbers[e.detail.index])
			},
			deleteItem() {
				this.$emit("clickOnlyCharNumber", '')
			}

		}
	}
</script>

<style lang="scss">
	.char-number {
		padding: 20px;
	}

	/deep/ .my-grid {
		margin-left: 5px;
		margin-right: 5px;
		display: flex;
		flex: 1;
		border: 0;
	}

	/deep/ .my-grid-item {

		margin-bottom: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
		border: 0;
		font-size: 20px;
		color: $uni-text-color-grey;

	}

	.text-view {
		width: 36px;
		height: 36px;
	}

	.del {
		text-align: right;
		font-size: 20px;
		color: $uni-text-color-grey;
		font-weight: 600;
	}
</style>