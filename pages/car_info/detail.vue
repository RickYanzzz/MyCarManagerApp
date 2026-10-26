<template>
  <view class="container">
    <unicloud-db ref="udb" v-slot:default="{data, loading, error, options}" :options="options" :collection="collectionList" field="carNumber,owner,ownerphone,carType,brand,engineNumber,frame,insure,other" :where="queryWhere" :getone="true" :manual="true">
      <view v-if="error">{{error.message}}</view>
      <view v-else-if="loading">
        <uni-load-more :contentText="loadMore" status="loading"></uni-load-more>
      </view>
      <view v-else-if="data">
        <view>
          <text>车牌号</text>
          <text>{{data.carNumber}}</text>
        </view>
        <view>
          <text>车主姓名</text>
          <text>{{data.owner}}</text>
        </view>
        <view>
          <text>联系方式</text>
          <text>{{data.ownerphone}}</text>
        </view>
        <view>
          <text>车类型</text>
          <text>{{data.carType}}</text>
        </view>
        <view>
          <text>车辆品牌</text>
          <text>{{data.brand}}</text>
        </view>
        <view>
          <text>发动机号</text>
          <text>{{data.engineNumber}}</text>
        </view>
        <view>
          <text>车架号</text>
          <text>{{data.frame}}</text>
        </view>
        <view>
          <text>保险到期</text>
          <uni-dateformat :threshold="[0, 0]" :date="data.insure"></uni-dateformat>
        </view>
        <view>
          <text>其他说明</text>
          <text>{{data.other}}</text>
        </view>
      </view>
    </unicloud-db>
    <view class="btns">
      <button type="primary" @click="handleUpdate">修改</button>
      <button type="warn" class="btn-delete" @click="handleDelete">删除</button>
    </view>
  </view>
</template>

<script>
  // 由schema2code生成，包含校验规则和enum静态数据
  import { enumConverter } from '../../js_sdk/validator/car_info.js'
  const db = uniCloud.database()

  export default {
    data() {
      return {
        queryWhere: '',
        collectionList: "car_info",
        loadMore: {
          contentdown: '',
          contentrefresh: '',
          contentnomore: ''
        },
        options: {
          // 将scheme enum 属性静态数据中的value转成text
          ...enumConverter
        }
      }
    },
    onLoad(e) {
      this._id = e.id
    },
    onReady() {
      if (this._id) {
        this.queryWhere = '_id=="' + this._id + '"'
      }
    },
    methods: {
      handleUpdate() {
        // 打开修改页面
        uni.navigateTo({
          url: './edit?id=' + this._id,
          events: {
            // 监听修改页面成功修改数据后, 刷新当前页面数据
            refreshData: () => {
              this.$refs.udb.loadData({
                clear: true
              })
            }
          }
        })
      },
      handleDelete() {
        this.$refs.udb.remove(this._id, {
          success: (res) => {
            // 删除数据成功后跳转到list页面
            uni.navigateTo({
              url: './list'
            })
          }
        })
      }
    }
  }
</script>

<style>
  .container {
    padding: 10px;
  }

  .btns {
    margin-top: 10px;
    /* #ifndef APP-NVUE */
    display: flex;
    /* #endif */
    flex-direction: row;
  }

  .btns button {
    flex: 1;
  }

  .btn-delete {
    margin-left: 10px;
  }
</style>
