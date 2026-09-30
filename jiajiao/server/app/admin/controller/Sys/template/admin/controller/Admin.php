<?php

namespace app\ApplicationName\controller;
use app\BaseController;

class Admin extends BaseController
{
	
	public function initialize(){
		$controller = $this->request->controller();
		$action = $this->request->action();
		$app = app('http')->getName();
		
		$ApplicationName = session('ApplicationName');
		$userid = session('ApplicationName_sign') == data_auth_sign($ApplicationName) ? true : false;
		
		if( !$userid && ( $app <> 'ApplicationName' || $controller <> 'Login' )){
			echo '<script type="text/javascript">top.parent.frames.location.href="'.url('ApplicationName/Login/index').'";</script>';exit();
		}
		
		foreach(config('my.nocheck') as $val){
			$nocheck[] = str_replace('admin','ApplicationName',$val);
		}
		$url =  "{$app}/{$controller}/{$action}";
		if(session('ApplicationName.role_id') <> 1 && !in_array($url,$nocheck) && $action !== 'startImport'){	
			if(!in_array($url,session('ApplicationName.nodes'))){
				throw new ValidateException ('你没操作权限');
			}	
		}
		
		event('DoLog');
		
		$list = db("config")->cache(true,60)->select()->column('data','name');
		config($list,'xhadmin');
	}
	

}
