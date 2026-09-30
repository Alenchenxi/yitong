import {
	api,
	url
} from './api.js';
export function getCategoryCascadeList(){
	return api('/index/getCategoryCascadeList', 'post');
}
export async function getCityCascade(){
	return api('/index/getCityCascade', 'post');
}
/**
 * 获取城市关联的地区列表
 * @param {Object} cityId
 */
export async function getCityCountyList(cityId){
	return api('/index/getAreaList', 'post', {city_id: cityId});
}
/**
 * 上传文件
 * @param {Object} filepath
 * @param {Object} name
 * @param {Object} callback
 */
export function uploadFile(filepath, name, callback){
	let that = this
	uni.uploadFile({
		url: url + '/Base/upload',
		filePath: filepath,
		name: name,
		success(res) {
			if (typeof res.data == 'object') {
				callback(res.data.data)
			} else {
				callback(JSON.parse(res.data).data)
			}
		},
		fail(error){
			console.log('=====> upload error ', error)
		}
	})
}
/**
 * 获取小程序配置
 */
export function getMiniConfig(){
	return api('/index/getMiniConfig', 'get');
}