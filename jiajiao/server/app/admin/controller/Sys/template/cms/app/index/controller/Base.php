<?php

namespace app\ApplicationName\controller;
use app\BaseController;
use think\exception\FuncNotFoundException;
use think\App;
use think\View;


class Base extends BaseController
{
	
	protected $request;
	protected $app;
	protected $view;
	
	/**
     * 构造方法
     * @access public
     * @param  App  $app  应用对象
     */
    public function __construct(App $app,View $view)
    {
        $this->app     = $app;
		$this->view     = $view;
        $this->request = $this->app->request;
		$this->initConfig();
    }
	
	//初始化配置文件
	public function initConfig(){
		$list = db("config")->cache(true,60)->select()->column('data','name');
		config($list,'xhadmin');
		//检测终端
		if($this->request->isMobile() && config('xhadmin.mobile_status')){
			$parse_url = parse_url($this->request->url(true));
			if(config('xhadmin.mobile_domain') && config('xhadmin.mobile_domain') <> $parse_url['host']){
				header('location:http://'.config('xhadmin.mobile_domain').$parse_url['path']);exit();
			}
			$list['default_themes'] = config('xhadmin.mobile_themes');
			config($list,'xhadmin');
		}
	}

	public function __call($method, $args)
    {
        throw new FuncNotFoundException('方法不存在',$method);
    }
	
	

}
