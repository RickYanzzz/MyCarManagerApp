<template>
	<view class="uni-container">
		<uni-forms ref="form" :model="formData" validate-trigger="submit" err-show-type="toast">
			<uni-forms-item name="carNumber" label="车牌号">
				<uni-easyinput placeholder="车牌号" v-model="formData.carNumber"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="owner" label="车主姓名">
				<uni-easyinput placeholder="车主姓名" v-model="formData.owner"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="ownerphone" label="联系方式">
				<uni-easyinput placeholder="联系方式" v-model="formData.ownerphone"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="carType" label="车类型">
				<uni-easyinput placeholder="车类型；0五座，1SUV，2其他" v-model="formData.carType"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="brand" label="车辆品牌">
				<uni-easyinput placeholder="车辆品牌" v-model="formData.brand"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="engineNumber" label="发动机号">
				<uni-easyinput placeholder="发动机号" v-model="formData.engineNumber"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="frame" label="车架号">
				<uni-easyinput placeholder="车架号" v-model="formData.frame"></uni-easyinput>
			</uni-forms-item>
			<uni-forms-item name="insure" label="保险到期">
				<uni-datetime-picker return-type="timestamp" v-model="formData.insure"></uni-datetime-picker>
			</uni-forms-item>
			<uni-forms-item name="other" label="其他说明">
				<uni-easyinput placeholder="其他说明" v-model="formData.other"></uni-easyinput>
			</uni-forms-item>
			<view class="uni-button-group">
				<button type="primary" class="uni-button" @click="submit">提交</button>
			</view>
		</uni-forms>
	</view>
</template>

<script>
	import { validator } from '../../js_sdk/validator/car_info.js'

	function getValidator(fields) {
		let result = {}
		for (let key in validator) {
			if (fields.indexOf(key) > -1) {
				result[key] = validator[key]
			}
		}
		return result
	}

	export default {
		data() {
			const formData = {
				carNumber: '',
				owner: '',
				ownerphone: '',
				carType: '',
				brand: '',
				engineNumber: '',
				frame: '',
				insure: null,
				other: ''
			}
			return {
				orderId: '',
				formDataId: '',
				formData,
				formOptions: {},
				rules: {
					...getValidator(Object.keys(formData))
				}
			}
		},
		onLoad(options) {
			if (options.id) {
				this.formDataId = options.id
				this.orderId = options.orderId || ''
				this.getDetail(options.id)
			}
		},
		onReady() {
			this.$refs.form.setRules(this.rules)
		},
		methods: {
			submit() {
				uni.showLoading({
					mask: true
				})
				this.$refs.form.validate().then((res) => {
					return this.submitForm(res)
				}).catch(() => {
				}).finally(() => {
					uni.hideLoading()
				})
			},
			submitForm(value) {
				return this.$api.update_car_info(Object.assign({
					_id: this.formDataId
				}, value)).then(() => {
					uni.showToast({
						icon: 'none',
						title: '修改成功'
					})
					if (this.getOpenerEventChannel) {
						this.getOpenerEventChannel().emit('refreshData', this.orderId)
					}
					setTimeout(() => uni.navigateBack(), 500)
				}).catch((err) => {
					uni.showModal({
						content: (err && (err.msg || err.errMsg || err.message)) || '请求服务失败',
						showCancel: false
					})
				})
			},
			getDetail(id) {
				uni.showLoading({
					mask: true
				})
				this.$api.get_car_info_byId({
					carInfoId: id
				}).then((res) => {
					const data = res.data || {}
					if (data && data._id) {
						this.formData = {
							carNumber: data.carNumber || '',
							owner: data.owner || '',
							ownerphone: data.ownerphone || '',
							carType: data.carType || '',
							brand: data.brand || '',
							engineNumber: data.engineNumber || '',
							frame: data.frame || '',
							insure: data.insure || null,
							other: data.other || ''
						}
					}
				}).catch((err) => {
					uni.showModal({
						content: (err && (err.msg || err.errMsg || err.message)) || '请求服务失败',
						showCancel: false
					})
				}).finally(() => {
					uni.hideLoading()
				})
			}
		}
	}
</script>

<style>
	.uni-container {
		padding: 15px;
	}

	.uni-input-border,
	.uni-textarea-border {
		width: 100%;
		font-size: 14px;
		color: #666;
		border: 1px #e5e5e5 solid;
		border-radius: 5px;
		box-sizing: border-box;
	}

	.uni-input-border {
		padding: 0 10px;
		height: 35px;
	}

	.uni-textarea-border {
		padding: 10px;
		height: 80px;
	}

	.uni-button-group {
		margin-top: 50px;
		display: flex;
		justify-content: center;
	}

	.uni-button {
		width: 184px;
	}
</style>
