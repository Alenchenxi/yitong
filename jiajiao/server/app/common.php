<?php
// +----------------------------------------------------------------------
// | 应用公共文件
// +----------------------------------------------------------------------
// | Copyright (c) 2006-2016 http://thinkphp.cn All rights reserved.
// +----------------------------------------------------------------------
// | Licensed ( http://www.apache.org/licenses/LICENSE-2.0 )
// +----------------------------------------------------------------------
// | Author:
// +----------------------------------------------------------------------

use think\facade\Config;
use think\facade\Db;

error_reporting(0);

/**
 * 随机字符
 * @param int $length 长度
 * @param string $type 类型
 * @param int $convert 转换大小写 1大写 0小写
 * @return string
 */
function random($length = 10, $type = 'letter', $convert = 0) {
	$config = array(
		'number' => '1234567890',
		'letter' => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
		'string' => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789',
		'all' => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
	);

	if (!isset($config[$type])) {
		$type = 'letter';
	}

	$string = $config[$type];

	$code = '';
	$strlen = strlen($string) - 1;
	for ($i = 0; $i < $length; $i++) {
		$code .= $string{mt_rand(0, $strlen)};
	}
	if (!empty($convert)) {
		$code = ($convert > 0) ? strtoupper($code) : strtolower($code);
	}
	return $code;
}

/*
 * 生成交易流水号
 * @param char(2) $type
 */
function doOrderSn($type) {
	return date('YmdHis') . $type . substr(microtime(), 2, 3) . sprintf('%02d', rand(0, 99));
	//return rand(10, 99).substr(microtime(), 2, 3) .  sprintf('%02d', rand(0, 99));
}

function deldir($dir) {
//先删除目录下的文件：
	$dh = opendir($dir);
	while ($file = readdir($dh)) {
		if ($file != "." && $file != "..") {
			$fullpath = $dir . "/" . $file;
			if (!is_dir($fullpath)) {
				unlink($fullpath);
			} else {
				deldir($fullpath);
			}
		}
	}

	closedir($dh);
	//删除当前文件夹：
	if (rmdir($dir)) {
		return true;
	} else {
		return false;
	}
}

/**
 * 数据签名认证
 * @param array $data 被认证的数据
 * @return string       签名
 */
function data_auth_sign($data) {
	//数据类型检测
	if (!is_array($data)) {
		$data = (array) $data;
	}
	ksort($data); //排序
	$code = http_build_query($data); //url编码并生成query字符串
	$sign = sha1($code); //生成签名
	return $sign;
}

//通过字段值获取字段配置的名称
function getFieldVal($val, $fieldConfig) {
	if ($fieldConfig) {
		foreach (explode(',', $fieldConfig) as $k => $v) {
			$tempstr = explode('|', $v);
			foreach (explode(',', $val) as $m => $n) {
				if ($tempstr[1] == $n) {
					$fieldvals .= $tempstr[0] . ',';
				}
			}

		}
		return rtrim($fieldvals, ',');
	}
}

//通过字段名称获取字段配置的值
function getFieldName($val, $fieldConfig) {
	if ($fieldConfig) {
		foreach (explode(',', $fieldConfig) as $k => $v) {
			$tempstr = explode('|', $v);
			if ($tempstr[0] == $val) {
				$fieldval = $tempstr[1];
			}
		}
		return $fieldval;
	}
}

//通过键值返回键名
function getKeyByVal($array, $data) {
	foreach ($array as $key => $val) {
		if ($val == $data) {
			$data = $key;
		}
	}
	return $data;
}

//导出时候当有三级联动字段的时候 需要将查询字段重载
function formartExportWhere($field) {
	foreach ($field as $k => $v) {
		if (strpos($v, '|') > 0) {
			$dt = $field[$k];
			unset($field[$k]);
		}
	}

	return \xhadmin\CommonService::filterEmptyArray(array_merge($field, explode('|', $dt)));
}

/*格式化列表*/
function formartList($fieldConfig, $list) {
	$cat = new \org\Category($fieldConfig);
	$ret = $cat->getTree($list);
	return $ret;
}

/*写入
 * @param  string  $type 1 为生成控制器
 */

function filePutContents($content, $filepath, $type) {
	if (in_array($type, [1, 3])) {
		$str = file_get_contents($filepath);
		$parten = '/\s\/\*+start\*+\/(.*)\/\*+end\*+\//iUs';
		preg_match_all($parten, $str, $all);
		if ($all[0]) {
			foreach ($all[0] as $key => $val) {
				$ext_content .= $val . "\n\n";
			}
		}

		$content .= $ext_content . "\n\n";
		if ($type == 1) {
			$content .= "}\n\n";
		}
	}

	ob_start();
	echo $content;
	$_cache = ob_get_contents();
	ob_end_clean();

	if ($_cache) {
		$File = new \think\template\driver\File();
		$File->write($filepath, $_cache);
	}
}

function htmlOutList($list, $err_status = false) {
	foreach ($list as $key => $row) {
		$res[$key] = checkData($row, $err_status);
	}
	return $res;
}

