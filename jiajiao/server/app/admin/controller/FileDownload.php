<?php 
/*
 module:		文件下载
 create_time:	2023-05-23 13:36:14
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\FileDownloadService;
use app\admin\model\FileDownload as FileDownloadModel;
use think\facade\Db;

class FileDownload extends Admin {


	/*修改排序开关按钮操作*/
	function updateExt(){
		$postField = 'file_download_id,zsort';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(!$data['file_download_id']) $this->error('参数错误');
		try{
			FileDownloadModel::update($data);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'name,file,type,price,status,zsort';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = FileDownloadService::add($data);
			if($res && empty($data['zsort'])){
				FileDownloadModel::update(['zsort'=>$res,'file_download_id'=>$res]);
			}
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$file_download_id = $this->request->get('file_download_id','','serach_in');
			if(!$file_download_id) $this->error('参数错误');
			$this->view->assign('info',checkData(FileDownloadModel::find($file_download_id)));
			return view('update');
		}else{
			$postField = 'file_download_id,name,file,type,price,status,zsort';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = FileDownloadService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('file_download_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			FileDownloadModel::destroy(['file_download_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

	/*箭头排序*/
	function arrowsort(){
		$postField = 'file_download_id,sortid,type';
		$data = $this->request->only(explode(',',$postField),'post',null);
		if(empty($data['sortid'])){
			$this->error('操作失败，当前数据没有排序号');
		}
		if($data['type'] == 1){
			$where['zsort'] = ['>',$data['sortid']];
			$info = FileDownloadModel::where(formatWhere($where))->order('zsort asc')->find();
		}else{
			$where['zsort'] = ['<',$data['sortid']];
			$info = FileDownloadModel::where(formatWhere($where))->order('zsort desc')->find();
		}
		if(empty($info['zsort'])){
			$this->error('操作失败，目标位置没有排序号');
		}
		if($info){
			try{
				FileDownloadModel::update(['file_download_id'=>$data['file_download_id'],'zsort'=>$info['zsort']]);
				FileDownloadModel::update(['file_download_id'=>$info['file_download_id'],'zsort'=>$data['sortid']]);
			}catch(\Exception $e){
				throw new \think\exception\ValidateException ($e->getMessage());
			}
		}else{
			$this->error('目标位置没有数据');
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}

 /*start*/
    /*首页数据列表*/
    function index(){
        if (!$this->request->isAjax()){
            return view('index');
        }else{
            $limit  = $this->request->post('limit', 20, 'intval');
            $offset = $this->request->post('offset', 0, 'intval');
            $page   = floor($offset / $limit) +1 ;

            $where = [];
            $where['name'] = ['like',$this->request->param('name_s', '', 'serach_in')];
            $where['type'] = $this->request->param('type', '', 'serach_in');
            $where['is_top'] = $this->request->param('is_top', '', 'serach_in');

            $order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
            $sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

            $field = 'file_download_id,name,file,type,price,status,is_top,zsort';
            $orderby = ($sort && $order) ? $sort.' '.$order : 'zsort asc,top_time desc,file_download_id desc';

            $res = FileDownloadService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
            return json($res);
        }
    }


	/*置顶*/
	function setTop(){
		if (!$this->request->isPost()){
			$file_download_id = $this->request->get('file_download_id','','serach_in');
			if(!$file_download_id) $this->error('参数错误');
			$this->view->assign('info',checkData(FileDownloadModel::find($file_download_id)));
			return view('setTop');
		}else{
			$postField = 'file_download_id,is_top';
			$data = $this->request->only(explode(',',$postField),'post',null);

			if($data['is_top']==1){
                $data['top_time']= time();
            }else{
                $data['top_time']= null;
            }

			$res = FileDownloadService::setTop($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}
    /*end*/



}

