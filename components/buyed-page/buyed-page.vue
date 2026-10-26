<template>
	<view>
		<uni-list>
			<uni-list-item v-for="(data,index) in PurchasedGoods" :key="index"  :title="data.name"  :show-badge="true"  :badge-text="data.count" :badge-style="{background: '#CC71BF'}">
				
			</uni-list-item>
		</uni-list>	
	</view>
</template>

<script>
	export default {
		name:"buyed-page",
		data() {
			return {
				
			};
		},
		props:{
			PurchasedGoods:{
				type:Array,
				required:true
			}
		}
	}
</script>

<style lang="scss">

</style>