//err_status  没有数据是否抛出异常 true 是 false 否
function checkData($data, $err_status = true) {
	if (empty($data) && $err_status) {
		abort(412, '没有数据');
	}

	if (is_object($data)) {
		$data = $data->toArray();
	}

	foreach ($data as $k => $v) {
		if ($v && is_array($v)) {
			$data[$k] = checkData($v);
		} else {
			$data[$k] = html_out($v);
		}
	}
	return $data;

}

//html代码输入
function html_in($str) {
	$str = htmlspecialchars($str);
	$str = strip_tags($str);
	$str = addslashes($str);
	return $str;
}

//html代码输出
function html_out($str) {
	$str = htmlspecialchars_decode($str);
	$str = stripslashes($str);
	return $str;
}

//后台sql输入框语句过滤
function sql_replace($str) {
	$farr = ["/insert[\s]+|update[\s]+|create[\s]+|alter[\s]+|delete[\s]+|drop[\s]+|load_file|outfile|dump/is"];
	$str = preg_replace($farr, '', $str);
	return $str;
}

//上传文件黑名单过滤
function upload_replace($str) {
	$farr = ["/php|php3|php4|php5|phtml|pht|/is"];
	$str = preg_replace($farr, '', $str);
	return $str;
}

//查询方法过滤
function serach_in($str) {
	$farr = ["/^select[\s]+|insert[\s]+|and[\s]+|or[\s]+|create[\s]+|update[\s]+|delete[\s]+|alter[\s]+|count[\s]+|\'|\/\*|\*|\.\.\/|\.\/|union|into|load_file|outfile/i"];
	$str = preg_replace($farr, '', html_in($str));
	return trim($str);
}

//返回字段定义的时间格式
function getTimeFormat($val) {
	$default_time_format = explode('|', $val['default_value']);
	$time_format = $default_time_format[0];
	if (!$time_format || $val['default_value'] == 'null') {
		$time_format = 'Y-m-d H:i:s';
	}
	return $time_format;
}

/**
 * 过滤掉空的数组
 * @access protected
 * @param array $data 数据
 * @return array
 */
function filterEmptyArray($data = []) {
	foreach ($data as $k => $v) {
		if (!$v && $v !== 0) {
			unset($data[$k]);
		}

	}
	return $data;
}

/**
 * tp官方数组查询方法废弃，数组转化为现有支持的查询方法
 * @param array $data 原始查询条件
 * @return array
 */
function formatWhere($data) {
	$where = [];
	foreach ($data as $k => $v) {
		if (is_array($v)) {
			if (((string) $v[1] != null && !is_array($v[1])) || (is_array($v[1]) && (string) $v[1][0] != null)) {
				switch (strtolower($v[0])) {
				//模糊查询
				case 'like':
					$v[1] = '%' . $v[1] . '%';
					break;

				//表达式查询
				case 'exp':
					$v[1] = Db::raw($v[1]);
					break;
				}
				$where[] = [$k, $v[0], $v[1]];
			}
		} else {
			if ((string) $v != null) {
				$where[] = [$k, '=', $v];
			}
		}
	}
	return $where;
}

function getUploadServerUrl($upload_config_id = '') {
	if (config('my.oss_status') && config('my.oss_upload_type') == 'client') {
		$appname = app('http')->getName();
		switch (config('my.oss_default_type')) {
		case 'qiniuyun';
			$serverurl = 'http://up-z0.qiniup.com?&' . url($appname . '/Base/getOssToken') . '&' . config('my.qny_oss_domain');
			break;

		case 'ali':
			$serverurl = getendpoint(config('my.ali_oss_endpoint')) . '?&' . url($appname . '/Base/getOssToken');
			break;
		}
	} else {
		$serverurl = url("admin/Upload/uploadImages", ['upload_config_id' => $upload_config_id]);
	}

	return $serverurl;
}

function getendpoint($str) {
	if (strpos(config('my.ali_oss_endpoint'), 'aliyuncs.com') !== false) {
		if (strpos($str, 'https') !== false) {
			$point = 'https://' . config('my.ali_oss_bucket') . '.' . substr($str, 8);
		} else {
			$point = 'http://' . config('my.ali_oss_bucket') . '.' . substr($str, 7);
		}
	} else {
		$point = config('my.ali_oss_endpoint');
	}
	return $point;
}

//导出excel表头设置
function getTag($key3, $no = 100) {
	$data = [];
	$key = ord("A"); //A--65
	$key2 = ord("@"); //@--64
	for ($n = 1; $n <= $no; $n++) {
		if ($key > ord("Z")) {
			$key2 += 1;
			$key = ord("A");
			$data[$n] = chr($key2) . chr($key); //超过26个字母时才会启用
		} else {
			if ($key2 >= ord("A")) {
				$data[$n] = chr($key2) . chr($key); //超过26个字母时才会启用
			} else {
				$data[$n] = chr($key);
			}
		}
		$key += 1;
	}
	return $data[$key3];
}

