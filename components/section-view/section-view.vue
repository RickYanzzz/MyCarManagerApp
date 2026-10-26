<template>
	<view>
		<uni-section class="my_section" :title="item.title">
			<template v-slot:decoration>
				<text :class="['iconfont',item.classStr,item.id==0?'textColor':'mytextColor']"></text>
			</template>
			<template v-slot:right>
				<text class="iconfont icon-21 addColor" @click="clickAddBtn(item)" v-show="item.status!=2"></text>
			</template>
		</uni-section>
		<view class="list-view">
			<uni-list v-if="item.id == 0" >
				<view class="" v-for="(data,index) in item.list" :key="index">
						<uni-swipe-action-item :disabled="status==2" :right-options="options" @click="onClick(data)" @change="change">
							<uni-list-item :title="data.name+' x'+data.count" :show-badge="true" :right-text="data.fee" 
								:badge-style="{background: '#CC71BF'}" clickable="true" @click="modifyItem(data)">
							</uni-list-item>
						</uni-swipe-action-item>
				</view>
			</uni-list>
			<uni-list v-if="item.id == 1">
				<view class="" v-for="(data,index) in item.list" :key="index">
						<uni-swipe-action-item :disabled="status==2"  :right-options="options" @click="onClickPayItem(data)" @change="change">
							<uni-list-item :title="data.name" :show-badge="true" :right-text="data.fee" 
								:badge-style="{background: '#CC71BF'}">
							</uni-list-item>
						</uni-swipe-action-item>
				</view>
			</uni-list>
		</view>
	</view>
</template>

<script>
	export default {
		name: "section-view",
		data() {
			return {
				options: [{
					text: '删除',
					style: {
						backgroundColor: '#dd524d'
					}
				}]
			};
		},
		props: {
			item: {
				type: Object,
				required: true
			},
			status:{
				type:Number,
				required:true
			}
		},
		methods: {
			onClick(e) {
				const that = this
				this.$api.delete_purchased_goods({
					_id:e._id
				}).then(res=>{
					that.$emit('onDeleteItem', 0)
				})
			},
			onClickPayItem(e) {
				const that = this
				this.$api.delete_pay_info({
					_id:e._id
				}).then(res=>{
					that.$emit('onDeleteItem', 1)
				})
			},
			
			swipeChange(e, index) {
				console.log('当前状态：' + e + '，下标：' + index)
			},
			clickAddBtn(item) {
				this.$emit('clickSection', item)
			},
			modifyItem(e){
				this.$emit('modifyMyItem',e)
			}
		}
	}
</script>

<style lang="scss">
	@import url("../../common/css/icons.css");

	.my_section {
		background-color: $uni-bg-color-grey;
		margin-left: 8px;
	}

	.addColor {
		color: $uni-color-primary;
	}

	.textColor {
		color: #E6AA46;
		margin-right: 5px;
	}

	.mytextColor {
		color: #CC71BF;
		margin-right: 5px;
	}

	.list-view {
		margin-left: 15px;
		margin-right: 15px;
	}
</style>