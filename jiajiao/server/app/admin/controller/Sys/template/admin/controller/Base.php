<?php

namespace app\ApplicationName\controller;

class Base extends Admin
{
   
    /*修改密码*/
    public function password(){
	    if (!$this->request->isPost()){	
			return view('password');
		}else{			
			$password = $this->request->post('password', '', 'strip_tags,trim');
			$data['pwd'] = md5($password.config('my.password_secrect'));
			$data['pk_id'] = session('ApplicationName.pk_id');
			try {
				db('tablename')->update($data);
			} catch (\Exception $e) {
				abort(config('my.error_log_code'),$e->getMessage());
			}
            return json(['status'=>'00','message'=>'修改成功']);
		}
    }
	
	
	//获取oss的token以及key
	//获取oss的token以及key
	public function getOssToken(){
		if(config('my.oss_status')){	
			$filename = $this->request->post('filename');
			$ossname = \utils\oss\OssService::setKey('01',['extension'=>end(explode('.', $filename))]);
			switch(config('my.oss_default_type')){
				case 'qiniuyun':
					$auth = new \Qiniu\Auth(config('my.qny_oss_accessKey'), config('my.qny_oss_secretKey'));
					$upToken = $auth->uploadToken(config('my.qny_oss_bucket'));
					$domain = config('my.qny_oss_domain');
					$key = $ossname;
					$res = ['token'=>$upToken,'key'=>$key];
				break;
				
				case 'ali':
					$options = array();
					$expire = 30;  //设置该policy超时时间是10s. 即这个policy过了这个有效时间，将不能访问。
					$now = time();
					$end = $now + $expire;
					$options['expiration'] = $this->gmtIso8601($end); /// 授权过期时间
					$conditions = array();
					array_push($conditions, array('bucket'=>'xhadmin'));
					
					//$callbackUrl = 'http://b.cdlfvip.com/admin/Login/test';
					$callbackUrl = '{:url("admin/Login/aliOssCallBack")}';

					$callback_param = array('callbackUrl'=>$callbackUrl,
						'callbackBody'=>'${object}',
						'callbackBodyType'=>"application/x-www-form-urlencoded");
					$callback_string = json_encode($callback_param);

					$base64_callback_body = base64_encode($callback_string);
					
					$content_length_range = array();
					array_push($content_length_range, 'content-length-range');
					array_push($content_length_range, 0);
					array_push($content_length_range, 2048 * 1024 * 1024);
					array_push($conditions, $content_length_range);
					$options['conditions'] = $conditions;
					$policy = base64_encode(stripslashes(json_encode($options)));
					$sign = base64_encode(hash_hmac('sha1',$policy,config('my.ali_oss_accessKeySecret'), true));
					
					$domain = config('my.ali_oss_endpoint');
					$key = $ossname;
					
					$res = ['sign'=>$sign,'policy'=>$policy,'key'=>$key,'callback'=>$base64_callback_body,'OSSAccessKeyId'=>config('my.ali_oss_accessKeyId')];
				break;
			}
		}
		return json($res);
	}
	
	public function gmtIso8601($time) {
        $dtStr = date("c", $time);
        $mydatetime = new \DateTime($dtStr);
        $expiration = $mydatetime->format(\DateTime::ISO8601);
        $pos = strpos($expiration, '+');
        $expiration = substr($expiration, 0, $pos);
        return $expiration."Z";
    }
  
	

}