/**
 * 实例化数据库类
 * @param string $name 操作的数据表名称（不含前缀）
 * @param array|string $config 数据库配置参数
 * @param bool $force 是否强制重新连接
 * @return \think\db\Query
 */
if (!function_exists('db')) {

	function db($name = '', $connect = '') {
		if (empty($connect)) {
			$connect = config('database.default');
		}
		return Db::connect($connect, false)->name($name);
	}
}

// 微信提现到零钱方法
function wxTiXian($batch_name, $out_trade_no, $money, $openid) {
	$url = 'https://api.mch.weixin.qq.com/v3/transfer/batches';
	$pars = [];
	$pars['appid'] = config('my.mini_program.app_id'); //直连商户的appid
	$pars['out_batch_no'] = 'sjzz' . date('Ymd') . mt_rand(1000, 9999); //商户系统内部的商家批次单号，要求此参数只能由数字、大小写字母组成，在商户系统内部唯一
	$pars['batch_name'] = $batch_name; //该笔批量转账的名称
	$pars['batch_remark'] = $batch_name; //转账说明，UTF8编码，最多允许32个字符
	$pars['total_amount'] = intval($money * 100); //转账总金额 单位为“分”
	$pars['total_num'] = 1; //转账总笔数
	$pars['transfer_detail_list'][0] = [
		'out_detail_no' => 'Dh' . $out_trade_no,
		'transfer_amount' => $pars['total_amount'],
		'transfer_remark' => $batch_name,
		'openid' => $openid,
	]; //转账明细列表
	$token = getToken($pars); //获取token
	$res = https_request($url, json_encode($pars), $token); //发送请求
	$resArr = json_decode($res, true);
	//halt($resArr);
	return $resArr;
	//成功返回
	// array(3) {
	//   ["batch_id"] => string(40) "1030001016101247194272022062900873000000"
	//   ["create_time"] => string(25) "2022-06-29T10:21:30+08:00"
	//   ["out_batch_no"] => string(16) "sjzz202206291647001"
	// }
}

//获取 token
function getToken($pars) {
	// $url = 'https://api.mch.weixin.qq.com/v3/certificates';
	$url = 'https://api.mch.weixin.qq.com/v3/transfer/batches';
	$http_method = 'POST'; //请求方法（GET,POST,PUT）
	$timestamp = time(); //请求时间戳
	$url_parts = parse_url($url); //获取请求的绝对URL
	$nonce = $timestamp . rand('10000', '99999'); //请求随机串
	$body = json_encode((object) $pars); //请求报文主体
	$stream_opts = [
		"ssl" => [
			"verify_peer" => false,
			"verify_peer_name" => false,
		],
	];
	$apiclient_cert_path = config('my.wechart_pay.cert_path');
	$apiclient_key_path = config('my.wechart_pay.key_path');

	$apiclient_cert_arr = openssl_x509_parse(file_get_contents($apiclient_cert_path, false, stream_context_create($stream_opts)));
	$serial_no = $apiclient_cert_arr['serialNumberHex']; //证书序列号
	$mch_private_key = file_get_contents($apiclient_key_path, false, stream_context_create($stream_opts)); //密钥
	$merchant_id = config('my.wechart_pay.mch_id'); //商户id
	$canonical_url = ($url_parts['path'] . (!empty($url_parts['query']) ? "?${url_parts['query']}" : ""));
	$message = $http_method . "\n" .
		$canonical_url . "\n" .
		$timestamp . "\n" .
		$nonce . "\n" .
		$body . "\n";
	openssl_sign($message, $raw_sign, $mch_private_key, 'sha256WithRSAEncryption');
	$sign = base64_encode($raw_sign); //签名
	$schema = 'WECHATPAY2-SHA256-RSA2048';
	$token = sprintf('mchid="%s",nonce_str="%s",timestamp="%d",serial_no="%s",signature="%s"',
		$merchant_id, $nonce, $timestamp, $serial_no, $sign); //微信返回token
	return $token;
}

function https_request($url, $data = null, $token) {
	$curl = curl_init();
	curl_setopt($curl, CURLOPT_URL, (string) $url);
	curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, FALSE);
	curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, FALSE);
	if (!empty($data)) {
		curl_setopt($curl, CURLOPT_POST, 1);
		curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
	}
	curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
	//添加请求头
	$headers = [
		'Authorization:WECHATPAY2-SHA256-RSA2048 ' . $token,
		'Accept: application/json',
		'Content-Type: application/json; charset=utf-8',
		'User-Agent:Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36',
	];
	if (!empty($headers)) {
		curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
	}
	$output = curl_exec($curl);
	curl_close($curl);
	return $output;
}

//保留两位小数，并且把小数最后的0去掉
function cusDecimal($number, $num = 2) {
	return floatval(sprintf("%." . $num . "f", $number));
}

//格式化 富文本带图片
function format_html($content) {
	$prefix = request()->domain();
	$content = html_out($content);

	$contentAlter = preg_replace_callback('/(<[img|IMG].*?src=[\'\"])([\s\S]*?)([\'\"])[\s\S]*?/i', function ($match) use ($prefix) {
		if (strstr($match[2], 'http://') == false && strstr($match[2], 'https://') == false) {
			return $match[1] . $prefix . $match[2] . $match[3];
		} else {
			return $match[1] . $match[2] . $match[3];
		}

	}, $content);
	return $contentAlter;
}

