const Config = {
	active: 'prod',
	dev: {
		url: 'http://localhost:8080/api',
		ossHost: 'http://localhost:8080'
	},
	prod: {
		url: 'https://www.xxjjwz.com',
		ossHost: 'https://www.xxjjwz.com'
	}
}

const url = Config[Config.active].url;
const ossHost = Config[Config.active].ossHost;
var loadingCount = 0
const api = (urls, method, data = {}, options = {showLoading: true}) => {
	if(options.showLoading && loadingCount > 0){
		uni.showLoading({
			title: '请求中...'
		})
	}

	loadingCount++
	return new Promise((resolve, reject) => {
		uni.request({
			url: url + urls,
			method,
			data,
			// timeout: 3000,
			header: {
				Authorization: uni.getStorageSync('token') || ''
			},
			success(res) {
				loadingCount--
				if (loadingCount == 0 && options.showLoading) {
					uni.hideLoading()
				}
				if (res.statusCode >= 200 && res.statusCode < 300) {
					resolve(res.data)
					if (res.data.status == '101') {
						uni.clearStorageSync()
						uni.showToast({
							title: '登录失效，请重新登录',
							icon: "none",
							duration: 1000
						})
						setTimeout(() => {
							uni.navigateTo({
								url: '/my/getPhone/getPhone'
							})
						}, 1000)

					}
				} else {
					reject(res.data)
				}
			},
			fail(err) {
				loadingCount--
				if (loadingCount == 0 && options.showLoading) {
					uni.hideLoading()
				}
				reject(err)
			}
		})
	})
}
module.exports = {
	api,
	url,
	ossHost
}