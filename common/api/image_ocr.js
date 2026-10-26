// 车牌识别（百度 OCR）
// 统一走云函数代理 ocr_license_plate：
//   1. 百度 AK/SK 只存在于云函数（服务端），前端不再持有，App 反编译也拿不到
//   2. 云函数调用走微信内置云调用通道，小程序端无需把 aip.baidubce.com 加进 request 合法域名
// 重要：base64Image 必须是「纯 base64」，不能带 data:image/xxx;base64, 编码头
export const ocrLicensePlate = (base64Image) => {
	return new Promise((resolve, reject) => {
		uniCloud.callFunction({
			name: "ocr_license_plate",
			data: {
				image: base64Image
			}
		}).then((res) => {
			if (res.result && res.result.code == 200) {
				resolve(res.result)
			} else {
				reject(res.result || {
					code: -1,
					msg: "识别失败"
				})
			}
		}).catch((err) => {
			reject(err)
		})
	})
}