//生成带参数的小程序码
function qrcode($file_name, $param) {
	$data['filename'] = $file_name;
	$data['scene'] = $param;
	//$data['page']     = "pages/index/index";
	//检查 page 是否存在，为 true 时 page 必须是已经发布的小程序存在的页面（否则报错）；为 false 时允许小程序未发布或者 page 不存在，
	$data['check_path'] = false;
	//要打开的小程序版本。正式版为 release，体验版为 trial，开发版为 develop
	$data['env_version'] = "release";
	$res = \utils\wechart\QrcodeService::createQrcode($data);

	//print_r($res);die;

	$pic = "/uploads/qrcode/" . $res;
	return $pic;
}

header("Content-type: text/html; charset=utf8");
date_default_timezone_set("Asia/Shanghai"); //设置时区
function time_tran($the_time) {
	$now_time = time();
	$dur = $now_time - $the_time;
	if ($dur < 0) {
		return date('Y-m-d', $the_time);
	} else {
		if ($dur < 60) {
			return $dur . '秒前';
		} else {
			if ($dur < 3600) {
				return floor($dur / 60) . '分钟前';
			} else {
				if ($dur < 86400) {
					return floor($dur / 3600) . '小时前';
				} else {
					if ($dur < 604800) {
//7天内
						return floor($dur / 86400) . '天前';
					} else {
						return date('Y-m-d', $the_time);
					}
				}
			}
		}
	}
}

//用友 获取大学列表
header('Content-type:text/html;charset=utf-8');
function getCollegeList($keywords) {
	//配置您申请的appkey
	$apicode = "71bba062d057483cbcc74e3c0437f2e5";
	$url = "https://api.yonyoucloud.com/apis/dst/collegeInfoQuery/collegeInfoQuery";
	$method = "GET";

	$params = array(
		"name" => $keywords,
	);

	$header = array();
	$header[] = "apicode:" . $apicode;
	$header[] = "content-type:application/json";

	$content = linkcurl($url, $method, $params, $header);
	//$result = json_decode($content,true);
	//print_r($result);

	return $content;

	/*if($result){
		        if($result['error_code']=='0'){
		            return $result;
		        }else{
		            echo $result['error_code'].":".$result['reason'];
		        }
		    }else{
		        echo "请求失败";
	*/
}

/**
 * 请求接口返回内容
 * @param string $url [请求的URL地址]
 * @param string $params [请求的参数]
 * @param int $ipost [是否采用POST形式]
 * @return  string
 */
function linkcurl($url, $method, $params = false, $header = false) {
	$httpInfo = array();
	$ch = curl_init();

	curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_HTTPHEADER, $header);
	curl_setopt($ch, CURLOPT_FAILONERROR, false);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

	if (1 == strpos("$" . $url, "https://")) {
		curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
		curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
	}
	curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 60);
	curl_setopt($ch, CURLOPT_TIMEOUT, 60);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);

	if ($method == "POST") {
		curl_setopt($ch, CURLOPT_POST, true);
		curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
	} else if ($params) {
		curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
	}
	$response = curl_exec($ch);
	if ($response === FALSE) {
		//echo "cURL Error: " . curl_error($ch);
		return false;
	}
	$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	$httpInfo = array_merge($httpInfo, curl_getinfo($ch));
	curl_close($ch);
	return $response;
}

//获取老师简称
function getShortName($name) {

	$short_name = mb_substr($name, 0, 1) . '教员';

	return $short_name;
}

//获取性别 字符串
function getGenderStr($value) {
	if ($value == 1) {
		return '男';
	} elseif ($value == 2) {
		return '女';
	} else {
		return '不限';
	}
}

//获取教师身份 字符串
function getTeacherIdentityStr($value) {
	//大学生教员|1|primary,普通教员|2|success,专业教员|3|danger,不限|4|info
	if ($value == 1) {
		return '大学生教员';
	} elseif ($value == 2) {
		return '普通教员';
	} elseif ($value == 3) {
		return '专业教员';
	} else {
		return '不限';
	}
}

//获取教师任教方式 字符串teaching_way
function getTeachingWayStr($value) {
	//教员上门|1|primary,学生上门|2|success,网上辅导|3|info,住家辅导|4|warning,不限|5|danger
	$value_arr = explode(',', $value);

	$data = [];
	foreach ($value_arr as $k => $v) {

		if ($v == 1) {
			$data[] = '教员上门';
		} elseif ($v == 2) {
			$data[] = '学生上门';
		} elseif ($v == 3) {
			$data[] = '网上辅导';
		} elseif ($v == 4) {
			$data[] = '住家辅导';
		} else {
			$data[] = '不限';
		}
	}

	return implode(',', $data);

}

