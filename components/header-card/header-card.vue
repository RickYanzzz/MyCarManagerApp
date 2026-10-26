<template>
	<view class="header" @click="clickToDetail">
		<p class="h-p1"><span>{{carInfo.carType?carInfo.carType:"未知"}}
			</span><span class="midline">{{carInfo.carBrand?"|":""}}</span>
			<span>{{carInfo.brand?carInfo.brand:""}}</span>
		</p>
		<p class="h-p2">{{carInfo.carNumber}}</p>

		<p v-show="carInfo.memberId" class="h-p4"><span>王</span><span class="midline">|</span><span>{{ownerphone}}</span>
		</p>
		<p v-show="carInfo.memberId" class="h-p3 mtop"><text>车衣参加8000送一次达打蜡</text></p>
		<p class="h-line"></p>
		<p v-show="carInfo.memberId" class="hp6 h-p1 mtop">
			<view>
				<text class="iconfont icon-qiapian"></text>
				<text style="margin-left: 3px;">P0001</text>
			</view>
			<view>
				<text class="iconfont icon-huiyuan1"></text>
				<text style="margin-left: 3px;">王志林</text>
			</view>
			<view>
				<text class="iconfont icon-qian"></text>
				<text style="margin-left: 3px;">12017</text>
			</view>
		</p>
		<p v-show="!carInfo.memberId" class="hp6 h-p1 mtop">
			<view>
				<text>尚未绑定会员，请点击绑定</text>
			</view>
		</p>
	</view>
</template>

<script>
	export default {
		name: "header-card",
		data() {
			return {

			};
		},
		props: {
			carInfo: {
				type: Object,
				required: true
			}
		},
		methods: {
			clickToDetail() {
			
				this.$emit("clickHeaderCard")
			}
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/icons.css");

	.card-bg {
		background-color: $uni-color-primary;
		height: 160px;
		margin-top: 5px;
	}

	.header {
		background-color: $uni-color-primary;
		// height: 300rpx;
		color: white;
		border-radius: 5px;
		padding: 10px;
		margin-left: 15px;
		margin-right: 15px;
		box-sizing: border-box;

	}

	.h-p1 {
		font-size: 14px;
		margin-left: 10px;

	}

	.h-p4 {
		font-size: 14px;
		margin-left: 10px;
		text-align: right;
	}

	.h-p2 {
		font-size: 20px;
		text-align: center;
		padding: 10px;
		font-weight: 600;
	}

	.h-p3 {
		font-size: 12px;
		margin-left: 10px;
		color: $uni-text-color-yellow;

	}

	.h-line {
		background: white;
		height: 1px;
	}

	.mtop {
		margin-top: 10px;
	}

	.hp6 {
		display: flex;
		justify-content: space-between;
	}

	.midline {
		font-size: 16px;
		margin-left: 10px;
		margin-right: 10px;
		font-weight: 600;
	}
</style>