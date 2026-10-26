<template>
	<view class="module" @click="clickToDetail(data)">
		<view class="">
			<text :class="['iconfont','my-icon',data.icon]"></text>
		</view>
		<view class="title">
			<text>{{data.text}}</text>
		</view>
	</view>
</template>

<script>
	export default {
		name: "home-item",
		data() {
			return {

			};
		},
		props: {
			data: {
				type: Object,
				required: true
			}
		},
		methods: {
			clickToDetail(item) {
				uni.navigateTo({
					url: item.url
				})

			}
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/icons.css");

	.module {
		background-color: white;
		width: 160px;
		height: 70px;
		margin: 5px;
		border-radius: 5px;
		display: flex;
		justify-content: center;
		align-items: center;

		.my-icon {
			font-size: 30px;
			color: #E6AA46;
		}

		.title {
			color: #636363;
			font-size: 16px;
			margin-left: 14px;
		}

	}
</style>