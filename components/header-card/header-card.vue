<template>
	<view class="header" @click="clickToDetail">
		<p class="h-p1"><span>{{carInfo.carType?carInfo.carType:"未知"}}
			</span><span class="midline">{{carInfo.carBrand?"|":""}}</span>
			<span>{{carInfo.brand?carInfo.brand:""}}</span>
		</p>
		<p class="h-p2">{{carInfo.carNumber}}</p>

		<template v-if="isMemberBound">
			<p class="h-p4" @click.stop="openMember">
				<span>{{ memberName }}</span><span class="midline">|</span><span>{{ memberPhone }}</span>
			</p>
			<p class="h-p3 mtop" @click.stop="openMember">
				<text>{{ memberLevel }}</text>
			</p>
			<p class="h-line"></p>
			<p class="hp6 h-p1 mtop" @click.stop="openMember">
				<view>
					<text class="iconfont icon-qiapian"></text>
					<text style="margin-left: 3px;">{{ memberCardNo || '-' }}</text>
				</view>
				<view>
					<text class="iconfont icon-huiyuan1"></text>
					<text style="margin-left: 3px;">{{ memberName }}</text>
				</view>
				<view>
					<text class="iconfont icon-qian"></text>
					<text style="margin-left: 3px;">{{ memberBalance }}</text>
				</view>
			</p>
		</template>
		<template v-else>
			<p class="h-line"></p>
			<p class="hp6 h-p1 mtop" @click.stop="bindMember">
				<view>
					<text>尚未绑定会员，请点击绑定</text>
				</view>
			</p>
		</template>
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
			},
			member: {
				type: Object,
				default: () => ({})
			}
		},
		computed: {
			isMemberBound() {
				return !!(this.member && (this.member._id || this.carInfo.memberId))
			},
			memberName() {
				return this.member.name || this.carInfo.memberName || this.carInfo.owner || ''
			},
			memberPhone() {
				return this.member.phone || this.carInfo.ownerphone || ''
			},
			memberCardNo() {
				return this.member.cardNo || this.carInfo.memberCardNo || ''
			},
			memberBalance() {
				return this.member.balance !== undefined ? this.member.balance : (this.carInfo.memberBalance || 0)
			},
			memberLevel() {
				return this.member.level || (this.member._id || this.carInfo.memberId ? '会员' : '')
			}
		},
		methods: {
			clickToDetail() {
				this.$emit("clickHeaderCard")
			},
			openMember() {
				this.$emit("openMember", this.member)
			},
			bindMember() {
				this.$emit("bindMember")
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