//生成海报
function poster() {
	$bgfile = Image::open('xxccj/img/poster.jpg');
	$config = array(
		'text' => array(
			array(
				'text' => "幸福就在身边",
				'left' => 182,
				'top' => 105,
				'fontPath' => realpath('assets/fonts/SourceHanSansK-Regular.ttf'), //如果不显示汉字可能是字体不支持或路径不对
				'fontSize' => 20, //字号
				'fontColor' => '255,255,255', //字体颜色
				'angle' => 0,
			),
		),
		'image' => array(
			array(
				'url' => 'uploads/mincode/2022120116044947456.jpg', //图片资源路径
				'left' => 130,
				'top' => -140,
				'stream' => 0, //图片资源是否是字符串图像流
				'right' => 0,
				'bottom' => 0,
				'width' => 100,
				'height' => 100,
				'opacity' => 100,
			),
			array(
				'url' => 'xxccj/img/avatar.png',
				'left' => 120,
				'top' => 850,
				'right' => 0,
				'stream' => 0,
				'bottom' => 150,
				'width' => 55,
				'height' => 55,
				'opacity' => 100,
			),
		),
		'background' => 'xxccj/img/poster.jpg',
	);
	$imgfile = createPoster($config, "po.jpg");
	echo "<img src='/" . $imgfile . "'>";

}

/**
 * 生成宣传海报
 * @param array  参数,包括图片和文字
 * @param string $filename 生成海报文件名,不传此参数则不生成文件,直接输出图片
 * @return [type] [description]
 */
function createPoster($config = array(), $filename = "") {
	//如果要看报什么错，可以先注释调这个header
	if (empty($filename)) {
		header("content-type: image/png");
	}

	$imageDefault = array(
		'left' => 0,
		'top' => 0,
		'right' => 0,
		'bottom' => 0,
		'width' => 100,
		'height' => 100,
		'opacity' => 100,
	);
	$textDefault = array(
		'text' => '',
		'left' => 0,
		'top' => 0,
		'fontSize' => 32, //字号
		'fontColor' => '255,255,255', //字体颜色
		'angle' => 0,
	);
	$background = $config['background']; //海报最底层得背景
	//背景方法
	$backgroundInfo = getimagesize($background);
	$backgroundFun = 'imagecreatefrom' . image_type_to_extension($backgroundInfo[2], false);
	$background = $backgroundFun($background);
	$backgroundWidth = imagesx($background); //背景宽度
	$backgroundHeight = imagesy($background); //背景高度
	$imageRes = imageCreatetruecolor($backgroundWidth, $backgroundHeight);
	$color = imagecolorallocate($imageRes, 0, 0, 0);
	imagefill($imageRes, 0, 0, $color);
	// imageColorTransparent($imageRes, $color);  //颜色透明
	imagecopyresampled($imageRes, $background, 0, 0, 0, 0, imagesx($background), imagesy($background), imagesx($background), imagesy($background));
	//处理了图片
	if (!empty($config['image'])) {
		foreach ($config['image'] as $key => $val) {
			$val = array_merge($imageDefault, $val);
			$info = getimagesize($val['url']);
			$function = 'imagecreatefrom' . image_type_to_extension($info[2], false);
			if ($val['stream']) {
				//如果传的是字符串图像流
				$info = getimagesizefromstring($val['url']);
				$function = 'imagecreatefromstring';
			}
			$res = $function($val['url']);
			$resWidth = $info[0];
			$resHeight = $info[1];
			//建立画板 ，缩放图片至指定尺寸
			$canvas = imagecreatetruecolor($val['width'], $val['height']);
			$colors = imagecolorallocatealpha($canvas, 255, 255, 255, 127);
			imagefill($canvas, 0, 0, $colors);
			//关键函数，参数（目标资源，源，目标资源的开始坐标x,y, 源资源的开始坐标x,y,目标资源的宽高w,h,源资源的宽高w,h）
			imagecopyresampled($canvas, $res, 0, 0, 0, 0, $val['width'], $val['height'], $resWidth, $resHeight);
			$val['left'] = $val['left'] < 0 ? $backgroundWidth - abs($val['left']) - $val['width'] : $val['left'];
			$val['top'] = $val['top'] < 0 ? $backgroundHeight - abs($val['top']) - $val['height'] : $val['top'];
			//放置图像
			imagecopy($imageRes, $canvas, $val['left'], $val['top'], 0, 0, $val['width'], $val['height']); //左，上，右，下，宽度，高度，透明度
		}
	}
	//处理文字
	if (!empty($config['text'])) {
		foreach ($config['text'] as $key => $val) {
			$val = array_merge($textDefault, $val);
			list($R, $G, $B) = explode(',', $val['fontColor']);
			$fontColor = imagecolorallocate($imageRes, $R, $G, $B);
			$val['left'] = $val['left'] < 0 ? $backgroundWidth - abs($val['left']) : $val['left'];
			$val['top'] = $val['top'] < 0 ? $backgroundHeight - abs($val['top']) : $val['top'];
			imagettftext($imageRes, $val['fontSize'], $val['angle'], $val['left'], $val['top'], $fontColor, $val['fontPath'], $val['text']);
		}
	}
	//生成图片
	if (!empty($filename)) {
		$res = imagejpeg($imageRes, $filename, 90); //保存到本地
		imagedestroy($imageRes);
		if (!$res) {
			return false;
		}

		return $filename;
	} else {
		imagejpeg($imageRes); //在浏览器上显示
		imagedestroy($imageRes);
	}
}

