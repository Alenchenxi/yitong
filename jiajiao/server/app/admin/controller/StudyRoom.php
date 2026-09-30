<?php 
/*
 module:		自习室
 create_time:	2022-10-21 10:55:19
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\StudyRoomService;
use app\admin\model\StudyRoom as StudyRoomModel;
use think\facade\Db;

class StudyRoom extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['province'] = $this->request->param('province', '', 'serach_in');
			$where['city'] = $this->request->param('city', '', 'serach_in');
			$where['area'] = $this->request->param('area', '', 'serach_in');
			$where['linkman'] = ['like',$this->request->param('linkman', '', 'serach_in')];
			$where['mobile'] = ['like',$this->request->param('mobile', '', 'serach_in')];

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = 'study_room_id,province,city,area,address,linkman,mobile,price';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'study_room_id desc';

			$res = StudyRoomService::indexList(formatWhere($where),$field,$orderby,$limit,$page);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'province,city,area,address,longitude,latitude,linkman,mobile,price';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = StudyRoomService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$study_room_id = $this->request->get('study_room_id','','serach_in');
			if(!$study_room_id) $this->error('参数错误');
			$this->view->assign('info',checkData(StudyRoomModel::find($study_room_id)));
			return view('update');
		}else{
			$postField = 'study_room_id,province,city,area,address,longitude,latitude,linkman,mobile,price';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = StudyRoomService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('study_room_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			StudyRoomModel::destroy(['study_room_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

