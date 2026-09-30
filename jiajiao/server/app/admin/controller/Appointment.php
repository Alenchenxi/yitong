<?php 
/*
 module:		预约
 create_time:	2023-05-16 14:11:10
 author:		
 contact:		
*/

namespace app\admin\controller;

use app\admin\service\AppointmentService;
use app\admin\model\Appointment as AppointmentModel;
use think\facade\Db;

class Appointment extends Admin {


	/*首页数据列表*/
	function index(){
		if (!$this->request->isAjax()){
			return view('index');
		}else{
			$limit  = $this->request->post('limit', 20, 'intval');
			$offset = $this->request->post('offset', 0, 'intval');
			$page   = floor($offset / $limit) +1 ;

			$where = [];
			$where['a.teacher_mobile'] = ['like',$this->request->param('teacher_mobile', '', 'serach_in')];
			$where['a.demand_id'] = $this->request->param('demand_id', '', 'serach_in');
			$where['a.stu_mobile'] = ['like',$this->request->param('stu_mobile', '', 'serach_in')];

			$create_time_start = $this->request->param('create_time_start', '', 'serach_in');
			$create_time_end = $this->request->param('create_time_end', '', 'serach_in');

			$where['a.create_time'] = ['between',[strtotime($create_time_start),strtotime($create_time_end)]];
			$where['a.sn'] = ['like',$this->request->param('sn', '', 'serach_in')];
			$where['a.status'] = $this->request->param('status', '', 'serach_in');

			$order  = $this->request->post('order', '', 'serach_in');	//排序字段 bootstrap-table 传入
			$sort  = $this->request->post('sort', '', 'serach_in');		//排序方式 desc 或 asc

			$field = '';
			$orderby = ($sort && $order) ? $sort.' '.$order : 'appointment_id desc';

			$sql = 'select a.*,b.province,b.city,b.area,b.address from cd_appointment a left join cd_demand b on a.demand_id=b.demand_id';
			$limit = ($page-1) * $limit.','.$limit;
			$res = \xhadmin\CommonService::loadList($sql,formatWhere($where),$limit,$orderby);
			return json($res);
		}
	}

	/*添加*/
	function add(){
		if (!$this->request->isPost()){
			return view('add');
		}else{
			$postField = 'mid,teacher_id,create_time,demand_id,teacher_name,teacher_mobile,teacher_wechat,stu_name,stu_mobile,grade_id,grade_name,subject_id,subject_name,status,sn,amount,pay_time';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = AppointmentService::add($data);
			return json(['status'=>'00','msg'=>'添加成功']);
		}
	}

	/*修改*/
	function update(){
		if (!$this->request->isPost()){
			$appointment_id = $this->request->get('appointment_id','','serach_in');
			if(!$appointment_id) $this->error('参数错误');
			$this->view->assign('info',checkData(AppointmentModel::find($appointment_id)));
			return view('update');
		}else{
			$postField = 'appointment_id,mid,teacher_id,create_time,demand_id,teacher_name,teacher_mobile,teacher_wechat,stu_name,stu_mobile,grade_id,grade_name,subject_id,subject_name,status,sn,amount,pay_time';
			$data = $this->request->only(explode(',',$postField),'post',null);
			$res = AppointmentService::update($data);
			return json(['status'=>'00','msg'=>'修改成功']);
		}
	}

	/*删除*/
	function delete(){
		$idx =  $this->request->post('appointment_id', '', 'serach_in');
		if(!$idx) $this->error('参数错误');
		try{
			AppointmentModel::destroy(['appointment_id'=>explode(',',$idx)],true);
		}catch(\Exception $e){
			abort(config('my.error_log_code'),$e->getMessage());
		}
		return json(['status'=>'00','msg'=>'操作成功']);
	}



}