function httpRequest($url, $data = '', $headers = [], $method = 'POST') {

	$curl = curl_init();
	curl_setopt($curl, CURLOPT_URL, $url);
	curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, 0);
	curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, 0);
	// curl_setopt($curl, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT']);
	curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1);
	curl_setopt($curl, CURLOPT_AUTOREFERER, 1);
	if ($method == 'POST') {
		curl_setopt($curl, CURLOPT_POST, 1);
		if ($data != '') {
			curl_setopt($curl, CURLOPT_POSTFIELDS, $data);
		}
	}

	curl_setopt($curl, CURLOPT_TIMEOUT, 30);
	curl_setopt($curl, CURLOPT_HEADER, 0);
	curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);

	//添加请求头
	if (!empty($headers)) {
		curl_setopt($curl, CURLOPT_HTTPHEADER, $headers);
	}

	$result = curl_exec($curl);
	curl_close($curl);
	return $result;
}

function getGenderVal($val) {

	if ($val == 1) {
		return '男';
	} elseif ($val == 1) {
		return '女';
	} else {
		return '不限';
	}
}

function getTeaIdentityVal($val) {

	if ($val == 1) {
		return '大学生教员';
	} elseif ($val == 1) {
		return '专职教员';
	} else {
		return '不限';
	}
}

function getTeachingWayVal($val) {

	if ($val == 1) {
		return '上门授课';
	} elseif ($val == 1) {
		return '在线授课';
	} else {
		return '均可';
	}
}

//发送10位符合的老师 推荐给家长邮箱
function sendTeacherToStu($demand_id) {
	//家长发布需求 信息
	$demand_info = db('demand')->where('demand_id', $demand_id)->find();

	$city = $demand_info['city'];
	$area = $demand_info['area'];
	$where[] = ['b.subject_id', '=', $demand_info['subject_id']];
	$where[] = ['a.teaching_way', '=', $demand_info['teaching_way']];
	$where[] = ['a.teacher_identity', '=', $demand_info['teacher_identity']];
	$where[] = ['a.city', 'like', "$city"];
	$where[] = ['a.area', 'find in set', $area];

	//获取 为隐藏简历的
	$where[] = ['a.status', '=', 1];

	$list = db("teacher")->alias('a')
		->field("a.*")
		->join('teaching_subject b', 'a.teacher_id=b.teacher_id', 'left')
		->where($where)
		->group('a.teacher_id')
		->order('a.teacher_id asc')
		->select()->toArray();

	foreach ($list as $k => $info) {

		$info["gender_str"] = getGenderVal($info["gender"]);
		$info["teacher_identity_str"] = getTeaIdentityVal($info["teacher_identity"]);
		$info["teaching_way_str"] = getTeachingWayVal($info["teaching_way"]);

		/*
			                <tr>
								<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学生证：</td>
								<td><a href="javascript:void(0)"  ><img height="75" src="'.$info['student_card_img'].'"></a></td>
							</tr></br>
							<tr>
								<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学历证：</td>
								<td><a href="javascript:void(0)"  ><img height="75" src="'.$info['diploma_img'].'"></a></td>
							</tr></br>
							<tr>
								<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教师证：</td>
								<td><a href="javascript:void(0)"  ><img height="75" src="'.$info['itic_img'].'"></a></td>
							</tr></br>
							<tr>
								<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">头像：</td>
								<td><a href="javascript:void(0)"  ><img height="75" src="'.$info['head_img'].'"></a></td>
							</tr></br>
			                <tr>
								<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教师职称证书：</td>
								<td><a href="javascript:void(0)"  ><img height="75" src="'.$info['teacher_title_img'].'"></a></td>
							</tr></br>
		*/

		$content = '<table class="table table-bordered" style="word-break:break-all;">
			<tbody>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">微信昵称：</td>
					<td>' . $info['nickname'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">真实姓名：</td>
					<td>' . $info['name'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">性别：</td>
					<td>' . $info['gender_str'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">年龄：</td>
					<td>' . $info['age'] . '</td>
				</tr></br>

				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教龄：</td>
					<td>' . $info['teaching_age'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学校：</td>
					<td>' . $info['school'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学校就读开始时间：</td>
					<td>' . $info['school_start_time'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学校就读结束时间：</td>
					<td>' . $info['school_end_time'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学历：</td>
					<td>' . $info['education'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">专业：</td>
					<td>' . $info['specialty'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教师身份：</td>
					<td>' . $info["teacher_identity_str"] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教方式：</td>
					<td>' . $info["teaching_way_str"] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教省份：</td>
					<td>' . $info['province'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教城市：</td>
					<td>' . $info['city'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教区域：</td>
					<td>' . $info['area'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教经验：</td>
					<td>' . $info['experience'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">成功案例标题：</td>
					<td>' . $info['successful_case_title'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">成功案例：</td>
					<td>' . $info['successful_case'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">奖励荣誉：</td>
					<td>' . $info['honor'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教师职称：</td>
					<td>' . $info['teacher_title'] . '</td>
				</tr></br>

				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">个人标签：</td>
					<td>' . $info['label'] . '</td>
				</tr></br>

			</tbody> ';

		$mail_address[] = $demand_info['mail'];
		$title = '推荐教师';
		sendMail($title, $mail_address, $content);
	}

}

