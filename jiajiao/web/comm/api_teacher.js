import {
	api
} from './api.js';

export function getCategoryCascadeList(){
	return api('/index/getCategoryCascadeList', 'post');
}
/**
 * 教师下架简历
 */
export function offProfile(){
	return api('/user/teacherOffProfile', 'post');
}
/**
 * 记录VIP消耗
 * @param {Object} data
 */
export function logTeacherVipCost(data){
	return api('/user/teacherVipCost', 'post', data, {showLoading: false});
}
/**
 * 教师退款
 */
export function teacherOrderRefund(){
	return api('/order/teacherOrderRefund', 'post');
}