<?php

namespace app\cms\controller;
use app\BaseController;
use think\exception\FuncNotFoundException;
use think\App;
use think\exception\ValidateException;
use think\facade\Filesystem;
use think\Image;
use think\View;


class Base extends BaseController
{
	
	protected $request;
	protected $app;
	protected $view;
	protected $mid;
	protected $city;

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

        $action = $this->request->action();

        $admin = session('member_info');
        $city = session('city')?session('city'):'重庆市';
        $this->mid = $admin['mid'];
        $this->city = $city;
        $is_login = $admin? 1 : 0;

        if($admin['mid']){
            $member_info = db('member')->where('mid', $admin['mid'])->find();
            $teacher_info = db('teacher')->where('mid', $admin['mid'])->find();
            $this->view->assign('user_info',$member_info);
            $this->view->assign('teacher_info',$teacher_info);

        }

        $list = db("config")->cache(true,60)->select()->column('data','name');
        config($list,'config');

        if(!session('member_info.mid') && ($action == 'release' || $action == 'register' || $action == 'teacherCenter' || $action == 'estimate'
                || $action == 'message' || $action == 'feedback' || $action == 'cancel' || $action == 'dsOrder' || $action == 'wcOrder' || $action == 'collect')){
            header("Location: /login/index");
        }

        $this->view->assign('pic_url',request()->domain());
        $this->view->assign('is_login',$is_login);
        $this->view->assign('city',$city);

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


    /**
     * @api {post} /Base/upload 01、图片上传
     * @apiGroup Base
     * @apiVersion 1.0.0
     * @apiDescription  图片上传

     * @apiHeader {String} Authorization 用户授权token
     * @apiHeaderExample {json} Header-示例:
     * "Authorization: eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOjM2NzgsImF1ZGllbmNlIjoid2ViIiwib3BlbkFJZCI6MTM2NywiY3JlYXRlZCI6MTUzMzg3OTM2ODA0Nywicm9sZXMiOiJVU0VSIiwiZXhwIjoxNTM0NDg0MTY4fQ.Gl5L-NpuwhjuPXFuhPax8ak5c64skjDTCBC64N_QdKQ2VT-zZeceuzXB9TqaYJuhkwNYEhrV3pUx1zhMWG7Org"

     * @apiParam (失败返回参数：) {object}     	array 返回结果集
     * @apiParam (失败返回参数：) {string}     	array.status 返回错误码  201
     * @apiParam (失败返回参数：) {string}     	array.msg 返回错误消息
     * @apiParam (成功返回参数：) {string}     	array 返回结果集
     * @apiParam (成功返回参数：) {string}     	array.status 返回错误码 200
     * @apiParam (成功返回参数：) {string}     	array.data 返回图片地址
     * @apiSuccessExample {json} 01 成功示例
     * {"status":"200","data":"操作成功"}
     * @apiErrorExample {json} 02 失败示例
     * {"status":" 201","msg":"操作失败"}
     */
    public function upload(){
        if(!$_FILES) throw new ValidateException('上传验证失败');
        $file = $this->request->file(array_keys($_FILES)[0]);
        $upload_config_id = $this->request->param('upload_config_id','','intval'); //上传配置id

        /*if(!Validate::fileExt($file,config('my.api_upload_ext')) || !Validate::fileSize($file,config('my.api_upload_max'))){
            throw new ValidateException('上传验证失败');
        }*/
        //检测图片路径已存在  true 检测 读取已有的图片路径 false不检测 每次都重新上传新的
        $upload_hash_status = !is_null(config('my.upload_hash_status')) ? config('my.upload_hash_status') : true;
        $fileinfo = $upload_hash_status ? db("file")->where('hash',$file->hash('md5'))->find() : false;
        if($upload_hash_status && $fileinfo && $this->checkFileExists($fileinfo['filepath'])){
            $url =  $fileinfo['filepath'];
        }else{
            $url = $this->up($file,$upload_config_id);
        }
        return json(['status'=>config('my.successCode'),'data'=>$url]);
    }

    protected function up($file,$upload_config_id){
        try{
            if(config('my.oss_status')){
                $url = \utils\oss\OssService::OssUpload(['tmp_name'=>$file->getPathname(),'extension'=>$file->extension()]);
            }else{
                $info = Filesystem::disk('public')->putFile(\utils\oss\OssService::setFilepath(),$file,'uniqid');
                $url = \utils\oss\OssService::getApiFileName(basename($info));
                if($upload_config_id && !config('my.oss_status') && in_array(pathinfo($info)['extension'],['jpg','png','gif','jpeg','bmp'])){
                    $this->thumb(config('my.upload_dir').'/'.$info,$upload_config_id); //生成缩略图或者水印
                }
            }
        }catch(\Exception $e){
            abort(config('my.error_log_code'),$e->getMessage());
        }

        $upload_hash_status = !is_null(config('my.upload_hash_status')) ? config('my.upload_hash_status') : true;
        $upload_hash_status && db('file')->insert(['filepath'=>$url,'hash'=>$file->hash('md5'),'create_time'=>time()]);

        return $url;
    }

    //生成缩略图或水印
    private function thumb($imagesUrl,$upload_config_id){
        $configInfo = db("upload_config")->where('id',$upload_config_id)->find();
        if($configInfo){
            $image = Image::open($imagesUrl);
            $targetimages = $imagesUrl;

            //当设置不覆盖生成新的文件名
            if(!$configInfo['upload_replace']){
                $fileinfo = pathinfo($imagesUrl);
                $targetimages = $fileinfo['dirname'].'/s_'.$fileinfo['basename'];
                copy($imagesUrl,$targetimages);
            }

            //生成缩略图
            if($configInfo['thumb_status']){
                $image->thumb($configInfo['thumb_width'], $configInfo['thumb_height'],$configInfo['thumb_type'])->save($targetimages);
            }

            $config = db("config")->column('data','name');

            //生成水印
            if(file_exists('.'.$config['water_logo']) && $config['water_status'] && $config['water_position']){
                $image->water('.'.$config['water_logo'],$config['water_position'])->save($targetimages);
            }
        }
    }

    //检测文件是否存在
    public function checkFileExists($filepath){
        if(strpos($filepath, '://')){
            $res = file_get_contents($filepath) ? true: false;
        }else{
            $res = file_exists('.'.$filepath) ? true: false;
        }
        return $res;
    }
	

}
