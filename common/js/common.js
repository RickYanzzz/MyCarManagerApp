export default {
	uuid() {
		var s = [];
		var hexDigits = "0123456789abcdef";
		for (var i = 0; i < 32; i++) {
			s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
		}
		s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
		s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
		s[8] = s[13] = s[18] = s[23];
		var uuid = s.join("");
		return uuid;
	},

	// dateTimeStamp是一个时间毫秒，注意时间戳是秒的形式，在这个毫秒的基础上除以1000，就是十位数的时间戳。13位数的都是时间毫秒。
	formatDate(dateTimeStamp) {
		var result
		var minute = 1000 * 60 // 把分，时，天，周，半个月，一个月用毫秒表示
		var hour = minute * 60
		var day = hour * 24
		var week = day * 7
		var halfamonth = day * 15
		var month = day * 30
		var now = new Date().getTime() // 获取当前时间毫秒
		var diffValue = now - dateTimeStamp // 时间差

		if (diffValue < 0) {
			return
		}
		var minC = diffValue / minute // 计算时间差的分，时，天，周，月
		var hourC = diffValue / hour
		var dayC = diffValue / day
		var weekC = diffValue / week
		var monthC = diffValue / month
		// if (monthC >= 1 && monthC <= 3) {
		//   result = " " + parseInt(monthC) + "月前"
		// } else
		//
		// if (weekC >= 1 && weekC <= 3) {
		//   result = " " + parseInt(weekC) + "周前"
		// } else

		if (dayC >= 1 && dayC <= 6) {
			result = ' ' + parseInt(dayC) + '天前'
		} else if (hourC >= 1 && hourC <= 23) {
			result = ' ' + parseInt(hourC) + '小时前'
		} else if (minC >= 1 && minC <= 59) {
			result = ' ' + parseInt(minC) + '分钟前'
		} else if (diffValue >= 0 && diffValue <= minute) {
			result = '刚刚'
		} else {
			var datetime = new Date()
			datetime.setTime(dateTimeStamp)
			var Nyear = datetime.getFullYear()
			var Nmonth = datetime.getMonth() + 1 < 10 ? '0' + (datetime.getMonth() + 1) : datetime.getMonth() + 1
			var Ndate = datetime.getDate() < 10 ? '0' + datetime.getDate() : datetime.getDate()
			var Nhour = datetime.getHours() < 10 ? '0' + datetime.getHours() : datetime.getHours()
			var Nminute = datetime.getMinutes() < 10 ? '0' + datetime.getMinutes() : datetime.getMinutes()
			var Nsecond = datetime.getSeconds() < 10 ? '0' + datetime.getSeconds() : datetime.getSeconds()
			result = Nyear + '-' + Nmonth + '-' + Ndate
		}
		return result
	},
	formatToTodayDate(dateTimeStamp) {
		var result
		var minute = 1000 * 60 // 把分，时，天，周，半个月，一个月用毫秒表示
		var hour = minute * 60
		var day = hour * 24
		var week = day * 7
		var halfamonth = day * 15
		var month = day * 30
		var now = new Date().getTime() // 获取当前时间毫秒
		var diffValue = now - dateTimeStamp // 时间差
		if (diffValue < 0) {
			return
		}
		var datetime = new Date()
		datetime.setTime(dateTimeStamp)
		var Nyear = datetime.getFullYear()
		var Nmonth = datetime.getMonth() + 1 < 10 ? '0' + (datetime.getMonth() + 1) : datetime.getMonth() + 1
		var Ndate = datetime.getDate() < 10 ? '0' + datetime.getDate() : datetime.getDate()
		var Nhour = datetime.getHours() < 10 ? '0' + datetime.getHours() : datetime.getHours()
		var Nminute = datetime.getMinutes() < 10 ? '0' + datetime.getMinutes() : datetime.getMinutes()
		var Nsecond = datetime.getSeconds() < 10 ? '0' + datetime.getSeconds() : datetime.getSeconds()
		result = Nyear + '-' + Nmonth + '-' + Ndate
		return result
	},
	getTomorrowTimestamp(){
		const d = new Date()
		d.setHours(0, 0, 0, 0)
		return d.getTime() + 24 * 60 * 60 * 1000
	},
	getToDayTimestamp(){
		const d = new Date()
		d.setHours(0, 0, 0, 0)
		return d.getTime()
	},
	setDataUserId(data){
		const user = uni.getStorageSync("userInfo")
		if(user){
			data.userId = user._id
			data.enterpriseId = user.enterpriseId
		}
		
	}
}