//发送给50位符合的老师
function sendStuToTeacher($demand_id) {
	//家长发布需求 信息
	$demand_info = db("demand")->alias('a')
		->field('a.*,b.name as subject_name,c.name as grade_name,d.name as category_name')
		->join('subject b', 'a.subject_id=b.subject_id', 'left')
		->join('grade c', 'a.grade_id=c.grade_id', 'left')
		->join('category d', 'a.category_id=d.category_id', 'left')
		->where('a.demand_id', $demand_id)
		->find();

	$city = $demand_info['city'];
	$area = $demand_info['area'];
	$where[] = ['b.subject_id', '=', $demand_info['subject_id']];
	/*$where[] = ['a.teaching_way', '=', $demand_info['teaching_way']];
		    $where[] = ['a.teacher_identity', '=', $demand_info['teacher_identity']];
		    $where[] = ['a.city', 'like', "$city"];
	*/

	//获取 为隐藏简历的
	$where[] = ['a.status', '=', 1];

	$list = db("teacher")->alias('a')
		->field("a.*")
		->join('teaching_subject b', 'a.teacher_id=b.teacher_id', 'left')
		->where($where)
		->group('a.teacher_id')
		->order('a.teacher_id asc')
		->limit(50)
		->select()->toArray();

	$demand_info["gender_str"] = getGenderVal($demand_info["gender"]);
	$demand_info["teacher_gender_str"] = getGenderVal($demand_info["teacher_gender"]);
	$demand_info["teacher_identity_str"] = getTeaIdentityVal($demand_info["teacher_identity"]);
	$demand_info["teaching_way_str"] = getTeachingWayVal($demand_info["teaching_way"]);

	$content = '<table class="table table-bordered" style="word-break:break-all;">
			<tbody>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">订单编号：</td>
					<td>' . $demand_info['sn'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">性别：</td>
					<td>' . $demand_info['gender_str'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教科目：</td>
					<td>' . $demand_info['subject_name'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教城市/区域：</td>
					<td>' . $demand_info['province'] . '--' . $demand_info['city'] . '--' . $demand_info['area'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">详细地址：</td>
					<td>' . $demand_info['address'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">学员概况：</td>
					<td>' . $demand_info['gai_kuang'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教费用：</td>
					<td>' . $demand_info['expense'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教时间：</td>
					<td>' . $demand_info['teach_time'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教员性别：</td>
					<td>' . $demand_info['teacher_gender_str'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教师身份：</td>
					<td>' . $demand_info['teacher_identity_str'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">任教方式：</td>
					<td>' . $demand_info["teaching_way_str"] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">教员要求：</td>
					<td>' . $demand_info['teacher_require'] . '</td>
				</tr></br>
				<tr>
					<td style="background-color:#F5F5F6; font-weight:bold; text-align:right" width="15%">联系人：</td>
					<td>' . $demand_info['linkman'] . '</td>
				</tr></br>

			</tbody> ';

	foreach ($list as $k => $v) {

		$mail_address[] = $v['mail'];
	}
	$title = '学生推荐';
	sendMail($title, $mail_address, $content);
}

//发送邮件
function sendMail($title, $address, $content) {
	$mail = new \PHPMailer\PHPMailer();

	$mail->isSMTP(); // 使用SMTP服务
	// $mail->SMTPDebug = 1;
	$mail->CharSet = "utf8"; // 编码格式为utf8，不设置编码的话，中文会出现乱码
	$mail->Host = "smtp.qq.com"; // 发送方的SMTP服务器地址
	$mail->SMTPAuth = true; // 是否使用身份验证
	$mail->Username = "42920568@qq.com";
	$mail->Password = "awmhtiowwysecada";

	$mail->SMTPSecure = "ssl";
	$mail->Port = 465;
	$mail->IsHTML(true);
	//$mail->setFrom("42920568@qq.com", "42920568");
	$mail->setFrom("42920568@qq.com", "献新家教");
	//$mail->addAddress($toemail, 'Wang');
	foreach ($address as $k => $v) {
		$mail->AddAddress($v); //设置收件的地址

	}
	$mail->Subject = $title; // 邮件标题
	$mail->Body = $content; // 邮件正文

	if (!$mail->send()) {
		return $mail->ErrorInfo;
	} else {
		return '1';
	}
}

