<template>
	<view class="sp-page">
		<nav-header type="spareParts" :title="isEdit ? '编辑备件' : '新增备件'"></nav-header>

		<scroll-view class="sp-scroll" scroll-y="true">
			<view class="sp-form">
				<view class="sp-field" v-if="isEdit">
					<text class="sp-label">备件编号</text>
					<text class="sp-readonly">{{ form.code }}</text>
				</view>
				<view class="sp-field">
					<text class="sp-label">名称 <text class="sp-required">*</text></text>
					<uni-easyinput v-model="form.name" placeholder="如：机油滤清器" />
				</view>
				<view class="sp-field">
					<text class="sp-label">规格/型号</text>
					<uni-easyinput v-model="form.spec" placeholder="如：JX-001" />
				</view>
				<view class="sp-field">
					<text class="sp-label">单位 <text class="sp-required">*</text></text>
					<uni-easyinput v-model="form.unit" placeholder="个 / 件 / 套 / 桶" />
				</view>
				<view class="sp-field">
					<text class="sp-label">安全库存</text>
					<uni-easyinput type="number" v-model="form.safetyStock" placeholder="低于该值预警" />
				</view>
				<view class="sp-field">
					<text class="sp-label">仓位</text>
					<uni-easyinput v-model="form.location" placeholder="如：A-01" />
				</view>
				<view class="sp-field">
					<text class="sp-label">供应商</text>
					<uni-easyinput v-model="form.supplier" placeholder="默认供应商" />
				</view>
				<view class="sp-field">
					<text class="sp-label">成本价（元）</text>
					<uni-easyinput type="number" v-model="form.costPrice" placeholder="采购成本" />
				</view>
				<view class="sp-field">
					<text class="sp-label">销售价（元）</text>
					<uni-easyinput type="number" v-model="form.salePrice" placeholder="出库计入工单的单价" />
				</view>
				<view class="sp-tip">
					<text v-if="!isEdit">新增后备件库存为 0，请在详情页做入库。</text>
					<text v-else>当前库存 {{ form.stock }} {{ form.unit }}，请通过入库/盘点调整。</text>
				</view>
			</view>

			<view class="sp-submit-wrap">
				<button class="sp-submit" type="primary" @click="submit">{{ isEdit ? '保存修改' : '创建备件' }}</button>
			</view>
			<view class="sp-bottom-space"></view>
		</scroll-view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				isEdit: false,
				partId: '',
				form: {
					code: '',
					name: '',
					spec: '',
					unit: '个',
					stock: 0,
					safetyStock: 0,
					location: '',
					supplier: '',
					costPrice: 0,
					salePrice: 0
				}
			}
		},
		onLoad(options) {
			if (options.id) {
				this.isEdit = true
				this.partId = options.id
				this.loadData()
			}
		},
		methods: {
			loadData() {
				uni.showLoading({
					title: '加载中...'
				})
				this.$api.get_spare_part_by_id({
					id: this.partId
				}).then(res => {
					const part = res.data || {}
					this.form = {
						code: part.code || '',
						name: part.name || '',
						spec: part.spec || '',
						unit: part.unit || '个',
						stock: Number(part.stock || 0),
						safetyStock: Number(part.safetyStock || 0),
						location: part.location || '',
						supplier: part.supplier || '',
						costPrice: Number(part.costPrice || 0),
						salePrice: Number(part.salePrice || 0)
					}
				}).catch(err => {
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '加载失败',
						icon: 'none'
					})
				}).finally(() => {
					uni.hideLoading()
				})
			},
			submit() {
				if (!String(this.form.name || '').trim()) {
					return uni.showToast({ title: '请输入备件名称', icon: 'none' })
				}
				if (!String(this.form.unit || '').trim()) {
					return uni.showToast({ title: '请输入单位', icon: 'none' })
				}
				const payload = {
					name: String(this.form.name || '').trim(),
					spec: this.form.spec || '',
					unit: String(this.form.unit || '').trim(),
					safetyStock: parseInt(this.form.safetyStock || 0) || 0,
					location: this.form.location || '',
					supplier: this.form.supplier || '',
					costPrice: parseInt(this.form.costPrice || 0) || 0,
					salePrice: parseInt(this.form.salePrice || 0) || 0
				}
				uni.showLoading({
					title: '保存中...'
				})
				const request = this.isEdit
					? this.$api.update_spare_part(Object.assign({ _id: this.partId }, payload))
					: this.$api.add_spare_part(payload)
				request.then(() => {
					uni.hideLoading()
					uni.showToast({
						title: this.isEdit ? '修改成功' : '创建成功',
						icon: 'none'
					})
					setTimeout(() => uni.navigateBack(), 500)
				}).catch(err => {
					uni.hideLoading()
					uni.showToast({
						title: (err && (err.msg || err.errMsg)) || '保存失败',
						icon: 'none'
					})
				})
			}
		}
	}
</script>

<style>
	.sp-page {
		background-color: #F4F8FB;
		min-height: 100vh;
	}

	.sp-scroll {
		height: calc(100vh - 88px);
		box-sizing: border-box;
	}

	.sp-form {
		background-color: #ffffff;
		border-radius: 8px;
		margin: 12px;
		padding: 6px 14px;
	}

	.sp-field {
		padding: 12px 0;
		border-bottom: 1px solid #F0F0F0;
	}

	.sp-field:last-child {
		border-bottom: none;
	}

	.sp-label {
		display: block;
		font-size: 13px;
		color: #666666;
		margin-bottom: 8px;
	}

	.sp-required {
		color: #FF4D4F;
	}

	.sp-readonly {
		display: block;
		font-size: 15px;
		color: #333333;
	}

	.sp-tip {
		padding: 12px 0;
		font-size: 12px;
		color: #999999;
		line-height: 1.6;
	}

	.sp-submit-wrap {
		padding: 10px 12px 30px;
	}

	.sp-submit {
		background-color: #6EA0F7;
		font-size: 15px;
	}

	.sp-bottom-space {
		height: 30px;
	}
</style>
