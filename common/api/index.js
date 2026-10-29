import {login,get_enterprise,get_user_status} from "./login.js"
import {addcar,get_car_info_byId,get_car_info_by_carNumber} from "./carInfo.js"
import {addOrder,get_order_byId,get_order_byStatus,delete_order,get_order_byDate} from "./order.js"
import {get_hot_goods,get_All_goods} from "./goods.js"
import {get_purchased_goods,add_purchased_goods,delete_purchased_goods,update_purchased_goods} from "./purchased_goods.js"
import {add_pay_info,get_pay_info,delete_pay_info} from "./pay_info.js"
import {ocrLicensePlate} from "./image_ocr.js"
import {
	get_analytics_summary,
	analytics_test_data,
	seed_analytics_test_data,
	list_analytics_test_data,
	clear_analytics_test_data,
	create_analytics_test_data,
	update_analytics_test_data,
	remove_analytics_test_data
} from "./analytics.js"
export default {
	login,
	get_enterprise,
	addcar,
	addOrder,
	get_car_info_byId,
	get_order_byId,
	get_hot_goods,
	get_purchased_goods,
	add_purchased_goods,
	delete_purchased_goods,
	add_pay_info,
	get_pay_info,
	delete_pay_info,
	update_purchased_goods,
	get_All_goods,
	get_order_byStatus,
	get_car_info_by_carNumber,
	ocrLicensePlate,
	get_analytics_summary,
	analytics_test_data,
	seed_analytics_test_data,
	list_analytics_test_data,
	clear_analytics_test_data,
	create_analytics_test_data,
	update_analytics_test_data,
	remove_analytics_test_data,
	delete_order,
	get_order_byDate,
	get_user_status
}