//发送给50位符合的老师
function sendMsgToTeacher($demand_id) {
	//家长发布需求 信息
	$demand_info = db("demand")->alias('a')
		->field('a.*,b.name as subject_name,c.name as grade_name,d.name as category_name')
		->join('subject b', 'a.subject_id=b.subject_id', 'left')
		->join('grade c', 'a.grade_id=c.grade_id', 'left')
		->join('category d', 'a.category_id=d.category_id', 'left')
		->where('a.demand_id', $demand_id)
		->find();

	$city = $demand_info['city'];
	$area = $demand_info['area'];
	$where[] = ['b.subject_id', '=', $demand_info['subject_id']];
	/*$where[] = ['a.teaching_way', '=', $demand_info['teaching_way']];
		    $where[] = ['a.teacher_identity', '=', $demand_info['teacher_identity']];
		    $where[] = ['a.city', 'like', "$city"];
	*/

	//获取 为隐藏简历的
	$where[] = ['a.status', '=', 1];

	$list = db("teacher")->alias('a')
		->field("a.*")
		->join('teaching_subject b', 'a.teacher_id=b.teacher_id', 'left')
		->where($where)
		->group('a.teacher_id')
		->order('a.teacher_id asc')
		->limit(50)
		->select()->toArray();

	foreach ($list as $k => $v) {

		//给上传资料的老师 添加消息通知
		$ins['title'] = '购买资料通知';
		$ins['content'] = "        家长编号为 " . $demand_info['mid'] . " 的家长,发布了适合您的家教信息,请及时查看";
		$ins['mid'] = $v['mid'];
		$ins['create_time'] = time();
		$ins['type'] = 3;
		db('msg')->insertGetId($ins);
	}

}

//抖音获取签名
function dySign($map) {
	$rList = [];
	foreach ($map as $k => $v) {
		if ($k == "other_settle_params" || $k == "app_id" || $k == "sign" || $k == "thirdparty_id") {
			continue;
		}

		$value = trim(strval($v));
		if (is_array($v)) {
			$value = arrayToStr($v);
		}

		$len = strlen($value);
		if ($len > 1 && substr($value, 0, 1) == "\"" && substr($value, $len, $len - 1) == "\"") {
			$value = substr($value, 1, $len - 1);
		}

		$value = trim($value);
		if ($value == "" || $value == "null") {
			continue;
		}

		$rList[] = $value;
	}
	$rList[] = config('my.dy_mini_program.payment_salt');
	sort($rList, SORT_STRING);
	return md5(implode('&', $rList));
}

function arrayToStr($map) {
	$isMap = isArrMap($map);

	$result = "";
	if ($isMap) {
		$result = "map[";
	}

	$keyArr = array_keys($map);
	if ($isMap) {
		sort($keyArr);
	}

	$paramsArr = array();
	foreach ($keyArr as $k) {
		$v = $map[$k];
		if ($isMap) {
			if (is_array($v)) {
				$paramsArr[] = sprintf("%s:%s", $k, arrayToStr($v));
			} else {
				$paramsArr[] = sprintf("%s:%s", $k, trim(strval($v)));
			}
		} else {
			if (is_array($v)) {
				$paramsArr[] = arrayToStr($v);
			} else {
				$paramsArr[] = trim(strval($v));
			}
		}
	}

	$result = sprintf("%s%s", $result, join(" ", $paramsArr));
	$result = sprintf("[%s]", $result);

	return $result;
}

function isArrMap($map) {
	foreach ($map as $k => $v) {
		if (is_string($k)) {
			return true;
		}
	}

	return false;
}

/**
 * 生成回调签名
 * @param $data
 * @return string
 */
function getNotifySignature($data): string {
	$data['token'] = config('my.dy_mini_program.token');

	$params = [
		$data['token'],
		$data['timestamp'],
		$data['nonce'],
		$data['msg'],
	];
	sort($params, SORT_STRING);
	$signature = sha1(implode('', $params));

	if ($data['msg_signature'] == $signature) {
		return true;
	}

	return false;
}

function getAgeFromIdNo($idno = '') {
	$btime = strtotime(substr($idno, 6, 8)); //idno是身份证号 截取日期并转为时间戳
	$byear = date('Y', $btime);
	$bmonth = date('m', $btime);
	$bday = date('d', $btime);
	$curYear = date('Y');
	$curMoth = date('m');
	$curDay = date('d');
	$age = $curYear - $byear;
	if ($curMoth < $bmonth || ($curMoth == $bmonth && $curDay < $bday)) {
		$age--;
	}
	return $age;

}
function getTeacherAge($careerYear) {
	$curYear = date('Y');
	$age = $curYear - $careerYear + 1;
	return $age;

}
function getAgeFromBirthday($birthday = '') {
	$btime = strtotime($birthday); //转为时间戳
	$byear = date('Y', $btime);
	$bmonth = date('m', $btime);
	$bday = date('d', $btime);
	$curYear = date('Y');
	$curMoth = date('m');
	$curDay = date('d');
	$age = $curYear - $byear;
	if ($curMoth < $bmonth || ($curMoth == $bmonth && $curDay < $bday)) {
		$age--;
	}
	return $age;

}