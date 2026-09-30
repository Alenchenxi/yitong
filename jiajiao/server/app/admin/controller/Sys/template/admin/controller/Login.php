<?php

namespace app\ApplicationName\controller;
use think\exception\ValidateException;

class Login extends Admin
{
 
    //用户登录
    public function index(){
        if (!$this->request->isPost()) {
            return view('index');
        } else {    
            $postField = 'username,password,verify';
			$data = $this->request->only(explode(',',$postField),'post',null);
			
			if(!captcha_check($data['verify'])){
				throw new ValidateException('验证码错误');
			}
            if($this->checkLogin($data)){
				$this->success('登录成功', url('ApplicationName/Index/index'));
			}
        }
    }
	
	public function checkLogin($data) {
		$where['tempUsername'] = $data['username'];
		$where['tempPassword']  = md5($data['password'].config('my.password_secrect'));
		
		try{
			$info = db('tablename')->where($where)->find();
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		if(!$info) {
			throw new ValidateException("请检查用户名或者密码");
		}
		if(!$info['role_id']) $info['role_id'] = 1;	
		if(!$info['username']) $info['username'] = $info['tempUsername'];
		
		session('ApplicationName', $info);
		session('ApplicationName_sign', data_auth_sign($info));
		
		event('LoginLog',$info);	//写入登录日志
		
        return true;
    }
	
	//验证码
	public function verify(){
		ob_clean();
	    return captcha();
	}
	
	//退出
    public function out(){
        session('ApplicationName', null);
		return redirect(url('ApplicationName/Login/index'));
    }
	
	
}
