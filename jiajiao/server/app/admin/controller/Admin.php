<?php

namespace app\admin\controller;
use think\exception\FuncNotFoundException;
use think\exception\ValidateException;
use app\BaseController;

class Admin extends BaseController
{
	
	public function initialize(){
		$controller = $this->request->controller();
		$action = $this->request->action();
		$app = app('http')->getName();
		
		$admin = session('admin');
        $userid = session('admin_sign') == data_auth_sign($admin) ? $admin['user_id'] : 0;

        if( !$userid && ( $app <> 'admin' || $controller <> 'Login' )){
			echo '<script type="text/javascript">top.parent.frames.location.href="'.url('admin/Login/index').'";</script>';exit();
        }
		
		if(session('admin.nodes')){
			foreach(session('admin.nodes') as $key=>$val){
				$newnodes[] = parse_url($val)['path'];
			}
		}

		$url =  "{$app}/{$controller}/{$action}";
		if(session('admin.role_id') <> 1 && !in_array($url,config('my.nocheck')) && $action !== 'startImport' && $action !== 'getExtends'){	
			if(!in_array($url,$newnodes)){
				throw new ValidateException ('你没操作权限');
			}	
		}
		
		event('DoLog');
		
		$list = db("config")->cache(true,60)->column('data','name');
		config($list,'xhadmin');
	}
	
	public function __call($method, $args){
        throw new FuncNotFoundException('方法不存在',$method);
    }

}
