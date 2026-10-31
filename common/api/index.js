import { login, get_enterprise, get_user_status } from "./login.js"
import { addcar, get_car_info_byId, get_car_info_by_carNumber, get_car_info_list, update_car_info, delete_car_info } from "./carInfo.js"
import { addOrder, get_order_byId, get_order_byStatus, delete_order, get_order_byDate } from "./order.js"
import { get_hot_goods, get_All_goods } from "./goods.js"
import { get_purchased_goods, add_purchased_goods, delete_purchased_goods, update_purchased_goods } from "./purchased_goods.js"
import { add_pay_info, get_pay_info, delete_pay_info } from "./pay_info.js"
import { ocrLicensePlate } from "./image_ocr.js"
import {
	add_member,
	get_member,
	list_members,
	update_member,
	set_member_status,
	bind_member_car,
	recharge_member,
	consume_member_balance,
	get_member_transactions
} from "./member.js"
import {
	get_spare_parts,
	get_spare_part_by_id,
	add_spare_part,
	update_spare_part,
	delete_spare_part,
	stock_in_spare_part,
	issue_spare_parts,
	return_spare_part,
	adjust_spare_part_stock,
	get_spare_part_logs
} from "./spareParts.js"
import mockApi from "../mock/api.js"
import { USE_MOCK } from "../mock/config.js"
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


const realApi = {
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
	get_user_status,
	get_car_info_list,
	update_car_info,
	delete_car_info,
	get_spare_parts,
	get_spare_part_by_id,
	add_spare_part,
	update_spare_part,
	delete_spare_part,
	stock_in_spare_part,
	issue_spare_parts,
	return_spare_part,
	adjust_spare_part_stock,
	get_spare_part_logs,
	add_member,
	get_member,
	list_members,
	update_member,
	set_member_status,
	bind_member_car,
	recharge_member,
	consume_member_balance,
	get_member_transactions
}

// 默认走真实 uniCloud API；本地无云调试时才在 common/mock/config.js 打开 mock。
export default USE_MOCK ? mockApi : realApi
