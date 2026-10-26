<template>
	<view class="tagPage">
	  <uni-tag class="mytag"  :text="item.name" v-for="item in hotGoods" @click="clickItem(item)">

	  </uni-tag>
	</view>
</template>

<script>
	export default {
		name:"tag-page",
		data() {
			return {
				
			};
		},
		props:{
			hotGoods:{
				type:Array,
				required:true
			}
		},
		methods:{
			clickItem(item){
				this.$emit("clickTagPageItem",item);
				
			}
		}
	}
</script>

<style lang="scss">
   .tagPage{
	   display: flex;
	   align-items: center;
	   justify-content: flex-start;
	   padding: 10px;
	   box-sizing: border-box;
	   flex-wrap: wrap;
	   .mytag{
		   background-color: $uni-bg-color-grey;
		   color: black;
		   border: 0px;
		   border-radius: 10px;
		   margin-bottom: 10px;
		   font-size: 13px;
	   }
   }
</style>