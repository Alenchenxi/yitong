<?php

namespace utils;

class Baidu {

	function token() {
		$CLIENT_ID = config('my.baidu.appKey');
		$CLIENT_SECRET = config('my.baidu.appSecret');
		$url = "https://openapi.baidu.com/oauth/2.0/token?grant_type=client_credentials&client_id=" . $CLIENT_ID . "&client_secret=" . $CLIENT_SECRET . "&scope=smartapp_snsapi_base";
		$res = self::request_get($url);
		file_put_contents("baidu2.txt", $res['access_token']);
	}
	function getSessionKey($code) {
		$file_path = "baidu2.txt";
		if (file_exists($file_path)) {
			$fp = fopen($file_path, "r");
			$token = fread($fp, filesize($file_path));
		}

		// $url = "https://openapi.baidu.com/rest/2.0/smartapp/getsessionkey?access_token=33444443" . $token . "&code=3333333" . $code;
		$url = "https://openapi.baidu.com/rest/2.0/smartapp/getsessionkey?access_token=" . $token . "&code=" . $code;
		$url = str_replace(' ', '', $url);
		// $url = "https://openapi.baidu.com/rest/2.0/smartapp/getsessionkey?access_token=ACCESS_TOKEN&code=CODE";
		// $url = "https://cyw.oewifi.cn";
		// echo file_get_contents($url);
		$res = self::request_get($url);

		//如果access_token 不合法, 重新请求
		if($res['errno']==110 || $res['error_code']==111 || $res['error_code']==110){
            self::token();
        }

		return $res['data'];

	}
	function http_curl_get($url) {
		$curl = curl_init(); //初始化curl
		curl_setopt($curl, CURLOPT_URL, $url); //抓取指定网页
		curl_setopt($curl, CURLOPT_HEADER, 0); //设置header
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1); //要求结果为字符串且输出到屏幕上
		$data = curl_exec($curl); //运行curl
		curl_close($curl);
		return $data;
	}
	function curl_file_get_contents($durl) {
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_URL, $durl);
		curl_setopt($ch, CURLOPT_TIMEOUT, 5);
		curl_setopt($ch, CURLOPT_USERAGENT, _USERAGENT_);
		curl_setopt($ch, CURLOPT_REFERER, _REFERER_);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		$r = curl_exec($ch);
		curl_close($ch);
		return $r;
	}
	function refund($res) {
		$file_path = "baidu2.txt";
		if (file_exists($file_path)) {
			$fp = fopen($file_path, "r");
			$token = fread($fp, filesize($file_path));
		}
		$url = "https://openapi.baidu.com/rest/2.0/smartapp/pay/paymentservice/applyOrderRefund";
		$data['access_token'] = $token;
		$data['applyRefundMoney'] = (int) $res['refund_fee'];
		$data['bizRefundBatchId'] = $res['bizRefundBatchId'];
		$data['isSkipAudit'] = 1;
		$data['orderId'] = (int) $res['orderid'];
		$data['refundReason'] = $res['desc'];
		$data['refundType'] = 1;
		$data['tpOrderId'] = $res['tpOrderId'];
		$data['userId'] = $res['userid'];
		$data['pmAppKey'] = $res['pmAppKey'];
		return self::request_post($url, $data);
	}
	/**
	 * @Author: smartprogram_rd@baidu.com
	 * Copyright 2018 The BAIDU. All rights reserved.
	 *
	 * 百度小程序用户信息加解密示例代码（面向过程版）
	 * 示例代码未做异常判断，请勿用于生产环境
	 */

	function getUserInfo($data) {
		$session_key_data = self::getSessionKey($data['code']);
        $session_key = $session_key_data['session_key'];

		$iv = $data['iv'];
		$encryptedData = $data['encryptedData'];
		$app_key = config('my.baidu.appKey');

		$plaintext = self::decrypt($encryptedData, $iv, $app_key, $session_key);

		if($plaintext){
            $plaintext = json_decode($plaintext,true);
            $plaintext['open_id'] = $session_key_data['open_id'];
        }
		return json_encode($plaintext);
	}

	/**
	 * 数据解密：低版本使用mcrypt库（PHP < 5.3.0），高版本使用openssl库（PHP >= 5.3.0）。
	 *
	 * @param string $ciphertext    待解密数据，返回的内容中的data字段
	 * @param string $iv            加密向量，返回的内容中的iv字段
	 * @param string $app_key       创建小程序时生成的app_key
	 * @param string $session_key   登录的code换得的
	 * @return string | false
	 */
	function decrypt($ciphertext, $iv, $app_key, $session_key) {
		$session_key = base64_decode($session_key);
		$iv = base64_decode($iv);
		$ciphertext = base64_decode($ciphertext);

		$plaintext = false;
		if (function_exists("openssl_decrypt")) {
			$plaintext = openssl_decrypt($ciphertext, "AES-192-CBC", $session_key, OPENSSL_RAW_DATA | OPENSSL_ZERO_PADDING, $iv);
		} else {
			$td = mcrypt_module_open(MCRYPT_RIJNDAEL_128, null, MCRYPT_MODE_CBC, null);
			mcrypt_generic_init($td, $session_key, $iv);
			$plaintext = mdecrypt_generic($td, $ciphertext);
			mcrypt_generic_deinit($td);
			mcrypt_module_close($td);
		}
		if ($plaintext == false) {
			return false;
		}
		// trim pkcs#7 padding
		$pad = ord(substr($plaintext, -1));
		$pad = ($pad < 1 || $pad > 32) ? 0 : $pad;
		$plaintext = substr($plaintext, 0, strlen($plaintext) - $pad);

		// trim header
		$plaintext = substr($plaintext, 16);
		// get content length
		$unpack = unpack("Nlen/", substr($plaintext, 0, 4));
		// get content
		$content = substr($plaintext, 4, $unpack['len']);
		// get app_key
		$app_key_decode = substr($plaintext, $unpack['len'] + 4);
		return $app_key == $app_key_decode ? $content : false;
	}

	function request_get($url = '', $param = '') {
		// if (empty($url) || empty($param)) {
		//     return false;
		// }
		$curl = curl_init(); //初始化curl
		curl_setopt($curl, CURLOPT_URL, $url); //抓取指定网页
		curl_setopt($curl, CURLOPT_HEADER, 0); //设置header
		curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1); //要求结果为字符串且输出到屏幕上
		if ($param) {
			curl_setopt($curl, CURLOPT_POST, 1); //post提交方式
			curl_setopt($curl, CURLOPT_POSTFIELDS, $param);
		}
		$data = curl_exec($curl); //运行curl
		curl_close($curl);
		return json_decode($data, true);
	}
	function request_post($url, $params) {
		$params = http_build_query($params);
		$headers = array('Content-Type: application/x-www-form-urlencoded');
		$ch = curl_init();
		curl_setopt($ch, CURLOPT_POST, 1);
		curl_setopt($ch, CURLOPT_URL, $url);
		curl_setopt($ch, CURLOPT_POSTFIELDS, $params);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
		curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
		$response = curl_exec($ch);
		curl_close($ch);
		return $response = json_decode($response, true);
	}

	/**
	 * @desc 使用私钥生成签名字符串
	 * @param array $assocArr 入参数组
	 * @param string $rsaPriKeyStr 私钥原始字符串，不含PEM格式前后缀
	 * @return string 签名结果字符串
	 * @throws Exception
	 */
	public static function sign(array $assocArr) {
		$sign = '';
		if (empty($assocArr)) {
			return $sign;
		}
		if (!function_exists('openssl_pkey_get_private') || !function_exists('openssl_sign')) {
			throw new Exception("openssl扩展不存在");
		}
		$rsaPriKeyPem = self::convertRSAKeyStr2Pem();
		$priKey = openssl_pkey_get_private($rsaPriKeyPem);

		if (isset($assocArr['sign'])) {
			unset($assocArr['sign']);
		}
		// 参数按字典顺序排序
		ksort($assocArr);

		$parts = array();
		foreach ($assocArr as $k => $v) {
			$parts[] = $k . '=' . $v;
		}
		$str = implode('&', $parts);

		openssl_sign($str, $sign, $priKey);
		openssl_free_key($priKey);

		return base64_encode($sign);
	}
	function convertRSAKeyStr2Pem() {
		$rsaPriKeyPem = "-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDDgdjmXRbUGXOZEk38CV+97jYU4JadxSlSc9IC725WyRzkO8Bv
jRkrI9DEjWpMAGOGyf8WnRkCuTZ9vNN4AJNJGWyWw/hJIn9mx5CaeNNun6Bq37WO
w22Xl3KYMNV6utGvDwJe1Eisvh1j103doSTKlKs/2yITA/F5Gse8jpsJ2QIDAQAB
AoGAFULOqqae7+vgpVnXPzxpvAbmvLh7yKaDSuMriIQvNKLkUHGrCLaIcSeQ8X8L
ez5jlGntIrFs4d3wbhYVzSwK2Cx6P9gZ1UfeT7+68ZPHwvQdYyZKpiMshU5W82+k
Fl7Z4fYMPeyxIchDgdMCh8VMxyhn6t8VRXBIBPapIr8MhoECQQDt/PeVqagixKVZ
2Nabl7baE8WqTt+d+nbaFwLYDpDvwSk1PsDtoDBPR5aNVFKEFGIAasO/LAgnA/fG
LZ1OGVDpAkEA0k3PTP6DoJe/YTFg1+es20TCrKA/g5uOaFzG292BoNBXTRhaOwgW
XumN+tSymG2/WscQ7Li1bQ6me6Sq+R/bcQJAC4PY6unpk70WDxHZ2G9vzn90afgl
A7zRsV25qoCR7LfY6ZWeuiCtFbjuBOqWj4N49nI0BHT59AFSJMmiOdwpuQJBALTq
oSpQTXYK9WWsb+5s7IRZG8wbs2gJmzHmlmAwp0Jr2J6HE6By7aPK8gxVjCqbRyHV
3JZ4tALUtp3pY/ga0tECQQC0CxdHotYG+W5xMtOF0ERKyiLspijRmHIF+rrsg3BJ
XuQnUcPwoZdRHStuLLWT8s3w9JFZ0zpzPkizPoc+xUDl
-----END RSA PRIVATE KEY-----";
		return $rsaPriKeyPem;
	}
	/**
	 * @desc 使用公钥校验签名
	 * @param array $assocArr 入参数据，签名属性名固定为rsaSign
	 * @param string $rsaPubKeyStr 公钥原始字符串，不含PEM格式前后缀
	 * @return bool true 验签通过|false 验签不通过
	 * @throws Exception
	 */
	public static function checkSign(array $assocArr) {
		if (!isset($assocArr['rsaSign']) || empty($assocArr) || empty($rsaPubKeyStr)) {
			return false;
		}

		if (!function_exists('openssl_pkey_get_public') || !function_exists('openssl_verify')) {
			throw new Exception("openssl扩展不存在");
		}

		$sign = $assocArr['rsaSign'];
		unset($assocArr['rsaSign']);

		if (empty($assocArr)) {
			return false;
		}
		// 参数按字典顺序排序
		ksort($assocArr);

		$parts = array();
		foreach ($assocArr as $k => $v) {
			$parts[] = $k . '=' . $v;
		}
		$str = implode('&', $parts);

		$sign = base64_decode($sign);

		$rsaPubKeyPem = "-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDDgdjmXRbUGXOZEk38CV+97jYU
4JadxSlSc9IC725WyRzkO8BvjRkrI9DEjWpMAGOGyf8WnRkCuTZ9vNN4AJNJGWyW
w/hJIn9mx5CaeNNun6Bq37WOw22Xl3KYMNV6utGvDwJe1Eisvh1j103doSTKlKs/
2yITA/F5Gse8jpsJ2QIDAQAB
-----END PUBLIC KEY-----";
		$pubKey = openssl_pkey_get_public($rsaPubKeyPem);

		$result = (bool) openssl_verify($str, $sign, $pubKey);
		openssl_free_key($pubKey);

		return $result;
	}

}
